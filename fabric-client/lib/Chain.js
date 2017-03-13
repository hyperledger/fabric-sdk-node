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
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var Packager = require('./Packager.js');
var settle = require('promise-settle');
var grpc = require('grpc');
var logger = utils.getLogger('Chain.js');
var hashPrimitives = require('./hash.js');
var MSPManager = require('./msp/msp-manager.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;
var _peerConfigurationProto = grpc.load(__dirname + '/protos/peer/configuration.proto').protos;
var _mspPrProto = grpc.load(__dirname + '/protos/common/msp_principal.proto').common;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
var _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;
var _ledgerProto = grpc.load(__dirname + '/protos/common/ledger.proto').common;
var _commonConfigurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
var _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/mspconfig.proto').msp;
var _timestampProto = grpc.load(__dirname + '/protos/google/protobuf/timestamp.proto').google.protobuf;


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

		// Is in dev mode or network mode
		this._devMode = false;

		// If in prefetch mode, we prefetch tcerts from member
		// services to help performance
		this._preFetchMode = true;//to do - not in doc

		this._peers = [];
		this._primary_peer = null; // if not set, will use the first peer on the list

		this._orderers = [];

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
	 * Retrieve the configuration from the primary orderer and initialize this chain (channel)
	 * with those values. Currently only the MSP config value of the channel is loaded
	 * into this chain.
	 */
	initialize() {
		var self = this;
		return this.getChannelConfig()
		.then(
			function(config_envelope) {
				logger.debug('initialize - got config envelope from getChannelConfig :: %j',config_envelope);
				self.loadConfigEnvelope(config_envelope);
				return Promise.resolve(true);
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

	// utility function to ensure that a peer exists on this chain
	isValidPeer(peer) {
		var url = peer.getUrl();
		for (let i = 0; i < this._peers.length; i++) {
			if (this._peers[i].getUrl() === url) {
				return true;
			}
		}
		return false;
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


	/**
	 * Calls the orderer(s) to start building the new chain.
	 * Only one of the application instances needs to call this method.
	 * Once the chain is successfully created, this and other application
	 * instances only need to call joinChannel() to participate on the channel.
	 * @param {Object} request - An object containing the following field:
	 *		<br>`envelope` : required - byte[] of the envelope object containing
	 *                          all required settings to initialize this channel
	 * @returns {boolean} Whether the chain initialization process was successful.
	 */
	createChannel(request) {
		logger.debug('createChannel - start');
		var errorMsg = null;

		// verify that we have an orderer configured
		if(!this.getOrderers()[0]) {
			errorMsg = 'Missing orderer object for the initialize channel';
		}

		// verify that we have targets (Peers) to join this channel
		// defined by the caller
		else if(!request) {
			errorMsg = 'Missing all required input request parameters for initialize channel';
		}

		// Verify that a config envolope has been included in the request object
		else if (!request.envelope) {
			errorMsg = 'Missing envelope input parameter containing the configuration of the new channel';
		}

		if(errorMsg) {
			logger.error('createChannel error %s',errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var chain_id = this._name;
		var orderer = self.getOrderers()[0];
		var userContext = null;

		return this._clientContext.getUserContext()
		.then(
			function(foundUserContext) {
				userContext = foundUserContext;

				// building manually or will get protobuf errors on send
				var envelope = _commonProto.Envelope.decode(request.envelope);
				logger.debug('createChannel - about to send envelope');

				var out_envelope = {
					signature: envelope.signature,
					payload : envelope.payload
				};

				return orderer.sendBroadcast(out_envelope);
			}
		)
		.then(
			function(results) {
				logger.debug('createChannel - good results from broadcast :: %j',results);
				return Promise.resolve(results);
			}
		)
		.catch(
			function(error) {
				if(error instanceof Error) {
					logger.debug('createChannel - rejecting with %s', error);
					return Promise.reject(error);
				}
				else {
					logger.error('createChannel - system error :: %s', error);
					return Promise.reject(new Error(error));
				}
			}
		);
	}

	/**
	 * Sends a join channel proposal to one or more endorsing peers
	 * Will get the genesis block from the defined orderer to be used
	 * in the proposal.
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`targets` : required - An array of `Peer` objects that will join
	 *                      this channel
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	joinChannel(request) {
		logger.debug('joinChannel - start');
		var errorMsg = null;

		// verify that we have an orderer configured
		if(!this.getOrderers()[0]) {
			errorMsg = 'Missing orderer object for the join channel proposal';
		}

		// verify that we have targets (Peers) to join this channel
		// defined by the caller
		else if(!request) {
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

		if(errorMsg) {
			logger.error('joinChannel - error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var self = this;
		var userContext = null;
		var orderer = self.getOrderers()[0];

		return this._clientContext.getUserContext()
		.then(
			function(foundUserContext) {
				userContext = foundUserContext;

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
				//logger.debug('createChannel - seekInfo ::' + JSON.stringify(seekInfo));

				// build the header for use with the seekInfo payload
				var seekInfoHeader = buildChannelHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					request.txId,
					self._initial_epoch
				);

				var seekHeader = buildHeader(userContext.getIdentity(), seekInfoHeader, request.nonce);
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
		)
		.then(
			function(block) {
				logger.debug('joinChannel - good results from seek block '); // :: %j',results);
				// verify that we have the genesis block
				if(block) {
					logger.debug('joinChannel - found genesis block');
				}
				else {
					logger.error('joinChannel - did not find genesis block');
					return Promise.reject(new Error('Join Channel failed, no genesis block found'));
				}
				var chaincodeInput = new _ccProto.ChaincodeInput();
				var args = [];
				args.push(Buffer.from('JoinChain', 'utf8'));
				args.push(block.toBuffer());

				chaincodeInput.setArgs(args);

				var chaincodeID = new _ccProto.ChaincodeID();
				chaincodeID.setName('cscc');

				var chaincodeSpec = new _ccProto.ChaincodeSpec();
				chaincodeSpec.setType(_ccProto.ChaincodeSpec.Type.GOLANG);
				chaincodeSpec.setChaincodeId(chaincodeID);
				chaincodeSpec.setInput(chaincodeInput);

				var channelHeader = buildChannelHeader(
					_commonProto.HeaderType.ENDORSER_TRANSACTION,
					'',
					request.txId,
					null, //no epoch
					'cscc'
				);

				var header = buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
				var proposal = self._buildProposal(chaincodeSpec, header);
				var signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

				return Chain._sendPeersProposal(request.targets, signed_proposal);
			}
		).then(
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

		return this._clientContext.getUserContext()
		.then(
			function(foundUserContext) {
				userContext = foundUserContext;
				var nonce = utils.getNonce();
				var tx_id = self.buildTransactionID(nonce, userContext);

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
				var seekInfoHeader = buildChannelHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					tx_id,
					self._initial_epoch
				);

				var seekHeader = buildHeader(userContext.getIdentity(), seekInfoHeader, nonce);
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
				return orderer.sendDeliver(envelope);
			}
		)
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
				var metadata = _commonProto.Metadata.decode(block.metadata.metadata[1]);
				var last_config = _commonProto.LastConfig.decode(metadata.value);
				logger.debug('getChannelConfig - latest block has config block of %s',last_config.index);

				var nonce = utils.getNonce();
				var tx_id = self.buildTransactionID(nonce, userContext);

				// now build the seek info to get the block called out
				// as the latest config block
				var seekSpecifiedStart = new _abProto.SeekSpecified();
				seekSpecifiedStart.setNumber(last_config.index);
				var seekStart = new _abProto.SeekPosition();
				seekStart.setSpecified(seekSpecifiedStart);

				//   build stop
				var seekSpecifiedStop = new _abProto.SeekSpecified();
				seekSpecifiedStop.setNumber(last_config.index);
				var seekStop = new _abProto.SeekPosition();
				seekStop.setSpecified(seekSpecifiedStop);

				// seek info with all parts
				var seekInfo = new _abProto.SeekInfo();
				seekInfo.setStart(seekStart);
				seekInfo.setStop(seekStop);
				seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);
				//logger.debug('initializeChain - seekInfo ::' + JSON.stringify(seekInfo));

				// build the header for use with the seekInfo payload
				var seekInfoHeader = buildChannelHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					tx_id,
					self._initial_epoch
				);

				var seekHeader = buildHeader(userContext.getIdentity(), seekInfoHeader, nonce);
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
					return Promise.reject(new Error('Block must be of type "CONFIG"'));
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
	 * from a Configuration block
	 * @param {ConfigEnvelope} the envelope with the configuration items
	 * @see /protos/common/configtx.proto
	 */
	loadConfigEnvelope(config_envelope) {
		logger.debug('loadConfigEnvelope - start');

		let group = config_envelope.config.channel_group;

		var found_MSPs = []; //save all the MSP's found
		this.loadConfigGroup(group, 'base', found_MSPs, true, false);
		this._msp_manager.loadMSPs(found_MSPs);
	}

	/*
	 * utility method to load in a config group
	 * @param {bool} - top - to handle the  differences in the structure of groups
	 * @param {bool} - keep_children - once we start keeping a group, want to keep all
	 *                 children's settings
	 * @see /protos/common/configtx.proto
	 */
	loadConfigGroup(group, name, found_MSPs, top, keep_children) {
		logger.debug('loadConfigGroup - %s - START groups   keep:%s', name, keep_children);
		if(!group) {
			logger.debug('loadConfigGroup - %s - no groups', name);
			logger.debug('loadConfigGroup - %s - END groups', name);
		}
		var groups = null;
		if(top) {
			groups = group.groups;
		}
		else {
			groups = group.value.groups;
		}
		if(groups) {
			var keys = Object.keys(groups.map);
			if(keys.length == 0) {
				logger.debug('loadConfigGroup - %s - no keys, so no groups', name);
			}
			for(let i =0; i < keys.length; i++) {
				let key = keys[i];
				logger.debug('loadConfigGroup - %s - found config group ==> %s', name, key);
				// The Application group is where config settings are that we want to find
				this.loadConfigGroup(groups.map[key], name+'.'+key, found_MSPs, false, (key === 'Application' || keep_children));
			}
		}
		else {
			logger.debug('loadConfigGroup - %s - no groups', name);
		}

		logger.debug('loadConfigGroup - %s - START values', name);
		var values = null;
		if(top) {
			values = group.values;
		}
		else {
			values = group.value.values;
		}
		if(values) {
			var keys = Object.keys(values.map);
			for(let i =0; i < keys.length; i++) {
				let key = keys[i];
				var config_value = values.map[key];
				this.loadConfigValue(config_value, name, found_MSPs, keep_children);
			}
		}
		else {
			logger.debug('loadConfigGroup - %s - no values', name);
		}
		logger.debug('loadConfigGroup - %s - END values', name);

		logger.debug('loadConfigGroup - %s - START policies', name);
		var policies = null;
		if(top) {
			policies = group.policies;
		}
		else {
			policies = group.value.policies;
		}
		if(policies) {
			var keys = Object.keys(policies.map);
			for(let i =0; i < keys.length; i++) {
				let key = keys[i];
				var config_policy = policies.map[key];
				this.loadConfigPolicy(config_policy, name, keep_children);
			}
		}
		else {
			logger.debug('loadConfigGroup - %s - no policies', name);
		}
		logger.debug('loadConfigGroup - %s - END policies', name);

		logger.debug('loadConfigGroup - %s - END group',name);
	}

	/*
	 * utility method to load in a config value
	 * @see /protos/common/configtx.proto
	 * @see /protos/msp/mspconfig.proto
	 * @see /protos/orderer/configuration.proto
	 * @see /protos/peer/configuration.proto
	 */
	loadConfigValue(config_value, group_name, found_MSPs, keep_value) {
		logger.debug('loadConfigValue - %s - START value name: %s  keep:%s', group_name, config_value.key, keep_value);
		logger.debug('loadConfigValue - %s   - version: %s', group_name, config_value.value.version);
		logger.debug('loadConfigValue - %s   - mod_policy: %s', group_name, config_value.value.mod_policy);
		try {
			switch(config_value.key) {
			case 'AnchorPeers':
				var anchor_peers = _peerConfigurationProto.AnchorPeers.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - AnchorPeers :: %s', group_name, anchor_peers);
				if(anchor_peers && anchor_peers) for(let i =0; i < anchor_peers.anchor_peers.length; i++) {
					let anchor_peer = anchor_peers.anchor_peers[i];
					logger.debug('loadConfigValue - %s   - AnchorPeer :: %s:%s', group_name, anchor_peer.host, anchor_peer.port);
				}
				break;
			case 'MSP':
				var msp_value = _mspConfigProto.MSPConfig.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - MSP found', group_name);
				if(keep_value) found_MSPs.push(msp_value);
				break;
			case 'ConsensusType':
				var consensus_type = _ordererConfigurationProto.ConsensusType.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - Consensus type value :: %s', group_name, consensus_type.type);
				break;
			case 'BatchSize':
				var batch_size = _ordererConfigurationProto.BatchSize.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - BatchSize  maxMessageCount :: %s', group_name, batch_size.maxMessageCount);
				logger.debug('loadConfigValue - %s   - BatchSize  absoluteMaxBytes :: %s', group_name, batch_size.absoluteMaxBytes);
				logger.debug('loadConfigValue - %s   - BatchSize  preferredMaxBytes :: %s', group_name, batch_size.preferredMaxBytes);
				break;
			case 'BatchTimeout':
				var batch_timeout = _ordererConfigurationProto.BatchTimeout.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - BatchTimeout timeout value :: %s', group_name, batch_timeout.timeout);
				break;
			case 'ChannelRestrictions':
				var channel_restrictions = _ordererConfigurationProto.ChannelRestrictions.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - ChannelRestrictions max_count value :: %s', group_name, channel_restrictions.max_count);
				break;
			case 'CreationPolicy':
				var creation_policy = _ordererConfigurationProto.CreationPolicy.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - CreationPolicy policy value :: %s', group_name, creation_policy.policy);
				break;
			case 'ChainCreationPolicyNames':
				var chain_creation_policy_names = _ordererConfigurationProto.ChainCreationPolicyNames.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - ChainCreationPolicyNames names value :: %s', group_name, chain_creation_policy_names.names);
				break;
			case 'HashingAlgorithm':
				var hashing_algorithm_name = _commonConfigurationProto.HashingAlgorithm.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - HashingAlgorithm name value :: %s', group_name, hashing_algorithm_name.name);
				break;
			case 'BlockDataHashingStructure':
				var blockdata_hashing_structure = _commonConfigurationProto.BlockDataHashingStructure.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - BlockDataHashingStructure width value :: %s', group_name, blockdata_hashing_structure.width);
				break;
			case 'OrdererAddresses':
				var orderer_addresses = _commonConfigurationProto.OrdererAddresses.decode(config_value.value.value);
				logger.debug('loadConfigValue - %s   - OrdererAddresses addresses value :: %s', group_name, orderer_addresses.addresses);
				break;
			default:
				logger.debug('loadConfigValue - %s   - value: %s', group_name, config_value.value.value);
			}
		}
		catch(err) {
			logger.debug('loadConfigValue - %s - name: %s - *** unable to parse with error :: %s', group_name, config_value.key, err);
		}
		logger.debug('loadConfigValue - %s - END value name: %s', group_name, config_value.key);
	}

	/*
	 * utility method to load in a config policy
	 * @see /protos/common/configtx.proto
	 */
	loadConfigPolicy(config_policy, group_name, keep_policy) {
		logger.debug('loadConfigPolicy - %s - name: %s  keep:%s', group_name, config_policy.key, keep_policy);
		logger.debug('loadConfigPolicy - %s - version: %s', group_name, config_policy.value.version);
		logger.debug('loadConfigPolicy - %s - mod_policy: %s', group_name, config_policy.value.mod_policy);
		try {
			switch(config_policy.value.policy.type) {
			case _policiesProto.Policy.PolicyType.SIGNATURE:
				var policy = _policiesProto.SignaturePolicyEnvelope.decode(config_policy.value.policy.policy);
				logger.debug('loadConfigPolicy - %s - policy SIGNATURE :: %s',group_name, policy);
				break;
			case _policiesProto.Policy.PolicyType.MSP:
				//var policy = _policiesProto.Policy.decode(value.value.policy.policy);
				logger.debug('loadConfigPolicy - %s - policy :: MSP POLICY NOT PARSED ', group_name);
				break;
			case _policiesProto.Policy.PolicyType.IMPLICIT_META:
				var policy = _policiesProto.ImplicitMetaPolicy.decode(config_policy.value.policy.policy);
				logger.debug('loadConfigPolicy - %s - policy IMPLICIT_META :: %s',group_name, policy);
				break;
			default:
				throw new Error('Unknown Policy type');
			}
		}
		catch(err) {
			logger.debug('loadConfigPolicy - %s - name: %s - unable to parse policy %j', group_name, config_policy.key, err);
		}
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
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [self.getPrimaryPeer()],
				chaincodeId : 'qscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetChainInfo',
				args: [ self._name]
			};
			return self.sendTransactionProposal(request);
		})
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
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [self.getPrimaryPeer()],
				chaincodeId : 'qscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetBlockByHash',
				args: [ self._name],
				argbytes : blockHash
			};
			return self.sendTransactionProposal(request);
		})
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
						var block = _commonProto.Block.decode(response.response.payload);
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
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [self.getPrimaryPeer()],
				chaincodeId : 'qscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetBlockByNumber',
				args: [ self._name, block_number]
			};
			return self.sendTransactionProposal(request);
		})
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
						var block = _commonProto.Block.decode(response.response.payload);
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
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [self.getPrimaryPeer()],
				chaincodeId : 'qscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetTransactionByID',
				args: [ self._name, transaction_id]
			};
			return self.sendTransactionProposal(request);
		})
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
						var processTrans = _transProto.ProcessedTransaction.decode(response.response.payload);
						logger.debug('queryTransaction - ProcessedTransaction.validationCode :: %s', processTrans.validationCode);
//						var payload = _commonProto.Payload.decode(processTrans.transactionEnvelope.payload);
//						var channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
//						logger.debug('queryTransaction - transaction ID :: %s:', channel_header.tx_id);
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
		var nonce = utils.getNonce();
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [peer],
				chaincodeId : 'lccc',
				chainId: self._name,
				txId: txId,
				nonce: nonce,
				fcn : 'getinstalledchaincodes',
				args: []
			};
			return self.sendTransactionProposal(request);
		})
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
	 * Queries the instantiated chaincodes on this channel.
	 * @returns {object} ChaincodeQueryResponse proto
	 */
	queryInstantiatedChaincodes() {
		logger.debug('queryInstantiatedChaincodes - start');
		var self = this;
		var nonce = utils.getNonce();
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [self.getPrimaryPeer()],
				chaincodeId : 'lccc',
				chainId: self._name,
				txId: txId,
				nonce: nonce,
				fcn : 'getchaincodes',
				args: []
			};
			return self.sendTransactionProposal(request);
		})
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
	 * Queries the names of all the channels that a
	 * peer has joined.
	 * @param {Peer} peer
	 * @returns {object} ChannelQueryResponse proto
	 */
	queryChannels(peer) {
		logger.debug('queryChannels - start');
		var self = this;
		var nonce = utils.getNonce();
		return this.buildTransactionID_getUserContext(nonce)
		.then(function(txId) {
			var request = {
				targets: [peer],
				chaincodeId : 'cscc',
				chainId: '',
				txId: txId,
				nonce: nonce,
				fcn : 'GetChannels',
				args: []
			};
			return self.sendTransactionProposal(request);
		})
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
				logger.error(util.format('Failed Channels Query. Error: %j', err.stack ? {error: err.stack} : err));
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
	sendInstallProposal(request) {
		logger.debug('Chain.sendInstallProposal begin');

		var errorMsg = null;

		var peers = null;
		if (request) {
			let peers = request.targets;
			if (peers && peers.length > 0) {
				for (let p = 0; p < peers.length; p++) {
					if (!this.isValidPeer(peers[p])) {
						errorMsg = 'Request targets peer object '+ peers[p] +' not in chain';
						logger.error('Chain.sendInstallProposal error '+ errorMsg);
						return Promise.reject(new Error(errorMsg));
					}
				}
			}
		}
		if (!peers || peers.length < 1) {
			peers = this.getPeers();
		}
		// Verify that a Peer has been added
		if (peers.length < 1) {
			errorMsg = 'Missing peer objects in Install proposal chain or request';
			logger.error('Chain.sendInstallProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}
		// modify the request so the following checks will be OK
		if(request) {
			request.chainId = 'dummy';
		}

		errorMsg = Chain._checkProposalRequest(request);
		if (errorMsg) {
			logger.error('Chain.sendInstallProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}
		errorMsg = Chain._checkInstallRequest(request);
		if (errorMsg) {
			logger.error('Chain.sendInstallProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let self = this;

		let ccSpec = {
			type: translateCCType(request.chaincodeType),
			chaincode_id: {
				name: request.chaincodeId,
				path: request.chaincodePath,
				version: request.chaincodeVersion
			}
		};
		logger.debug('Chain.sendInstallProposal ccSpec %s ',JSON.stringify(ccSpec));

		// step 2: construct the ChaincodeDeploymentSpec
		let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);
		chaincodeDeploymentSpec.setEffectiveDate(buildCurrentTimestamp()); //TODO may wish to add this as a request setting

		return Chain._getChaincodePackageData(request, this.isDevMode())
		.then((data) => {
			logger.debug('Chain.sendInstallProposal data %s ',data);
			// DATA may or may not be present depending on devmode settings
			if (data) {
				chaincodeDeploymentSpec.setCodePackage(data);
			}
			logger.debug('Chain.sendInstallProposal sending deployment spec %s ',chaincodeDeploymentSpec);

			// TODO add ESCC/VSCC info here ??????
			let lcccSpec = {
				type: _ccProto.ChaincodeSpec.Type.GOLANG,
				chaincode_id: {
					name: 'lccc'
				},
				input: {
					args: [Buffer.from('install', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
				}
			};

			var header, proposal;
			return self._clientContext.getUserContext()
				.then(
					function(userContext) {
						var txId = self.buildTransactionID(request.nonce, userContext);
						var channelHeader = buildChannelHeader(
							_commonProto.HeaderType.ENDORSER_TRANSACTION,
							'', //install does not target a channel
							txId,
							null,
							'lccc'
						);
						header = buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
						proposal = self._buildProposal(lcccSpec, header);
						let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

						return Chain._sendPeersProposal(peers, signed_proposal);
					}
				).then(
					function(responses) {
						return [responses, proposal, header];
					}
				);
		});
	}


	/**
	 * Sends an instantiate proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java']
	 *                            (default 'golang')
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chaincodeVersion` : required - String of the version of the chaincode
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`fcn` : optional - String of the function to be called on
	 *                  the chaincode once instantiated (default 'init')
	 *		<br>`args` : optional - String Array arguments specific to
	 *                   the chaincode being instantiated
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/proposal_response.proto
	 */
	sendInstantiateProposal(request) {
		var errorMsg = null;

		var peers = null;
		if (request) {
			let peers = request.targets;
			if (peers && peers.length > 0) {
				for (let p = 0; p < peers.length; p++) {
					if (!this.isValidPeer(peers[p])) {
						errorMsg = 'Request targets peer object '+ peers[p] +' not in chain';
						logger.error('Chain.sendInstantiateProposal error '+ errorMsg);
						return Promise.reject(new Error(errorMsg));
					}
				}
			}
		}
		if (!peers || peers.length < 1) {
			peers = this.getPeers();
		}
		// Verify that a Peer has been added
		if (peers.length < 1) {
			errorMsg = 'Missing peer objects in Instantiate proposal chain';
			logger.error('Chain.sendInstantiateProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		errorMsg = Chain._checkProposalRequest(request);
		if (errorMsg) {
			logger.error('Chain.sendInstantiateProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}
		errorMsg = Chain._checkInstallRequest(request);
		if (errorMsg) {
			logger.error('Chain.sendInstantiateProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}
		errorMsg = Chain._checkInstantiateRequest(request);
		if (errorMsg) {
			logger.error('Chain.sendInstantiateProposal error ' + errorMsg);
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
			type: translateCCType(request.chaincodeType),
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
		return self._clientContext.getUserContext()
			.then(
				function(userContext) {
					let lcccSpec = {
						type: _ccProto.ChaincodeSpec.Type.GOLANG,
						chaincode_id: {
							name: 'lccc'
						},
						input: {
							args: [
								Buffer.from('deploy', 'utf8'),
								Buffer.from('default', 'utf8'),
								chaincodeDeploymentSpec.toBuffer(),
								self._buildDefaultEndorsementPolicy()
							]
						}
					};

					var channelHeader = buildChannelHeader(
						_commonProto.HeaderType.ENDORSER_TRANSACTION,
						request.chainId,
						request.txId,
						null,
						'lccc'
					);
					header = buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
					proposal = self._buildProposal(lcccSpec, header);
					let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

					return Chain._sendPeersProposal(peers, signed_proposal);
				}
			).then(
				function(responses) {
					return [responses, proposal, header];
				}
			);
	}

	/**
	 * Sends a transaction proposal to one or more endorsing peers.
	 *
	 * @param {Object} request
	 *		<br>`chaincodeId` : The id of the chaincode to perform the transaction proposal
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`args` : an array of arguments specific to the chaincode 'invoke'
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 */
	sendTransactionProposal(request) {
		logger.debug('sendTransactionProposal - start');
		var errorMsg = null;

		// Verify that a Peer has been added
		if (this.getPeers().length < 1) {
			errorMsg = 'Missing peer objects in Transaction proposal chain';
			logger.error('Chain.sendTransactionProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// args is not optional because we need for transaction to execute
		if (request && !request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
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
		return this._clientContext.getUserContext()
		.then(
			function(userContext) {
				var channelHeader = buildChannelHeader(
					_commonProto.HeaderType.ENDORSER_TRANSACTION,
					request.chainId,
					request.txId,
					null,
					request.chaincodeId
					);
				header = buildHeader(userContext.getIdentity(), channelHeader, request.nonce);
				proposal = self._buildProposal(invokeSpec, header);
				let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);
				var targets = self.getPeers();
				if(request.targets) {
					targets = request.targets;
				}

				return Chain._sendPeersProposal(targets, signed_proposal);
			}
		).then(
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
		let header            = request.header;

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
		var chaincodeProposalPayloadNoTrans = _proposalProto.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
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
		return this._clientContext.getUserContext()
		.then(
			function(userContext) {
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
		);
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

	// internal utility method to build the proposal
	/**
	 * @private
	 */
	_buildProposal(invokeSpec, header) {
		// construct the ChaincodeInvocationSpec
		let cciSpec = new _ccProto.ChaincodeInvocationSpec();
		cciSpec.setChaincodeSpec(invokeSpec);
//		cciSpec.setIdGenerationAlg('');

		let cc_payload = new _proposalProto.ChaincodeProposalPayload();
		cc_payload.setInput(cciSpec.toBuffer());
		//cc_payload.setTransient(null); // TODO application-level confidentiality related

		// proposal -- will switch to building the proposal once the signProposal is used
		let proposal = new _proposalProto.Proposal();
		proposal.setHeader(header.toBuffer());
		proposal.setPayload(cc_payload.toBuffer()); // chaincode proposal payload
		//proposal.setExtension(chaincodeAction); //optional chaincode action

		return proposal;
	}

	// internal utility method to build chaincode policy
	// FIXME: for now always construct a 'Signed By any member of an organization by mspid' policy
	_buildDefaultEndorsementPolicy() {
		// construct a list of msp principals to select from using the 'n out of' operator
		var msps = this.getMSPManager().getMSPs();
		var principals = [], signedBys = [];
		var index = 0;
		for (let name in msps) {
			if (msps.hasOwnProperty(name)) {
				let onePrn = new _mspPrProto.MSPPrincipal();
				onePrn.setPrincipalClassification(_mspPrProto.MSPPrincipal.Classification.ROLE);

				let memberRole = new _mspPrProto.MSPRole();
				memberRole.setRole(_mspPrProto.MSPRole.MSPRoleType.MEMBER);
				memberRole.setMspIdentifier(name);

				onePrn.setPrincipal(memberRole.toBuffer());

				principals.push(onePrn);

				var signedBy = new _policiesProto.SignaturePolicy();
				signedBy.set('signed_by', index++);
				signedBys.push(signedBy);
			}
		}

		if (principals.length === 0) {
			throw new Error('Verifying MSPs not found in the chain object, make sure "intialize()" is called first.');
		}

		// construct 'one of one' policy
		var oneOfAny = new _policiesProto.SignaturePolicy.NOutOf();
		oneOfAny.setN(1);
		oneOfAny.setPolicies(signedBys);

		var noutof = new _policiesProto.SignaturePolicy();
		noutof.set('n_out_of', oneOfAny);

		var envelope = new _policiesProto.SignaturePolicyEnvelope();
		envelope.setVersion(0);
		envelope.setPolicy(noutof);
		envelope.setIdentities(principals);

		return envelope.toBuffer();
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
	_signProposal(signingIdentity, proposal) {
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

	/*
	 * @private
	 */
	static _checkInstantiateRequest(request) {
		var errorMsg = null;

		if (request) {
			var type = translateCCType(request.chaincodeType);
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

	/**
	* Utility method to build an unique transaction id
	* based on a nonce and this chain's user.
	* @param {int} nonce - a one time use number
	* @param {User} userContext - the user context
	* @returns {string} An unique string
	*/
	buildTransactionID(nonce, userContext) {
		logger.debug('buildTransactionID - start');
		var creator_bytes = userContext.getIdentity().serialize();//same as signatureHeader.Creator
		var nonce_bytes = nonce;//nonce is already in bytes
		var trans_bytes = Buffer.concat([nonce_bytes, creator_bytes]);
		var trans_hash = hashPrimitives.sha2_256(trans_bytes);
		var transaction_id = Buffer.from(trans_hash).toString();
		logger.debug('buildTransactionID - transaction_id %s',transaction_id);
		return transaction_id;
	}

	/**
	* Utility method to build an unique transaction id
	* based on a nonce and this chain's user.
	* Gets the user context.
	* @param {int} nonce - a one time use number
	* @returns {Promise} A promise for the transaction id
	*/
	buildTransactionID_getUserContext(nonce) {
		return this._clientContext.getUserContext()
		.then((userContext) => {
			logger.debug('buildTransactionID_getUserContext - got userContext');
			return this.buildTransactionID(nonce, userContext);
		})
		.catch(function(error) {
			logger.debug('buildTransactionID_getUserContext - caught error ::' + error.stack ? error.stack : error);
			return Promise.reject(new Error(error));
		});
	}

	// internal utility method to get the chaincodePackage data in bytes
	/**
	 * @private
	 */
	static _getChaincodePackageData(request, devMode) {
		return new Promise((resolve,reject) => {
			if (!request.chaincodePackage) {
				resolve(Packager.package(request.chaincodePath, request.chaincodeType, devMode));
			} else {
				resolve(request.chaincodePackage);
			}
		});
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

//utility method to build a common chain header
function buildChannelHeader(type, chain_id, tx_id, epoch, chaincode_id, time_stamp) {
	logger.debug('buildChannelHeader - type %s chain_id %s tx_id %d epoch % chaincode_id %s',
			type, chain_id, tx_id, epoch, chaincode_id);
	var channelHeader = new _commonProto.ChannelHeader();
	channelHeader.setType(type); // int32
	channelHeader.setVersion(1); // int32
	if(!time_stamp) {
		time_stamp = buildCurrentTimestamp();
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
function buildHeader(creator, channelHeader, nonce) {
	let signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setCreator(creator.serialize());
	signatureHeader.setNonce(nonce);

	let header = new _commonProto.Header();
	header.setSignatureHeader(signatureHeader.toBuffer());
	header.setChannelHeader(channelHeader.toBuffer());

	return header;
}

//utility method to return a timestamp for the current time
function buildCurrentTimestamp() {
	logger.debug('buildCurrentTimestamp - building');
	var now = new Date();
	var timestamp = new _timestampProto.Timestamp();
	timestamp.setSeconds(now.getTime() / 1000);
	timestamp.setNanos((now.getTime() % 1000) * 1000000);
	return timestamp;
}

function translateCCType(type) {
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

module.exports = Chain;
