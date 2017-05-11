/*
 Copyright 2016, 2017 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var api = require('./api.js');
var utils = require('./utils.js');
var urlParser = require('url');
var net = require('net');
var util = require('util');
var os = require('os');
var path = require('path');
var ChannelConfig = require('./ChannelConfig.js');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var Block = require('./Block.js');
var settle = require('promise-settle');
var grpc = require('grpc');
var logger = utils.getLogger('Chain.js');
var hashPrimitives = require('./hash.js');
var MSPManager = require('./msp/msp-manager.js');
var Policy = require('./Policy.js');
var Constants = require('./Constants.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;
var _peerConfigurationProto = grpc.load(__dirname + '/protos/peer/configuration.proto').protos;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;
var _ledgerProto = grpc.load(__dirname + '/protos/common/ledger.proto').common;
var _commonConfigurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
var _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/mspconfig.proto').msp;
var _mspPrincipalProto = grpc.load(__dirname + '/protos/common/msp_principal.proto').common;
var _timestampProto = grpc.load(__dirname + '/protos/google/protobuf/timestamp.proto').google.protobuf;
var _identityProto = grpc.load(path.join(__dirname, '/protos/identity.proto')).msp;

const ImplicitMetaPolicy_Rule = {0: 'ANY', 1:'ALL', 2:'MAJORITY'};
var Long = require('long');

/**
 * The class representing a chain with which the client SDK interacts.
 *
 * The “Chain” object captures settings for a channel, which is created by
 * the orderers to isolate transactions delivery to peers participating on channel.
 * A chain must be initialized after it has been configured with the list of peers
 * and orderers. The initialization sends a get configuration block request to the
 * primary orderer to retrieve the configuration settings for this channel.
 *
 * @class
 * @tutorial app-overview
 */
var Chain = class {

	/**
	 * @param {string} name to identify different chain instances. The naming of chain instances
	 * is enforced by the ordering service and must be unique within the blockchain network
	 * @param {Client} clientContext An instance of {@link Client} that provides operational context
	 * such as submitting User etc.
	 */
	constructor(name, clientContext) {
		// name is required
		if (typeof name === 'undefined' || !name) {
			logger.error('Failed to create Chain. Missing requirement "name" parameter.');
			throw new Error('Failed to create Chain. Missing requirement "name" parameter.');
		}

		if (typeof clientContext === 'undefined' || !clientContext) {
			logger.error('Failed to create Chain. Missing requirement "clientContext" parameter.');
			throw new Error('Failed to create Chain. Missing requirement "clientContext" parameter.');
		}

		this._name = name;

		// Security enabled flag
		this._securityEnabled = true;//to do

		// The number of tcerts to get in each batch
		this._tcertBatchSize = utils.getConfigSetting('tcert-batch-size',200);

		// If in prefetch mode, we prefetch tcerts from member
		// services to help performance
		this._preFetchMode = true;//to do - not in doc

		this._peers = [];
		this._primary_peer = null; // if not set, will use the first peer on the list
		this._anchor_peers = [];
		this._orderers = [];
		this._kafka_brokers = [];

		this._clientContext = clientContext;

		this._msp_manager = new MSPManager();

		//to do update logger
		logger.debug('Constructed Chain instance: name - %s, ' +
		    'securityEnabled: %s, ' +
		    'TCert download batch size: %s, ' +
		    'network mode: %s',
			this._name,
			this._securityEnabled,
			this._tcertBatchSize,
			!this._devMode);
	}

	/**
	 * Retrieve the configuration from the primary orderer and initializes this chain (channel)
	 * with those values. Optionally a configuration may be passed in to initialize this channel
	 * without making the call to the orderer.
	 * @param {byte[]} config_update- Optional - A serialized form of the protobuf configuration update
	 * @return a Promise that will resolve when the action is complete
	 */
	initialize(config_update) {
		if(config_update) {
			this.loadConfigUpdate(config_update);
			return Promise.resolve(true);
		}

		var self = this;
		return this.getChannelConfig()
		.then(
			function(config_envelope) {
				logger.debug('initialize - got config envelope from getChannelConfig :: %j',config_envelope);
				var config_items = self.loadConfigEnvelope(config_envelope);
				return Promise.resolve(config_items);
			}
		)
		.catch(
			function(error) {
				logger.error('initialize - system error ::' + error.stack ? error.stack : error);
				return Promise.reject(new Error(error));
			}
		);
	}

	/**
	 * Get the chain name.
	 * @returns {string} The name of the chain.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Determine if security is enabled.
	 */
	isSecurityEnabled() {
		return true;//to do
	}

	/**
	 * Determine if pre-fetch mode is enabled to prefetch tcerts.
	 */
	isPreFetchMode() {
		return this._preFetchMode;
	}

	/**
	 * Set prefetch mode to true or false.
	 */
	setPreFetchMode(preFetchMode) {
		this._preFetchMode = preFetchMode;
	}

	/**
	 * Get the tcert batch size.
	 */
	getTCertBatchSize() {
		return this._tcertBatchSize;
	}

	/**
	 * Set the tcert batch size.
	 */
	setTCertBatchSize(batchSize) {
		this._tcertBatchSize = batchSize;
	}

	/**
	 * Get organizational unit identifiers from
	 * the MSP's for this channel
	 * @returns {string[]}
	 */
	getOrganizationUnits() {
		logger.debug('getOrganizationUnits - start');
		var msps = this._msp_manager.getMSPs();
		var orgs = [];
		if(msps) {
			var keys = Object.keys(msps);
			for(var key in keys) {
				var msp = msps[keys[key]];
				var msp_org = { id : msp.getId()};
				logger.debug('getOrganizationUnits - found %j',msp_org);
				orgs.push(msp_org);
			}
		}
		logger.debug('getOrganizationUnits - orgs::%j', orgs);
		return orgs;
	}

	/**
	 * Set the MSP Manager for this channel
	 * This utility method will not normally be use as the
	 * `initialize()` method will read this channel's
	 * current configuration and reset MSPManager with
	 * the MSP's found.
	 * @param {MSPManager} the msp manager for this channel
	 */
	setMSPManager(msp_manager) {
		this._msp_manager = msp_manager;
	}

	/**
	 * Get the MSP Manager for this channel
	 * @returns {MSPManager}
	 */
	getMSPManager() {
		return this._msp_manager;
	}

	/**
	 * Add peer endpoint to chain.
	 * @param {Peer} peer An instance of the Peer class that has been initialized with URL,
	 * TLC certificate, and enrollment certificate.
	 * @throws {Error} if the peer with that url already exists.
	 */
	addPeer(peer) {
		var url = peer.getUrl();
		for (let i = 0; i < this._peers.length; i++) {
			if (this._peers[i].getUrl() === url) {
				var error = new Error();
				error.name = 'DuplicatePeer';
				error.message = 'Peer with URL ' + url + ' already exists';
				logger.error(error.message);
				throw error;
			}
		}
		this._peers.push(peer);
	}

	/**
	 * Remove peer endpoint from chain.
	 * @param {Peer} peer An instance of the Peer class.
	 */
	removePeer(peer) {
		var url = peer.getUrl();
		for (let i = 0; i < this._peers.length; i++) {
			if (this._peers[i].getUrl() === url) {
				this._peers.splice(i, 1);
				logger.debug('Removed peer with url "%s".', url);
				return;
			}
		}
	}

	/**
	 * Get peers of a chain from local information.
	 * @returns {Peer[]} The peer list on the chain.
	 */
	getPeers() {
		logger.debug('getPeers - list size: %s.', this._peers.length);
		return this._peers;
	}

	/**
	 * Set the primary peer
	 * The peer to use for doing queries.
	 * Peer must be a peer on this chain's peer list.
	 * Default: When no primary peer has been set the first peer
	 * on the list will be used.
	 * @param {Peer} peer An instance of the Peer class.
	 * @throws Error when peer is not on the existing peer list
	 */
	setPrimaryPeer(peer) {
		if(peer) {
			for (let i = 0; i < this._peers.length; i++) {
				if (this._peers[i] === peer) {
					this._primary_peer = this._peers[i];
					return;
				}
			}
		}
		throw new Error('The primary peer must be on this chain\'s peer list');
	}

	/**
	 * Get the primary peer
	 * The peer to use for doing queries.
	 * Default: When no primary peer has been set the first peer
	 * on the list will be used.
	 * @returns {Peer} peer An instance of the Peer class.
	 */
	getPrimaryPeer() {
		logger.debug('getPrimaryPeer :: start');
		var result = this._primary_peer;
		if(!result) {
			result = this._peers[0];
			logger.info(' Primary peer was not set, using %s',result);
		}
		// return what we found
		return result;
	}

	/**
	 * Add orderer endpoint to a chain object, this is a local-only operation.
	 * A chain instance may choose to use a single orderer node, which will broadcast
	 * requests to the rest of the orderer network. Or if the application does not trust
	 * the orderer nodes, it can choose to use more than one by adding them to the chain instance.
	 * All APIs concerning the orderer will broadcast to all orderers simultaneously.
	 * @param {Orderer} orderer An instance of the Orderer class.
	 * @throws {Error} if the orderer with that url already exists.
	 */
	addOrderer(orderer) {
		var url = orderer.getUrl();
		for (let i = 0; i < this._orderers.length; i++) {
			if (this._orderers[i].getUrl() === url) {
				var error = new Error();
				error.name = 'DuplicateOrderer';
				error.message = 'Orderer with URL ' + url + ' already exists';
				logger.error(error.message);
				throw error;
			}
		}
		this._orderers.push(orderer);
	}

	/**
	 * Remove orderer endpoint from a chain object, this is a local-only operation.
	 * @param {Orderer} orderer An instance of the Orderer class.
	 */
	removeOrderer(orderer) {
		var url = orderer.getUrl();
		for (let i = 0; i < this._orderers.length; i++) {
			if (this._orderers[i].getUrl() === url) {
				this._orderers.splice(i, 1);
				logger.debug('Removed orderer with url "%s".', url);
				return;
			}
		}
	}

	/**
	 * Get orderers of a chain.
	 */
	getOrderers() {
		return this._orderers;
	}

	/*
	 * For test only
	 *
	 * Build a configuration envelope that is the channel configuration definition
	 * from the provide MSP's, the Channel definition input parameters, and the current
	 * configuration as read from the system channel.
	 * The result of the build will need to be signed and then may be used to create a new
	 * channel.
	 * @param {Object} A JSON object that represents the configuration settings to be changed.
	 * @param {MSP[]} A list of MSPs that may represent new or updates to existing MSPs
	 * @return {byte[]} A Promise for a byte buffer object that is the byte array representation
	 *                  of the Protobuf common.ConfigUpdate
	 * @see /protos/common/configtx.proto
	 */
	buildChannelConfig(config_definition, msps) {
		logger.debug('\n***\nbuildChannelConfig - start\n***\n');
		if (typeof config_definition === 'undefined' || config_definition === null) {
			return Promise.reject(new Error('Channel definition parameter is required.'));
		}

		// force the fetch to be against the system channel
		this._name = Constants.SYSTEM_CHANNEL_NAME;
		var self = this;

		return self.getChannelConfig()
		.then( function(config_envelope) {

			return self.loadConfigEnvelope(config_envelope);
		}).then( function(config_items) {
			logger.debug('buildChannelConfig -  version hierarchy  :: %j',config_items.versions);
			// get all the msps from the current configuration and from existing configuration
			var updated_msps = _combineMSPs(self._msp_manager.getMSPs(), msps);

			// build the config update protobuf
			var channel_config = new ChannelConfig(updated_msps);
			// build a create config which has the minimal readset
			var proto_channel_config = channel_config.build(config_definition, null);

			return proto_channel_config.toBuffer();
		}).catch(function(err) {
			logger.error('Failed buildChannelConfig. :: %s', err.stack ? err.stack : err);
			if(err instanceof Error) {
				throw err;
			}
			else {
				throw new Error(err);
			}
		});
	}

	/*
	 * For test only
	 *
	 * Build a configuration update envelope that is the channel configuration definition
	 * from the provide MSP's, the Channel definition input parameters, and the current
	 * configuration as read from this channel.
	 * The result of the build will need to be signed and then may be used to update this
	 * channel.
	 * @param {Object} A JSON object that represents the configuration settings to be changed.
	 * @param {MSP[]} A list of MSPs that may represent new or updates to existing MSPs
	 * @return {byte[]} A Promise for a byte buffer object that is the byte array representation
	 *                  of the Protobuf common.ConfigUpdate
	 * @see /protos/common/configtx.proto
	 */
	buildChannelConfigUpdate(config_definition, msps) {
		logger.debug('buildChannelConfigUpdate - start');
		if (typeof config_definition === 'undefined' || config_definition === null) {
			return Promise.reject(new Error('Channel definition update parameter is required.'));
		}

		var self = this;

		return self.initialize()
		.then( function(config_items) {
			logger.debug('buildChannelConfigUpdate -  version hierarchy  :: %j',config_items.versions);
			// get all the msps from the current configuration
			var updated_msps = _combineMSPs(self._msp_manager.getMSPs(), msps);
			var channel_config = new ChannelConfig(update_msps);
			var proto_channel_config = channel_config.build(config_definition, config_items.versions);
			return Promise.resolve( proto_channel_config.toBuffer());
		}).catch(function(err) {
			logger.error('Failed buildChannelConfigUpdate. :: %s', err.stack ? err.stack : err);
			return Promise.reject(err);
		});
		var channel_config = new ChannelConfig(updated_msps);
		var proto_channel_config = channel_config.build(config_definition, config_items.versions);

		return proto_channel_config.toBuffer();
	}

	/**
	 * Will get the genesis block from the defined orderer that may be
	 * used in a join request
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *
	 * @returns {Promise} A Promise for a protobuf `Block`
	 * @see /protos/peer/proposal_response.proto
	 */
	getGenesisBlock(request) {
		logger.debug('getGenesisBlock - start');
		var errorMsg = null;

		// verify that we have an orderer configured
		if(!this.getOrderers()[0]) {
			errorMsg = 'Missing orderer assigned to this channel for the getGenesisBlock request';
		}
		// verify that we have transaction id
		else if(!request.txId) {
			errorMsg = 'Missing txId input parameter with the required transaction identifier';
		}
		// verify that we have the nonce
		else if(!request.nonce) {
			errorMsg = 'Missing nonce input parameter with the required single use number';
		}

		if(errorMsg) {
			logger.error('getGenesisBlock - error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var userContext = null;
		var orderer = self.getOrderers()[0];

		userContext = this._clientContext.getUserContext();

		// now build the seek info , will be used once the chain is created
		// to get the genesis block back
		//   build start
		var seekSpecifiedStart = new _abProto.SeekSpecified();
		seekSpecifiedStart.setNumber(0);
		var seekStart = new _abProto.SeekPosition();
		seekStart.setSpecified(seekSpecifiedStart);

		//   build stop
		var seekSpecifiedStop = new _abProto.SeekSpecified();
		seekSpecifiedStop.setNumber(0);
		var seekStop = new _abProto.SeekPosition();
		seekStop.setSpecified(seekSpecifiedStop);

		// seek info with all parts
		var seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);

		// build the header for use with the seekInfo payload
		var seekInfoHeader = Chain._buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			request.txId,
			self._initial_epoch
		);

		var seekHeader = Chain._buildHeader(userContext.getIdentity(), seekInfoHeader, request.nonce);
		var seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		var seekPayloadBytes = seekPayload.toBuffer();

		let sig = userContext.getSigningIdentity().sign(seekPayloadBytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload : seekPayloadBytes
		};

		return orderer.sendDeliver(envelope);
	}

	/**
	 * Sends a join channel proposal to one or more endorsing peers
	 * Will get the genesis block from the defined orderer to be used
	 * in the proposal.
	 * @param {Object} request - An object containing the following fields:
	 *   <br>`targets` : required - An array of `Peer` objects that will join
	 *                   this channel
	 *   <br>`block` : the genesis block of the channel
	 *                 see getGenesisBlock() method
	 *   <br>`txId` : required - String of the transaction id
	 *   <br>`nonce` : required - Integer of the once time number
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	joinChannel(request) {
		logger.debug('joinChannel - start');
		var errorMsg = null;

		// verify that we have targets (Peers) to join this channel
		// defined by the caller
		if(!request) {
			errorMsg = 'Missing all required input request parameters';
		}

		// verify that a Peer(s) has been selected to join this channel
		else if (!request.targets) {
			errorMsg = 'Missing targets input parameter with the peer objects for the join channel proposal';
		}

		// verify that we have transaction id
		else if(!request.txId) {
			errorMsg = 'Missing txId input parameter with the required transaction identifier';
		}

		// verify that we have the nonce
		else if(!request.nonce) {
			errorMsg = 'Missing nonce input parameter with the required single use number';
		}

		else if(!request.block) {
			errorMsg = 'Missing block input parameter with the required genesis block';
		}

		if(errorMsg) {
			logger.error('joinChannel - error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var userContext = this._clientContext.getUserContext();
		var chaincodeInput = new _ccProto.ChaincodeInput();
		var args = [];
		args.push(Buffer.from('JoinChain', 'utf8'));
		args.push(request.block.toBuffer());

		chaincodeInput.setArgs(args);

		var chaincodeID = new _ccProto.ChaincodeID();
		chaincodeID.setName('cscc');

		var chaincodeSpec = new _ccProto.ChaincodeSpec();
		chaincodeSpec.setType(_ccProto.ChaincodeSpec.Type.GOLANG);
		chaincodeSpec.setChaincodeId(chaincodeID);
		chaincodeSpec.setInput(chaincodeInput);

		var channelHeader = Chain._buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			'',
			request.txId,
			null, //no epoch
			'cscc'
		);

		var header = Chain._buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
		var proposal = Chain._buildProposal(chaincodeSpec, header);
		var signed_proposal = Chain._signProposal(userContext.getSigningIdentity(), proposal);

		return Chain._sendPeersProposal(request.targets, signed_proposal)
		.then(
			function(responses) {
				return Promise.resolve(responses);
			}
		).catch(
			function(err) {
				logger.error('joinChannel - Failed Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries for the current config block for this chain(channel).
	 * This transaction will be made to the orderer.
	 * @returns {ConfigEnvelope} Object containing the configuration items.
	 * @see /protos/orderer/ab.proto
	 * @see /protos/common/configtx.proto
	 */
	getChannelConfig() {
		logger.debug('getChannelConfig - start for channel %s',this._name);

		var self = this;
		var userContext = null;
		var orderer = self.getOrderers()[0];

		userContext = this._clientContext.getUserContext();
		var nonce = utils.getNonce();
		var tx_id = Chain.buildTransactionID(nonce, userContext);

		// seek the latest block
		var seekSpecifiedStart = new _abProto.SeekNewest();
		var seekStart = new _abProto.SeekPosition();
		seekStart.setNewest(seekSpecifiedStart);

		var seekSpecifiedStop = new _abProto.SeekNewest();
		var seekStop = new _abProto.SeekPosition();
		seekStop.setNewest(seekSpecifiedStop);

		// seek info with all parts
		var seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);

		// build the header for use with the seekInfo payload
		var seekInfoHeader = Chain._buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			tx_id,
			self._initial_epoch
		);

		var seekHeader = Chain._buildHeader(userContext.getIdentity(), seekInfoHeader, nonce);
		var seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		var seekPayloadBytes = seekPayload.toBuffer();

		let sig = userContext.getSigningIdentity().sign(seekPayloadBytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload : seekPayloadBytes
		};
		// This will return us a block
		return orderer.sendDeliver(envelope)
		.then(
			function(block) {
				logger.debug('getChannelConfig - good results from seek block '); // :: %j',results);
				// verify that we have the genesis block
				if(block) {
					logger.debug('getChannelConfig - found latest block');
				}
				else {
					logger.error('getChannelConfig - did not find latest block');
					return Promise.reject(new Error('Failed to retrieve latest block'));
				}

				logger.debug('getChannelConfig - latest block is block number %s',block.header.number);
				// get the last config block number
				var metadata = _commonProto.Metadata.decode(block.metadata.metadata[_commonProto.BlockMetadataIndex.LAST_CONFIG]);
				var last_config = _commonProto.LastConfig.decode(metadata.value);
				logger.debug('getChannelConfig - latest block has config block of %s',last_config.index);

				var nonce = utils.getNonce();
				var tx_id = Chain.buildTransactionID(nonce, userContext);

				// now build the seek info to get the block called out
				// as the latest config block
				var seekSpecifiedStart = new _abProto.SeekSpecified();
				seekSpecifiedStart.setNumber(0); //FIXME: temporary hack to workaround https://jira.hyperledger.org/browse/FAB-3493
				var seekStart = new _abProto.SeekPosition();
				seekStart.setSpecified(seekSpecifiedStart);

				//   build stop
				var seekSpecifiedStop = new _abProto.SeekSpecified();
				seekSpecifiedStop.setNumber(0); //FIXME: temporary hack to workaround https://jira.hyperledger.org/browse/FAB-3493
				var seekStop = new _abProto.SeekPosition();
				seekStop.setSpecified(seekSpecifiedStop);

				// seek info with all parts
				var seekInfo = new _abProto.SeekInfo();
				seekInfo.setStart(seekStart);
				seekInfo.setStop(seekStop);
				seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);
				//logger.debug('initializeChain - seekInfo ::' + JSON.stringify(seekInfo));

				// build the header for use with the seekInfo payload
				var seekInfoHeader = Chain._buildChannelHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					tx_id,
					self._initial_epoch
				);

				var seekHeader = Chain._buildHeader(userContext.getIdentity(), seekInfoHeader, nonce);
				var seekPayload = new _commonProto.Payload();
				seekPayload.setHeader(seekHeader);
				seekPayload.setData(seekInfo.toBuffer());
				var seekPayloadBytes = seekPayload.toBuffer();

				let sig = userContext.getSigningIdentity().sign(seekPayloadBytes);
				let signature = Buffer.from(sig);

				// building manually or will get protobuf errors on send
				var envelope = {
					signature: signature,
					payload : seekPayloadBytes
				};
				// this will return us a block
				return orderer.sendDeliver(envelope);
			}
		).then(
			function(block) {
				if(!block) {
					return Promise.reject(new Error('Config block was not found'));
				}
				// lets have a look at the block
				logger.debug('getChannelConfig -  config block number ::%s  -- numberof tx :: %s', block.header.number, block.data.data.length);
				if(block.data.data.length != 1) {
					return Promise.reject(new Error('Config block must only contain one transaction'));
				}
				var envelope = _commonProto.Envelope.decode(block.data.data[0]);
				var payload = _commonProto.Payload.decode(envelope.payload);
				var channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
				if(channel_header.type != _commonProto.HeaderType.CONFIG) {
					return Promise.reject(new Error(util.format('Block must be of type "CONFIG" (%s), but got "%s" instead', _commonProto.HeaderType.CONFIG, channel_header.type)));
				}

				var config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);

				// send back the envelope
				return Promise.resolve(config_envelope);
			}
		).catch(
			function(err) {
				logger.error('getChannelConfig - Failed Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/*
	 * Utility method to load this chain with configuration information
	 * from an Envelope that contains a Configuration
	 * @param {byte[]} the envelope with the configuration update items
	 * @see /protos/common/configtx.proto
	 */
	loadConfigUpdateEnvelope(data) {
		logger.debug('loadConfigUpdateEnvelope - start');
		var envelope = _commonProto.Envelope.decode(data);
		var payload = _commonProto.Payload.decode(envelope.payload);
		var channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
		if(channel_header.type != _commonProto.HeaderType.CONFIG_UPDATE) {
			return new Error('Data must be of type "CONFIG_UPDATE"');
		}

		var config_update_envelope = _configtxProto.ConfigUpdateEnvelope.decode(payload.data);
		return this.loadConfigUpdate(config_update_envelope.config_update);
	}

	loadConfigUpdate(config_update_bytes) {
		var config_update = _configtxProto.ConfigUpdate.decode(config_update_bytes);
		logger.debug('loadConfigData - channel ::'+ config_update.channel_id);

		let read_group = config_update.read_set;
		let write_group = config_update.write_set;

		var config_items = {};
		config_items.msps = []; //save all the MSP's found
		config_items['anchor-peers'] = []; //save all the MSP's found
		config_items.orderers = [];
		config_items['kafka-brokers'] = [];
		config_items.settings = {};
		config_items.versions = {};
		config_items.versions.read_group = {};
		config_items.versions.write_group = {};

		loadConfigGroup(config_items, config_items.versions.read_group, read_group, 'read_set', null, true, false);
		// do the write_set second so they update anything in the read set
		loadConfigGroup(config_items, config_items.versions.write_group, write_group, 'write_set', null, true, false);
		this._msp_manager.loadMSPs(config_items.msps);
		this._anchor_peers =config_items.anchor_peers;

		//TODO should we create orderers and endorsing peers
		return config_items;
	}

	/*
	 * Utility method to load this chain with configuration information
	 * from a Configuration block
	 * @param {ConfigEnvelope} the envelope with the configuration items
	 * @see /protos/common/configtx.proto
	 */
	loadConfigEnvelope(config_envelope) {
		logger.debug('loadConfigEnvelope - start');

		let group = config_envelope.config.channel_group;

		var config_items = {};
		config_items.msps = []; //save all the MSP's found
		config_items['anchor-peers'] = []; //save all the MSP's found
		config_items.orderers = [];
		config_items['kafka-brokers'] = [];
		config_items.versions = {};
		config_items.versions.channel = {};

		loadConfigGroup(config_items, config_items.versions.channel, group, 'base', null, true, true);
		this._msp_manager.loadMSPs(config_items.msps);
		this._anchor_peers = config_items.anchor_peers;

		//TODO should we create orderers and endorsing peers
		return config_items;
	}

	/**
	 * Calls the orderer(s) to update an existing chain. This allows the addition and
	 * deletion of Peer nodes to an existing chain, as well as the update of Peer
	 * certificate information upon certificate renewals.
	 * @returns {boolean} Whether the chain update process was successful.
	 */
	updateChain() {
		//to do
	}

	/**
	 * Get chain status to see if the underlying channel has been terminated,
	 * making it a read-only chain, where information (transactions and states)
	 * can be queried but no new transactions can be submitted.
	 * @returns {boolean} Is read-only, true or not.
	 */
	isReadonly() {
		return false;//to do
	}

	/**
	 * Queries for various useful information on the state of the Chain
	 * (height, known peers).
	 * This query will be made to the primary peer.
	 * @returns {object} With height, currently the only useful info.
	 */
	queryInfo() {
		logger.debug('queryInfo - start');
		var self = this;
		var nonce = utils.getNonce();
		var userContext = this._clientContext.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [self.getPrimaryPeer()],
			chaincodeId : 'qscc',
			chainId: '',
			txId: tx_id,
			nonce: nonce,
			fcn : 'GetChainInfo',
			args: [ self._name]
		};
		return self.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryInfo - got responses=' + responses.length);
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying the primary peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryInfo - response status %d:', response.response.status);
						var chain_info = _ledgerProto.BlockchainInfo.decode(response.response.payload);
						return Promise.resolve(chain_info);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query chain info'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query chain info. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries the ledger for Block by block hash.
	 * This query will be made to the primary peer.
	 * @param {byte[]} block hash of the Block.
	 * @returns {object} Object containing the block.
	 */
	queryBlockByHash(blockHash) {
		logger.debug('queryBlockByHash - start');
		if(!blockHash) {
			return Promise.reject( new Error('Blockhash bytes are required'));
		}
		var self = this;
		var nonce = utils.getNonce();
		var userContext = this._clientContext.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [self.getPrimaryPeer()],
			chaincodeId : 'qscc',
			chainId: '',
			txId: tx_id,
			nonce: nonce,
			fcn : 'GetBlockByHash',
			args: [ self._name],
			argbytes : blockHash
		};
		return self.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryBlockByHash - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying the primary peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryBlockByHash - response status %d:', response.response.status);
						var block = Block.decode(response.response.payload);
						logger.debug('queryBlockByHash - looking at block :: %s',block.header.number);
						return Promise.resolve(block);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query block. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries the ledger for Block by block number.
	 * This query will be made to the primary peer.
	 * @param {number} blockNumber The number which is the ID of the Block.
	 * @returns {object} Object containing the block.
	 */
	queryBlock(blockNumber) {
		logger.debug('queryBlock - start blockNumber %s',blockNumber);
		var block_number = null;
		if(Number.isInteger(blockNumber) && blockNumber >= 0) {
			block_number = blockNumber.toString();
		} else {
			return Promise.reject( new Error('Block number must be a postive integer'));
		}
		var self = this;
		var nonce = utils.getNonce();
		var userContext = self._clientContext.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [self.getPrimaryPeer()],
			chaincodeId : 'qscc',
			chainId: '',
			txId: tx_id,
			nonce: nonce,
			fcn : 'GetBlockByNumber',
			args: [ self._name, block_number]
		};
		return self.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryBlock - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying the primary peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryBlock - response status %d:', response.response.status);
						var block = Block.decode(response.response.payload);
						logger.debug('queryBlockByHash - looking at block :: %s',block.header.number);
						return Promise.resolve(block);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query block. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries the ledger for Transaction by number.
	 * This query will be made to the primary peer.
	 * @param {number} transactionID
	 * @returns {object} Transaction information containing the transaction.
	 */
	queryTransaction(transactionID) {
		logger.debug('queryTransaction - start transactionID %s',transactionID);
		var transaction_id = null;
		if(transactionID) {
			transaction_id = transactionID.toString();
		} else {
			return Promise.reject( new Error('Transaction id is required'));
		}
		var self = this;
		var nonce = utils.getNonce();
		var userContext = self._clientContext.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [self.getPrimaryPeer()],
			chaincodeId : 'qscc',
			chainId: '',
			txId: tx_id,
			nonce: nonce,
			fcn : 'GetTransactionByID',
			args: [ self._name, transaction_id]
		};
		return self.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryTransaction - got response');
				if(responses && Array.isArray(responses)) {
					//will only be one response as we are only querying the primary peer
					if(responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					let response = responses[0];
					if(response instanceof Error ) {
						return Promise.reject(response);
					}
					if(response.response) {
						logger.debug('queryTransaction - response status :: %d', response.response.status);
						var processTrans = Block.decodeTransaction(response.response.payload);
						return Promise.resolve(processTrans);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(processTrans);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Transaction Query. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Queries the instantiated chaincodes on this channel.
	 * @returns {object} ChaincodeQueryResponse proto
	 */
	queryInstantiatedChaincodes() {
		logger.debug('queryInstantiatedChaincodes - start');
		var self = this;
		var nonce = utils.getNonce();
		var userContext = self._clientContext.getUserContext();
		var tx_id = Chain.buildTransactionID(nonce, userContext);
		var request = {
			targets: [self.getPrimaryPeer()],
			chaincodeId : Constants.LSCC,
			chainId: self._name,
			txId: tx_id,
			nonce: nonce,
			fcn : 'getchaincodes',
			args: []
		};
		return self.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				logger.debug('queryInstantiatedChaincodes - got response');
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
						logger.debug('queryInstantiatedChaincodes - response status :: %d', response.response.status);
						var queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
						logger.debug('queryInstantiatedChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
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
				logger.error('Failed Instantiated Chaincodes Query. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends an instantiate proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`targets` : Optional : An array of endorsing {@link Peer} objects as the
	 *                      targets of the request. The list of endorsing peers will be used if
	 *                      this parameter is omitted.
	 *		<br>`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java']
	 *                            (default 'golang')
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chaincodeVersion` : required - String of the version of the chaincode
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`fcn` : optional - String of the function to be called on
	 *                  the chaincode once instantiated (default 'init')
	 *		<br>`args` : optional - String Array arguments specific to
	 *                   the chaincode being instantiated
	 *		<br>`endorsement-policy` : optional - {@link EndorsementPolicy} object for this
	 *				chaincode. If not specified, a default policy of "a signature by any member
	 *				from any of the organizations corresponding to the array of member service
	 *				providers" is used
	 * @example <caption>"Signed by any member from one of the organizations"</caption>
	 * {
	 *   identities: [
	 *     { role: { name: "member", mspId: "org1" }},
	 *     { role: { name: "member", mspId: "org2" }}
	 *   ],
	 *   policy: {
	 *     "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
	 *   }
	 * }
	 * @example <caption>"Signed by admin of the ordererOrg and any member from one of the peer organizations"</caption>
	 * {
	 *   identities: [
	 *     { role: { name: "member", mspId: "peerOrg1" }},
	 *     { role: { name: "member", mspId: "peerOrg2" }},
	 *     { role: { name: "admin", mspId: "ordererOrg" }}
	 *   ],
	 *   policy: {
	 *     "2-of": [
	 *       { "signed-by": 2},
	 *       { "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]}
	 *     ]
	 *   }
	 * }
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	sendInstantiateProposal(request) {
		return this._sendChaincodeProposal(request, 'deploy');
	}

	/**
	 * Sends an upgrade proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`targets` : An array of endorsing {@link Peer} objects as the
	 *                      targets of the request
	 *		<br>`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java']
	 *                            (default 'golang')
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chaincodeVersion` : required - String of the version of the chaincode
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`fcn` : optional - String of the function to be called on
	 *                  the chaincode once instantiated (default 'init')
	 *		<br>`args` : optional - String Array arguments specific to
	 *                   the chaincode being instantiated
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	sendUpgradeProposal(request) {
		return this._sendChaincodeProposal(request, 'upgrade');
	}

	/*
	 * Internal method to handle both chaincode calls
	 */
	_sendChaincodeProposal(request, command) {
		var errorMsg = null;

		var peers = null;
		if (request) {
			let peers = request.targets;
		}
		if (!peers || peers.length < 1) {
			peers = this.getPeers();
		}
		// Verify that a Peer has been added
		if (peers.length < 1) {
			errorMsg = 'Missing peer objects in Instantiate proposal';
			logger.error('Chain.sendInstantiateProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		//validate the incoming request
		if(!errorMsg) errorMsg = Chain._checkProposalRequest(request);
		if(!errorMsg) errorMsg = Chain._checkInstallRequest(request);
		if(!errorMsg) errorMsg = _checkInstantiateRequest(request);

		if(errorMsg) {
			logger.error('sendChainCodeProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}
		let self = this;

		// step 1: construct a ChaincodeSpec
		var args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

		for (let i = 0; i < request.args.length; i++)
			args.push(Buffer.from(request.args[i], 'utf8'));

		let ccSpec = {
			type: Chain._translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			},
			input: {
				args: args
			}
		};

		// step 2: construct the ChaincodeDeploymentSpec
		let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);

		var header, proposal;
		var userContext = self._clientContext.getUserContext();
		let lcccSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincode_id: {
				name: Constants.LSCC
			},
			input: {
				args: [
					Buffer.from(command),
					Buffer.from(request.chainId),
					chaincodeDeploymentSpec.toBuffer(),
					self._buildEndorsementPolicy(request['endorsement-policy'])
				]
			}
		};

		var channelHeader = Chain._buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			request.chainId,
			request.txId,
			null,
			Constants.LSCC
		);
		header = Chain._buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
		proposal = Chain._buildProposal(lcccSpec, header, request.transientMap);
		let signed_proposal = Chain._signProposal(userContext.getSigningIdentity(), proposal);

		return Chain._sendPeersProposal(peers, signed_proposal)
		.then(
			function(responses) {
				return [responses, proposal, header];
			}
		);
	}

	/**
	 * Sends a transaction proposal to one or more endorsing peers.
	 *
	 * @param {Object} request
	 *		<br>`targets` : optional -- The peers that will receive this request,
	 *		              when not provided the peers assigned to this channel will
	 *		              be used.
	 *		<br>`chaincodeId` : The id of the chaincode to perform the transaction proposal
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
	 *		<br>`args` : an array of arguments specific to the chaincode 'invoke'
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 */
	sendTransactionProposal(request) {
		logger.debug('sendTransactionProposal - start');

		if(!request) {
			return Promise.reject(new Error('Missing request object for this transaction proposal'));
		}
		var targets = null;
		if(request && request.targets) {
			logger.debug('sendTransactionProposal - request has targets');
		}
		else {
			logger.debug('sendTransactionProposal - request does not have targets using this channels endorsing peers');
			request.targets = this.getPeers();
		}
		return Chain.sendTransactionProposal(request, this._clientContext);
	}

	/*
	 * Internal static method to allow transaction proposals to be called without
	 * creating a new chain
	 */
	static sendTransactionProposal(request, clientContext) {
		// Verify that a Peer has been added
		var errorMsg = null;

		// args is not optional because we need for transaction to execute
		if (request && !request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
		}

		if (!request.targets || request.targets.length < 1) {
			errorMsg = 'Missing peer objects in Transaction proposal';
			logger.error('sendTransactionProposal Error:'+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		if(errorMsg) {
			logger.error('sendTransactionProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var args = [];
		// leaving this for now... but this call is always an invoke and we are not telling caller to include 'fcn' any longer
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('sendTransactionProposal - adding function arg:%s', request.fcn ? request.fcn : 'invoke');

		for (let i=0; i<request.args.length; i++) {
			logger.debug('sendTransactionProposal - adding arg:%s', request.args[i]);
			args.push(Buffer.from(request.args[i], 'utf8'));
		}
		//special case to support the bytes argument of the query by hash
		if(request.argbytes) {
			logger.debug('sendTransactionProposal - adding the argument :: argbytes');
			args.push(request.argbytes);
		}
		else {
			logger.debug('sendTransactionProposal - not adding the argument :: argbytes');
		}
		let invokeSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincode_id: {
				name: request.chaincodeId,
				version: request.chaincodeVersion
			},
			input: {
				args: args
			}
		};

		var self = this;
		var proposal, header;
		var userContext = clientContext.getUserContext();
		var channelHeader = self._buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			request.chainId,
			request.txId,
			null,
			request.chaincodeId
			);
		header = Chain._buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
		proposal = self._buildProposal(invokeSpec, header, request.transientMap);
		let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

		return Chain._sendPeersProposal(request.targets, signed_proposal)
		.then(
			function(responses) {
				return Promise.resolve([responses, proposal, header]);
			}
		).catch(
			function(err) {
				logger.error('Failed Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Sends the orderer an endorsed proposal.
	 * The caller must use the proposal response returned from the endorser along
	 * with the original proposal request sent to the endorser.
	 *
	 * @param {Array} proposalResponses - An array or single {ProposalResponse} objects containing
	 *        the response from the endorsement
	 * @see /protos/peer/proposal_response.proto
	 * @param {Proposal} chaincodeProposal - A Proposal object containing the original
	 *        request for endorsement(s)
	 * @see /protos/peer/proposal.proto
	 * @returns {Promise} A Promise for a `BroadcastResponse`.
	 *         This will be an acknowledgement from the orderer of successfully submitted transaction.
	 * @see /protos/orderer/ab.proto
	 */
	sendTransaction(request) {
		logger.debug('sendTransaction - start :: chain %s',this);
		var errorMsg = null;

		if (request) {
			// Verify that data is being passed in
			if (!request.proposalResponses) {
				errorMsg = 'Missing "proposalResponses" parameter in transaction request';
			}
			if (!request.proposal) {
				errorMsg = 'Missing "proposal" parameter in transaction request';
			}
			if (!request.header) {
				errorMsg = 'Missing "header" parameter in transaction request';
			}
		} else {
			errorMsg = 'Missing input request object on the proposal request';
		}

		if(errorMsg) {
			logger.error('sendTransaction error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let proposalResponses = request.proposalResponses;
		let chaincodeProposal = request.proposal;
		let header            = _commonProto.Header.decode(chaincodeProposal.getHeader());

		// verify that we have an orderer configured
		if(!this.getOrderers()) {
			logger.error('sendTransaction - no orderers defined');
			return Promise.reject(new Error('no Orderer defined'));
		}

		var endorsements = [];
		let proposalResponse = proposalResponses;
		if(Array.isArray(proposalResponses)) {
			for(let i=0; i<proposalResponses.length; i++) {
				// make sure only take the valid responses to set on the consolidated response object
				// to use in the transaction object
				if (proposalResponses[i].response && proposalResponses[i].response.status === 200) {
					proposalResponse = proposalResponses[i];
					endorsements.push(proposalResponse.endorsement);
				}
			}
		} else {
			endorsements.push(proposalResponse.endorsement);
		}

		var chaincodeEndorsedAction = new _transProto.ChaincodeEndorsedAction();
		chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
		chaincodeEndorsedAction.setEndorsements(endorsements);

		var chaincodeActionPayload = new _transProto.ChaincodeActionPayload();
		chaincodeActionPayload.setAction(chaincodeEndorsedAction);

		// the TransientMap field inside the original proposal payload is only meant for the
		// endorsers to use from inside the chaincode. This must be taken out before sending
		// to the orderer, otherwise the transaction will be rejected by the validators when
		// it compares the proposal hash calculated by the endorsers and returned in the
		// proposal response, which was calculated without the TransientMap
		var originalChaincodeProposalPayload = _proposalProto.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
		var chaincodeProposalPayloadNoTrans = new _proposalProto.ChaincodeProposalPayload();
		chaincodeProposalPayloadNoTrans.setInput(originalChaincodeProposalPayload.input); // only set the input field, skipping the TransientMap
		chaincodeActionPayload.setChaincodeProposalPayload(chaincodeProposalPayloadNoTrans.toBuffer());

		var transactionAction = new _transProto.TransactionAction();
		transactionAction.setHeader(header.getSignatureHeader());
		transactionAction.setPayload(chaincodeActionPayload.toBuffer());

		var actions = [];
		actions.push(transactionAction);

		var transaction = new _transProto.Transaction();
		transaction.setActions(actions);


		var payload = new _commonProto.Payload();
		payload.setHeader(header);
		payload.setData(transaction.toBuffer());

		let payload_bytes = payload.toBuffer();

		var self = this;
		var userContext = this._clientContext.getUserContext();
		let sig = userContext.getSigningIdentity().sign(payload_bytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload : payload_bytes
		};

		var orderer = self.getOrderers()[0];
		return orderer.sendBroadcast(envelope);
	}

	/**
	 * Sends a proposal to one or more endorsing peers that will be handled by the chaincode.
	 * This request will be presented to the chaincode 'invoke' and must understand
	 * from the arguments that this is a query request. The chaincode must also return
	 * results in the byte array format and the caller will have to be able to decode
	 * these results
	 *
	 * @param {Object} request A JSON object with the following
	 *		<br>targets : An array or single Endorsing {@link Peer} objects as the targets of the request
	 *		<br>chaincodeId : The id of the chaincode to perform the query
	 *		<br>`args` : an array of arguments specific to the chaincode 'innvoke'
	 *             that represent a query invocation on that chaincode
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
	 * @returns {Promise} A Promise for an array of byte array results from the chaincode on all Endorsing Peers
	 */
	queryByChaincode(request) {
		logger.debug('Chain.sendQueryProposal - start');

		return this.sendTransactionProposal(request)
		.then(
			function(results) {
				var responses = results[0];
				var proposal = results[1];
				logger.debug('Chain-queryByChaincode - results received');
				if(responses && Array.isArray(responses)) {
					var results = [];
					for(let i = 0; i < responses.length; i++) {
						let response = responses[i];
						if(response instanceof Error) {
							results.push(response);
						}
						else if(response.response && response.response.payload) {
							results.push(response.response.payload);
						}
						else {
							logger.error('queryByChaincode - unknown or missing results in query ::'+results);
							results.push(new Error(response));
						}
					}
					return Promise.resolve(results);
				}
				return Promise.reject(new Error('Payload results are missing from the chaincode query'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query by chaincode. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	/**
	 * Utility method to verify a single proposal response.
	 * Requires that the initialize method of this channel has been
	 * executed to load this channel's MSPs. The MSPs will have the
	 * trusted root certificates for this channel.
	 * The verifications performed are
	 *   - validate that the proposal endorsement's signer is trusted
	 *   - verify that the endorsement signature matches the signer's
	 *     claimed identity
	 *
	 * @param {ProposalResponse} The endorsement response from the peer,
	 *         includes the endorser certificate and signature over the
	 *         proposal, endorsement result and endorser certificate.
	 * @see /protos/peer/proposal_reponse.proto
	 * @returns {boolean} a boolean value of true when both the identity and
	 *          the signature are valid, false otherwise.
	 */
	 verifyProposalResponse(proposal_response) {
		logger.debug('verifyProposalResponse - start');
		if(!proposal_response) {
			throw new Error('Missing proposal response');
		}
		if(!proposal_response.endorsement) {
			throw new Error('Parameter must be a ProposalResponse Object');
		}

		let endorsement = proposal_response.endorsement;

		var sid = _identityProto.SerializedIdentity.decode(endorsement.endorser);
		var mspid = sid.getMspid();
		logger.debug('getMSPbyIdentity - found mspid %s',mspid);
		var msp = this._msp_manager.getMSP(mspid);

		if (!msp){
			throw new Error(util.format('Failed to locate an MSP instance matching the endorser identity\'s orgainization %s', mspid));
		}
		logger.debug('verifyProposalResponse - found endorser\'s MSP');

		try {
			var identity = msp.deserializeIdentity(endorsement.endorser, false);
			if(!identity) {
				throw new Error('Unable to find the endorser identity');
			}
		}
		catch(error) {
			logger.error('verifyProposalResponse - getting endorser identity failed with: ', error);
			return false;
		}

		try {
			// see if the identity is trusted
			if(!identity.isValid()) {
				logger.error('Endorser identity is not valid');
				return false;
			}
			logger.debug('verifyProposalResponse - have a valid identity');

			// check the signature against the endorser and payload hash
			var digest = Buffer.concat([proposal_response.payload, endorsement.endorser]);
			if(!identity.verify(digest, endorsement.signature)) {
				logger.error('Proposal signature is not valid');
				return false;
			}
		}
		catch(error) {
			logger.error('verifyProposalResponse - verify failed with: ', error);
			return false;
		}

		logger.debug('verifyProposalResponse - This endorsement has both a valid identity and valid signature');
		return true;
	 }

	/**
	 * Utility method to examine a set of proposals to check they contain
	 * the same endorsement result write sets.
	 * This will validate that the endorsing peers all agree on the result
	 * of the chaincode execution.
	 * @param {ProposalResponse[]} The proposal responses from all endorsing peers
	 * @see /protos/peer/proposal_reponse.proto
	 * @returns {boolean} True when all proposals compare equally, false otherwise.
	  */
	compareProposalResponseResults(proposal_responses) {
		logger.debug('compareProposalResponseResults - start');
		if(!proposal_responses) {
			throw new Error('Missing proposal responses');
		}
		if(!Array.isArray(proposal_responses)) {
			throw new Error('Parameter must be an array of ProposalRespone Objects');
		}

		if(proposal_responses.length == 0) {
			throw new Error('Parameter proposal responses does not contain a PorposalResponse');
		}
		var first_one = _getProposalResponseResults(proposal_responses[0]);
		for(var i = 1; i < proposal_responses.length; i++) {
			var next_one = _getProposalResponseResults(proposal_responses[i]);
			if(next_one.equals(first_one)){
				logger.debug('compareProposalResponseResults - read/writes result sets match index=%s',i);
			}
			else {
				logger.error('compareProposalResponseResults - read/writes result sets do not match index=%s',i);
				return false;
			}
		}

		return true;
	 }

	// internal utility method to build the proposal
	/**
	 * @private
	 */
	static _buildProposal(invokeSpec, header, transientMap) {
		// construct the ChaincodeInvocationSpec
		let cciSpec = new _ccProto.ChaincodeInvocationSpec();
		cciSpec.setChaincodeSpec(invokeSpec);

		let cc_payload = new _proposalProto.ChaincodeProposalPayload();
		cc_payload.setInput(cciSpec.toBuffer());

		if (typeof transientMap === 'object') {
			cc_payload.setTransientMap(transientMap);
		}

		// proposal -- will switch to building the proposal once the signProposal is used
		let proposal = new _proposalProto.Proposal();
		proposal.setHeader(header.toBuffer());
		proposal.setPayload(cc_payload.toBuffer()); // chaincode proposal payload

		return proposal;
	}

	// internal utility method to build chaincode policy
	_buildEndorsementPolicy(policy) {
		return Policy.buildPolicy(this.getMSPManager().getMSPs(), policy);
	}

	// internal utility method to return one Promise when sending a proposal to many peers
	/**
	 * @private
	 */
	 static _sendPeersProposal(peers, proposal) {
		if(!Array.isArray(peers)) {
			peers = [peers];
		}
		// make function to return an individual promise
		var fn = function(peer) {
			return new Promise(function(resolve,reject) {
				peer.sendProposal(proposal)
				.then(
					function(result) {
						resolve(result);
					}
				).catch(
					function(err) {
						logger.error('Chain-sendPeersProposal - Promise is rejected: %s',err.stack ? err.stack : err);
						return reject(err);
					}
				);
			});
		};
		// create array of promises mapping peers array to peer parameter
		// settle all the promises and return array of responses
		var promises = peers.map(fn);
		var responses = [];
		return settle(promises)
		  .then(function (results) {
			results.forEach(function (result) {
			  if (result.isFulfilled()) {
				logger.debug('Chain-sendPeersProposal - Promise is fulfilled: '+result.value());
				responses.push(result.value());
			  } else {
				logger.debug('Chain-sendPeersProposal - Promise is rejected: '+result.reason());
				if(result.reason() instanceof Error) {
					responses.push(result.reason());
				}
				else {
					responses.push(new Error(result.reason()));
				}
			  }
			});
			return responses;
		});
	}

	//internal method to sign a proposal
	/**
	 * @private
	 */
	static _signProposal(signingIdentity, proposal) {
		let proposal_bytes = proposal.toBuffer();
		// sign the proposal
		let sig = signingIdentity.sign(proposal_bytes);
		let signature = Buffer.from(sig);

		logger.debug('_signProposal - signature::'+JSON.stringify(signature));

		// build manually for now
		let signedProposal = {
			signature :  signature,
			proposal_bytes : proposal_bytes
		};
		return signedProposal;
	}

	/*
	 * @private
	 */
	static _checkProposalRequest(request) {
		var errorMsg = null;

		if(request) {
			var isQuery = (request.chaincodeId == 'qscc' || request.chaincodeId == 'cscc');
			if(!request.chaincodeId) {
				errorMsg = 'Missing "chaincodeId" parameter in the proposal request';
			} else if(!request.chainId && !isQuery) {
				errorMsg = 'Missing "chainId" parameter in the proposal request';
			} else if(!request.txId) {
				errorMsg = 'Missing "txId" parameter in the proposal request';
			} else if(!request.nonce) {
				errorMsg = 'Missing "nonce" parameter in the proposal request';
			}
		} else {
			errorMsg = 'Missing input request object on the proposal request';
		}
		return errorMsg;
	}

	/*
	 * @private
	 */
	static _checkInstallRequest(request) {
		var errorMsg = null;

		if (request) {
			if(!request.chaincodeVersion) {
				errorMsg = 'Missing "chaincodeVersion" parameter in the proposal request';
			}
		} else {
			errorMsg = 'Missing input request object on the proposal request';
		}
		return errorMsg;
	}

	/**
	* Utility method to build an unique transaction id
	* based on a nonce and this chain's user.
	* @param {int} nonce - a one time use number
	* @param {User} userContext - the user context
	* @returns {string} An unique string
	*/
	static buildTransactionID(nonce, userContext) {
		logger.debug('buildTransactionID - start');
		var creator_bytes = userContext.getIdentity().serialize();//same as signatureHeader.Creator
		var nonce_bytes = nonce;//nonce is already in bytes
		var trans_bytes = Buffer.concat([nonce_bytes, creator_bytes]);
		var trans_hash = hashPrimitives.sha2_256(trans_bytes);
		var transaction_id = Buffer.from(trans_hash).toString();
		logger.debug('buildTransactionID - transaction_id %s',transaction_id);
		return transaction_id;
	}


	//utility method to build a common chain header
	static _buildChannelHeader(type, chain_id, tx_id, epoch, chaincode_id, time_stamp) {
		logger.debug('buildChannelHeader - type %s chain_id %s tx_id %d epoch % chaincode_id %s',
				type, chain_id, tx_id, epoch, chaincode_id);
		var channelHeader = new _commonProto.ChannelHeader();
		channelHeader.setType(type); // int32
		channelHeader.setVersion(1); // int32
		if(!time_stamp) {
			time_stamp = this._buildCurrentTimestamp();
		}
		channelHeader.setTimestamp(time_stamp); // google.protobuf.Timestamp
		channelHeader.setChannelId(chain_id); //string
		channelHeader.setTxId(tx_id.toString()); //string
		if(epoch) {
			channelHeader.setEpoch(epoch); // uint64
		}
		if(chaincode_id) {
			let chaincodeID = new _ccProto.ChaincodeID();
			chaincodeID.setName(chaincode_id);

			let headerExt = new _proposalProto.ChaincodeHeaderExtension();
			headerExt.setChaincodeId(chaincodeID);

			channelHeader.setExtension(headerExt.toBuffer());
		}
		return channelHeader;
	};

	// utility method to build the header
	static _buildHeader(creator, channelHeader, nonce) {
		let signatureHeader = new _commonProto.SignatureHeader();
		signatureHeader.setCreator(creator.serialize());
		signatureHeader.setNonce(nonce);

		let header = new _commonProto.Header();
		header.setSignatureHeader(signatureHeader.toBuffer());
		header.setChannelHeader(channelHeader.toBuffer());

		return header;
	}

	//utility method to return a timestamp for the current time
	static _buildCurrentTimestamp() {
		logger.debug('buildCurrentTimestamp - building');
		var now = new Date();
		var timestamp = new _timestampProto.Timestamp();
		timestamp.setSeconds(now.getTime() / 1000);
		timestamp.setNanos((now.getTime() % 1000) * 1000000);
		return timestamp;
	}

	static _translateCCType(type) {
		switch (type) {
		case 'golang':
		default:
			return _ccProto.ChaincodeSpec.Type.GOLANG;
		case 'car':
			return _ccProto.ChaincodeSpec.Type.CAR;
		case 'java':
			return _ccProto.ChaincodeSpec.Type.JAVA;
		}
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		let orderers = '';
		for (let i = 0; i < this._orderers.length; i++) {
			orderers = orderers + this._orderers[i].toString() + '|';
		}
		var state = {
			name: this._name,
			orderers: this._orderers ? orderers : 'N/A'
		};

		return JSON.stringify(state);
	}

};

//internal utility method to decode and get the write set
//from a proposal response
function _getProposalResponseResults(proposal_response) {
	if(!proposal_response.payload) {
		throw new Error('Parameter must be a ProposalResponse Object');
	}
	var payload = _responseProto.ProposalResponsePayload.decode(proposal_response.payload);
	var extension = _proposalProto.ChaincodeAction.decode(payload.extension);
	// TODO should we check the status of this action
	logger.debug('_getWriteSet - chaincode action status:%s message:%s',extension.response.status, extension.response.message);
	// return a buffer object which has an equals method
	return extension.results.toBuffer();
};

//internal utility method to combine MSPs
function _combineMSPs(current, configuration) {
	var results = new Map();
	_arrayToMap(results, current);
	// do these second to replace any of the same name
	_arrayToMap(results, configuration);

	return results;
};

//internal utility method to add msps to a map
function _arrayToMap(map, msps) {
	if(msps) {
		var keys = Object.keys(msps);
		for(let key in keys) {
			let id = keys[key];
			let msp = msps[id];
			let mspid = msp.getId();
			logger.debug('buildChannelConfig - add msp ::%s',mspid);
			map.set(mspid, msp);
		}
	}
};

/*
* @private
*/
function _checkInstantiateRequest(request) {
	var errorMsg = null;

	if (request) {
		var type = Chain._translateCCType(request.chaincodeType);
		// FIXME: GOLANG platform on the peer has a bug that requires chaincodePath
		// during instantiate.  Police this for now until the peer is fixed.
		if(type === _ccProto.ChaincodeSpec.Type.GOLANG && !request.chaincodePath) {
			errorMsg = 'Missing "chaincodePath" parameter in the proposal request';
		}
	} else {
		errorMsg = 'Missing input request object on the proposal request';
	}
	return errorMsg;
}

/*
 * utility method to load in a config group
 * @param {Object} - config_items - holder of values found in the configuration
 * @param {Object} - group - used for recursive calls
 * @param {string} - name - used to help with the recursive calls
 * @param {string} - org - Organizational name
 * @param {bool} - top - to handle the  differences in the structure of groups
 * @see /protos/common/configtx.proto
 */
function loadConfigGroup(config_items, versions, group, name, org, top) {
	logger.debug('loadConfigGroup - %s - > group:%s', name, org);
	if(!group) {
		logger.debug('loadConfigGroup - %s - no group', name);
		logger.debug('loadConfigGroup - %s - < group', name);
		return;
	}

	logger.debug('loadConfigGroup - %s   - version %s',name, group.version);
	logger.debug('loadConfigGroup - %s   - mod policy %s',name, group.mod_policy);

	var groups = null;
	if(top) {
		groups = group.groups;
		versions.version = group.version;
	}
	else {
		groups = group.value.groups;
		versions.version = group.value.version;
	}
	logger.debug('loadConfigGroup - %s - >> groups', name);

	if(groups) {
		let keys = Object.keys(groups.map);
		versions.groups = {};
		if(keys.length == 0) {
			logger.debug('loadConfigGroup - %s   - no groups', name);
		}
		for(let i =0; i < keys.length; i++) {
			let key = keys[i];
			logger.debug('loadConfigGroup - %s   - found config group ==> %s', name, key);
			versions.groups[key] = {};
			// The Application group is where config settings are that we want to find
			loadConfigGroup(config_items, versions.groups[key], groups.map[key], name+'.'+key, key, false);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no groups', name);
	}
	logger.debug('loadConfigGroup - %s - << groups', name);

	logger.debug('loadConfigGroup - %s - >> values', name);
	var values = null;
	if(top) {
		values = group.values;
	}
	else {
		values = group.value.values;
	}
	if(values) {
		versions.values = {};
		let keys = Object.keys(values.map);
		for(let i =0; i < keys.length; i++) {
			let key = keys[i];
			versions.values[key] = {};
			var config_value = values.map[key];
			loadConfigValue(config_items, versions.values[key], config_value, name, org);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no values', name);
	}
	logger.debug('loadConfigGroup - %s - << values', name);

	logger.debug('loadConfigGroup - %s - >> policies', name);
	var policies = null;
	if(top) {
		policies = group.policies;
	}
	else {
		policies = group.value.policies;
	}
	if(policies) {
		versions.policies = {};
		let keys = Object.keys(policies.map);
		for(let i =0; i < keys.length; i++) {
			let key = keys[i];
			versions.policies[key] = {};
			var config_policy = policies.map[key];
			loadConfigPolicy(config_items, versions.policies[key], config_policy, name, org);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no policies', name);
	}
	logger.debug('loadConfigGroup - %s - << policies', name);

	logger.debug('loadConfigGroup - %s - < group',name);
}

/*
 * utility method to load in a config value
 * @see /protos/common/configtx.proto
 * @see /protos/msp/mspconfig.proto
 * @see /protos/orderer/configuration.proto
 * @see /protos/peer/configuration.proto
 */
function loadConfigValue(config_items, versions, config_value, group_name, org) {
	logger.debug('loadConfigValue - %s -  value name: %s', group_name, config_value.key);
	logger.debug('loadConfigValue - %s    - version: %s', group_name, config_value.value.version);
	logger.debug('loadConfigValue - %s    - mod_policy: %s', group_name, config_value.value.mod_policy);

	versions.version = config_value.value.version;
	try {
		switch(config_value.key) {
		case 'AnchorPeers':
			var anchor_peers = _peerConfigurationProto.AnchorPeers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - AnchorPeers :: %s', group_name, anchor_peers);
			if(anchor_peers && anchor_peers.anchor_peers) for(var i in anchor_peers.anchor_peers) {
				var anchor_peer = {
					host : anchor_peers.anchor_peers[i].host,
					port : anchor_peers.anchor_peers[i].port,
					org  : org
				};
				config_items['anchor-peers'].push(anchor_peer);
				logger.debug('loadConfigValue - %s    - AnchorPeer :: %s:%s:%s', group_name, anchor_peer.host, anchor_peer.port, anchor_peer.org);
			}
			break;
		case 'MSP':
			var msp_value = _mspConfigProto.MSPConfig.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - MSP found', group_name);
			config_items.msps.push(msp_value);
			break;
		case 'ConsensusType':
			var consensus_type = _ordererConfigurationProto.ConsensusType.decode(config_value.value.value);
			config_items.settings['ConsensusType'] = consensus_type;
			logger.debug('loadConfigValue - %s    - Consensus type value :: %s', group_name, consensus_type.type);
			break;
		case 'BatchSize':
			var batch_size = _ordererConfigurationProto.BatchSize.decode(config_value.value.value);
			config_items.settings['BatchSize'] = batch_size;
			logger.debug('loadConfigValue - %s    - BatchSize  maxMessageCount :: %s', group_name, batch_size.maxMessageCount);
			logger.debug('loadConfigValue - %s    - BatchSize  absoluteMaxBytes :: %s', group_name, batch_size.absoluteMaxBytes);
			logger.debug('loadConfigValue - %s    - BatchSize  preferredMaxBytes :: %s', group_name, batch_size.preferredMaxBytes);
			break;
		case 'BatchTimeout':
			var batch_timeout = _ordererConfigurationProto.BatchTimeout.decode(config_value.value.value);
			config_items.settings['BatchTimeout'] = batch_timeout;
			logger.debug('loadConfigValue - %s    - BatchTimeout timeout value :: %s', group_name, batch_timeout.timeout);
			break;
		case 'ChannelRestrictions':
			var channel_restrictions = _ordererConfigurationProto.ChannelRestrictions.decode(config_value.value.value);
			config_items.settings['ChannelRestrictions'] = channel_restrictions;
			logger.debug('loadConfigValue - %s    - ChannelRestrictions max_count value :: %s', group_name, channel_restrictions.max_count);
			break;
		case 'ChannelCreationPolicy':
			var creation_policy = _policiesProto.Policy.decode(config_value.value.value);
			loadPolicy(config_items, versions, config_value.key, creation_policy, group_name, org);
			break;
		case 'HashingAlgorithm':
			var hashing_algorithm_name = _commonConfigurationProto.HashingAlgorithm.decode(config_value.value.value);
			config_items.settings['HashingAlgorithm'] = hashing_algorithm_name;
			logger.debug('loadConfigValue - %s    - HashingAlgorithm name value :: %s', group_name, hashing_algorithm_name.name);
			break;
		case 'Consortium':
			var consortium_algorithm_name = _commonConfigurationProto.Consortium.decode(config_value.value.value);
			config_items.settings['Consortium'] = consortium_algorithm_name;
			logger.debug('loadConfigValue - %s    - Consortium name value :: %s', group_name, consortium_algorithm_name.name);
			break;
		case 'BlockDataHashingStructure':
			var blockdata_hashing_structure = _commonConfigurationProto.BlockDataHashingStructure.decode(config_value.value.value);
			config_items.settings['BlockDataHashingStructure'] = blockdata_hashing_structure;
			logger.debug('loadConfigValue - %s    - BlockDataHashingStructure width value :: %s', group_name, blockdata_hashing_structure.width);
			break;
		case 'OrdererAddresses':
			var orderer_addresses = _commonConfigurationProto.OrdererAddresses.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - OrdererAddresses addresses value :: %s', group_name, orderer_addresses.addresses);
			if(orderer_addresses && orderer_addresses.addresses ) for(var i in orderer_addresses.addresses) {
				config_items.orderers.push(orderer_addresses.addresses[i]);
			}
			break;
		case 'KafkaBrokers':
			var kafka_brokers = _ordererConfigurationProto.KafkaBrokers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - KafkaBrokers addresses value :: %s', group_name, kafka_brokers.brokers);
			if(kafka_brokers && kafka_brokers.brokers ) for(var i in kafka_brokers.brokers) {
				config_items['kafka-brokers'].push(kafka_brokers.brokers[i]);
			}
			break;
		default:
			logger.debug('loadConfigValue - %s    - value: %s', group_name, config_value.value.value);
		}
	}
	catch(err) {
		logger.debug('loadConfigValue - %s - name: %s - *** unable to parse with error :: %s', group_name, config_value.key, err);
	}
	//logger.debug('loadConfigValue - %s -  < value name: %s', group_name, config_value.key);
}

/*
 * utility method to load in a config policy
 * @see /protos/common/configtx.proto
 */
function loadConfigPolicy(config_items, versions, config_policy, group_name, org) {
	logger.debug('loadConfigPolicy - %s - policy name: %s', group_name, config_policy.key);
	logger.debug('loadConfigPolicy - %s   - version: %s', group_name, config_policy.value.version);
	logger.debug('loadConfigPolicy - %s   - mod_policy: %s', group_name, config_policy.value.mod_policy);

	versions.version = config_policy.value.version;
	loadPolicy(config_items, versions, config_policy.key, config_policy.value.policy, group_name, org);
}

function loadPolicy(config_items, versions, key, policy, group_name, org) {
	try {
		switch(policy.type) {
		case _policiesProto.Policy.PolicyType.SIGNATURE:
			let signature_policy = _policiesProto.SignaturePolicyEnvelope.decode(policy.policy);
			logger.debug('loadPolicy - %s - policy SIGNATURE :: %s %s',group_name, signature_policy.encodeJSON(),this.decodeSignaturePolicy(signature_policy.getIdentities()));
			break;
		case _policiesProto.Policy.PolicyType.IMPLICIT_META:
			let implicit_policy = _policiesProto.ImplicitMetaPolicy.decode(policy.policy);
			let rule = ImplicitMetaPolicy_Rule[implicit_policy.getRule()];
			logger.debug('loadPolicy - %s - policy IMPLICIT_META :: %s %s',group_name, rule, implicit_policy.getSubPolicy());
			break;
		default:
			logger.error('loadPolicy - Unknown policy type :: %s',policy.type);
			throw new Error('Unknown Policy type ::' +policy.type);
		}
	}
	catch(err) {
		logger.debug('loadPolicy - %s - name: %s - unable to parse policy %s', group_name, key, err);
	}
}

function decodeSignaturePolicy(identities) {
	var results = [];
	for(let i in identities) {
		let identity = identities[i];
		switch(identity.getPrincipalClassification()) {
		case _mspPrincipalProto.MSPPrincipal.Classification.ROLE:
			let principal = _mspPrincipalProto.MSPRole.decode(identity.getPrincipal());
			results.push(principal.encodeJSON());
		}
	}
	return results;
}

module.exports = Chain;
