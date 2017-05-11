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
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

var api = require('./api.js');
var User = require('./User.js');
var Chain = require('./Chain.js');
var ChannelConfig = require('./ChannelConfig.js');
var Packager = require('./Packager.js');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var MSP = require('./msp/msp.js');
var MSPManager = require('./msp/msp-manager.js');
var logger = sdkUtils.getLogger('Client.js');
var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var Constants = require('./Constants.js');

var grpc = require('grpc');
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;

/**
 * Main interaction handler with end user. A client instance provides a handler to interact
 * with a network of peers, orderers and optionally member services. An application using the
 * SDK may need to interact with multiple networks, each through a separate instance of the Client.
 *
 * Each client when initially created should be initialized with configuration data from the
 * consensus service, which includes a list of trusted roots, orderer certificates and IP addresses,
 * and a list of peer certificates and IP addresses that it can access. This must be done out of band
 * as part of bootstrapping the application environment. It is also the responsibility of the application
 * to maintain the configuration of a client as the SDK does not persist this object.
 *
 * Each Client instance can maintain several {@link Chain} instances representing channels and the associated
 * private ledgers.
 *
 * @class
 *
 */
var Client = class {

	constructor() {
		logger.debug('const - new Client');
		this._chains = {};
		this._stateStore = null;
		this._cryptoSuite = null;
		this._userContext = null;
		// keep a collection of MSP's
		this._msps = new Map();

		// Is in dev mode or network mode
		this._devMode = false;
	}

	/**
 	 * Returns a new instance of the CryptoSuite API implementation
	 *
	 * @param {object} setting This optional parameter is an object with the following optional properties:
	 * - software {boolean}: Whether to load a software-based implementation (true) or HSM implementation (false)
   	 *    default is true (for software based implementation), specific implementation module is specified
	 *    in the setting 'crypto-suite-software'
	 * - keysize {number}: The key size to use for the crypto suite instance. default is value of the setting 'crypto-keysize'
	 * - algorithm {string}: Digital signature algorithm, currently supporting ECDSA only with value "EC"
	 * - hash {string}: 'SHA2' or 'SHA3'
	 * @param {function} KVSImplClass Optional. The built-in key store saves private keys. The key store may be backed by different
	 * {@link KeyValueStore} implementations. If specified, the value of the argument must point to a module implementing the
	 * KeyValueStore interface.
	 * @param {object} opts Implementation-specific option object used in the constructor
	 * returns a new instance of the CryptoSuite API implementation
	 */
	newCryptoSuite(setting, KVSImplClass, opts) {
		this._cryptoSuite = sdkUtils.newCryptoSuite(setting, KVSImplClass, opts);
		return this._cryptoSuite;
	}

	setCryptoSuite(cryptoSuite) {
		this._cryptoSuite = cryptoSuite;
	}

	getCryptoSuite() {
		return this._cryptoSuite;
	}

	/**
	 * Determine if dev mode is enabled.
	 */
	isDevMode() {
		return this._devMode;
	}

	/**
	 * Set dev mode to true or false.
	 */
	setDevMode(devMode) {
		this._devMode = devMode;
	}

	/**
	 * Returns a chain instance with the given name. This represents a channel and its associated ledger
	 * (as explained above), and this call returns an empty object. To initialize the chain in the blockchain network,
	 * a list of participating endorsers and orderer peers must be configured first on the returned object.
	 * @param {string} name The name of the chain.  Recommend using namespaces to avoid collision.
	 * @returns {Chain} The uninitialized chain instance.
	 * @throws {Error} if the chain by that name already exists in the application's state store
	 */
	newChain(name) {
		var chain = this._chains[name];

		if (chain)
			throw new Error(util.format('Chain %s already exists', name));

		var chain = new Chain(name, this);
		this._chains[name] = chain;
		return chain;
	}

	/**
	 * Get a {@link Chain} instance from the state storage. This allows existing chain instances to be saved
	 * for retrieval later and to be shared among instances of the application. Note that it’s the
	 * application/SDK’s responsibility to record the chain information. If an application is not able
	 * to look up the chain information from storage, it may call another API that queries one or more
	 * Peers for that information.
	 * @param {string} name The name of the chain.
	 * @returns {Chain} The chain instance
	 * @throws {Error} if the state store has not been set or a chain does not exist under that name.
	 */
	getChain(name) {
		var ret = this._chains[name];

		// TODO: integrate reading from state store

		if (ret)
			return ret;
		else {
			logger.error('Chain not found for name '+name+'.');
			throw new Error('Chain not found for name '+name+'.');
		}
	}

    /**
	 * Returns a peer instance with the given url.
	 * @param {string} url - The URL with format of "grpcs://host:port".
	 * @param {Object} opts - The options for the connection to the peer.
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 * @returns {Peer} The Peer instance.
	 */
	newPeer(url, opts) {
		var peer = new Peer(url, opts);
		return peer;
	}

    /**
	 * Returns an order instance with the given url.
	 * @param {string} url The URL with format of "grpcs://host:port".
	 * @param {Object} opts The options for the connection to the peer.
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 * @returns {Orderer} The orderer instance.
	 */
	newOrderer(url, opts) {
		var orderer = new Orderer(url, opts);
		return orderer;
	}

	/**
	 * build an new MSP with the definition.
	 * @parm {Object} which has the following the following fields:
	 *		<br>`id`: {string} value for the identifier of this instance
	 *		<br>`rootCerts`: array of {@link Identity} representing trust anchors for validating
	 *           signing certificates. Required for MSPs used in verifying signatures
	 *		<br>`intermediateCerts`: array of {@link Identity} representing trust anchors for validating
	 *           signing certificates. optional for MSPs used in verifying signatures
	 *		<br>`admins`: array of {@link Identity} representing admin privileges
	 *@return {MSP} The newly created MSP object.
	 */
	newMSP(msp_def) {
		var msp = null;
		if(msp_def && msp_def.id) {
			if(!msp_def.cryptoSuite) {
				msp_def.cryptoSuite = sdkUtils.newCryptoSuite();
			}
			msp = new MSP(msp_def);
		}
		else {
			throw new Error('MSP definition is missing the "id" field.');
		}
		return msp;
	}

	/*
	 * For test only
	 *
	 * Build an configuration update envelope for the provided channel based on
	 * configuration definition provided and from the MSP's added to this client.
	 * The result of the build must be signed and then may be used to update
	 * the channel.
	 * @param {Object} A JSON object that has the following attributes...TODO fill out
	 * @param {Chain} The Chain instance that represents the channel. An Orderer must assigned
	 *                to this chain to retrieve the current concurrent configuration.
	 * @param {MSP[]} An array of MSPs that will be referenced by the configuration definition
	 * @return {byte[]} A Promise for a byte buffer object that is the byte array representation of the
	 *                  Protobuf common.ConfigUpdate
	 * @see /protos/common/configtx.proto
	 */
	buildChannelConfigUpdate(config_definition, chain, msps) {
		logger.debug('buildChannelConfigUpdate - start');
		try {
			ChannelConfig.validate(config_definition);
		}
		catch(err) {
			logger.error(err);
			return Promise.reject(err);
		}
		if(!(chain instanceof Chain)) {
			return Promise.reject(
				new Error('Building a channel configuration update requires an existing "Chain" object'));
		}
		return chain.buildChannelConfigUpdate(config_definition, msps);
	}

	/*
	 * For test only
	 *
	 * Build an configuration that is the channel configuration definition from the
	 * provide MSPs added to this client, the Channel definition input parameters, and
	 * system information from the provided Orderer.
	 * The result of the build must be signed and then may be used to create a channel.
	 * @param {Object} A JSON object that has the following attributes...TODO fill out
	 * @param {Orderer} An Orderer that will be used to create this channel. This Orderer will be
	 *                  used to retrieve required system chain settings used in the building of this
	 *                  channel definition.
	 * @param {MSP[]} An array of MSPs that will be referenced by the configuration definition
	 * @return {byte[]} A Promise for a byte buffer object that is the byte array representation of the
	 *                  Protobuf common.ConfigUpdate
	 * @see /protos/common/configtx.proto
	 */
	buildChannelConfig(config_definition, orderer, msps) {
		logger.debug('buildChannelConfig - start');
		try {
			ChannelConfig.validate(config_definition);
		}
		catch(err) {
			logger.error(err);
			return Promise.reject(err);
		}

		var chain = new Chain(config_definition.channel.name, this);
		chain.addOrderer(orderer);
		return chain.buildChannelConfig(config_definition, msps);
	}

	/**
	 * Extracts the protobuf 'ConfigUpdate' object out of the 'ConfigEnvelope'
	 * that is produced by the ConfigTX tool. The returned object may then be
	 * signed using the signChannelConfig() method of this class. Once the all
	 * signatures have been collected this object and the signatures may be used
	 * on the updateChannel or createChannel requests.
	 * @param {byte[]} The bytes of the ConfigEnvelope protopuf
	 * @returns {byte[]} The bytes of the ConfigUpdate protobuf
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
	 * Sign a configuration
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
	 * Calls the orderer to start building the new channel.
	 * Only one of the application instances needs to call this method.
	 * Once the chain is successfully created, this and other application
	 * instances only need to call Chain joinChannel() to participate on the channel.
	 * @param {Object} request - An object containing the following fields:
	 *      <br>`name` : required - {string} The name of the new channel
	 *      <br>`orderer` : required - {Orderer} object instance representing the
	 *                      Orderer to send the create request
	 *      <br>`envelope` : optional - byte[] of the envelope object containing all
	 *                       required settings and signatures to initialize this channel.
	 *                       This envelope would have been created by the command
	 *                       line tool "configtx".
	 *      <br>`config` : optional - {byte[]} Protobuf ConfigUpdate object extracted from
	 *                     a ConfigEnvelope created by the ConfigTX tool.
	 *                     see extractChannelConfig()
	 *      <br>`signatures` : optional - {ConfigSignature[]} the list of collected signatures
	 *                         required by the channel create policy when using the `config` parameter.
	 * @returns {Result} Result Object with status on the create process.
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
	 * Only one of the application instances needs to call this method.
	 * @param {Object} request - An object containing the following fields:
	 *      <br>`name` : required - {string} The name of the new channel
	 *      <br>`orderer` : required - {Orderer} object instance representing the
	 *                      Orderer to send the update request
	 *      <br>`envelope` : optional - byte[] of the envelope object containing all
	 *                       required settings and signatures to initialize this channel.
	 *                       This envelope would have been created by the command
	 *                       line tool "configtx".
	 *      <br>`config` : optional - {byte[]} Protobuf ConfigUpdate object built by the
	 *                     buildChannelConfig() method of this class.
	 *      <br>`signatures` : optional - {ConfigSignature[]} the list of collected signatures
	 *                         required by the channel create policy when using the `config` parameter.
	 *                         see signChannelConfig() method of this class
	 * @returns {Result} Result Object with status on the update process.
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
			if(!request.nonce && !have_envelope) {
				errorMsg = 'Missing nonce request parameter';
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
		var chain_id = request.name;
		var orderer = request.orderer;
		var userContext = null;
		var chain = null;

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
			proto_config_Update_envelope.setSignatures(request.signatures);

			var proto_channel_header = Chain._buildChannelHeader(
				_commonProto.HeaderType.CONFIG_UPDATE,
				request.name,
				request.txId
			);

			var proto_header = Chain._buildHeader(userContext.getIdentity(), proto_channel_header, request.nonce);
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
	 * This is a network call to the designated Peer(s) to discover the chain information.
	 * The target Peer(s) must be part of the chain to be able to return the requested information.
	 * @param {string} name The name of the chain.
	 * @param {Peer[]} peers Array of target Peers to query.
	 * @returns {Chain} The chain instance for the name or error if the target Peer(s) does not know
	 * anything about the chain.
	 */
	queryChainInfo(name, peers) {
		//to do
	}

	/**
	 * Queries the names of all the channels that a
	 * peer has joined.
	 * @param {Peer} peer
	 * @returns {Promise} A promise to return a ChannelQueryResponse proto Object
	 */
	queryChannels(peer) {
		logger.debug('queryChannels - start');
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var nonce = sdkUtils.getNonce();
		var userContext = this.getUserContext();
		var txId = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [peer],
			chaincodeId : 'cscc',
			chainId: '',
			txId: txId,
			nonce: nonce,
			fcn : 'GetChannels',
			args: []
		};
		return Chain.sendTransactionProposal(request, self)
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
	 * Queries the installed chaincodes on a peer
	 * returning the details of all chaincodes
	 * installed on a peer.
	 * @param {Peer} peer
	 * @returns {object} ChaincodeQueryResponse proto
	 */
	queryInstalledChaincodes(peer) {
		logger.debug('queryInstalledChaincodes - start peer %s',peer);
		if(!peer) {
			return Promise.reject( new Error('Peer is required'));
		}
		var self = this;
		var nonce = sdkUtils.getNonce();
		var userContext = self.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.LSCC,
			chainId: 'mychannel',
			txId: tx_id,
			nonce: nonce,
			fcn : 'getinstalledchaincodes',
			args: []
		};
		return Chain.sendTransactionProposal(request, self)
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
	 * Sends an install proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chaincodeVersion` : required - String of the version of the chaincode
	 *		<br>`chaincodePackage` : optional - Byte array of the archive content for
	 *                               the chaincode source. The archive must have a 'src'
	 *                               folder containing subfolders corresponding to the
	 *                               'chaincodePath' field. For instance, if the chaincodePath
	 *                               is 'mycompany/myproject', then the archive must contain a
	 *                               folder at the path 'src/mycompany/myproject', where the
	 *                               GO source code resides.
	 *		<br>`chaincodeType` : optional - Type of chaincode ['golang', 'car', 'java']
	 *                   (default 'golang')
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	installChaincode(request) {
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


		// modify the request so the following checks will be OK
		if(request) {
			request.chainId = 'dummy';
		}

		if (!errorMsg) errorMsg = Chain._checkProposalRequest(request);
		if (!errorMsg) errorMsg = Chain._checkInstallRequest(request);

		if (errorMsg) {
			logger.error('installChaincode error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let self = this;

		let ccSpec = {
			type: Chain._translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			}
		};
		logger.debug('installChaincode ccSpec %s ',JSON.stringify(ccSpec));

		// step 2: construct the ChaincodeDeploymentSpec
		let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);
		chaincodeDeploymentSpec.setEffectiveDate(Chain._buildCurrentTimestamp()); //TODO may wish to add this as a request setting

		return _getChaincodePackageData(request, this.isDevMode())
		.then((data) => {
			logger.debug('installChaincode data %s ',data);
			// DATA may or may not be present depending on devmode settings
			if (data) {
				chaincodeDeploymentSpec.setCodePackage(data);
			}
			logger.debug('installChaincode sending deployment spec %s ',chaincodeDeploymentSpec);

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
			var txId = Chain.buildTransactionID(request.nonce, userContext);
			var channelHeader = Chain._buildChannelHeader(
				_commonProto.HeaderType.ENDORSER_TRANSACTION,
				'', //install does not target a channel
				txId,
				null,
				Constants.LSCC
			);
			header = Chain._buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
			proposal = Chain._buildProposal(lcccSpec, header);
			let signed_proposal = Chain._signProposal(userContext.getSigningIdentity(), proposal);

			return Chain._sendPeersProposal(peers, signed_proposal)
			.then(
				function(responses) {
					return [responses, proposal, header];
				}
			);
		});
	}

	/**
	 * The enrollment materials for Users that have appeared in the instances of the application.
	 *
	 * The SDK should have a built-in key value store file-based implementation to allow easy setup during
	 * development. Production systems would use a store backed by database for more robust storage and
	 * clustering, so that multiple app instances can share app state via the database.
	 * This API makes this pluggable so that different store implementations can be selected by the application.
	 * @param {KeyValueStore} keyValueStore Instance of an alternative KeyValueStore implementation provided by
	 * the consuming app.
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
	 * Save the state of this member to the key value store.
	 * @returns {Promise} A Promise for the user context object upon successful save
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
	 * Sets an instance of the User class as the security context of self client instance. This user’s
	 * credentials (ECert), or special transaction certificates that are derived from the user's ECert,
	 * will be used to conduct transactions and queries with the blockchain network.
	 * Upon setting the user context, the SDK saves the object in a persistence cache if the “state store”
	 * has been set on the Client instance. If no state store has been set, this cache will not be established
	 * and the application is responsible for setting the user context again if the application crashes and is recovered.
	 *
	 * @param {User} user An instance of the User class encapsulating the authenticated user’s signing materials
	 * (private key and enrollment certificate)
	 * @param {boolean} skipPersistence Whether to skip saving the user object into persistence. Default is false and the
	 * method will attempt to save the user object to the state store.
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
	 * Returns the user with the signing identity. This can be a synchronous call or asynchronous call, depending
	 * on whether "checkPersistent" is truthy or not. If truthy, the method is asynchronous and returns a Promise,
	 * otherwise it's synchronous.
	 *
	 * As explained above, the client instance can have an optional state store. The SDK saves enrolled users
	 * in the storage which can be accessed by authorized users of the application (authentication is done by
	 * the application outside of the SDK). This function attempts to load the user by name from the local storage
	 * (via the KeyValueStore interface). The loaded user object must represent an enrolled user with a valid
	 * enrollment certificate signed by a trusted CA (such as the CA server).
	 *
	 * @param {String} name Optional. If not specified, will only return the in-memory user context object, or null
	 * if not found in memory. If "name" is specified, will also attempt to load it from the state store if search
	 * in memory failed.
	 * @param {boolean} checkPersistence Optional. If specified and truthy, the method returns a Promise and will
	 * attempt to check the state store for the requested user by the "name". If not specified or falsey, the method
	 * is synchronous and returns the requested user from memory
	 * @returns {Promise} The user object corresponding to the name, or null if the user does not exist or if the
	 * state store has not been set.
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
	 * Restore the state of this member from the key value store (if found).  If not found, do nothing.
	 * @returns {Promise} A Promise for a {User} object upon successful restore, or if the user by the name
	 * does not exist in the state store, returns null without rejecting the promise
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
						if (!self._cryptoSuite) {
							logger.info('loadUserFromStateStore, cryptoSuite is not set, will load using defaults');
						}
						newUser.setCryptoSuite(self._cryptoSuite);

						return newUser.fromString(memberStr);
					} else {
						return null;
					}
				})
			.then(function(data) {
				if (data) {
					logger.info('Successfully loaded user "%s" from local key value store', name);
					return resolve(data);
				} else {
					logger.info('Failed to load user "%s" from local key value store', name);
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
	 * A convenience method for obtaining the state store object in use for this client.
	 * @return {KeyValueStore} The KeyValueStore implementation object set within this Client, or null if it does not exist.
	 */
	getStateStore() {
		return this._stateStore;
	}

	/**
	* Utility method to build an unique transaction id
	* based on a nonce and the user context.
	* @param {int} nonce - a one time use number
	* @param {User} userContext - the user context
	* @returns {string} An unique string
	*/
	static buildTransactionID(nonce, userContext) {
		return Chain.buildTransactionID(nonce, userContext);
	}

	/**
	 * Returns an authorized user loaded using the
	 * private key and pre-enrolled certificate from files
	 * based on the MSP config directory structure:
	 * <br>root
	 * <br>&nbsp;&nbsp;&nbsp;\_ keystore
	 * <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\_ admin.pem  <<== this is the private key saved in PEM file
	 * <br>&nbsp;&nbsp;&nbsp;\_ signcerts
	 * <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\_ admin.pem  <<== this is the signed certificate saved in PEM file
	 * @param {object} opts
	 * <br>- username {string} - the user name used for enrollment
	 * <br>- mspid {string} - the MSP id
	 * <br>
	 * <br>- cryptoContent {object}
	 * <br>---- privateKey {string} - the PEM file name including the root path - required when using the file system
	 * <br>---- signedCert {string} - the PEM file name including the root path - required when using the file system
	 * <br>---- or
	 * <br>---- privateKeyPEM {string} - the PEM string - required when no file system is available
	 * <br>---- signedCertPEM {string} - the PEM string - required when no file system is available
	 *
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

		if (this._cryptoSuite == null) {
			this._cryptoSuite = sdkUtils.newCryptoSuite();
		}
		var self = this;
		return new Promise((resolve, reject) => {
			logger.info('loading user from files');
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
				logger.debug('then privateKeyPEM data');
				return self._cryptoSuite.importKey(data.toString());
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
				member.setCryptoSuite(self._cryptoSuite);
				return member.setEnrollment(importedKey, data.toString(), opts.mspid);
			}).then(() => {
				logger.debug('then setUserContext');
				return self.setUserContext(member);
			}).then((user) => {
				logger.debug('then user');
				return resolve(user);
			}).catch((err) => {
				logger.error(err.stack ? err.stack : err);
				return reject(new Error('Failed to load key or certificate and save to local stores.'));
			});
		});
	}

	/**
	 * Obtains an instance of the [KeyValueStore]{@link module:api.KeyValueStore} class. By default
	 * it returns the built-in implementation, which is based on files ([FileKeyValueStore]{@link module:api.FileKeyValueStore}).
	 * This can be overriden with an environment variable KEY_VALUE_STORE, the value of which is the
	 * full path of a CommonJS module for the alternative implementation.
	 *
	 * @param {Object} options is whatever the implementation requires for initializing the instance. For the built-in
	 * file-based implementation, this requires a single property "path" to the top-level folder for the store
	 * @returns [KeyValueStore]{@link module:api.KeyValueStore} an instance of the KeyValueStore implementation
	 */
	static newDefaultKeyValueStore(options) {
		return sdkUtils.newKeyValueStore(options);
	}

	/**
	 * Configures a logger for the entire HFC SDK to use and override the default logger. Unless this method is called,
	 * HFC uses a default logger (based on winston). When using the built-in "winston" based logger, use the environment
	 * variable HFC_LOGGING to pass in configurations in the following format:
	 *
	 * {
	 *   'error': 'error.log',				// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
	 *   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
	 *   'info': 'console'					// 'console' is a keyword for logging to console
	 * }
	 *
	 * @param {Object} logger a logger instance that defines the following methods: debug(), info(), warn(), error() with
	 * string interpolation methods like [util.format]{@link https://nodejs.org/api/util.html#util_util_format_format}.
	 */
	static setLogger(logger) {
		var err = '';

		if (typeof logger.debug !== 'function') {
			err += 'debug() ';
		}

		if (typeof logger.info !== 'function') {
			err += 'info() ';
		}

		if (typeof logger.warn !== 'function') {
			err += 'warn() ';
		}

		if (typeof logger.error !== 'function' ) {
			err += 'error()';
		}

		if (err !== '') {
			throw new Error('The "logger" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		if (global.hfc) {
			global.hfc.logger = logger;
		} else {
			global.hfc = {
				logger: logger
			};
		}
	}

	/**
	 * Adds a file to the top of the list of configuration setting files that are
	 * part of the hierarchical configuration.
	 * These files will override the default settings and be overriden by environment,
	 * command line arguments, and settings programmatically set into configuration settings.
	 *
	 * hierarchy search order:
	 *  1. memory - all settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} path - The path to the file to be added to the top of list of configuration files
	 */
	static addConfigFile(path) {

		sdkUtils.addConfigFile(path);
	}

	/**
	 * Adds a setting to override all settings that are
	 * part of the hierarchical configuration.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with this call
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} value - The value of a setting
	 */
	static setConfigSetting(name, value) {

		sdkUtils.setConfigSetting(name, value);
	}

	/**
	 * Retrieves a setting from the hierarchical configuration and if not found
	 * will return the provided default value.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} default_value - The value of a setting if not found in the hierarchical configuration
	 */
	static getConfigSetting(name, default_value) {

		return sdkUtils.getConfigSetting(name, default_value);
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
/**
 * @private
 */
function _getChaincodePackageData(request, devMode) {
	return new Promise((resolve,reject) => {
		if (!request.chaincodePackage) {
			resolve(Packager.package(request.chaincodePath, request.chaincodeType, devMode));
		} else {
			resolve(request.chaincodePackage);
		}
	});
}

module.exports = Client;
