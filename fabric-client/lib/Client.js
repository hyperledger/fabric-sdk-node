/*
 Copyright 2016, 2017 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var sdkUtils = require('./utils.js');
var clientUtils = require('./client-utils.js');

var api = require('./api.js');
var BaseClient = require('./BaseClient.js');
var User = require('./User.js');
var Channel = require('./Channel.js');
var Packager = require('./Packager.js');
var Peer = require('./Peer.js');
var EventHub = require('./EventHub.js');
var Orderer = require('./Orderer.js');
var TransactionID = require('./TransactionID.js');
var MSP = require('./msp/msp.js');
var idModule = require('./msp/identity.js');
var Identity = idModule.Identity;
var SigningIdentity = idModule.SigningIdentity;
var Signer = idModule.Signer;

var util = require('util');
var fs = require('fs-extra');
var path = require('path');
var yaml = require('js-yaml');
var Constants = require('./Constants.js');

var grpc = require('grpc');
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;

var config = sdkUtils.getConfig();
// setup the location of the default config shipped with code
var default_config = path.resolve( __dirname, '../config/default.json');
config.reorderFileStores(default_config); //make sure this default has precedences
// set default SSL ciphers for gRPC
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

var logger = sdkUtils.getLogger('Client.js');

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
var Client = class extends BaseClient {

	constructor() {
		super();

		this._channels = {};
		this._stateStore = null;
		this._userContext = null;
		this._network_config = null;
		// keep a collection of MSP's
		this._msps = new Map();

		// Is in dev mode or network mode
		this._devMode = false;

		// When using a network configuration there may be
		// an admin defined for the current user's organization.
		// This will get set during the setUserFromConfig
		this._adminSigningIdentity = null;

		// When using a network configuration (connection profile) the client
		// side mutual tls cert and key must be stored here
		this._tls_mutual = {};
	}

	/**
	 * Load a network configuration object or load a JSON file and return a Client object.
	 *
	 * @param {object | string} config - This may be the config object or a path to the configuration file
	 * @return {Client} An instance of this class initialized with the network end points.
	 */
	static loadFromConfig(config) {
		var client = new Client();
		client._network_config = _getNetworkConfig(config, client);
		if(client._network_config.hasClient()) {
			client._setAdminFromConfig();
		}

		return client;
	}

	/**
	 * Load a network configuration object or load a JSON file and update this client with
	 * any values in the config.
	 *
	 * @param {object | string} config - This may be the config object or a path to the configuration file
	 */
	loadFromConfig(config) {
		var additional_network_config = _getNetworkConfig(config, this);
		if(!this._network_config) {
			this._network_config = additional_network_config;
		} else {
			this._network_config.mergeSettings(additional_network_config);
		}
		if(this._network_config.hasClient()) {
			this._setAdminFromConfig();
		}
	}

	/**
	 * Sets the mutual TLS client side certificate and key necessary to build
	 * network endpoints when working with a network configuration (connection profile).
	 * This must be called before a peer, orderer, or channel eventhub is needed.
	 *
	 * @param {string} clientCert - The pem encoded client certificate.
	 * @param {byte[]} clientKey - The client key.
	 */
	setTlsClientCertAndKey(clientCert, clientKey) {
		logger.debug('setTlsClientCertAndKey - start');
		this._tls_mutual.clientCert = clientCert;
		this._tls_mutual.clientKey = clientKey;
	}

	/**
	 * Utility method to add the mutual tls client material to a set of options
	 * @param {object} opts - The options object holding the connection settings
	 *        that will be updated with the mutual TLS clientCert and clientKey.
	 */
	 addTlsClientCertAndKey(opts) {
		 if(this._tls_mutual.clientCert) {
			 opts.clientCert = this._tls_mutual.clientCert;
		 }
		 if(this._tls_mutual.clientKey) {
			 opts.clientKey = this._tls_mutual.clientKey;
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
		var channel = this._channels[name];

		if (channel)
			throw new Error(util.format('Channel %s already exists', name));

		channel = new Channel(name, this);
		this._channels[name] = channel;
		return channel;
	}

	/**
	 * Get a {@link Channel} instance from the client instance. This is a memory-only lookup.
	 * If the loaded network configuration has a channel by the 'name', a new channel instance
	 * will be created and populated with {@link Orderer} objects and {@link Peer} objects
	 * as defined in the network configuration.
	 *
	 * @param {string} name - Optional. The name of the channel. When omitted the
	 *        first channel defined in the loaded network configuration will be
	 *        returned
	 * @param {boolean} throwError - Indicates if this method will throw an error
	 *        if the channel is not found. Default is true.
	 * @returns {Channel} The channel instance
	 */
	getChannel(name, throwError) {
		var channel = this._channels[name];

		if (channel)
			return channel;
		else {
			// maybe it is defined in the network config
			if(this._network_config) {
				if(!name) {
					let channel_names = Object.keys(this._network_config._network_config.channels);
					if(channel_names) {
						name = channel_names[0];
					}
				}
				channel = this._network_config.getChannel(name);
				this._channels[name] = channel;
			}
			if(channel) {
				return channel;
			}

			logger.error('Channel not found for name '+name+'.');

			if(typeof throwError === 'undefined') {
				throwError = true;
			}
			if(throwError) {
				throw new Error('Channel not found for name '+name+'.');
			} else {
				return null;
			}
		}
	}

	/**
	 * @typedef {Object} ConnectionOpts
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
	 * @param {string} url - The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts - The options for the connection to the peer.
	 * @returns {Peer} The Peer instance.
	 */
	newPeer(url, opts) {
		var peer = new Peer(url, opts);
		return peer;
	}

	/**
	 * Returns an {@link EventHub} object. An event hub object encapsulates the
	 * properties of an event stream on a peer node, through which the peer publishes
	 * notifications of blocks being committed in the channel's ledger.
	 *
	 * @returns {EventHub} The EventHub instance
	 */
	newEventHub() {
		var event_hub = new EventHub(this);
		return event_hub;
	}

	/**
	 * Returns and {@link EventHub} object based on the event hub address
	 * as defined in the currently loaded network configuration for the
	 * peer by the name parameter. The named peer must have the "eventUrl"
	 * setting or a null will be returned.
	 *
	 * @param {string} peer_name - The name of the peer that has an event hub defined
	 * @returns {EventHub} The EventHub instance that has had the event hub address assigned
	 */
	getEventHub(peer_name) {
		var event_hub = null;
		if(this._network_config) {
			event_hub = this._network_config.getEventHub(peer_name);
		}

		return event_hub;
	}

	/**
	 * Returns a list of {@link EventHub} for the named organization as defined
	 * in the currently loaded network configuration. If no organization is
	 * provided then the organization named in the currently active network
	 * configuration's client section will be used. The list will be based on
	 * the peers in the organization that have the "eventUrl" setting.
	 *
	 * @param {string} org_name - Optional - The name of an organization
	 * @returns {EventHub[]} An array of EventHub instances that are defined for this organization
	 */
	 getEventHubsForOrg(org_name) {
		 var event_hubs = [];
		 if(this._network_config) {
			 if(!org_name && this._network_config.hasClient()) {
				 let client = this._network_config.getClientConfig();
				 org_name = client.organization;
			 }
			 if(org_name) {
				 let organization = this._network_config.getOrganization(org_name);
				 if(organization) {
					 event_hubs = organization.getEventHubs();
				 }
			 }
		 }

		 return event_hubs;
	 }

	 /**
 	 * Returns a list of {@link Peer} for the named organization as defined
 	 * in the currently loaded network configuration. If no organization is
 	 * provided then the organization named in the currently active network
 	 * configuration's client section will be used.
 	 *
 	 * @param {string} org_name - Optional - The name of an organization
 	 * @returns {Peer[]} An array of Peer instances that are defined for this organization
 	 */
 	 getPeersForOrg(org_name) {
 		 var peers = [];
 		 if(this._network_config) {
 			 if(!org_name && this._network_config.hasClient()) {
 				 let client = this._network_config.getClientConfig();
 				 org_name = client.organization;
 			 }
 			 if(org_name) {
 				 let organization = this._network_config.getOrganization(org_name);
 				 if(organization) {
 					 peers = organization.getPeers();
 				 }
 			 }
 		 }

 		 return peers;
 	 }

	/**
	 * Returns an {@link Orderer} object with the given url and opts. An orderer object
	 * encapsulates the properties of an orderer node and the interactions with it via
	 * the grpc stream API. Orderer objects are used by the {@link Client} objects to broadcast
	 * requests for creating and updating channels. They are used by the {@link Channel}
	 * objects to broadcast requests for ordering transactions.
	 *
	 * @param {string} url The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts The options for the connection to the orderer.
	 * @returns {Orderer} The Orderer instance.
	 */
	newOrderer(url, opts) {
		var orderer = new Orderer(url, opts);
		return orderer;
	}

	/**
	 * Returns a CertificateAuthority implementation as defined by the settings
	 * in the currently loaded network configuration and the client configuration.
	 * A network configuration must be loaded for this get method to return a
	 * Certificate Authority.
	 * A crypto suite must be assigned to this client instance. Running the
	 * 'initCredentialStores' method will build the stores and create a crypto
	 * suite as defined in the network configuration.
	 *
	 * @param {string} name - Optional - the name of the Certificate Authority
	 *        defined in the loaded connection profile.
	 * @returns {CertificateAuthority}
	 */
	 getCertificateAuthority(name) {
		 if(!this._network_config) {
			 throw new Error('No network configuration has been loaded');
		 }
		 if(!this._cryptoSuite) {
			 throw new Error('A crypto suite has not been assigned to this client');
		 }
		 let ca_info = null;
		 let ca_service = null;

		 if(name) {
			 ca_info = this._network_config.getCertificateAuthority(name);
		 } else {
			 let client_config = this._network_config.getClientConfig();
			 if(client_config && client_config.organization) {
			 	let organization_config = this._network_config.getOrganization(client_config.organization);
			 	if(organization_config) {
				 	let ca_infos = organization_config.getCertificateAuthorities();
				 	if(ca_infos.length > 0) {
					 	ca_info = ca_infos[0];
				 	}
			 	}
			}
		 }

		 if(ca_info) {
			 ca_service = this._buildCAfromConfig(ca_info);
		 } else {
			 throw new Error('Network configuration is missing this client\'s organization and certificate authority');
		 }

		 return ca_service;
	 }

	 /*
	  * utility method to build a ca from a connection profile ca settings
	  */
	 _buildCAfromConfig(ca_info) {
		 let tlsCACerts = ca_info.getTlsCACerts();
		 if(tlsCACerts) {
			 tlsCACerts = [tlsCACerts];
		 } else {
			 tlsCACerts = [];
		 }
		 let connection_options = ca_info.getConnectionOptions();
		 let verify = true; //default if not found
		 if(connection_options && typeof connection_options.verify === 'boolean') {
			 verify = connection_options.verify;
		 }
		 let tls_options = {
			 trustedRoots: tlsCACerts,
			 verify: verify
		 };
		 let ca_url = ca_info.getUrl();
		 let ca_name = ca_info.getCaName();

		 let ca_service_class = Client.getConfigSetting('certificate-authority-client');
		 let ca_service_impl = require(ca_service_class);
		 let ca_service = new ca_service_impl( {url : ca_url, tlsOptions : tls_options, caName : ca_name, cryptoSuite : this._cryptoSuite});
		 return ca_service;
	 }

	/**
	 * Returns the "client" section of the network configuration.
	 *
	 * @returns {object} The client section from the configuration
	 */
	 getClientConfig() {
		 let result = null;
		 if(this._network_config && this._network_config.hasClient()) {
			 result = this._network_config.getClientConfig();
		 }

		 return result;
	 }

	/**
	 * Returns the mspid of the currently loaded client's organization
	 * as defined in the network configuration.
	 *
	 * @returns {string} the mspid of the organization defined in the client
	 *          section of the loaded network configuration
	 */
	 getMspid() {
		 let result = null;
		 let client_config = this.getClientConfig();
		 if(client_config) {
			 result = client_config.mspid;
		 }

		 return result;
	 }

	/**
	 * Returns a new {@link TransactionID} object. Fabric transaction ids are constructed
	 * as a hash of a nonce concatenated with the signing identity's serialized bytes. The
	 * TransactionID object keeps the nonce and the resulting id string bundled together
	 * as a coherent pair.
	 * <br><br>
	 * This method requires the client instance to have been assigned a userContext.
	 * @param {boolean} If this transactionID should be built based on the admin credentials
	 *                  Default is a non admin TransactionID
	 * @returns {TransactionID} An object that contains a transaction id based on the
	 *           client's userContext and a randomly generated nonce value.
	 */
	newTransactionID(admin) {
		if(admin) {
			if(typeof admin === 'boolean') {
				if(admin) {
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
		try {
			var envelope = _commonProto.Envelope.decode(config_envelope);
			var payload = _commonProto.Payload.decode(envelope.getPayload().toBuffer());
			var configtx = _configtxProto.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
			return configtx.getConfigUpdate().toBuffer();
		}
		catch(err) {
			if(err instanceof Error) {
				logger.error('Problem with extracting the config update object :: %s', err.stack ? err.stack : err);
				throw err;
			}
			else {
				logger.error('Problem with extracting the config update object :: %s',err);
				throw new Error(err);
			}
		}
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
	 * @param {byte[]} config - The Configuration Update in byte form
	 * @return {ConfigSignature} - The signature of the current user on the config bytes
	 */
	signChannelConfig(config) {
		logger.debug('signChannelConfigUpdate - start');
		if (typeof config === 'undefined' || config === null) {
			throw new Error('Channel configuration update parameter is required.');
		}
		if(!(config instanceof Buffer)) {
			throw new Error('Channel configuration update parameter is not in the correct form.');
		}
		// should try to use the admin signer if assigned
		// then use the assigned user
		var signer = this._getSigningIdentity(true);

		// signature is across a signature header and the config update
		let proto_signature_header = new _commonProto.SignatureHeader();
		proto_signature_header.setCreator(signer.serialize());
		proto_signature_header.setNonce(sdkUtils.getNonce());
		var signature_header_bytes = proto_signature_header.toBuffer();

		// get all the bytes to be signed together, then sign
		let signing_bytes = Buffer.concat([signature_header_bytes, config]);
		let sig = signer.sign(signing_bytes);
		let signature_bytes = Buffer.from(sig);

		// build the return object
		let proto_config_signature = new _configtxProto.ConfigSignature();
		proto_config_signature.setSignatureHeader(signature_header_bytes);
		proto_config_signature.setSignature(signature_bytes);

		return proto_config_signature;
	}

	/**
	 * @typedef {Object} ChannelRequest
	 * @property {string} name - Required. The name of the new channel
	 * @property {Orderer} orderer - Required. An Orderer object representing the
	 *                               orderer node to send the channel create request
	 * @property {byte[]} envelope - Optional. Bytes of the envelope object containing all
	 *                               required settings and signatures to initialize this channel. This envelope
	 *                               would have been created by the command line tool
	 *                               [configtxgen]{@link http://hyperledger-fabric.readthedocs.io/en/latest/configtxgen.html} or
	 *                               [configtxlator]{@link https://github.com/hyperledger/fabric/blob/master/examples/configtxupdate/README.md}
	 * @property {byte[]} config - Optional. Protobuf ConfigUpdate object extracted from a ConfigEnvelope
	 *                             created by the configtxgen tool. See [extractChannelConfig()]{@link Client#extractChannelConfig}.
	 *                             The ConfigUpdate object may also be created by the configtxlator tool.
	 * @property {ConfigSignature[]} signatures - Required. The list of signatures required by the
	 *                               channel creation or update policy when using the `config` parameter.
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
		var have_envelope = false;
		if(request && request.envelope) {
			logger.debug('createChannel - have envelope');
			have_envelope = true;
		}
		return this._createOrUpdateChannel(request, have_envelope);
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
	 *                    of the successful update of the channel, an application should use the {@link EventHub}
	 *                    to connect to the peers and register a block listener.
	 */
	updateChannel(request) {
		var have_envelope = false;
		if(request && request.envelope) {
			logger.debug('updateChannel - have envelope');
			have_envelope = true;
		}
		return this._createOrUpdateChannel(request, have_envelope);
	}

	/*
	 * internal method to support create or update of a channel
	 */
	_createOrUpdateChannel(request, have_envelope) {
		logger.debug('_createOrUpdateChannel - start');
		var error_msg = null;
		var orderer = null;

		if(!request) {
			error_msg = 'Missing all required input request parameters for initialize channel';
		}
		// Verify that a config envelope or config has been included in the request object
		else if (!request.config && !have_envelope) {
			error_msg = 'Missing config request parameter containing the configuration of the channel';
		}
		else if(!request.signatures && !have_envelope) {
			error_msg = 'Missing signatures request parameter for the new channel';
		}
		else if(!Array.isArray(request.signatures ) && !have_envelope) {
			error_msg = 'Signatures request parameter must be an array of signatures';
		}
		else if(!request.txId && !have_envelope) {
			error_msg = 'Missing txId request parameter';
		}
		// verify that we have the name of the new channel
		else if(!request.name) {
			error_msg = 'Missing name request parameter';
		}

		if(error_msg) {
			logger.error('_createOrUpdateChannel error %s',error_msg);
			return Promise.reject(new Error(error_msg));
		}

		try {
			orderer = this.getTargetOrderer(request.orderer, null, request.name);
		} catch (err) {
			return Promise.reject(err);
		}

		var self = this;
		var channel_id = request.name;
		var channel = null;

		// caller should have gotten a admin based TransactionID
		// but maybe not, so go with whatever they have decided
		var signer = this._getSigningIdentity(request.txId.isAdmin());

		var signature = null;
		var payload = null;
		if (have_envelope) {
			logger.debug('_createOrUpdateChannel - have envelope');
			var envelope = _commonProto.Envelope.decode(request.envelope);
			signature = envelope.signature;
			payload = envelope.payload;
		}
		else {
			logger.debug('_createOrUpdateChannel - have config_update');
			var proto_config_Update_envelope = new _configtxProto.ConfigUpdateEnvelope();
			proto_config_Update_envelope.setConfigUpdate(request.config);
			var signatures = _stringToSignature(request.signatures);
			proto_config_Update_envelope.setSignatures(signatures);

			var proto_channel_header = clientUtils.buildChannelHeader(
				_commonProto.HeaderType.CONFIG_UPDATE,
				request.name,
				request.txId.getTransactionID()
			);

			var proto_header = clientUtils.buildHeader(signer, proto_channel_header, request.txId.getNonce());
			var proto_payload = new _commonProto.Payload();
			proto_payload.setHeader(proto_header);
			proto_payload.setData(proto_config_Update_envelope.toBuffer());
			var payload_bytes = proto_payload.toBuffer();

			let sig = signer.sign(payload_bytes);
			let signature_bytes = Buffer.from(sig);

			signature = signature_bytes;
			payload = payload_bytes;
		}

		// building manually or will get protobuf errors on send
		var out_envelope = {
			signature: signature,
			payload : payload
		};

		logger.debug('_createOrUpdateChannel - about to send envelope');
		return orderer.sendBroadcast(out_envelope)
			.then(
				function(results) {
					logger.debug('_createOrUpdateChannel - good results from broadcast :: %j',results);

					return Promise.resolve(results);
				}
			)
			.catch(
				function(error) {
					if(error instanceof Error) {
						logger.debug('_createOrUpdateChannel - rejecting with %s', error);
						return Promise.reject(error);
					}
					else {
						logger.error('_createOrUpdateChannel - system error :: %s', error);
						return Promise.reject(new Error(error));
					}
				}
			);
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
	 *        identity must have been loaded by network configuration or by
	 *        using the 'setAdminSigningIdentity' method.
	 * @returns {Promise} A promise to return a {@link ChannelQueryResponse}
	 */
	queryChannels(peer, useAdmin) {
		logger.debug('queryChannels - start');
		let targets = null;
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		} else {
			try {
				targets = this.getTargetPeers(peer);
			} catch (err) {
				return Promise.reject(err);
			}
		}
		const self = this;
		const signer = this._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId : Constants.CSCC,
			txId: txId,
			signer: signer,
			fcn : 'GetChannels',
			args: []
		};
		return Channel.sendTransactionProposal(request, '' /* special channel id */, self)
			.then(
				function(results) {
					const responses = results[0];
					logger.debug('queryChannels - got response');
					if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
						if(responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						const response = responses[0];
						if(response instanceof Error ) {
							return Promise.reject(response);
						}
						if(response.response) {
							logger.debug('queryChannels - response status :: %d', response.response.status);
							const queryTrans = _queryProto.ChannelQueryResponse.decode(response.response.payload);
							logger.debug('queryChannels - ProcessedTransaction.channelInfo.length :: %s', queryTrans.channels.length);
							for (let channel of queryTrans.channels) {
								logger.debug('>>> channel id %s ',channel.channel_id);
							}
							return Promise.resolve(queryTrans);
						}
						// no idea what we have, lets fail it and send it back
						return Promise.reject(response);
					}
					return Promise.reject(new Error('Payload results are missing from the query'));
				}
			).catch(
				function(err) {
					logger.error('Failed Channels Query. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
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
	 *        identity must have been loaded by network configuration or by
	 *        using the 'setAdminSigningIdentity' method.
	 * @returns {Promise} Promise for a {@link ChaincodeQueryResponse} object
	 */
	queryInstalledChaincodes(peer, useAdmin) {
		logger.debug('queryInstalledChaincodes - start peer %s',peer);
		let targets = null;
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		} else {
			try {
				targets = this.getTargetPeers(peer);
			} catch (err) {
				return Promise.reject(err);
			}
		}
		const self = this;
		const signer = this._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId : Constants.LSCC,
			txId: txId,
			signer: signer,
			fcn : 'getinstalledchaincodes',
			args: []
		};
		return Channel.sendTransactionProposal(request, '' /* special channel id */, self)
			.then(
				function(results) {
					const responses = results[0];
					logger.debug('queryInstalledChaincodes - got response');
					if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
						if(responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						const response = responses[0];
						if(response instanceof Error ) {
							return Promise.reject(response);
						}
						if(response.response) {
							logger.debug('queryInstalledChaincodes - response status :: %d', response.response.status);
							const queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
							logger.debug('queryInstalledChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
							for (let chaincode of queryTrans.chaincodes) {
								logger.debug('>>> name %s, version %s, path %s',chaincode.name,chaincode.version,chaincode.path);
							}
							return Promise.resolve(queryTrans);
						}
						// no idea what we have, lets fail it and send it back
						return Promise.reject(response);
					}
					return Promise.reject(new Error('Payload results are missing from the query'));
				}
			).catch(
				function(err) {
					logger.error('Failed Installed Chaincodes Query. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * @typedef {Object} ChaincodeInstallRequest
	 * @property {Peer[]} targets - Optional. An array of Peer objects where the
	 *           chaincode will be installed. When excluded, the peers assigned
	 *           to this client's organization will be used as defined in the
	 *           network configuration. If the 'channelNames' property is included,
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
	 *           Default is 'golang'. Note that 'java' is not supported as of v1.0.
	 * @property {string[] | string} channelNames - Optional. When no targets are
	 *           provided. The loaded network configuration will be searched for
	 *           suitable target peers. Peers that are defined in the channels named
	 *           by this property and in this client's organization and that are
	 *           in the endorsing or chain code query role on the named channel
	 *           will be selected.
	 */

	/**
	 * All calls to the endorsing peers for proposal endorsement return this standard
	 * array of objects.
	 *
	 * @typedef {array} ProposalResponseObject
	 * @property {array} index:0 - Array of ProposalResponse objects from the endorsing peers
	 * @property {Object} index:1 - The original Proposal object needed when sending the transaction
	 *                              request to the orderer
	 */

	/**
	 * In fabric v1.0, a chaincode must be installed and instantiated before it
	 * can be called to process transactions.
	 * <br><br>
	 * Chaincode installation is simply uploading the chaincode source and
	 * dependencies to the peers. This operation is "channel-agnostic" and is
	 * performed on a peer-by-peer basis. Only the peer organization's ADMIN
	 * identities are allowed to perform this operation.
	 *
	 * @param {ChaincodeInstallRequest} request - The request object
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the Peer instance and the global timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link ProposalResponseObject}
	 */
	installChaincode(request, timeout) {
		logger.debug('installChaincode - start');

		let error_msg = null;

		let peers = null;
		if (request) {
			try {
				peers = this.getTargetPeers(request.targets);
				if(!peers) {
					peers = this.getPeersForOrgOnChannel(request.channelNames);
				}
			} catch (err) {
				return Promise.reject(err);
			}

			// Verify that a Peer has been added
			if (peers && peers.length > 0) {
				logger.debug('installChaincode - found peers ::%s',peers.length);
			}
			else {
				error_msg = 'Missing peer objects in install chaincode request';
			}
		}
		else {
			error_msg = 'Missing input request object on install chaincode request';
		}

		if (!error_msg) error_msg = clientUtils.checkProposalRequest(request, true);
		if (!error_msg) error_msg = clientUtils.checkInstallRequest(request);

		if (error_msg) {
			logger.error('installChaincode error ' + error_msg);
			return Promise.reject(new Error(error_msg));
		}

		const self = this;

		const ccSpec = {
			type: clientUtils.translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			}
		};
		logger.debug('installChaincode - ccSpec %s ',JSON.stringify(ccSpec));

		// step 2: construct the ChaincodeDeploymentSpec
		const chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);
		chaincodeDeploymentSpec.setEffectiveDate(clientUtils.buildCurrentTimestamp()); //TODO may wish to add this as a request setting

		return _getChaincodePackageData(request, this.isDevMode())
			.then((data) => {
			// DATA may or may not be present depending on devmode settings
				if (data) {
					chaincodeDeploymentSpec.setCodePackage(data);
					logger.debug('installChaincode - found packaged data');
				}
				logger.debug('installChaincode - sending deployment spec %s ',chaincodeDeploymentSpec);

				// TODO add ESCC/VSCC info here ??????
				const lcccSpec = {
					type: ccSpec.type,
					chaincode_id: {
						name: Constants.LSCC
					},
					input: {
						args: [Buffer.from('install', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
					}
				};

				let signer;
				let tx_id = request.txId;
				if(!tx_id) {
					signer = self._getSigningIdentity(true);
					tx_id = new TransactionID(signer, true);
				} else {
					signer = self._getSigningIdentity(tx_id.isAdmin());
				}

				const channelHeader = clientUtils.buildChannelHeader(
					_commonProto.HeaderType.ENDORSER_TRANSACTION,
					'', //install does not target a channel
					tx_id.getTransactionID(),
					null,
					Constants.LSCC
				);
				const header = clientUtils.buildHeader(signer, channelHeader, tx_id.getNonce());
				const proposal = clientUtils.buildProposal(lcccSpec, header);
				const signed_proposal = clientUtils.signProposal(signer, proposal);
				logger.debug('installChaincode - about to sendPeersProposal');
				return clientUtils.sendPeersProposal(peers, signed_proposal, timeout)
					.then(
						function(responses) {
							return [responses, proposal];
						}
					);
			});
	}

	/**
	 * Sets the state and crypto suite for use by this client.
	 * This requires that a network config has been loaded. Will use the settings
	 * from the network configuration along with the system configuration to build
	 * instances of the stores and assign them to this client and the crypto suites
	 * if needed.
	 *
	 * @returns {Promise} - A promise to build a key value store and crypto store.
	 */
	initCredentialStores() {
		if(this._network_config) {
			let client_config = this._network_config.getClientConfig();
			if(client_config && client_config.credentialStore) {
				const self = this;
				return BaseClient.newDefaultKeyValueStore(client_config.credentialStore)
					.then((key_value_store) =>{
						self.setStateStore(key_value_store);
						const crypto_suite = BaseClient.newCryptoSuite();
						// not all crypto suites require a crypto store
						if (typeof crypto_suite.setCryptoKeyStore == 'function') {
							crypto_suite.setCryptoKeyStore(BaseClient.newCryptoKeyStore(client_config.credentialStore.cryptoStore));
						}
						self.setCryptoSuite(crypto_suite);
						return Promise.resolve(true);
					}).catch((err)=>{
						return Promise.reject(err);
					});
			} else {
				return Promise.reject(new Error('No credentialStore settings found'));
			}
		} else {
			return Promise.reject(new Error('No network configuration settings found'));
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
		methods.forEach(function(m) {
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
		logger.debug('_getSigningIdentity - admin parameter is %s :%s',(typeof admin),admin);
		if(admin && this._adminSigningIdentity) {
			return this._adminSigningIdentity;
		} else {
			if(this._userContext) {
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
		logger.debug('setAdminSigningIdentity - start mspid:%s',mspid);
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
		if(!crypto_suite) {
			crypto_suite = BaseClient.newCryptoSuite();
		}
		const key = crypto_suite.importKey(private_key, {ephemeral : true});
		const public_key = crypto_suite.importKey(certificate, {ephemeral: true});

		this._adminSigningIdentity = new SigningIdentity(certificate, public_key, mspid, crypto_suite, new Signer(crypto_suite, key));
	}

	/*
	 * Utility method to set the admin signing identity object based on the current
	 * organization defined in the network configuration. A network configuration
	 * be must loaded that defines an organization for this client and have an
	 * admin credentials defined.
	 */
	_setAdminFromConfig() {
		let admin_key, admin_cert, mspid = null;
		if(!this._network_config) {
			throw new Error('No network configuration has been loaded');
		}

		let client_config = this._network_config.getClientConfig();
		if(client_config && client_config.organization) {
			let organization_config = this._network_config.getOrganization(client_config.organization);
			if(organization_config) {
				mspid = organization_config.getMspid();
				admin_key = organization_config.getAdminPrivateKey();
				admin_cert = organization_config.getAdminCert();
			}
		}
		// if we found all we need then set the admin
		if(admin_key && admin_cert && mspid) {
			this.setAdminSigningIdentity(admin_key, admin_cert, mspid);
		}
	}

	/*
	 * Utility Method
	 * Sets the user context based on the passed in username and password
	 * and the organization in the client section of the network configuration
	 * settings.
	 *
	 * @param {Object} opts - contains
	 *                  - username [required] - username of the user
	 *                  - password [optional] - password of the user
	 */
	_setUserFromConfig(opts) {
		if (!opts || typeof opts.username === 'undefined' || opts.username === null || opts.username === '') {
			return Promise.reject( new Error('Missing parameter. Must have a username.'));
		}
		if(!this._network_config || !this._stateStore || !this._cryptoSuite ) {
			return Promise.reject(new Error('Client requires a network configuration loaded, stores attached, and crypto suite.'));
		}
		this._userContext = null;
		const self = this;
		return self.getUserContext(opts.username, true)
			.then((user) => {
				return new Promise((resolve, reject) => {
					if (user && user.isEnrolled()) {
						logger.debug('Successfully loaded member from persistence');
						return resolve(user);
					}

					if (typeof opts.password === 'undefined' || opts. password === null || opts. password === '') {
						return reject( new Error('Missing parameter. Must have a password.'));
					}

					let ca_service, mspid = null;
					try {
						const client_config = this._network_config.getClientConfig();
						if(client_config && client_config.organization) {
							const organization_config = this._network_config.getOrganization(client_config.organization);
							if(organization_config) {
								mspid = organization_config.getMspid();
							}
						}
						if(!mspid) {
							throw new Error('Network configuration is missing this client\'s organization and mspid');
						}
						ca_service = self.getCertificateAuthority();
					} catch(err) {
						reject(err);
					}

					return ca_service.enroll({
						enrollmentID: opts.username,
						enrollmentSecret: opts.password
					}).then((enrollment) => {
						logger.debug('Successfully enrolled user "%s"',opts.username);

						return self.createUser(
							{username: opts.username,
								mspid: mspid,
								cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
							});
					}).then((member) => {
						return resolve(member);
					}).catch((err) => {
						logger.error('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
						reject(err);
					});
				});
			});
	}

	/**
	 * Persist the current <code>userContext</code> to the key value store.
	 *
	 * @returns {Promise} A Promise for the userContext object upon successful persistence
	 */
	saveUserToStateStore() {
		const self = this;
		logger.debug('saveUserToStateStore, userContext: ' + self._userContext);
		return new Promise(function(resolve, reject) {
			if (self._userContext && self._userContext._name && self._stateStore) {
				logger.debug('saveUserToStateStore, begin promise stateStore.setValue');
				self._stateStore.setValue(self._userContext._name, self._userContext.toString())
					.then(
						function(result) {
							logger.debug('saveUserToStateStore, store.setValue, result = ' + result);
							resolve(self._userContext);
						},
						function (reason) {
							logger.debug('saveUserToStateStore, store.setValue, reject reason = ' + reason);
							reject(reason);
						}
					).catch(
						function(err) {
							logger.debug('saveUserToStateStore, store.setValue, error: ' +err);
							reject(new Error(err));
						}
					);
			} else {
				if (!self._userContext) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
					reject(new Error('Cannot save user to state store when userContext is null.'));
				} else if (!self._userContext._name) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext has no name.');
					reject(new Error('Cannot save user to state store when userContext has no name.'));
				} else {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when stateStore is null.');
					reject(new Error('Cannot save user to state store when stateStore is null.'));
				}
			}
		});
	}
	/**
	 * An alternate object to use on the 'setUserContext' call in place of the 'User' object.
	 * When using this object it is assumed that the current 'Client' instance has been loaded
	 * with a network configuration.
	 *
	 * @typedef {Object} UserNamePasswordObject
	 * @property {string} username - A string representing the user name of the user
	 * @property {string} password - A string repsesenting the password of the user
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
	 *                      and optionaly the password. A network configuration must has been loaded to use the
	 *                      {@link UserNamePasswordObject} which will also create the user context and set it on
	 *                      this client instance. The created user context will be based on the current network
	 *                      configuration( i.e. the current organization's CA, current persistence stores).
	 * @param {boolean} skipPersistence - Whether to skip saving the user object into persistence. Default is false and the
	 *                                    method will attempt to save the user object to the state store. When using a
	 *                                    network configuration and {@link UserNamePasswordObject}, the user object will
	 *                                    always be stored to the persistence store.
	 * @returns {Promise} Promise of the 'user' object upon successful persistence of the user to the state store
	 */
	setUserContext(user, skipPersistence) {
		logger.debug('setUserContext - user: ' + user + ', skipPersistence: ' + skipPersistence);
		const self = this;
		return new Promise((resolve, reject) => {
			if (user) {
				if(user.constructor && user.constructor.name === 'User') {
					self._userContext = user;
					if (!skipPersistence) {
						logger.debug('setUserContext - begin promise to saveUserToStateStore');
						self.saveUserToStateStore()
							.then((return_user) => {
								return resolve(return_user);
							}).catch((err) => {
								reject(err);
							});
					} else {
						logger.debug('setUserContext - resolved user');
						return resolve(user);
					}
				} else {
					// must be they have passed in an object
					logger.debug('setUserContext - will try to use network configuration to set the user');
					self._setUserFromConfig(user)
						.then((return_user) => {
							return resolve(return_user);
						}).catch((err) => {
							reject(err);
						});
				}
			} else {
				logger.debug('setUserContext, Cannot save null userContext');
				reject(new Error('Cannot save null userContext.'));
			}
		});
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
	 * @param {String} name - Optional. If not specified, will only return the current in-memory user context object, or null
	 *                        if none has been set. If "name" is specified, will also attempt to load it from the state store
	 *                        if search in memory failed.
	 * @param {boolean} checkPersistence - Optional. If specified and truthy, the method returns a Promise and will
	 *                                     attempt to check the state store for the requested user by the "name". If not
	 *                                     specified or falsey, the method is synchronous and returns the requested user from memory
	 * @returns {Promise | User} Promise for the user object corresponding to the name, or null if the user does not exist or if the
	 *                           state store has not been set. If "checkPersistence" is not specified or false, then the user object
	 *                           is returned synchronously.
	 */
	getUserContext(name, checkPersistence) {
		// first check if only one param is passed in for "checkPersistence"
		if (typeof name === 'boolean' && name && typeof checkPersistence === 'undefined')
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is undefined');

		if (typeof checkPersistence === 'boolean' && checkPersistence &&
			(typeof name !== 'string' || name === null || name === ''))
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');

		const self = this;
		const username = name;
		if ((self._userContext && name && self._userContext.getName() === name) || (self._userContext && !name)) {
			if (typeof checkPersistence === 'boolean' && checkPersistence)
				return Promise.resolve(self._userContext);
			else
				return self._userContext;
		} else {
			if (!username) {
				if (typeof checkPersistence === 'boolean' && checkPersistence)
					return Promise.resolve(null);
				else
					return null;
			}

			// this could be because the application has not set a user context yet for this client, which would
			// be an error condiditon, or it could be that this app has crashed before and is recovering, so we
			// should allow the previously saved user context object to be deserialized

			// first check if there is a user context of the specified name in persistence
			if (typeof checkPersistence === 'boolean' && checkPersistence) {
				if (self._stateStore) {
					return self.loadUserFromStateStore(username).then(
						function(userContext) {
							if (userContext) {
								logger.debug('Requested user "%s" loaded successfully from the state store on this Client instance: name - %s', name, name);
								return self.setUserContext(userContext, true); //skipPersistence as we just got it from there
							} else {
								logger.debug('Requested user "%s" not loaded from the state store on this Client instance: name - %s', name, name);
								return null;
							}
						}
					).then(
						function(userContext) {
							return Promise.resolve(userContext);
						}
					).catch(
						function(err) {
							logger.error('Failed to load an instance of requested user "%s" from the state store on this Client instance. Error: %s', name, err.stack ? err.stack : err);
							return Promise.reject(err);
						}
					);
				} else {
					// we don't have it in memory or persistence, just return null
					return Promise.resolve(null);
				}
			} else
				return null;
		}
	}

	/**
	 * Restore the state of the {@link User} by the given name from the key value store (if found).  If not found, return null.
	 *
	 * @param {string} name - Name of the user
	 * @returns {Promise} A Promise for a {User} object upon successful restore, or if the user by the name
	 *                    does not exist in the state store, returns null without rejecting the promise
	 */
	loadUserFromStateStore(name) {
		const self = this;

		return new Promise(function(resolve, reject) {
			self._stateStore.getValue(name)
				.then(
					function(memberStr) {
						if (memberStr) {
						// The member was found in the key value store, so restore the state.
							const newUser = new User(name);
							if (!self.getCryptoSuite()) {
								logger.debug('loadUserFromStateStore, cryptoSuite is not set, will load using defaults');
							}
							newUser.setCryptoSuite(self.getCryptoSuite());

							return newUser.fromString(memberStr);
						} else {
							return null;
						}
					})
				.then(function(data) {
					if (data) {
						logger.debug('Successfully loaded user "%s" from local key value store', name);
						return resolve(data);
					} else {
						logger.debug('Failed to load user "%s" from local key value store', name);
						return resolve(null);
					}
				}).catch(
					function(err) {
						logger.error('Failed to load user "%s" from local key value store. Error: %s', name, err.stack ? err.stack : err);
						reject(err);
					}
				);
		});
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
	 * @property {string} username {string} - the user name used for enrollment
	 * @property {string} mspid {string} - the MSP id
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
	createUser(opts) {
		logger.debug('opts = %j', opts);
		if (!opts) {
			return Promise.reject(new Error('Client.createUser missing required \'opts\' parameter.'));
		}
		if (!opts.username || opts.username && opts.username.length < 1) {
			return Promise.reject(new Error('Client.createUser parameter \'opts username\' is required.'));
		}
		if (!opts.mspid || opts.mspid && opts.mspid.length < 1) {
			return Promise.reject(new Error('Client.createUser parameter \'opts mspid\' is required.'));
		}
		if (opts.cryptoContent) {
			if (!opts.cryptoContent.privateKey && !opts.cryptoContent.privateKeyPEM && !opts.cryptoContent.privateKeyObj) {
				return Promise.reject(new Error('Client.createUser one of \'opts cryptoContent privateKey, privateKeyPEM or privateKeyObj\' is required.'));
			}
			if (!opts.cryptoContent.signedCert && !opts.cryptoContent.signedCertPEM) {
				return Promise.reject(new Error('Client.createUser either \'opts cryptoContent signedCert or signedCertPEM\' is required.'));
			}
		} else {
			return Promise.reject(new Error('Client.createUser parameter \'opts cryptoContent\' is required.'));
		}

		if (this.getCryptoSuite() == null) {
			logger.debug('cryptoSuite is null, creating default cryptoSuite and cryptoKeyStore');
			this.setCryptoSuite(sdkUtils.newCryptoSuite());
			this.getCryptoSuite().setCryptoKeyStore(Client.newCryptoKeyStore());
		} else {
			if (this.getCryptoSuite()._cryptoKeyStore) logger.debug('cryptoSuite has a cryptoKeyStore');
			else logger.debug('cryptoSuite does not have a cryptoKeyStore');
		}

		const self = this;
		return new Promise((resolve, reject) => {
			// need to load private key and pre-enrolled certificate from files based on the MSP
			// root MSP config directory structure:
			// <config>
			//    \_ keystore
			//       \_ admin.pem  <<== this is the private key saved in PEM file
			//    \_ signcerts
			//       \_ admin.pem  <<== this is the signed certificate saved in PEM file

			// first load the private key and save in the BCCSP's key store
			var promise, member, importedKey;

			if (opts.cryptoContent.privateKey) {
				promise = readFile(opts.cryptoContent.privateKey);
			} else if (opts.cryptoContent.privateKeyPEM){
				promise = Promise.resolve(opts.cryptoContent.privateKeyPEM);
			} else {
				importedKey = opts.cryptoContent.privateKeyObj;
				promise = Promise.resolve();
			}
			promise.then((data) => {
				if (data) {
					logger.debug('then privateKeyPEM data');
					var opt1;
					if (self.getCryptoSuite()._cryptoKeyStore) {
						opt1 = { ephemeral: false };
					} else {
						opt1 = { ephemeral: true };
					}
					return self.getCryptoSuite().importKey(data.toString(), opt1);
				} else {
					return importedKey;
				}
			}).then((key) => {
				logger.debug('then key');
				importedKey = key;
				// next save the certificate in a serialized user enrollment in the state store
				if (opts.cryptoContent.signedCert) {
					promise = readFile(opts.cryptoContent.signedCert);
				} else {
					promise = Promise.resolve(opts.cryptoContent.signedCertPEM);
				}
				return promise;
			}).then((data) => {
				logger.debug('then signedCertPEM data');
				member = new User(opts.username);
				member.setCryptoSuite(self.getCryptoSuite());
				return member.setEnrollment(importedKey, data.toString(), opts.mspid);
			}).then(() => {
				logger.debug('then setUserContext');
				return self.setUserContext(member, opts.skipPersistence);
			}, (err) => {
				logger.debug('error during setUserContext...');
				logger.error(err.stack ? err.stack : err);
				return reject(err);
			}).then((user) => {
				logger.debug('then user');
				return resolve(user);
			}).catch((err) => {
				logger.error(err.stack ? err.stack : err);
				return reject(new Error('Failed to load key or certificate and save to local stores.'));
			});
		});
	}

	/*
	 * utility method to get the peer targets
	 */
	getTargetPeers(request_targets) {
		logger.debug('%s - start','getTargetPeers');
		const targets = [];
		let targetsTemp = request_targets;
		if(request_targets) {
			if(!Array.isArray(request_targets)) {
				targetsTemp = [request_targets];
			}
			for(let target_peer of targetsTemp) {
				if(typeof target_peer === 'string') {
					if(this._network_config) {
						const peer = this._network_config.getPeer(target_peer);
						if(peer) {
							targets.push(peer);
						} else {
							throw new Error('Target peer name was not found');
						}
					} else {
						throw new Error('No network configuraton loaded');
					}
				} else if(target_peer && target_peer.constructor && target_peer.constructor.name === 'Peer') {
					targets.push(target_peer);
				} else {
					throw new Error('Target peer is not a valid peer object instance');
				}
			}
		}

		if(targets.length > 0) {
			return targets;
		} else {
			return null;
		}
	}

	/*
	 * Utility method to get the orderer for the request
	 * Will find the orderer is this sequence:
	 *    if request_orderer is an object, will check that it is an orderer
	 *    if request_orderer is a string will look up in the network configuration the orderer by that name
	 *    if channel_orderers is not null then this index 0 will be used
	 *    if channel_name is not null will look up the channel to see if there is an orderer defined in the
	 *        network configuration
	 *    will throw an error in all cases if there is not a valid orderer to return
	 */
	getTargetOrderer(request_orderer, channel_orderers, channel_name) {
		logger.debug('%s - start','getTargetOrderer');
		let orderer = null;
		if(request_orderer) {
			if(typeof request_orderer === 'string') {
				if(this._network_config) {
					orderer = this._network_config.getOrderer(request_orderer);
					if(!orderer) {
						throw new Error('Orderer name was not found in the network configuration');
					}
				}
			} else if(request_orderer && request_orderer.constructor && request_orderer.constructor.name === 'Orderer') {
				orderer = request_orderer;
			} else {
				throw new Error('"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object.');
			}
		} else if(channel_orderers && Array.isArray(channel_orderers) && channel_orderers[0]) {
			orderer = channel_orderers[0];
		} else if(channel_name && this._network_config) {
			const temp_channel = this.getChannel(channel_name, false);
			if(temp_channel) {
				const temp_orderers = temp_channel.getOrderers();
				if(temp_orderers && temp_orderers.length > 0) {
					orderer = temp_orderers[0];
				}
				else {
					throw new Error('"orderer" request parameter is missing and there' + ' ' +
							'are no orderers defined on this channel in the network configuration');
				}
			} else {
				throw new Error(util.format('Channel name %s was not found in the network configuration',channel_name));
			}
		} else {
			throw new Error('Missing "orderer" request parameter');
		}

		return orderer;
	}

	/*
	 * Utility method to get target peers from the network configuration
	 * Will get the list of all peers for the current organization of this
	 * client. If channel names are provided, the list will be filtered
	 * down to be just the endorsing or chain code query peers as defined
	 * in the channels. If no channels are provided the full org list
	 * will be returned.
	 */
	getPeersForOrgOnChannel(channels) {
		let method = 'getPeersForOrgOnChannel';
		logger.debug('%s - starting',method);
		let peers = [];
		if(this._network_config && this._network_config.hasClient()) {
			let org_peers = this.getPeersForOrg();
			logger.debug('%s - have client config and an org_peers list with %s',method,org_peers.length);
			if(channels) {
				logger.debug('%s - have channels %s',method,channels);
				if(!Array.isArray(channels)) {
					channels = [channels];
				}
				peers = [];
				let found_peers = {};
				for(let i in channels) {
					logger.debug('%s - looking at channel:%s',method,channels[i]);
					let channel = this._network_config.getChannel(channels[i]);
					let channel_peers = channel.getPeers();
					for(let j in channel_peers) {
						let channel_peer = channel_peers[j];
						logger.debug('%s - looking at channel peer:%s',method,channel_peer.getName());
						if(channel_peer.isInRole(Constants.NetworkConfig.ENDORSING_PEER_ROLE)
						|| channel_peer.isInRole(Constants.NetworkConfig.CHAINCODE_QUERY_ROLE)) {
							for(let k in org_peers) {
								let org_peer = org_peers[k];
								logger.debug('%s - looking at org peer:%s',method,org_peer.getName());
								if(org_peer.getName() === channel_peer.getName()) {
									found_peers[org_peer.getName()] = org_peer;//to avoid Duplicate Peers
									logger.debug('%s - adding peer to list:%s',method,org_peer.getName());
								}
							}
						}
					}
				}
				for(let name in found_peers) {
					logger.debug('%s - final list has:%s',method,name);
					peers.push(found_peers[name]);
				}
			} else {
				logger.debug('%s - return org list',method);
				peers = org_peers;
			}
		}

		return peers;
	}
};

function readFile(path) {
	return new Promise(function(resolve, reject) {
		fs.readFile(path, 'utf8', function (err, data) {
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

// internal utility method to get the chaincodePackage data in bytes
function _getChaincodePackageData(request, devMode) {
	return new Promise((resolve,reject) => {
		if (!request.chaincodePackage) {
			logger.debug('_getChaincodePackageData -  build package with chaincodepath %s, chaincodeType %s, devMode %s, metadataPath %s',
				request.chaincodePath, request.chaincodeType, devMode, request.metadataPath);
			resolve(Packager.package(request.chaincodePath, request.chaincodeType, devMode, request.metadataPath));
		} else {
			logger.debug('_getChaincodePackageData - working with included chaincodePackage');
			resolve(request.chaincodePackage);
		}
	});
}

// internal utility method to check and convert any strings to protobuf signatures
function _stringToSignature(string_signatures) {
	const signatures = [];
	for(let signature of string_signatures) {
		// check for properties rather than object type
		if(signature && signature.signature_header && signature.signature) {
			logger.debug('_stringToSignature - signature is protobuf');
		}
		else {
			logger.debug('_stringToSignature - signature is string');
			const signature_bytes = Buffer.from(signature, 'hex');
			signature = _configtxProto.ConfigSignature.decode(signature_bytes);
		}
		signatures.push(signature);
	}
	return signatures;
}

//internal utility method to get a NetworkConfig
function _getNetworkConfig(config, client) {
	let network_config = null;
	let network_data = null;
	if(typeof config === 'string') {
		const config_loc = path.resolve(config);
		logger.debug('%s - looking at absolute path of ==>%s<==','_getNetworkConfig',config_loc);
		const file_data = fs.readFileSync(config_loc);
		const file_ext = path.extname(config_loc);
		// maybe the file is yaml else has to be JSON
		if(file_ext.indexOf('y') > -1) {
			network_data = yaml.safeLoad(file_data);
		} else {
			network_data = JSON.parse(file_data);
		}
	} else {
		network_data = config;
	}

	let error_msg = null;
	if(network_data) {
		if(network_data.version) {
			const parsing = Client.getConfigSetting('network-config-schema');
			if(parsing) {
				const pieces = network_data.version.toString().split('.');
				const version = pieces[0] + '.' + pieces[1];
				if(parsing[version]) {
					const NetworkConfig = require(parsing[version]);
					network_config = new NetworkConfig(network_data, client);
				} else {
					error_msg = 'network configuration has an unknown "version"';
				}
			} else {
				error_msg = 'missing "network-config-schema" configuration setting';
			}
		} else {
			error_msg = '"version" is missing';
		}
	} else {
		error_msg = 'missing configuration data';
	}

	if(error_msg) {
		throw new Error(util.format('Invalid network configuration due to %s',error_msg));
	}

	return network_config;
}

module.exports = Client;
