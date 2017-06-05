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
var clientUtils = require('./client-utils.js');
var urlParser = require('url');
var net = require('net');
var util = require('util');
var os = require('os');
var path = require('path');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var BlockDecoder = require('./BlockDecoder.js');
var TransactionID = require('./TransactionID.js');
var grpc = require('grpc');
var logger = utils.getLogger('Channel.js');
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
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/msp_config.proto').msp;
var _mspPrincipalProto = grpc.load(__dirname + '/protos/msp/msp_principal.proto').common;
var _identityProto = grpc.load(path.join(__dirname, '/protos/msp/identities.proto')).msp;

const ImplicitMetaPolicy_Rule = {0: 'ANY', 1:'ALL', 2:'MAJORITY'};
var Long = require('long');

/**
 * The class representing a channel with which the client SDK interacts.
 *
 * The “Channel” object captures settings for a channel, which is created by
 * the orderers to isolate transactions delivery to peers participating on channel.
 * A channel must be initialized after it has been configured with the list of peers
 * and orderers. The initialization sends a get configuration block request to the
 * primary orderer to retrieve the configuration settings for this channel.
 *
 * @class
 * @tutorial app-overview
 */
var Channel = class {

	/**
	 * @param {string} name to identify different channel instances. The naming of channel instances
	 * is enforced by the ordering service and must be unique within the blockchain network
	 * @param {Client} clientContext An instance of {@link Client} that provides operational context
	 * such as submitting User etc.
	 */
	constructor(name, clientContext) {
		// name is required
		if (typeof name === 'undefined' || !name) {
			logger.error('Failed to create Channel. Missing requirement "name" parameter.');
			throw new Error('Failed to create Channel. Missing requirement "name" parameter.');
		}

		if (typeof clientContext === 'undefined' || !clientContext) {
			logger.error('Failed to create Channel. Missing requirement "clientContext" parameter.');
			throw new Error('Failed to create Channel. Missing requirement "clientContext" parameter.');
		}

		this._name = name;

		this._peers = [];
		this._anchor_peers = [];
		this._orderers = [];
		this._kafka_brokers = [];

		this._clientContext = clientContext;

		this._msp_manager = new MSPManager();

		//to do update logger
		logger.debug('Constructed Channel instance: name - %s, ' +
		    'network mode: %s',
			this._name,
			!this._devMode);
	}

	/**
	 * Retrieve the configuration from the primary orderer and initializes this channel
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
	 * Get the channel name.
	 * @returns {string} The name of the channel.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get organization identifiers from the MSP's for this channel
	 * @returns {string[]} array of MSP identifiers representing the channel's
	 *   participating organizations
	 */
	getOrganizations() {
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
	 * Add peer endpoint to channel.
	 * @param {Peer} peer An instance of the Peer class that has been initialized with URL,
	 * TLS certificate, and enrollment certificate.
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
	 * Remove peer endpoint from channel.
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
	 * Get peers of a channel from local information.
	 * @returns {Peer[]} The peer list on the channel.
	 */
	getPeers() {
		logger.debug('getPeers - list size: %s.', this._peers.length);
		return this._peers;
	}

	/**
	 * Add orderer endpoint to a channel object, this is a local-only operation.
	 * A channel instance may choose to use a single orderer node, which will broadcast
	 * requests to the rest of the orderer network. Or if the application does not trust
	 * the orderer nodes, it can choose to use more than one by adding them to the channel instance.
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
	 * Remove orderer endpoint from a channel object, this is a local-only operation.
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
	 * Get orderers of a channel.
	 */
	getOrderers() {
		return this._orderers;
	}

	/**
	 * Will get the genesis block from the defined orderer that may be
	 * used in a join request
	 * @param {Object} request - An object containing the following fields:
	 *    <br>`txId` : required -  {@link TransactionID} object with the transaction id and nonce
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

		if(errorMsg) {
			logger.error('getGenesisBlock - error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var userContext = null;
		var orderer = self.getOrderers()[0];

		userContext = this._clientContext.getUserContext();

		// now build the seek info, will be used once the channel is created
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
		var seekInfoHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			request.txId.getTransactionID(),
			self._initial_epoch
		);

		var seekHeader = clientUtils.buildHeader(userContext.getIdentity(), seekInfoHeader, request.txId.getNonce());
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
	 *   <br>`txId` : required -  {@link TransactionID} object with the transaction id and nonce
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
		chaincodeID.setName(Constants.CSCC);

		var chaincodeSpec = new _ccProto.ChaincodeSpec();
		chaincodeSpec.setType(_ccProto.ChaincodeSpec.Type.GOLANG);
		chaincodeSpec.setChaincodeId(chaincodeID);
		chaincodeSpec.setInput(chaincodeInput);

		var channelHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			'',
			request.txId.getTransactionID(),
			null, //no epoch
			Constants.CSCC
		);

		var header = clientUtils.buildHeader(userContext.getIdentity(), channelHeader, request.txId.getNonce());
		var proposal = clientUtils.buildProposal(chaincodeSpec, header);
		var signed_proposal = clientUtils.signProposal(userContext.getSigningIdentity(), proposal);

		return clientUtils.sendPeersProposal(request.targets, signed_proposal)
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
	 * Queries for the current config block for this channel.
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
		var txId = new TransactionID(userContext);

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
		var seekInfoHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			txId.getTransactionID(),
			self._initial_epoch
		);

		var seekHeader = clientUtils.buildHeader(userContext.getIdentity(), seekInfoHeader, txId.getNonce());
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

				var txId = new TransactionID(userContext);

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
				//logger.debug('initializeChannel - seekInfo ::' + JSON.stringify(seekInfo));

				// build the header for use with the seekInfo payload
				var seekInfoHeader = clientUtils.buildChannelHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					txId.getTransactionID(),
					self._initial_epoch
				);

				var seekHeader = clientUtils.buildHeader(userContext.getIdentity(), seekInfoHeader, txId.getNonce());
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
	 * Utility method to load this channel with configuration information
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
	 * Utility method to load this channel with configuration information
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
	 * Queries for various useful information on the state of the Channel
	 * (height, known peers).
	 * @param {Peer} target Optional.  The peer that is the target for this query.  If no target
	 * is passed, the query will use the first peer that was added to the channel.
	 * @returns {object} With height, currently the only useful info.
	 */
	queryInfo(target) {
		logger.debug('queryInfo - start');
		var peer = this._getPeerForQuery(target);
		if (peer instanceof Error) {
			throw peer;
		}
		var self = this;
		var userContext = this._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.QSCC,
			chainId: '',
			txId: txId,
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
				return Promise.reject(new Error('Payload results are missing from the query channel info'));
			}
		).catch(
			function(err) {
				logger.error('Failed Query channel info. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
	}

	_getPeerForQuery(target) {
		if (target) {
			if (Array.isArray(target)) {
				return new Error('"target" parameter is an array, but should be a singular peer object');
			}
			return target;
		} else {
			var peers = this.getPeers();
			if (peers.length < 1) {
				return new Error('"target" parameter not specified and no peers are set on Channel.');
			}
			return peers[0];
		}
	}

	/**
	 * Queries the ledger for Block by block hash.
	 * This query will be made to the primary peer.
	 * @param {byte[]} block hash of the Block.
	 * @param {Peer} target Optional.  The peer that is the target for this query.  If no target
	 * is passed, the query will use the first peer that was added to the channel.
	 * @returns {object} Object containing the block.
	 */
	queryBlockByHash(blockHash, target) {
		logger.debug('queryBlockByHash - start');
		if(!blockHash) {
			return Promise.reject( new Error('Blockhash bytes are required'));
		}
		var peer = this._getPeerForQuery(target);
		if (peer instanceof Error) {
			throw peer;
		}
		var self = this;
		var userContext = this._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.QSCC,
			chainId: '',
			txId: txId,
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
						var block = BlockDecoder.decode(response.response.payload);
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
	 * @param {Peer} target Optional.  The peer that is the target for this query.  If no target
	 * is passed, the query will use the first peer that was added to the channel.
	 * @returns {object} Object containing the block.
	 */
	queryBlock(blockNumber, target) {
		logger.debug('queryBlock - start blockNumber %s',blockNumber);
		var block_number = null;
		if(Number.isInteger(blockNumber) && blockNumber >= 0) {
			block_number = blockNumber.toString();
		} else {
			return Promise.reject( new Error('Block number must be a postive integer'));
		}
		var peer = this._getPeerForQuery(target);
		if (peer instanceof Error) {
			throw peer;
		}
		var self = this;
		var userContext = self._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.QSCC,
			chainId: '',
			txId: txId,
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
						var block = BlockDecoder.decode(response.response.payload);
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
	 * @param  tx_id The id of the transaction
	 * @param {Peer} target Optional.  The peer that is the target for this query.  If no target
	 * is passed, the query will use the first peer that was added to the channel.
	 * @returns {object} Transaction information containing the transaction.
	 */
	queryTransaction(tx_id, target) {
		logger.debug('queryTransaction - start transactionID %s',tx_id);
		var transaction_id = null;
		if(tx_id) {
			tx_id = tx_id.toString();
		} else {
			return Promise.reject( new Error('Missing "tx_id" parameter'));
		}
		var peer = this._getPeerForQuery(target);
		if (peer instanceof Error) {
			throw peer;
		}
		var self = this;
		var userContext = self._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.QSCC,
			chainId: '',
			txId: txId,
			fcn : 'GetTransactionByID',
			args: [ self._name, tx_id]
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
						var processTrans = BlockDecoder.decodeTransaction(response.response.payload);
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
	 * @param {Peer} target Optional.  The peer that is the target for this query.  If no target
	 * is passed, the query will use the first peer that was added to the channel.
	 * @returns {object} ChaincodeQueryResponse proto
	 */
	queryInstantiatedChaincodes(target) {
		logger.debug('queryInstantiatedChaincodes - start');
		var peer = this._getPeerForQuery(target);
		if (peer instanceof Error) {
			throw peer;
		}
		var self = this;
		var userContext = self._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		var request = {
			targets: [peer],
			chaincodeId : Constants.LSCC,
			chainId: self._name,
			txId: txId,
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
	 *		<br>`txId` : required -  {@link TransactionID} object with the transaction id and nonce
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
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
	 *		<br>`txId` : required -  {@link TransactionID} object with the transaction id and nonce
	 *   	<br>`transientMap` : optional - <string, byte[]> map that can be used by
	 *			the chaincode but not saved in the ledger, such as cryptographic information
	 *			for encryption
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
			logger.error('Channel.sendInstantiateProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		//validate the incoming request
		if(!errorMsg) errorMsg = clientUtils.checkProposalRequest(request);
		if(!errorMsg) errorMsg = clientUtils.checkInstallRequest(request);

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
			type: clientUtils.translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
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
					Buffer.from(self._name),
					chaincodeDeploymentSpec.toBuffer(),
					self._buildEndorsementPolicy(request['endorsement-policy'])
				]
			}
		};

		var channelHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			self._name,
			request.txId.getTransactionID(),
			null,
			Constants.LSCC
		);
		header = clientUtils.buildHeader(userContext.getIdentity(), channelHeader, request.txId.getNonce());
		proposal = clientUtils.buildProposal(lcccSpec, header, request.transientMap);
		let signed_proposal = clientUtils.signProposal(userContext.getSigningIdentity(), proposal);

		return clientUtils.sendPeersProposal(peers, signed_proposal)
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
	 *				when not provided the peers assigned to this channel will be used.
	 *		<br>`chaincodeId` : The id of the chaincode to perform the transaction proposal
	 *		<br>`txId` : required -  {@link TransactionID} object with the transaction id and nonce
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
		return Channel.sendTransactionProposal(request, this._name, this._clientContext);
	}

	/*
	 * Internal static method to allow transaction proposals to be called without
	 * creating a new channel
	 */
	static sendTransactionProposal(request, channelId, clientContext) {
		// Verify that a Peer has been added
		var errorMsg = null;

		// args is not optional because we need for transaction to execute
		if (request && !request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else {
			errorMsg = clientUtils.checkProposalRequest(request);
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
				name: request.chaincodeId
			},
			input: {
				args: args
			}
		};

		var proposal, header;
		var userContext = clientContext.getUserContext();
		var channelHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			channelId,
			request.txId.getTransactionID(),
			null,
			request.chaincodeId
			);
		header = clientUtils.buildHeader(userContext.getIdentity(), channelHeader, request.txId.getNonce());
		proposal = clientUtils.buildProposal(invokeSpec, header, request.transientMap);
		let signed_proposal = clientUtils.signProposal(userContext.getSigningIdentity(), proposal);

		return clientUtils.sendPeersProposal(request.targets, signed_proposal)
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
		logger.debug('sendTransaction - start :: channel %s',this);
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
		logger.debug('queryByChaincodel - start');
		if(!request) {
			return Promise.reject(new Error('Missing request object for this queryByChaincode call.'));
		}
		var userContext = this._clientContext.getUserContext();
		var txId = new TransactionID(userContext);
		// make a new request object so we can add in the txId and not change the user's
		var trans_request = {
			targets : request.targets,
			chaincodeId : request.chaincodeId,
			chainId : request.channelId,
			fcn : request.fcn,
			args : request.args,
			transientMap :  request.transientMap,
			txId : txId
		};

		return this.sendTransactionProposal(trans_request)
		.then(
			function(results) {
				var responses = results[0];
				var proposal = results[1];
				logger.debug('queryByChaincode - results received');
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

	// internal utility method to build chaincode policy
	_buildEndorsementPolicy(policy) {
		return Policy.buildPolicy(this.getMSPManager().getMSPs(), policy);
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
			logger.debug('_arrayToMap - add msp ::%s',mspid);
			map.set(mspid, msp);
		}
	}
};

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

module.exports = Channel;
