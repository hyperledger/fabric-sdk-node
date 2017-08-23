/*
 Copyright 2016 IBM All Rights Reserved.

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
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

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

var logger = sdkUtils.getLogger('Client.js');
var util = require('util');
var fs = require('fs-extra');
var Constants = require('./Constants.js');

var grpc = require('grpc');
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;

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
		// keep a collection of MSP's
		this._msps = new Map();

		// Is in dev mode or network mode
		this._devMode = false;
	}

	/**
	 * Determine if the fabric backend is started in
	 * [development mode]{@link http://hyperledger-fabric.readthedocs.io/en/latest/Setup/Chaincode-setup.html?highlight=development%20mode}.
	 * In development mode, the endorsing peers will not attempt to spin up a docker instance to run
	 * the target chaincode requested by a transaction proposal, but instead redirect the invocation
	 * requests to the chaincode process that has registered itself with the endorsing peer. This makes
	 * it easier to test changes to the chaincode during chaincode development.
	 * <br><br>
	 * The client instance can be set to dev mode to reflect the backend's development mode. This will
	 * cause the SDK to make adjustments in certain behaviors such as not sending the chaincode package
	 * to the peers during chanicode install.
	 */
	isDevMode() {
		return this._devMode;
	}

	/**
	 * Set dev mode to true or false to reflect the mode of the fabric backend. See {@link Client#isDevMode} for details.
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

		var channel = new Channel(name, this);
		this._channels[name] = channel;
		return channel;
	}

	/**
	 * Get a {@link Channel} instance from the client instance. This is a memory-only lookup.
	 *
	 * @param {string} name The name of the channel.
	 * @returns {Channel} The channel instance
	 */
	getChannel(name) {
		var ret = this._channels[name];

		if (ret)
			return ret;
		else {
			logger.error('Channel not found for name '+name+'.');
			throw new Error('Channel not found for name '+name+'.');
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
	 * Returns a new {@link TransactionID} object. Fabric transaction ids are constructed
	 * as a hash of a nonce concatenated with the signing identity's serialized bytes. The
	 * TransactionID object keeps the nonce and the resulting id string bundled together
	 * as a coherent pair.
	 * <br><br>
	 * This method requires the client instance to have been assigned a userContext.
	 * @returns {TransactionID} An object that contains a transaction id based on the
	 *           client's userContext and a randomly generated nonce value.
	 */
	newTransactionID() {
		if (typeof this._userContext === 'undefined' || this._userContext === null) {
			throw new Error('This client instance must be assigned an user context');
		}
		let trans_id = new TransactionID(this._userContext);

		return trans_id;
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
		var userContext = this.getUserContext();

		// signature is across a signature header and the config update
		let proto_signature_header = new _commonProto.SignatureHeader();
		proto_signature_header.setCreator(userContext.getIdentity().serialize());
		proto_signature_header.setNonce(sdkUtils.getNonce());
		var signature_header_bytes = proto_signature_header.toBuffer();

		// get all the bytes to be signed together, then sign
		let signing_bytes = Buffer.concat([signature_header_bytes, config]);
		let sig = userContext.getSigningIdentity().sign(signing_bytes);
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
			logger.debug('createChannel - have envelope');
			have_envelope = true;
		}
		return this._createOrUpdateChannel(request, have_envelope);
	}

	/*
	 * internal method to support create or update of a channel
	 */
	_createOrUpdateChannel(request, have_envelope) {
		logger.debug('_createOrUpdateChannel - start');
		var errorMsg = null;

		if(!request) {
			errorMsg = 'Missing all required input request parameters for initialize channel';
		}
		else {
			// Verify that a config envelope or config has been included in the request object
			if (!request.config && !have_envelope) {
				errorMsg = 'Missing config request parameter containing the configuration of the channel';
			}
			if(!request.signatures && !have_envelope) {
				errorMsg = 'Missing signatures request parameter for the new channel';
			}
			else if(!Array.isArray(request.signatures ) && !have_envelope) {
				errorMsg = 'Signatures request parameter must be an array of signatures';
			}
			if(!request.txId && !have_envelope) {
				errorMsg = 'Missing txId request parameter';
			}

			// verify that we have an orderer configured
			if(!request.orderer) {
				errorMsg = 'Missing orderer request parameter';
			}
			// verify that we have the name of the new channel
			if(!request.name) {
				errorMsg = 'Missing name request parameter';
			}
		}

		if(errorMsg) {
			logger.error('_createOrUpdateChannel error %s',errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var channel_id = request.name;
		var orderer = request.orderer;
		var userContext = null;
		var channel = null;

		userContext = this.getUserContext();

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

			var proto_header = clientUtils.buildHeader(userContext.getIdentity(), proto_channel_header, request.txId.getNonce());
			var proto_payload = new _commonProto.Payload();
			proto_payload.setHeader(proto_header);
			proto_payload.setData(proto_config_Update_envelope.toBuffer());
			var payload_bytes = proto_payload.toBuffer();

			let sig = userContext.getSigningIdentity().sign(payload_bytes);
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
	 * @param {Peer} peer - The target peer to send the query to
	 * @returns {Promise} A promise to return a {@link ChannelQueryResponse}
	 */
	queryChannels(peer) {
		logger.debug('queryChannels - start');
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var txId = new TransactionID(this._userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.CSCC,
			txId: txId,
			fcn : 'GetChannels',
			args: []
		};
		return Channel.sendTransactionProposal(request, '' /* special channel id */, self)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryChannels - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryChannels - response status :: %d', response.response.status);
						var queryTrans = _queryProto.ChannelQueryResponse.decode(response.response.payload);
						logger.debug('queryChannels - ProcessedTransaction.channelInfo.length :: %s', queryTrans.channels.length);
						for (let i=0; i<queryTrans.channels.length; i++) {
							logger.debug('>>> channel id %s ',queryTrans.channels[i].channel_id);
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
	 * @returns {Promise} Promise for a {@link ChaincodeQueryResponse} object
	 */
	queryInstalledChaincodes(peer) {
		logger.debug('queryInstalledChaincodes - start peer %s',peer);
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var txId = new TransactionID(this._userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.LSCC,
			txId: txId,
			fcn : 'getinstalledchaincodes',
			args: []
		};
		return Channel.sendTransactionProposal(request, '' /* special channel id */, self)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryInstalledChaincodes - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying one peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryInstalledChaincodes - response status :: %d', response.response.status);
						var queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
						logger.debug('queryInstalledChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
						for (let i=0; i<queryTrans.chaincodes.length; i++) {
							logger.debug('>>> name %s, version %s, path %s',queryTrans.chaincodes[i].name,queryTrans.chaincodes[i].version,queryTrans.chaincodes[i].path);
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
	 * @property {Peer[]} targets - Required. An array of Peer objects that the chaincode will
	 *                              be installed on
	 * @property {string} chaincodePath - Required. The path to the location of the source code
	 *                                    of the chaincode. If the chaincode type is golang, then
	 *                                    this path is the fully qualified package name, such as
	 *                                    'mycompany.com/myproject/mypackage/mychaincode'
	 * @property {string} chaincodeId - Required. Name of the chaincode
	 * @property {string} chaincodeVersion - Required. Version string of the chaincode, such as 'v1'
	 * @property {byte[]} chaincodePackage - Optional. Byte array of the archive content for the chaincode
	 *                            source. The archive must have a 'src' folder containing subfolders corresponding
	 *                            to the 'chaincodePath' field. For instance, if the chaincodePath is
	 *                            'mycompany.com/myproject/mypackage/mychaincode', then the archive must contain a
	 *                            folder 'src/mycompany.com/myproject/mypackage/mychaincode', where the
	 *                            GO source code resides.
	 * @property {string} chaincodeType - Optional. Type of chaincode. One of 'golang', 'car' or 'java'.
	 *                                    Default is 'golang'. Note that 'java' is not supported as of v1.0.
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

		var errorMsg = null;

		var peers = null;
		if (request) {
			peers = request.targets;
			// Verify that a Peer has been added
			if (peers && peers.length > 0) {
				logger.debug('installChaincode - found peers ::%s',peers.length);
			}
			else {
				errorMsg = 'Missing peer objects in install chaincode request';
			}
		}
		else {
			errorMsg = 'Missing input request object on install chaincode request';
		}

		if (!errorMsg) errorMsg = clientUtils.checkProposalRequest(request, true);
		if (!errorMsg) errorMsg = clientUtils.checkInstallRequest(request);

		if (errorMsg) {
			logger.error('installChaincode error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let self = this;

		let ccSpec = {
			type: clientUtils.translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			}
		};
		logger.debug('installChaincode - ccSpec %s ',JSON.stringify(ccSpec));

		// step 2: construct the ChaincodeDeploymentSpec
		let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
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
			let lcccSpec = {
				type: _ccProto.ChaincodeSpec.Type.GOLANG,
				chaincode_id: {
					name: Constants.LSCC
				},
				input: {
					args: [Buffer.from('install', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
				}
			};

			var header, proposal;
			var userContext = self.getUserContext();
			var txId = new TransactionID(userContext);
			var channelHeader = clientUtils.buildChannelHeader(
				_commonProto.HeaderType.ENDORSER_TRANSACTION,
				'', //install does not target a channel
				txId.getTransactionID(),
				null,
				Constants.LSCC
			);
			header = clientUtils.buildHeader(userContext.getIdentity(), channelHeader, txId.getNonce());
			proposal = clientUtils.buildProposal(lcccSpec, header);
			let signed_proposal = clientUtils.signProposal(userContext.getSigningIdentity(), proposal);
			logger.debug('installChaincode - about to sendPeersProposal');
			return clientUtils.sendPeersProposal(peers, signed_proposal, timeout)
			.then(
				function(responses) {
					return [responses, proposal, header];
				}
			);
		});
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
		var err = '';

		var methods = sdkUtils.getClassMethods(api.KeyValueStore);
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

	/**
	 * Persist the current <code>userContext</code> to the key value store.
	 *
	 * @returns {Promise} A Promise for the userContext object upon successful persistence
	 */
	saveUserToStateStore() {
		var self = this;
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
				if (self._userContext == null) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
					reject(new Error('Cannot save user to state store when userContext is null.'));
				} else if (self._userContext._name == null) {
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
	 * Sets an instance of the {@link User} class as the security context of this client instance. This user’s
	 * signing identity (the private key and its corresponding certificate), will be used to sign all requests
	 * with the fabric backend.
	 * <br><br>
	 * Upon setting the user context, the SDK saves the object in a persistence cache if the “state store”
	 * has been set on the Client instance. If no state store has been set, this cache will not be established
	 * and the application is responsible for setting the user context again if the application crashes and is recovered.
	 *
	 * @param {User} user - An instance of the User class encapsulating the authenticated user’s signing materials
	 *                      (private key and enrollment certificate)
	 * @param {boolean} skipPersistence - Whether to skip saving the user object into persistence. Default is false and the
	 *                                    method will attempt to save the user object to the state store.
	 * @returns {Promise} Promise of the 'user' object upon successful persistence of the user to the state store
	 */
	setUserContext(user, skipPersistence) {
		logger.debug('setUserContext, user: ' + user + ', skipPersistence: ' + skipPersistence);
		var self = this;
		return new Promise((resolve, reject) => {
			if (user) {
				self._userContext = user;
				if (!skipPersistence) {
					logger.debug('setUserContext begin promise to saveUserToStateStore');
					self.saveUserToStateStore()
					.then((user) => {
						return resolve(user);
					}).catch((err) => {
						reject(err);
					});
				} else {
					logger.debug('setUserContext, resolved user');
					return resolve(user);
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
	 *                           state store has not been set. If "checkPersistence" is not specified or falsey, then the user object
	 *                           is returned synchronously.
	 */
	getUserContext(name, checkPersistence) {
		// first check if only one param is passed in for "checkPersistence"
		if (typeof name === 'boolean' && name && typeof checkPersistence === 'undefined')
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is undefined');

		if (typeof checkPersistence === 'boolean' && checkPersistence &&
			(typeof name !== 'string' || name === null || name === ''))
			throw new Error('Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value');

		var self = this;
		var username = name;
		if ((self._userContext && name && self._userContext.getName() === name) || (self._userContext && !name)) {
			if (typeof checkPersistence === 'boolean' && checkPersistence)
				return Promise.resolve(self._userContext);
			else
				return self._userContext;
		} else {
			if (typeof username === 'undefined' || !username) {
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
								return self.setUserContext(userContext, false);
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
		var self = this;

		return new Promise(function(resolve, reject) {
			self._stateStore.getValue(name)
			.then(
				function(memberStr) {
					if (memberStr) {
						// The member was found in the key value store, so restore the state.
						var newUser = new User(name);
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
	 * @property {IdentityFiles | IdentityPEMs} cryptoContent - the private key and certificate
	 */

	/**
	 * @typedef {Object} IdentityFiles
	 * @property {string} privateKey - the PEM file path for the private key
	 * @property {string} signedCert - the PEM file path for the certificate
	 */

	/**
	 * @typedef {Object} IdentityPEMs
	 * @property {string} privateKeyPEM - the PEM string for the private key
	 * @property {string} signedCertPEM - the PEM string for the certificate
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
		logger.debug('opts = %s', JSON.stringify(opts));
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
			if ((opts.cryptoContent.privateKey || opts.cryptoContent.signedCert) &&
				(!opts.cryptoContent.privateKey || !opts.cryptoContent.signedCert)) {
				return Promise.reject(new Error('Client.createUser both parameters \'opts cryptoContent privateKey and signedCert\' files are required.'));
			}
			if ((opts.cryptoContent.privateKeyPEM || opts.cryptoContent.signedCertPEM) &&
				(!opts.cryptoContent.privateKeyPEM || !opts.cryptoContent.signedCertPEM)) {
				return Promise.reject(new Error('Client.createUser both parameters \'opts cryptoContent privateKeyPEM and signedCertPEM\' strings are required.'));
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

		var self = this;
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
			} else {
				promise = Promise.resolve(opts.cryptoContent.privateKeyPEM);
			}
			promise.then((data) => {
				if (data) {
					logger.debug('then privateKeyPEM data');
					var opt1;
					if (self.getCryptoSuite()._cryptoKeyStore) {
						opt1 = {ephemeral: false};
					} else {
						opt1 = {ephemeral: true};
					}
					return self.getCryptoSuite().importKey(data.toString(), opt1);
				} else {
					throw new Error('failed to load private key data');
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
				return self.setUserContext(member);
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
			resolve(Packager.package(request.chaincodePath, request.chaincodeType, devMode));
		} else {
			resolve(request.chaincodePackage);
		}
	});
}

// internal utility method to check and convert any strings to protobuf signatures
function _stringToSignature(string_signatures) {
	var signatures = [];
	for(var i in string_signatures) {
		let signature = string_signatures[i];
		// check for properties rather than object type
		if(signature && signature.signature_header && signature.signature) {
			logger.debug('_stringToSignature - signature is protobuf');
		}
		else {
			logger.debug('_stringToSignature - signature is string');
			var signature_bytes = Buffer.from(signature, 'hex');
			signature = _configtxProto.ConfigSignature.decode(signature_bytes);
		}
		signatures.push(signature);
	}
	return signatures;
}

module.exports = Client;
