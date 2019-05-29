/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const sdkUtils = require('./utils.js');
const clientUtils = require('./client-utils.js');

const api = require('./api.js');
const BaseClient = require('./BaseClient.js');
const User = require('./User.js');
const Channel = require('./Channel.js');
const Package = require('./Package.js');
const Peer = require('./Peer.js');
const ChannelEventHub = require('./ChannelEventHub');
const Orderer = require('./Orderer.js');
const TransactionID = require('./TransactionID.js');
const {Signer, SigningIdentity} = require('./msp/identity.js');
const crypto = require('crypto');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const Constants = require('./Constants.js');

const ProtoLoader = require('./ProtoLoader');
const _commonProto = ProtoLoader.load(__dirname + '/protos/common/common.proto').common;
const _configtxProto = ProtoLoader.load(__dirname + '/protos/common/configtx.proto').common;
const _queryProto = ProtoLoader.load(__dirname + '/protos/peer/query.proto').protos;

const config = sdkUtils.getConfig();
// setup the location of the default config shipped with code
const default_config = path.resolve(__dirname, '../config/default.json');
config.reorderFileStores(default_config); // make sure this default has precedences
// set default SSL ciphers for gRPC
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

const logger = sdkUtils.getLogger('Client.js');

/**
 * A client instance provides the main API surface to interact with a network of
 * peers and orderers. An application using the SDK may need to interact with
 * multiple networks, each through a separate instance of the Client.
 * <br><br>
 * An important aspect of the current design of the Client class is that it is <b>stateful</b>.
 * An instance must be configured with a <code>userContext</code> before it can be used to talk to the fabric
 * backend. A userContext is an instance of the {@link User} class, which encapsulates the ability to sign
 * requests. If the SDK is used in a multi-user environment, there are two recommended techniques to manage
 * the authenticated users and instances of clients.
 * <li>Use a dedicated client instance per authenticated user. Create a new instance for each authenticated user.
 *     You can enroll each authenticated user separately so that each user gets its own signing identity.
 * <li>Use a shared client instance and a common signing identity among authenticated users.
 * <br><br>
 * It is important to understand that switching userContexts with the same client instance is considered an
 * anti-pattern. This is the direct result of the stateful design. A JIRA work item has been opened to discuss
 * adding support for stateless usage of the SDK: [FAB-4563]{@link https://jira.hyperledger.org/browse/FAB-4563}
 * <br><br>
 * The client also supports persistence via a <code>stateStore</code>. A state store is a simple storage plugin
 * that implements the {@link module:api.KeyValueStore} interface, which helps the SDK save critical information
 * to be used across server restarts/crashes. Out of the box, the SDK saves the signing identities (instances of
 * the {@link User} class) in the state store.
 *
 * @class
 * @extends BaseClient
 *
 */
const Client = class extends BaseClient {

	constructor() {
		super();
		this._clientConfigMspid = null; // MSP ID of the organization specified in the client section of the connection profile

		this._stateStore = null;
		this._userContext = null;

		// common connection profile
		this._network_config = null;

		// keep a collection of MSP's
		this._msps = new Map();

		// Is in dev mode or network mode
		this._devMode = false;

		// When using a common connection profile there may be
		// an admin defined for the current user's organization.
		// This will get set during the setUserFromConfig
		this._adminSigningIdentity = null;

		// When using a common connection profile (connection profile) the client
		// side mutual tls cert and key must be stored here
		//  -- also store the hash after computing
		this._tls_mutual = {};

		this._organizations = new Map();
		this._certificateAuthorities = new Map();
		this._channels = new Map();

		// connection settings
		this._connection_options = {};
	}

	/**
	 * Load a common connection profile object or load a JSON file and return a Client object.
	 *
	 * @param {object | string} loadConfig - This may be the config object or a path to the configuration file
	 * @return {Client} An instance of this class initialized with the network end points.
	 */
	static loadFromConfig(loadConfig) {
		const client = new Client();
		client.loadFromConfig(loadConfig);
		return client;
	}

	/**
	 * Load a common connection profile object or load a JSON file and update this client with
	 * any values in the config.
	 *
	 * @param {object | string} config - This may be the config object or a path to the configuration file
	 */
	loadFromConfig(loadConfig) {
		const additional_network_config = _getNetworkConfig(loadConfig, this);
		if (!this._network_config) {
			this._network_config = additional_network_config;
		} else {
			this._network_config.mergeSettings(additional_network_config);
		}
		if (this._network_config.hasClient()) {
			this._setAdminFromConfig();
			this._setMspidFromConfig();
			this._addConnectionOptionsFromConfig();
		}
	}

	/**
	 * Sets the mutual TLS client side certificate and key necessary to build
	 * network endpoints when working with a common connection profile (connection profile).
	 * This must be called before a peer, orderer, or channel eventhub is needed.
	 *
	 * If the tls client material has not been provided for the client, it will be
	 * generated if the user has been assigned to this client. Note that it will
	 * always use the default software cryptosuite, not the one assigned to the
	 * client.

	 *
	 * @param {string} clientCert - The pem encoded client certificate.
	 * @param {byte[]} clientKey - The client key.
	 */
	setTlsClientCertAndKey(clientCert, clientKey) {
		logger.debug('setTlsClientCertAndKey - start');
		if (clientCert && clientKey) {
			this._tls_mutual.clientCert = clientCert;
			this._tls_mutual.clientKey = clientKey;
			this._tls_mutual.clientCertHash = null;
			this._tls_mutual.selfGenerated = false;
		} else {
			if (this._userContext) {
				logger.debug('setTlsClientCertAndKey - generating self-signed TLS client certificate');
				// generate X509 cert pair
				// use the default software cryptosuite, not the client assigned cryptosuite, which may be
				// HSM, or the default has been set to HSM. FABN-830
				const key = Client.newCryptoSuite({software: true}).generateEphemeralKey();
				this._tls_mutual.clientKey = key.toBytes();
				this._tls_mutual.clientCert = key.generateX509Certificate(this._userContext.getName());
				this._tls_mutual.selfGenerated = true;
			}
		}

	}

	/**
	 * Utility method to add the mutual tls client material to a set of options.
	 * @param {object} opts - The options object holding the connection settings
	 *        that will be updated with the mutual TLS clientCert and clientKey.
	 * @throws Will throw an error if generating the tls client material fails
	 */
	addTlsClientCertAndKey(opts) {
		// use client cert pair if it exists and is not a self cert generated by this class
		if (!this._tls_mutual.selfGenerated && this._tls_mutual.clientCert && this._tls_mutual.clientKey) {
			opts.clientCert = this._tls_mutual.clientCert;
			opts.clientKey = this._tls_mutual.clientKey;
		}
	}

	/**
	 * Utility method to merge connection options into a set of options and
	 * return a new options object.
	 * The client's options and default connection options will not override any passed settings by
	 * the same name, these will only be added as new settings to the
	 * application's options being passed in. see {@link Client#addConnectionOptions}
	 * for how this client will have connection options to merge.
	 *
	 * @param {object} options - The object holding the application options
	 *        that will be merged on top of this client's options.
	 * @returns {object} - The object holding both the application's options
	 *          and this client's options.
	 */
	buildConnectionOptions(options) {
		const method = 'getConnectionOptions';
		logger.debug('%s - start', method);
		let return_options = Object.assign({}, Client.getConfigSetting('connection-options'));
		return_options = Object.assign(return_options, this._connection_options);
		return_options = Object.assign(return_options, this._getLegacyOptions()); // keep for a while legacy options
		return_options = Object.assign(return_options, options);

		if (!return_options.clientCert) {
			this.addTlsClientCertAndKey(return_options);
		}

		return return_options;
	}

	// @deprecated
	// Deprecated, but keep for a while for backward compatibility. Code is moved here from Remote.js;
	_getLegacyOptions() {
		const MAX_SEND = 'grpc.max_send_message_length';
		const MAX_RECEIVE = 'grpc.max_receive_message_length';
		const MAX_SEND_V10 = 'grpc-max-send-message-length';
		const MAX_RECEIVE_V10 = 'grpc-max-receive-message-length';
		const LEGACY_WARN_MESSAGE = 'Setting grpc options by utils.setConfigSetting() is deprecated. Use utils.g(s)etConfigSetting("connection-options")';
		const result = {};

		if (typeof sdkUtils.getConfigSetting(MAX_RECEIVE) !== 'undefined') {
			Object.assign(result, {[MAX_RECEIVE]: sdkUtils.getConfigSetting(MAX_RECEIVE)});
		}
		if (typeof sdkUtils.getConfigSetting(MAX_RECEIVE_V10) !== 'undefined') {
			Object.assign(result, {[MAX_RECEIVE]: sdkUtils.getConfigSetting(MAX_RECEIVE_V10)});
		}
		if (typeof sdkUtils.getConfigSetting(MAX_SEND) !== 'undefined') {
			Object.assign(result, {[MAX_SEND]: sdkUtils.getConfigSetting(MAX_SEND)});
		}
		if (typeof sdkUtils.getConfigSetting(MAX_SEND_V10) !== 'undefined') {
			Object.assign(result, {[MAX_SEND]: sdkUtils.getConfigSetting(MAX_SEND_V10)});
		}
		if (Object.keys(result).length > 0) {
			logger.warn(LEGACY_WARN_MESSAGE);
		}
		return result;
	}

	/**
	 * Add a set of connection options to this client. These will be
	 * available to be merged into an application's options when new
	 * peers and orderers are created or when a channel
	 * uses discovery to automatically create the peers and orderers on
	 * the channel. This would be a convenient place to store common GRPC settings
	 * that affect all connections from this client.
	 * These settings will be used when this client object builds new
	 * {@link Peer} or {@link Orderer} instances when the {@link Client#newPeer},
	 * {@link Client#getPeer}, {@link Client#newOrderer} or {@link Client#getOrderer}
	 * methods are called.
	 * Options will be automatically added when loading a common connection profile
	 * and the client section has the 'connection' section with an 'options' attribute.
	 * Default connection options will be initially loaded from the system configuration
	 * 'connection-options' setting.
	 *
	 * @param {object} options - The connection options that will be added to
	 *        this client instance.
	 */
	addConnectionOptions(options) {
		if (options) {
			this._connection_options = Object.assign(this._connection_options, options);
		}
	}

	/**
	 * Determine if the fabric backend is started in
	 * [development mode]{@link http://hyperledger-fabric.readthedocs.io/en/latest/chaincode4ade.html?highlight=develop%20mode#testing-using-dev-mode}.
	 * In development mode, the endorsing peers will not attempt to spin up a docker instance to run
	 * the target chaincode requested by a transaction proposal, but instead redirect the invocation
	 * requests to the chaincode process that has registered itself with the endorsing peer. This makes
	 * it easier to test changes to the chaincode during chaincode development.
	 * <br><br>
	 * The client instance can be set to dev mode to reflect the backend's development mode. This will
	 * cause the SDK to make adjustments in certain behaviors such as not sending the chaincode package
	 * to the peers during chaincode install.
	 */
	isDevMode() {
		return this._devMode;
	}

	/**
	 * Set dev mode to true or false to reflect the mode of the fabric backend. See {@link Client#isDevMode} for details.
	 * @param {boolean} devMode
	 */
	setDevMode(devMode) {
		this._devMode = devMode;
	}

	/**
	 * Returns a {@link Channel} instance with the given name. This represents a channel and its associated ledger.
	 *
	 * @param {string} name The name of the channel.  Recommend using namespaces to avoid collision.
	 * @returns {Channel} The uninitialized channel instance.
	 */
	newChannel(name) {
		if (this._channels.get(name)) {
			throw new Error(`Channel ${name} already exists`);
		}
		const channel = new Channel(name, this);
		this._channels.set(name, channel);
		return channel;
	}

	/**
	 * Get a {@link Channel} instance from the client instance. This is a memory-only lookup.
	 * If the loaded common connection profile has a channel by the 'name', a new channel instance
	 * will be created and populated with {@link Orderer} objects and {@link Peer} objects
	 * as defined in the common connection profile.
	 *
	 * @param {string} name - Optional. The name of the channel. When omitted the
	 *        first channel defined in the loaded common connection profile will be
	 *        returned
	 * @param {boolean} throwError - Indicates if this method will throw an error
	 *        if the channel is not found. Default is true.
	 * @returns {Channel} The channel instance
	 */
	getChannel(name, throwError = true) {
		let channel;
		if (name) {
			channel = this._channels.get(name);
		} else if (this._channels.size > 0) {
			// not sure it's deterministic which channel would be returned if more than 1.
			channel = this._channels.values().next().value;
		}

		if (channel) {
			return channel;
		}

		// maybe it is defined in the network
		if (this._network_config) {
			if (!name) {
				const channel_names = Object.keys(this._network_config._network_config.channels);
				name = channel_names[0];
			}
			if (name) {
				channel = this._network_config.getChannel(name);
			}
		}
		if (channel) {
			this._channels.set(name, channel);
			return channel;
		}

		const errorMessage = `Channel not found for name ${name}`;
		if (throwError) {
			logger.error(errorMessage);
			throw new Error(errorMessage);
		} else {
			logger.debug(errorMessage);
			return null;
		}
	}

	/**
	 * @typedef {Object} ConnectionOpts
	 * @property {string} name - Optional. To gives this remote endpoint a name.
	 *           The endpoint will be known by its URL if no name is provided.
	 * @property {string} request-timeout - An integer value in milliseconds to
	 *    be used as maximum amount of time to wait on the request to respond.
	 * @property {string} pem - The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * @property {string} ssl-target-name-override - Used in test environment only,
	 *    when the server certificate's hostname (in the 'CN' field) does not match
	 *    the actual host endpoint that the server process runs at, the application
	 *    can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * @property {any} &lt;any&gt; - any other standard grpc call options will be passed to the grpc service calls directly
	 */

	/**
	 * Returns a {@link Peer} object with the given url and opts. A peer object
	 * encapsulates the properties of an endorsing peer and the interactions with it
	 * via the grpc service API. Peer objects are used by the {@link Client} objects to
	 * send channel-agnostic requests such as installing chaincode, querying peers for
	 * installed chaincodes, etc. They are also used by the {@link Channel} objects to
	 * send channel-aware requests such as instantiating chaincodes, and invoking
	 * transactions.
	 *
	 * This method will return a new {@link Peer} object.
	 *
	 * @param {string} url - The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts - The options for the connection to the peer.
	 * @returns {Peer} The Peer instance.
	 */
	newPeer(url, opts) {
		return new Peer(url, this.buildConnectionOptions(opts));
	}

	/**
	 * This method will create a {@link Peer} instance. This method is only able to
	 * create an instance of a peer if there is a loaded connection profile that
	 * contains a peer with the name.
	 *
	 * @param {string} name - The name of the peer
	 * @returns {Peer} The Peer instance.
	 */
	getPeer(name) {
		let peer = null;
		if (this._network_config) {
			peer = this._network_config.getPeer(name);
		}
		if (!peer) {
			throw new Error('Peer with name:' + name + ' not found');
		}

		return peer;
	}

	/**
	 * Returns a list of {@link Peer} for the mspid of an organization as defined
	 * in the currently loaded common connection profile. If no id is
	 * provided then the organization named in the currently active network
	 * configuration's client section will be used.
	 *
	 * @param {string} mspid - Optional - The mspid of an organization
	 * @returns {Peer[]} An array of Peer instances that are defined for this organization
	 */
	getPeersForOrg(mspid) {
		let _mspid = mspid;
		if (!mspid) {
			_mspid = this.getMspid();
		}
		if (_mspid && this._network_config) {
			const organization = this._network_config.getOrganizationByMspId(_mspid);
			if (organization) {
				return organization.getPeers();
			}
		}

		return [];
	}

	/**
	 * Returns an {@link Orderer} object with the given url and opts. An orderer object
	 * encapsulates the properties of an orderer node and the interactions with it via
	 * the grpc stream API. Orderer objects are used by the {@link Client} objects to broadcast
	 * requests for creating and updating channels. They are used by the {@link Channel}
	 * objects to broadcast requests for ordering transactions.
	 *
	 * This method will create the orderer.
	 *
	 * @param {string} url The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts The options for the connection to the orderer.
	 * @returns {Orderer} The Orderer instance.
	 */
	newOrderer(url, opts) {
		return new Orderer(url, this.buildConnectionOptions(opts));
	}

	/**
	 * This method will create the {@link Orderer} if it does not exist and hold a
	 * reference to the instance object by name. This method is only able to
	 * create an instance of an orderer if there is a loaded connection profile that
	 * contains an orderer with the name. Orderers that have been created by the
	 * {@link newOrderer} method may be reference by the url if no name was provided
	 * in the options.
	 *
	 * @param {string} name - The name or url of the orderer
	 * @returns {Orderer} The Orderer instance.
	 */
	getOrderer(name) {
		let orderer = null;
		if (this._network_config) {
			orderer = this._network_config.getOrderer(name);
		}
		if (!orderer) {
			throw new Error('Orderer with name:' + name + ' not found');
		}

		return orderer;
	}

	/*
	 * Private utility method to get target peers. The peers will be in the organization of this client,
	 * (meaning the peer has the same mspid). If this client is not assigned a mspid, then all
	 * peers will be returned defined on the channel. The returned list may be empty if no channels
	 * are provide, a channel is not found on the list or channel does not have any peers defined.
	 *
	 * @param {string||string[]} channel_names channel name or array of channel names
	 * @returns {ChannelPeer[]} array of channel peers
	 * @private
	 */
	getPeersForOrgOnChannel(channel_names) {
		if (!Array.isArray(channel_names)) {
			channel_names = [channel_names];
		}
		const peers = [];
		const temp_peers = {};
		for (const i in channel_names) {
			const channel = this.getChannel(channel_names[i]);
			const channel_peers = channel.getPeersForOrg();
			for (const j in channel_peers) {
				const peer = channel_peers[j];
				temp_peers[peer.getName()] = peer; // will remove duplicates
			}
		}
		for (const name in temp_peers) {
			// TODO: Need to check the roles but cannot do so at present awaiting fix
			peers.push(temp_peers[name]);
		}
		return peers;
	}

	/**
	 * Returns a CertificateAuthority implementation as defined by the settings
	 * in the currently loaded common connection profile and the client configuration.
	 * A common connection profile must be loaded for this get method to return a
	 * Certificate Authority.
	 * A crypto suite must be assigned to this client instance. Running the
	 * 'initCredentialStores' method will build the stores and create a crypto
	 * suite as defined in the common connection profile.
	 *
	 * @param {string} name - Optional - the name of the Certificate Authority
	 *        defined in the loaded connection profile.
	 * @returns {CertificateAuthority}
	 */
	getCertificateAuthority(name) {
		if (!this._network_config) {
			throw new Error('No common connection profile has been loaded');
		}
		if (!this._cryptoSuite) {
			throw new Error('A crypto suite has not been assigned to this client');
		}
		let ca_info = null;

		if (name) {
			ca_info = this._network_config.getCertificateAuthority(name);
		} else {
			const client_config = this._network_config.getClientConfig();
			if (client_config && client_config.organization) {
				const organization_config = this._network_config.getOrganization(client_config.organization, true);
				if (organization_config) {
					const ca_infos = organization_config.getCertificateAuthorities();
					if (ca_infos.length > 0) {
						ca_info = ca_infos[0];
					}
				}
			}
		}

		if (ca_info) {
			const ca_service = this._buildCAfromConfig(ca_info);
			ca_info.setFabricCAServices(ca_service);
		} else {
			throw new Error('Common connection profile is missing this client\'s organization and certificate authority');
		}

		return ca_info;
	}

	/*
	  * utility method to build a ca from a connection profile ca settings
	  */
	_buildCAfromConfig(ca_info) {
		let tlsCACerts = ca_info.getTlsCACerts();
		if (tlsCACerts) {
			tlsCACerts = [tlsCACerts];
		} else {
			tlsCACerts = [];
		}
		const connection_options = ca_info.getConnectionOptions();
		let verify = true; // default if not found
		if (connection_options && typeof connection_options.verify === 'boolean') {
			verify = connection_options.verify;
		}
		const tls_options = {
			trustedRoots: tlsCACerts,
			verify
		};
		const ca_url = ca_info.getUrl();
		const ca_name = ca_info.getCaName();

		const ca_service_class = Client.getConfigSetting('certificate-authority-client');
		const ca_service_impl = require(ca_service_class);
		const ca_service = new ca_service_impl({
			url: ca_url,
			tlsOptions: tls_options,
			caName: ca_name,
			cryptoSuite: this._cryptoSuite
		});
		return ca_service;
	}

	/**
	 * Returns the "client" section of the common connection profile.
	 *
	 * @returns {object} The client section from the configuration
	 */
	getClientConfig() {
		if (this._network_config && this._network_config.hasClient()) {
			return this._network_config.getClientConfig();
		}
		return null;
	}

	/**
	 * Returns the mspid of the client. The mspid is also used as the
	 * reference to the organization.
	 *
	 * @returns {string} the mspid of the organization defined in the client
	 *          section of the loaded common connection profile
	 */
	getMspid() {
		const user = this._userContext;
		const identity = (user && user.getIdentity());
		return (identity && identity.getMSPId()) || this._clientConfigMspid;
	}


	/**
	 * Returns a new {@link TransactionID} object. Fabric transaction ids are constructed
	 * as a hash of a nonce concatenated with the signing identity's serialized bytes. The
	 * TransactionID object keeps the nonce and the resulting id string bundled together
	 * as a coherent pair.
	 * <br><br>
	 * This method requires the client instance to have been assigned a userContext.
	 * @param {boolean} admin - If true, this transactionID should be built based on the admin credentials
	 *                  Default is a non admin TransactionID based on the userContext.
	 * @returns {TransactionID} An object that contains a transaction id based on the
	 *           client's userContext and a randomly generated nonce value.
	 */
	newTransactionID(admin) {
		if (typeof admin !== 'undefined' && admin !== null) {
			if (typeof admin === 'boolean') {
				if (admin) {
					logger.debug('newTransactionID - getting an admin TransactionID');
				} else {
					logger.debug('newTransactionID - getting non admin TransactionID');
				}
			} else {
				throw new Error('"admin" parameter must be of type boolean');
			}
		} else {
			admin = false;
			logger.debug('newTransactionID - no admin parameter, returning non admin TransactionID');
		}
		return new TransactionID(this._getSigningIdentity(admin), admin);
	}

	/**
	 * Extracts the protobuf 'ConfigUpdate' object out of the 'ConfigEnvelope' object
	 * that is produced by the [configtxgen tool]{@link http://hyperledger-fabric.readthedocs.io/en/latest/configtxgen.html}.
	 * The returned object may then be signed using the signChannelConfig() method of this class. Once the all
	 * signatures have been collected, the 'ConfigUpdate' object and the signatures may be used
	 * on the [createChannel()]{@link Client#createChannel} or [updateChannel()]{@link Client#updateChannel} calls.
	 *
	 * @param {byte[]} config_envelope - The encoded bytes of the ConfigEnvelope protobuf
	 * @returns {byte[]} The encoded bytes of the ConfigUpdate protobuf, ready to be signed
	 */
	extractChannelConfig(config_envelope) {
		logger.debug('extractConfigUpdate - start');
		const envelope = _commonProto.Envelope.decode(config_envelope);
		const payload = _commonProto.Payload.decode(envelope.getPayload().toBuffer());
		const configtx = _configtxProto.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
		return configtx.getConfigUpdate().toBuffer();
	}

	/**
	 * @typedef {Object} ConfigSignature
	 * @property {byte[]} signature_header Encoded bytes of a {@link SignatureHeader}
	 * @property {byte[]} signature Encoded bytes of the signature over the concatenation
	 *          of the signatureHeader bytes and config bytes
	 */

	/**
	 * Channel configuration updates can be sent to the orderers to be processed. The
	 * orderer enforces the Channel creation or update policies such that the updates
	 * will be made only when enough signatures from participating organizations are
	 * discovered in the request. Typically channel creation or update requests must
	 * be signed by participating organizations' ADMIN principals, although this policy
	 * can be customized when the consortium is defined.
	 * <br><br>
	 * This method uses the client instance's current signing identity to sign over the
	 * configuration bytes passed in, and returns the signature that is ready to be
	 * included in the configuration update protobuf message to send to the orderer.
	 *
	 * @param {byte[]} loadConfig - The Configuration Update in byte form
	 * @return {ConfigSignature} - The signature of the current user on the config bytes
	 */
	signChannelConfig(loadConfig) {
		logger.debug('signChannelConfigUpdate - start');
		if (!loadConfig) {
			throw new Error('Channel configuration update parameter is required.');
		}
		if (!Buffer.isBuffer(loadConfig)) {
			throw new Error('Channel configuration update parameter is not in the correct form.');
		}
		// should try to use the admin signer if assigned
		// then use the assigned user
		const signer = this._getSigningIdentity(true);

		// signature is across a signature header and the config update
		const proto_signature_header = new _commonProto.SignatureHeader();
		proto_signature_header.setCreator(signer.serialize());
		proto_signature_header.setNonce(sdkUtils.getNonce());
		const signature_header_bytes = proto_signature_header.toBuffer();

		// get all the bytes to be signed together, then sign
		const signing_bytes = Buffer.concat([signature_header_bytes, loadConfig]);
		const sig = signer.sign(signing_bytes);
		const signature_bytes = Buffer.from(sig);

		// build the return object
		const proto_config_signature = new _configtxProto.ConfigSignature();
		proto_config_signature.setSignatureHeader(signature_header_bytes);
		proto_config_signature.setSignature(signature_bytes);

		return proto_config_signature;
	}

	/**
	 * @typedef {Object} ChannelRequest
	 * @property {string} name - Required. The name of the new channel
	 * @property {Orderer | string} orderer - Required. An Orderer object or an orderer name representing the
	 *                               orderer node to send the channel create request
	 * @property {byte[]} envelope - Optional. Bytes of the envelope object containing all
	 *                               required settings and signatures to initialize this channel. This envelope
	 *                               would have been created by the command line tool
	 *                               [configtxgen]{@link http://hyperledger-fabric.readthedocs.io/en/latest/configtxgen.html} or
	 *                               [configtxlator]{@link https://github.com/hyperledger/fabric/blob/master/examples/configtxupdate/README.md}
	 * @property {byte[]} config - Optional. Protobuf ConfigUpdate object extracted from a ConfigEnvelope
	 *                             created by the configtxgen tool. See [extractChannelConfig()]{@link Client#extractChannelConfig}.
	 *                             The ConfigUpdate object may also be created by the configtxlator tool.
	 * @property {ConfigSignature[] | string[]} signatures - Required. The list of signatures required by the
	 *                                                       channel creation or update policy when using the `config` parameter.
	 * @property {TransactionID} txId - Required. TransactionID object with the transaction id and nonce
	 */

	/**
	 * Calls the orderer to start building the new channel.
	 *
	 * A channel typically has more than one participating organizations. To create
	 * a new channel, one of the participating organizations should call this method
	 * to submit the creation request to the orderer service.
	 * <br><br>
	 * Once the channel is successfully created by the orderer, the next step is to
	 * have each organization's peer nodes join the channel, by sending the channel
	 * configuration to each of the peer nodes. The step is accomplished by calling the
	 * [joinChannel()]{@link Channel#joinChannel} method.
	 *
	 * @param {ChannelRequest} request - The request object.
	 * @returns {Promise} Promise for a result object with status on the acceptance of the create request
	 *                    by the orderer. Note that this is not the confirmation of successful creation
	 *                    of the channel. The client application must poll the orderer to discover whether
	 *                    the channel has been created completely or not.
	 */
	createChannel(request) {
		return this._createOrUpdateChannel(request, request && request.envelope);
	}

	/**
	 * Calls the orderer to update an existing channel.
	 *
	 * After the channel updates are successfully processed by the orderer, the orderer cuts a new
	 * block containing the new channel configuration and delivers it to all the participating peers
	 * in the channel.
	 *
	 * @param {ChannelRequest} request - The request object.
	 * @returns {Promise} Promise for a result object with status on the acceptance of the update request
	 *                    by the orderer. A channel update is finally completed when the new channel configuration
	 *                    block created by the orderer has been committed to the channel's peers. To be notified
	 *                    of the successful update of the channel, an application should use the {@link ChannelEventHub}
	 *                    to connect to the peers and register a block listener.
	 */
	updateChannel(request) {
		return this._createOrUpdateChannel(request, request && request.envelope);
	}

	/*
	 * internal method to support create or update of a channel
	 */
	async _createOrUpdateChannel(request, have_envelope) {
		logger.debug('_createOrUpdateChannel - start');
		if (!request) {
			throw new Error('Missing all required input request parameters for initialize channel');
		}
		if (!request.name) {
			// verify that we have the name of the new channel
			throw new Error('Missing name request parameter');
		}
		if (!request.txId) {
			throw Error('Missing txId request parameter');
		}
		const orderer = this.getTargetOrderer(request.orderer, null, request.name);

		let signature = null;
		let payload = null;
		if (have_envelope) {
			logger.debug('_createOrUpdateChannel - have envelope');
			const envelope = _commonProto.Envelope.decode(request.envelope);
			signature = envelope.signature;
			payload = envelope.payload;
		} else {
			// Verify that a config envelope or config has been included in the request object
			if (!request.config) {
				throw Error('Missing config request parameter containing the configuration of the channel');
			}
			if (!request.signatures) {
				throw Error('Missing signatures request parameter for the new channel');
			}
			if (!Array.isArray(request.signatures)) {
				throw Error('Signatures request parameter must be an array of signatures');
			}

			logger.debug('_createOrUpdateChannel - have config_update');
			const proto_config_Update_envelope = new _configtxProto.ConfigUpdateEnvelope();
			proto_config_Update_envelope.setConfigUpdate(request.config);
			const signatures = _stringToSignature(request.signatures);
			proto_config_Update_envelope.setSignatures(signatures);

			const proto_channel_header = clientUtils.buildChannelHeader(
				_commonProto.HeaderType.CONFIG_UPDATE,
				request.name,
				request.txId.getTransactionID()
			);

			const signer = this._getSigningIdentity(request.txId.isAdmin());

			const proto_header = clientUtils.buildHeader(signer, proto_channel_header, request.txId.getNonce());
			const proto_payload = new _commonProto.Payload();
			proto_payload.setHeader(proto_header);
			proto_payload.setData(proto_config_Update_envelope.toBuffer());
			const payload_bytes = proto_payload.toBuffer();

			const sig = signer.sign(payload_bytes);
			signature = Buffer.from(sig);
			payload = payload_bytes;
		}

		// building manually or will get protobuf errors on send
		const out_envelope = {
			signature: signature,
			payload: payload
		};

		logger.debug('_createOrUpdateChannel - about to send envelope');
		const results = await orderer.sendBroadcast(out_envelope);
		logger.debug('_createOrUpdateChannel - good results from broadcast :: %j', results);
		return results;
	}

	/**
	 * @typedef {Object} PeerQueryRequest
	 * @property {Peer | string} target - The {@link Peer} object or peer name to
	 *           use for the service discovery request
	 * @property {boolean} useAdmin - Optional. Indicates that the admin credentials
	 *           should be used in making this call to the peer. An administrative
	 *           identity must have been loaded by a connection profile or by
	 *           using the 'setAdminSigningIdentity' method.
	 */

	/**
	 * @typedef {Object} PeerQueryResponse
	 * @property {Object} peers_by_org
	 * @example
{
	"peers_by_org": {
		"Org1MSP": {
			"peers":[
				{"mspid":"Org1MSP", "endpoint":"peer0.org1.example.com:7051"}
			]
		},
		"Org2MSP": {
		"peers":[
				{"mspid":"Org2MSP","endpoint":"peer0.org2.example.com:8051"}
			]
		}
	}
}
	*/

	/**
	 * Queries the target peer for a list of {@link Peer} objects of all peers
	 * known by the target peer.
	 *
	 * @param {PeerQueryRequest} request - The request parameters.
	 * @returns {PeerQueryResponse} The list of peer information
	 */
	async queryPeers(request) {
		const method = 'queryPeers';
		logger.debug('%s - start', method);

		let targets = null;
		if (!request || !request.target) {
			throw Error('Target Peer is required');
		} else {
			targets = this.getTargetPeers(request.target);
			if (!targets || !targets[0]) {
				throw Error('Target Peer not found');
			}
		}

		try {
			const discover_request = {
				target: targets[0],
				local: true,
				config: false, // config only available on channel queries
				useAdmin: request.useAdmin
			};

			// create dummy channel just to use the discovery code
			// since channel does not exist only the local query will work
			const channel = new Channel('discover-peers', this);

			const discovery_results = await channel._discover(discover_request);

			return discovery_results;
		} catch (error) {
			logger.error(error);
			throw Error('Failed to discover local peers ::' + error.toString());
		}
	}

	/**
	 * @typedef {Object} ChannelQueryResponse
	 * @property {ChannelInfo[]} channels
	 */

	/**
	 * @typedef {Object} ChannelInfo
	 * @property {string} channel_id
	 */

	/**
	 * Queries the target peer for the names of all the channels that a
	 * peer has joined.
	 *
	 * @param {Peer} peer - The target peer to send the query
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials
	 *        should be used in making this call to the peer. An administrative
	 *        identity must have been loaded by common connection profile or by
	 *        using the 'setAdminSigningIdentity' method.
	 * @returns {Promise} A promise to return a {@link ChannelQueryResponse}
	 */
	async queryChannels(peer, useAdmin) {
		logger.debug('queryChannels - start');
		let targets = null;
		if (!peer) {
			throw Error('Peer is required');
		} else {
			targets = this.getTargetPeers(peer);
		}
		const signer = this._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.CSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetChannels',
			args: []
		};
		const results = await Channel.sendTransactionProposal(request, '' /* special channel id */, this);
		const responses = results[0];
		logger.debug('queryChannels - got response');
		if (responses && Array.isArray(responses)) {
			// will only be one response as we are only querying one peer
			if (responses.length > 1) {
				throw Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response) {
				logger.debug('queryChannels - response status :: %d', response.response.status);
				const queryTrans = _queryProto.ChannelQueryResponse.decode(response.response.payload);
				logger.debug('queryChannels - ProcessedTransaction.channelInfo.length :: %s', queryTrans.channels.length);
				for (const channel of queryTrans.channels) {
					logger.debug('>>> channel id %s ', channel.channel_id);
				}
				return queryTrans;
			}
			// no idea what we have, lets fail it and send it back
			throw Error(response);
		}
		throw Error('Payload results are missing from the query');
	}

	/**
	 * @typedef {Object} ChaincodeQueryResponse
	 * @property {ChaincodeInfo[]} chaincodes
	 */

	/**
	 * @typedef {Object} ChaincodeInfo
	 * @property {string} name
	 * @property {string} version
	 * @property {string} path - the path as specified by the install/instantiate transaction
	 * @property {string} input - the chaincode function upon instantiation and its arguments.
	 *                            This will be blank if the query is returning information about
	 *                            installed chaincodes.
	 * @property {string} escc - the name of the ESCC for this chaincode. This will be blank
	 *                           if the query is returning information about installed chaincodes.
	 * @property {string} vscc - the name of the VSCC for this chaincode. This will be blank
	 *                           if the query is returning information about installed chaincodes.
	 */

	/**
	 * Queries the installed chaincodes on a peer.
	 *
	 * @param {Peer} peer - The target peer
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials
	 *        should be used in making this call to the peer. An administrative
	 *        identity must have been loaded by common connection profile or by
	 *        using the 'setAdminSigningIdentity' method.
	 * @returns {Promise} Promise for a {@link ChaincodeQueryResponse} object
	 */
	async queryInstalledChaincodes(peer, useAdmin) {
		logger.debug('queryInstalledChaincodes - start peer %s', peer);
		let targets = null;
		if (!peer) {
			throw new Error('Peer is required');
		} else {
			targets = this.getTargetPeers(peer);
		}
		const signer = this._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.LSCC,
			txId: txId,
			signer: signer,
			fcn: 'getinstalledchaincodes',
			args: []
		};
		const results = await Channel.sendTransactionProposal(request, '' /* special channel id */, this);
		const responses = results[0];
		logger.debug('queryInstalledChaincodes - got response');
		if (responses && Array.isArray(responses)) {
			// will only be one response as we are only querying one peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response) {
				logger.debug('queryInstalledChaincodes - response status :: %d', response.response.status);
				const queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
				logger.debug('queryInstalledChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
				for (const chaincode of queryTrans.chaincodes) {
					logger.debug('>>> name %s, version %s, path %s', chaincode.name, chaincode.version, chaincode.path);
				}
				return queryTrans;
			}
			// no idea what we have, lets fail it and send it back
			throw response;
		}
		throw new Error('Payload results are missing from the query');
	}

	/**
	 * @typedef {Object} ChaincodeInstallRequest
	 * @property {Peer[] | string[]} targets - Optional. An array of Peer objects or peer names
	 *           where the chaincode will be installed. When excluded, the peers assigned
	 *           to this client's organization will be used as defined in the
	 *           common connection profile. If the 'channelNames' property is included,
	 *           the target peers will be based the peers defined in the channels.
	 * @property {string} chaincodePath - Required. The path to the location of
	 *           the source code of the chaincode. If the chaincode type is golang,
	 *           then this path is the fully qualified package name, such as
	 *           'mycompany.com/myproject/mypackage/mychaincode'
	 * @property {string} metadataPath - Optional. The path to the top-level
	 *           directory containing metadata descriptors.
	 * @property {string} chaincodeId - Required. Name of the chaincode
	 * @property {string} chaincodeVersion - Required. Version string of the
	 *           chaincode, such as 'v1'
	 * @property {byte[]} chaincodePackage - Optional. Byte array of the archive
	 *           content for the chaincode source. The archive must have a 'src'
	 *           folder containing subfolders corresponding to the 'chaincodePath'
	 *           field. For instance, if the chaincodePath is
	 *           'mycompany.com/myproject/mypackage/mychaincode',
	 *           then the archive must contain a
	 *           folder 'src/mycompany.com/myproject/mypackage/mychaincode',
	 *           where the chaincode source code resides.
	 * @property {string} chaincodeType - Optional. Type of chaincode. One of
	 *           'golang', 'car', 'node' or 'java'.
	 *           Default is 'golang'.
	 * @property {string[] | string} channelNames - Optional. When no targets are
	 *           provided. The loaded common connection profile will be searched for
	 *           suitable target peers. Peers that are defined in the channels named
	 *           by this property and in this client's organization and that are
	 *           in the endorsing or chain code query role on the named channel
	 *           will be selected.
	 * @property {TransactionID} txId - Optional. TransactionID object for this request.
	 */

	/**
	 * All calls to the endorsing peers for proposal endorsement return this
	 * standard array of objects.
	 *
	 * @typedef {array} ProposalResponseObject
	 * @property {Array.<(ProposalResponse|Error)>} index:0 - Array where each element is either a ProposalResponse
	 *           object (for a successful response from the endorsing peer) or an Error object (for an unsuccessful
	 *           peer response or runtime error).
	 * @property {Object} index:1 - The original Proposal object needed when
	 *           sending the transaction request to the orderer
	 */

	/**
	 * A chaincode must be installed to peers and instantiated on a channel
	 * before it can be called to process transactions.
	 * <br><br>
	 * Chaincode installation is simply uploading the chaincode source and
	 * dependencies to the peers. This operation is "channel-agnostic" and is
	 * performed on a peer-by-peer basis. Only the peer organization's ADMIN
	 * identities are allowed to perform this operation.
	 *
	 * @param {ChaincodeInstallRequest} request - The request object
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link ProposalResponseObject}
	 */
	async installChaincode(request, timeout) {
		try {
			logger.debug('installChaincode - start');

			// must provide a valid request object with:
			// chaincodePackage
			// -or-
			// chaincodeId, chaincodeVersion, and chaincodePath
			if (!request) {
				throw new Error('Missing input request object on install chaincode request');
			} else if (request.chaincodePackage) {
				logger.debug('installChaincode - installing chaincode package');
			} else if (!request.chaincodeId) {
				throw new Error('Missing "chaincodeId" parameter in the proposal request');
			} else if (!request.chaincodeVersion) {
				throw new Error('Missing "chaincodeVersion" parameter in the proposal request');
			} else if (!request.chaincodePath) {
				throw new Error('Missing "chaincodePath" parameter in the proposal request');
			}

			let peers = this.getTargetPeers(request.targets);
			if (!peers && request.channelNames) {
				peers = this.getPeersForOrgOnChannel(request.channelNames);
			}

			// Verify that a Peer has been added
			if (peers && peers.length > 0) {
				logger.debug(`installChaincode - found peers ::${peers.length}`);
			} else {
				throw new Error('Missing peer objects in install chaincode request');
			}

			let cdsBytes;
			if (request.chaincodePackage) {
				cdsBytes = request.chaincodePackage;
				logger.debug(`installChaincode - using specified chaincode package (${cdsBytes.length} bytes)`);
			} else if (this.isDevMode()) {
				cdsBytes = null;
				logger.debug('installChaincode - in dev mode, refusing to package chaincode');
			} else {
				const cdsPkg = await Package.fromDirectory({
					name: request.chaincodeId,
					version: request.chaincodeVersion,
					path: request.chaincodePath,
					type: request.chaincodeType,
					metadataPath: request.metadataPath
				});
				cdsBytes = await cdsPkg.toBuffer();
				logger.debug(`installChaincode - built chaincode package (${cdsBytes.length} bytes)`);
			}

			// TODO add ESCC/VSCC info here ??????
			const lcccSpec = {
				type: clientUtils.translateCCType(request.chaincodeType),
				chaincode_id: {
					name: Constants.LSCC
				},
				input: {
					args: [Buffer.from('install', 'utf8'), cdsBytes]
				}
			};

			let signer;
			let tx_id = request.txId;
			if (!tx_id) {
				signer = this._getSigningIdentity(true);
				tx_id = new TransactionID(signer, true);
			} else {
				signer = this._getSigningIdentity(tx_id.isAdmin());
			}

			const channelHeader = clientUtils.buildChannelHeader(
				_commonProto.HeaderType.ENDORSER_TRANSACTION,
				'', // install does not target a channel
				tx_id.getTransactionID(),
				null,
				Constants.LSCC
			);
			const header = clientUtils.buildHeader(signer, channelHeader, tx_id.getNonce());
			const proposal = clientUtils.buildProposal(lcccSpec, header);
			const signed_proposal = clientUtils.signProposal(signer, proposal);
			logger.debug('installChaincode - about to sendPeersProposal');
			const responses = await clientUtils.sendPeersProposal(peers, signed_proposal, timeout);
			return [responses, proposal];
		} catch (error) {
			logger.error(`installChaincode error ${error.message}`);
			throw error;
		}
	}

	/**
	 * Sets the state and crypto suite for use by this client.
	 * This requires that a common connection profile has been loaded. Will use the settings
	 * from the common connection profile along with the system configuration to build
	 * instances of the stores and assign them to this client and the crypto suites
	 * if needed.
	 *
	 * @returns {Promise} - A promise to build a key value store and crypto store.
	 */
	async initCredentialStores() {
		if (!this._network_config) {
			throw new Error('No common connection profile settings found');
		}
		const client_config = this._network_config.getClientConfig();
		if (client_config && client_config.credentialStore) {
			const key_value_store = await BaseClient.newDefaultKeyValueStore(client_config.credentialStore);
			this.setStateStore(key_value_store);
			const crypto_suite = BaseClient.newCryptoSuite();
			// all crypto suites should extends api.CryptoSuite
			crypto_suite.setCryptoKeyStore(BaseClient.newCryptoKeyStore(client_config.credentialStore.cryptoStore));
			this.setCryptoSuite(crypto_suite);
			return true;
		} else {
			throw new Error('No credentialStore settings found');
		}
	}

	/**
	 * Set an optional state store to persist application states. The state store must implement the
	 * {@link module:api.KeyValueStore} interface.
	 * <br><br>
	 * The SDK supports persisting the {@link User} objects so that the heavy-weight objects such as
	 * the certificate and private keys do not have to be passed in repeatedly. Out of the box the SDK
	 * provides a file-based implementation, and a CouchDB-based implementation, which also supports Cloudant.
	 * Applications can provide alternative implementations.
	 *
	 * @param {module:api.KeyValueStore} keyValueStore Instance of a KeyValueStore implementation
	 */
	setStateStore(keyValueStore) {
		let err = '';

		const methods = sdkUtils.getClassMethods(api.KeyValueStore);
		methods.forEach((m) => {
			if (typeof keyValueStore[m] !== 'function') {
				err += m + '() ';
			}
		});

		if (err !== '') {
			throw new Error('The "keyValueStore" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		this._stateStore = keyValueStore;
		// userContext invalid on state store change, set to null
		this._userContext = null;
	}

	/*
	 * Internal utility method to get an available {@link SigningIdentity}.
	 * Will return a SigningIdentity of either the admin for this organization
	 * if one has been assigned or the SigningIdentity of the currently assigned user.
	 * @param admin - To indicate would prefer the admin signer
	 *                Default is to return a non admin signer
	 * @returns {SigningIdentity} the signing identity object that encapsulates
	 *          the private key for signing
	 */
	_getSigningIdentity(admin) {
		logger.debug('_getSigningIdentity - admin parameter is %s :%s', (typeof admin), admin);
		if (admin && this._adminSigningIdentity) {
			return this._adminSigningIdentity;
		} else {
			if (this._userContext) {
				return this._userContext.getSigningIdentity();
			} else {
				throw new Error('No identity has been assigned to this client');
			}
		}
	}

	/**
	 * Set the admin signing identity object. This method will only assign a
	 * signing identity for use by this client instance and will not persist
	 * the identity.
	 * @param {string} private_key - the private key PEM string
	 * @param {string} certificate the PEM-encoded string of certificate
	 * @param {string} mspid The Member Service Provider id for the local signing identity
	 */
	setAdminSigningIdentity(private_key, certificate, mspid) {
		logger.debug('setAdminSigningIdentity - start mspid:%s', mspid);
		if (typeof private_key === 'undefined' || private_key === null || private_key === '') {
			throw new Error('Invalid parameter. Must have a valid private key.');
		}
		if (typeof certificate === 'undefined' || certificate === null || certificate === '') {
			throw new Error('Invalid parameter. Must have a valid certificate.');
		}
		if (typeof mspid === 'undefined' || mspid === null || mspid === '') {
			throw new Error('Invalid parameter. Must have a valid mspid.');
		}
		let crypto_suite = this.getCryptoSuite();
		if (!crypto_suite) {
			crypto_suite = BaseClient.newCryptoSuite();
		}
		const key = crypto_suite.importKey(private_key, {ephemeral: true});
		const public_key = crypto_suite.importKey(certificate, {ephemeral: true});

		this._adminSigningIdentity = new SigningIdentity(certificate, public_key, mspid, crypto_suite, new Signer(crypto_suite, key));
	}

	/*
	 * Utility method to set the admin signing identity object based on the current
	 * organization defined in the common connection profile. A common connection profile
	 * be must loaded that defines an organization for this client and have an
	 * admin credentials defined.
	 */
	_setAdminFromConfig() {
		let admin_key, admin_cert, mspid = null;
		if (!this._network_config) {
			throw new Error('No common connection profile has been loaded');
		}

		const client_config = this._network_config.getClientConfig();
		if (client_config && client_config.organization) {
			const organization_config = this._network_config.getOrganization(client_config.organization, true);
			if (organization_config) {
				mspid = organization_config.getMspid();
				admin_key = organization_config.getAdminPrivateKey();
				admin_cert = organization_config.getAdminCert();
			}
		}
		// if we found all we need then set the admin
		if (admin_key && admin_cert && mspid) {
			this.setAdminSigningIdentity(admin_key, admin_cert, mspid);
		}
	}

	/*
	 * Utility method to set the mspid from current common connection profile.
	 * A common connection profile be must loaded and defines both an organization
	 * and the client.
	 */
	_setMspidFromConfig() {
		if (!this._network_config) {
			throw new Error('No common connection profile has been loaded');
		}

		const client_config = this._network_config.getClientConfig();
		if (client_config && client_config.organization) {
			const organization_config = this._network_config.getOrganization(client_config.organization, true);
			if (organization_config) {
				this._clientConfigMspid = organization_config.getMspid();
			}
		}
	}

	/*
	 * Utility method to add connection options from the current common connection profile
	 * client section into this client.
	 */
	_addConnectionOptionsFromConfig() {
		if (!this._network_config) {
			throw new Error('No common connection profile has been loaded');
		}

		const client_config = this._network_config.getClientConfig();
		if (client_config && client_config.connection && client_config.connection.options) {
			this.addConnectionOptions(client_config.connection.options);
		}
	}

	/**
	 * Utility Method
	 * Sets the user context based on the passed in username and password
	 * and the organization in the client section of the common connection profile
	 * settings.
	 *
	 * @param {Object} opts - contains
	 *                  - username [required] - username of the user
	 *                  - password [optional] - password of the user
	 *                  - caName [optional] - name of the Certificate Authority
	 */
	async _setUserFromConfig(opts = {}) {
		if (!opts.username) {
			throw new Error('Missing parameter. Must have a username.');
		}
		if (!this._network_config || !this._stateStore || !this._cryptoSuite) {
			throw new Error('Client requires a common connection profile loaded, stores attached, and crypto suite.');
		}
		this._userContext = null;

		const user = await this.getUserContext(opts.username, true);
		if (user && user.isEnrolled()) {
			logger.debug('Successfully loaded member from persistence');
			return user;
		}

		if (!opts.password) {
			throw new Error('Missing parameter. Must have a password.');
		}

		let mspid = null;
		const client_config = this._network_config.getClientConfig();
		if (client_config && client_config.organization) {
			const organization_config = this._network_config.getOrganization(client_config.organization, true);
			if (organization_config) {
				mspid = organization_config.getMspid();
			}
		}
		if (!mspid) {
			throw new Error('Common connection profile is missing this client\'s organization and mspid');
		}
		const ca_service = this.getCertificateAuthority(opts.caName);

		const enrollment = await ca_service.enroll({
			enrollmentID: opts.username,
			enrollmentSecret: opts.password
		});
		logger.debug(`Successfully enrolled user "${opts.username}"`);

		const cryptoContent = {signedCertPEM: enrollment.certificate};
		let keyBytes = null;
		try {
			keyBytes = enrollment.key.toBytes();
		} catch (err) {
			logger.debug('Cannot access enrollment private key bytes');
		}
		if (keyBytes !== null && keyBytes.startsWith('-----BEGIN')) {
			cryptoContent.privateKeyPEM = keyBytes;
		} else {
			cryptoContent.privateKeyObj = enrollment.key;
		}
		return this.createUser(
			{
				username: opts.username,
				mspid: mspid,
				cryptoContent: cryptoContent
			});
	}

	/**
	 * Persist the current <code>userContext</code> to the key value store.
	 *
	 * @returns {Promise} A Promise for the userContext object upon successful persistence
	 */
	async saveUserToStateStore() {
		logger.debug(`saveUserToStateStore, userContext: ${this._userContext}`);

		if (!this._userContext) {
			logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
			throw new Error('Cannot save user to state store when userContext is null.');
		}
		if (!this._userContext._name) {
			logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext has no name.');
			throw new Error('Cannot save user to state store when userContext has no name.');
		}
		if (!this._stateStore) {
			logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when stateStore is null.');
			throw new Error('Cannot save user to state store when stateStore is null.');
		}

		logger.debug('saveUserToStateStore, begin promise stateStore.setValue');
		const result = await this._stateStore.setValue(this._userContext._name, this._userContext.toString());
		logger.debug(`saveUserToStateStore, store.setValue, result = ${result}`);
		return this._userContext;
	}

	/**
	 * An alternate object to use on the 'setUserContext' call in place of the 'User' object.
	 * When using this object it is assumed that the current 'Client' instance has been loaded
	 * with a common connection profile.
	 *
	 * @typedef {Object} UserNamePasswordObject
	 * @property {string} username - Required. A string representing the user name of the user
	 * @property {string} password - Optional. A string representing the password of the user
	 * @property {string} caName - Optional. A string representing the name of the Certificate Authority.
	 If not specified, will use the first Certificate Authority on the list.
	 */

	/**
	 * Sets an instance of the {@link User} class as the security context of this client instance. This user’s
	 * signing identity (the private key and its corresponding certificate), will be used to sign all requests
	 * with the fabric backend.
	 * <br><br>
	 * Upon setting the user context, the SDK saves the object in a persistence cache if the “state store”
	 * has been set on the Client instance. If no state store has been set, this cache will not be established
	 * and the application is responsible for setting the user context again if the application crashes and is recovered.
	 *
	 * @param {User | UserNamePasswordObject} user - An instance of the User class encapsulating the authenticated
	 *                      user’s signing materials (private key and enrollment certificate).
	 *                      The parameter may also be a {@link UserNamePasswordObject} that contains the username
	 *                      and optionally the password and caName. A common connection profile must has been loaded to use the
	 *                      {@link UserNamePasswordObject} which will also create the user context and set it on
	 *                      this client instance. The created user context will be based on the current network
	 *                      configuration( i.e. the current organization's CA, current persistence stores).
	 * @param {boolean} skipPersistence - Whether to skip saving the user object into persistence. Default is false and the
	 *                                    method will attempt to save the user object to the state store. When using a
	 *                                    common connection profile and {@link UserNamePasswordObject}, the user object will
	 *                                    always be stored to the persistence store.
	 * @returns {Promise} Promise of the 'user' object upon successful persistence of the user to the state store
	 */
	async setUserContext(user, skipPersistence) {
		logger.debug(`setUserContext - user: ${user}, skipPersistence: ${skipPersistence}`);
		if (!user) {
			logger.debug('setUserContext, Cannot save null userContext.');
			throw new Error('Cannot save null userContext.');
		}

		if (user && user.constructor && user.constructor.name === 'User') {
			this._userContext = user;
			if (!skipPersistence) {
				logger.debug('setUserContext - begin promise to saveUserToStateStore');
				return this.saveUserToStateStore();
			}
			logger.debug('setUserContext - resolved user');
			return user;
		}
		// must be they have passed in an object
		logger.debug('setUserContext - will try to use common connection profile to set the user');
		return this._setUserFromConfig(user);
	}

	/**
	 * Returns the user by the given name. This can be a synchronous call or asynchronous call, depending
	 * on whether "checkPersistent" is truthy or not. If truthy, the method is asynchronous and returns a Promise,
	 * otherwise it's synchronous.
	 *
	 * As explained above, the client instance can have an optional state store. The SDK saves enrolled users
	 * in the storage which can be accessed by authorized users of the application (authentication is done by
	 * the application outside of the SDK). This function attempts to load the user by name from the local storage
	 * (via the KeyValueStore interface). The loaded user object must represent an enrolled user with a valid
	 * enrollment certificate signed by a trusted CA (such as the CA server).
	 *
	 * @param {string} name - Optional. If not specified, will only return the current in-memory user context object, or null
	 *                        if none has been set. If "name" is specified, will also attempt to load it from the state store
	 *                        if search in memory failed.
	 * @param {boolean} checkPersistence - Optional. If specified and truthy, the method returns a Promise and will
	 *                                     attempt to check the state store for the requested user by the "name". If not
	 *                                     specified or falsey, the method is synchronous and returns the requested user from memory
	 * @returns {Promise<User>} Promise for the user object corresponding to the name, or null if the user does not exist or if the
	 *                           state store has not been set.
	 */
	async getUserContext(name, checkPersistence) {
		// first check if only one param is passed in for "checkPersistence"
		if (typeof name === 'boolean' && name && typeof checkPersistence === 'undefined') {
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is undefined');
		}

		if (typeof checkPersistence === 'boolean' && checkPersistence &&
			(typeof name !== 'string' || name === null || name === '')) {
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');
		}

		const username = name;
		if ((this._userContext && name && this._userContext.getName() === name) || (this._userContext && !name)) {
			return this._userContext;
		} else {
			if (!username) {
				return null;
			}

			// this could be because the application has not set a user context yet for this client, which would
			// be an error condition, or it could be that this app has crashed before and is recovering, so we
			// should allow the previously saved user context object to be deserialized

			// first check if there is a user context of the specified name in persistence
			if (typeof checkPersistence === 'boolean' && checkPersistence) {
				if (!this._stateStore) {
					// we don't have it in memory or persistence, just return null
					return null;
				}
				const userContext = await this.loadUserFromStateStore(username);

				if (userContext) {
					logger.debug(`Requested user "${name}" loaded successfully from the state store on this Client instance`);
					return this.setUserContext(userContext, true); // skipPersistence as we just got it from there
				} else {
					logger.debug(`Requested user "${name}" not loaded from the state store on this Client instance`);
					return null;
				}
			} else {
				return null;
			}
		}
	}

	/**
	 * Restore the state of the {@link User} by the given name from the key value store (if found).  If not found, return null.
	 *
	 * @param {string} name - Name of the user
	 * @returns {Promise} A Promise for a {User} object upon successful restore, or if the user by the name
	 *                    does not exist in the state store, returns null without rejecting the promise
	 */
	async loadUserFromStateStore(name) {
		const memberStr = await this._stateStore.getValue(name);
		if (!memberStr) {
			logger.debug(`Failed to find "${name}" in local key value store`);
			return null;
		}

		// The member was found in the key value store, so restore the state.
		const newUser = new User(name);
		if (!this.getCryptoSuite()) {
			logger.debug('loadUserFromStateStore, cryptoSuite is not set, will load using defaults');
		}
		newUser.setCryptoSuite(this.getCryptoSuite());
		const data = await newUser.fromString(memberStr, true);
		if (!data) {
			logger.debug(`Failed to load user "${name}" from local key value store`);
			return null;
		}
		logger.debug(`Successfully load user "${name}" from local key value store`);
		return data;
	}

	/**
	 * A convenience method for obtaining the state store object in use by this client.
	 *
	 * @return {module:api.KeyValueStore} The KeyValueStore implementation object set on this Client, or null if one has not been set.
	 */
	getStateStore() {
		return this._stateStore;
	}

	/**
	 * @typedef {Object} UserOpts
	 * @property {string} username - the user name used for enrollment
	 * @property {string} mspid - the MSP id
	 * @property {CryptoContent} cryptoContent - the private key and certificate
	 * @property {boolean} skipPersistence - whether to save this new user object into persistence.
	 */

	/**
	 * @typedef {Object} CryptoContent
	 * @property {string} privateKey - the PEM file path for the private key
	 * @property {string} privateKeyPEM - the PEM string for the private key (not required if privateKey or privateKeyObj is set)
	 * @property {module:api.Key} privateKeyObj - private key object (not required if privateKey or privateKeyPEM is set)
	 * @property {string} signedCert - the PEM file path for the certificate
	 * @property {string} signedCertPEM - the PEM string for the certificate (not required if signedCert is set)
	 */

	/**
	 * Returns a {@link User} object with signing identities based on the
	 * private key and the corresponding x509 certificate. This allows applications
	 * to use pre-existing crypto materials (private keys and certificates) to
	 * construct user objects with signing capabilities, as an alternative to
	 * dynamically enrolling users with [fabric-ca]{@link http://hyperledger-fabric-ca.readthedocs.io/en/latest/}
	 * <br><br>
	 * Note that upon successful creation of the new user object, it is set to
	 * the client instance as the current <code>userContext</code>.
	 *
	 * @param {UserOpts} opts - Essential information about the user
	 * @returns {Promise} Promise for the user object.
	 */
	async createUser(opts) {
		logger.debug('opts = %j', opts);
		if (!opts) {
			throw new Error('Client.createUser missing required \'opts\' parameter.');
		}
		if (!opts.username || opts.username.length < 1) {
			throw new Error('Client.createUser parameter \'opts username\' is required.');
		}
		if (!opts.mspid || opts.mspid.length < 1) {
			throw new Error('Client.createUser parameter \'opts mspid\' is required.');
		}
		if (opts.cryptoContent) {
			if (!opts.cryptoContent.privateKey && !opts.cryptoContent.privateKeyPEM && !opts.cryptoContent.privateKeyObj) {
				throw new Error('Client.createUser one of \'opts cryptoContent privateKey, privateKeyPEM or privateKeyObj\' is required.');
			}
			if (!opts.cryptoContent.signedCert && !opts.cryptoContent.signedCertPEM) {
				throw new Error('Client.createUser either \'opts cryptoContent signedCert or signedCertPEM\' is required.');
			}
		} else {
			throw new Error('Client.createUser parameter \'opts cryptoContent\' is required.');
		}

		if (this.getCryptoSuite() === null) {
			logger.debug('cryptoSuite is null, creating default cryptoSuite and cryptoKeyStore');
			this.setCryptoSuite(sdkUtils.newCryptoSuite());
			this.getCryptoSuite().setCryptoKeyStore(Client.newCryptoKeyStore()); // This is impossible
		} else {
			if (this.getCryptoSuite()._cryptoKeyStore) {
				logger.debug('cryptoSuite has a cryptoKeyStore');
			} else {
				logger.debug('cryptoSuite does not have a cryptoKeyStore');
			}
		}

		// need to load private key and pre-enrolled certificate from files based on the MSP
		// root MSP config directory structure:
		// <config>
		//    \_ keystore
		//       \_ admin.pem  <<== this is the private key saved in PEM file
		//    \_ signcerts
		//       \_ admin.pem  <<== this is the signed certificate saved in PEM file

		// first load the private key and save in the BCCSP's key store

		let importedKey;
		const user = new User(opts.username);
		let privateKeyPEM = opts.cryptoContent.privateKeyPEM;
		if (opts.cryptoContent.privateKey) {
			privateKeyPEM = await readFile(opts.cryptoContent.privateKey);
		}
		if (privateKeyPEM) {
			logger.debug('then privateKeyPEM data');
			if (opts.skipPersistence) {
				importedKey = await this.getCryptoSuite().importKey(privateKeyPEM.toString(), {ephemeral: true});
			} else {
				importedKey = await this.getCryptoSuite().importKey(privateKeyPEM.toString(), {ephemeral: !this.getCryptoSuite()._cryptoKeyStore});
			}
		} else {
			importedKey = opts.cryptoContent.privateKeyObj;
		}
		let signedCertPEM = opts.cryptoContent.signedCertPEM;
		if (opts.cryptoContent.signedCert) {
			signedCertPEM = await readFile(opts.cryptoContent.signedCert);
		}
		logger.debug('then signedCertPEM data');
		user.setCryptoSuite(this.getCryptoSuite());
		await user.setEnrollment(importedKey, signedCertPEM.toString(), opts.mspid, opts.skipPersistence);
		logger.debug('then setUserContext');
		await this.setUserContext(user, opts.skipPersistence);
		logger.debug('then user');
		return user;
	}

	/*
	 * utility method to get the peer targets
	 */
	getTargetPeers(request_targets) {
		logger.debug('%s - start', 'getTargetPeers');
		const targets = [];
		let targetsTemp = request_targets;
		if (request_targets) {
			if (!Array.isArray(request_targets)) {
				targetsTemp = [request_targets];
			}
			for (const target_peer of targetsTemp) {
				if (typeof target_peer === 'string') {
					targets.push(this.getPeer(target_peer));
				} else if (target_peer && target_peer.constructor && target_peer.constructor.name === 'Peer') {
					targets.push(target_peer);
				} else {
					throw new Error('Target peer is not a valid peer object instance');
				}
			}
		}

		if (targets.length > 0) {

			return targets;
		} else {

			return null;
		}
	}

	/*
	 * Utility method to get the orderer for the request
	 * Will find the orderer in this sequence:
	 *    if request_orderer is an object, will check that it is an orderer
	 *    if request_orderer is a string will look up in the common connection profile the orderer by that name
	 *    if channel_orderers is not null then this index 0 will be used
	 *    if channel_name is not null will look up the channel to see if there is an orderer defined in the
	 *        common connection profile
	 *    will throw an error in all cases if there is not a valid orderer to return
	 */
	getTargetOrderer(request_orderer, channel_orderers, channel_name) {
		logger.debug('%s - start', 'getTargetOrderer');
		let orderer = null;
		if (request_orderer) {
			if (typeof request_orderer === 'string') {
				orderer = this.getOrderer(request_orderer);
			} else if (request_orderer && request_orderer.constructor && request_orderer.constructor.name === 'Orderer') {
				orderer = request_orderer;
			} else {
				throw new Error('"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object.');
			}
		} else if (channel_orderers && Array.isArray(channel_orderers) && channel_orderers[0]) {
			orderer = channel_orderers[0];
		} else if (channel_name && this._network_config) {
			const temp_channel = this.getChannel(channel_name, false);
			if (temp_channel) {
				const temp_orderers = temp_channel.getOrderers();
				if (temp_orderers && temp_orderers.length > 0) {
					orderer = temp_orderers[0];
				} else {
					throw new Error('"orderer" request parameter is missing and there' + ' ' +
						'are no orderers defined on this channel in the common connection profile');
				}
			} else {
				throw new Error(util.format('Channel name %s was not found in the common connection profile', channel_name));
			}
		} else {
			throw new Error('Missing "orderer" request parameter');
		}

		return orderer;
	}

	/**
	 * Get the client certificate hash
	 * @param {boolean} create - Optional. Create the hash based on the current
	 *        user if the client cert has not been assigned to this client
	 * @returns {byte[]} The hash of the client certificate
	 */
	getClientCertHash(create) {
		const method = 'getClientCertHash';
		logger.debug('%s - start', method);
		if (this._tls_mutual.clientCertHash) {
			return this._tls_mutual.clientCertHash;
		}
		if (!this._tls_mutual.clientCert && create) {
			// this will create the cert and key from the current user if available
			this.setTlsClientCertAndKey();
		}

		if (this._tls_mutual.clientCert) {
			logger.debug('%s - using clientCert %s', method, this._tls_mutual.clientCert);
			const der_cert = sdkUtils.pemToDER(this._tls_mutual.clientCert);
			this._tls_mutual.clientCertHash = computeHash(der_cert);
		} else {
			logger.debug('%s - no tls client cert', method);
		}

		return this._tls_mutual.clientCertHash;
	}
};

// Compute hash for replay protection
function computeHash(data) {
	const sha256 = crypto.createHash('sha256');

	return sha256.update(data).digest();
}

function readFile(filePath) {
	return new Promise((resolve, reject) => {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
				if (err.code !== 'ENOENT') {
					return reject(err);
				} else {
					return resolve(null);
				}
			}

			return resolve(data);
		});
	});
}

// internal utility method to check and convert any strings to protobuf signatures
function _stringToSignature(string_signatures) {
	const signatures = [];
	for (let signature of string_signatures) {
		// check for properties rather than object type
		if (signature && signature.signature_header && signature.signature) {
			logger.debug('_stringToSignature - signature is protobuf');
		} else {
			logger.debug('_stringToSignature - signature is string');
			const signature_bytes = Buffer.from(signature, 'hex');
			signature = _configtxProto.ConfigSignature.decode(signature_bytes);
		}
		signatures.push(signature);
	}

	return signatures;
}

// internal utility method to get a NetworkConfig
function _getNetworkConfig(loadConfig, client) {
	let network_config = null;
	let network_data = null;
	let network_config_loc = null;
	if (typeof loadConfig === 'string') {
		network_config_loc = path.resolve(loadConfig);
		logger.debug('%s - looking at absolute path of ==>%s<==', '_getNetworkConfig', network_config_loc);
		const file_data = fs.readFileSync(network_config_loc);
		const file_ext = path.extname(network_config_loc);
		// maybe the file is yaml else has to be JSON
		if ((/(yml|yaml)$/i).test(file_ext)) {
			network_data = yaml.safeLoad(file_data);
		} else {
			network_data = JSON.parse(file_data);
		}
	} else {
		network_data = loadConfig;
	}

	try {
		if (!network_data) {
			throw new Error('missing configuration data');
		}
		if (!network_data.version) {
			throw new Error('"version" is missing');
		}
		const parsing = Client.getConfigSetting('network-config-schema');
		if (!parsing) {
			throw new Error('missing "network-config-schema" configuration setting');
		}
		const pieces = network_data.version.toString().split('.');
		const version = pieces[0] + '.' + pieces[1];
		if (!parsing[version]) {
			throw new Error('common connection profile has an unknown "version"');
		}
		const NetworkConfig = require(parsing[version]);
		network_config = new NetworkConfig(network_data, client, network_config_loc);
	} catch (error) {
		throw new Error(util.format('Invalid common connection profile due to %s', error.message));
	}

	return network_config;
}

module.exports = Client;
module.exports.Peer = Peer;
module.exports.ChannelEventHub = ChannelEventHub;
module.exports.Orderer = Orderer;
module.exports.Channel = Channel;
module.exports.User = User;
module.exports.Package = Package;
