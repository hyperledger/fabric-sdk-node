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
var fs = require('fs');
var Peer = require('./Peer.js');
var Orderer = require('./Orderer.js');
var settle = require('promise-settle');
var grpc = require('grpc');
var logger = utils.getLogger('Chain.js');

var _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _mspPrProto = grpc.load(__dirname + '/protos/common/msp_principal.proto').common;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _configurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
var _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _mspConfigProto = grpc.load(__dirname + '/protos/msp/mspconfig.proto').msp;


/**
 * The class representing a chain with which the client SDK interacts.
 *
 * The “Chain” object captures settings for a channel, which is created by
 * the orderers to isolate transactions delivery to peers participating on channel.
 * A chain must be initialized after it has been configured with the list of peers
 * and orderers. The initialization sends a CONFIGURATION transaction to the orderers
 * to create the specified channel and asks the peers to join that channel.
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

		/**
		 * @member [CryptoSuite]{@link module:api.CryptoSuite} cryptoPrimitives
		 * The crypto primitives object provides access to the crypto suite
		 * for functions like sign, encrypt, decrypt, etc.
		 * @memberof module:api.Chain.prototype
		 */
		this.cryptoPrimitives = utils.getCryptoSuite();

		this._peers = [];
		this._orderers = [];

		this._clientContext = clientContext;

		// the following settings will be used when this chain
		// is initialized (created) The user should set these
		// to the desired values before initializing this chain
		this.setInitialEpoch(0);
		this.setInitialMaxMessageCount(10);
		this.setInitialAbsoluteMaxBytes(10 * 1024 * 1024);
		this.setInitialPreferredMaxBytes(10 * 1024 * 1024);
		this._consensus_type = 'solo';
		// user must set this value before the initializeChain() method
		// is called
		this._initial_transaction_id = null;

		//to do update logger
		logger.info('Constructed Chain instance: name - %s, ' +
		    'securityEnabled: %s, ' +
		    'TCert download batch size: %s, ' +
		    'network mode: %s',
			this._name,
			this._securityEnabled,
			this._tcertBatchSize,
			!this._devMode);
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
	 * Get the consensus type that will be used when this
	 * chain is created.
	 * @return {string} consensus type
	 */
	getConsensusType() {
		return this._consensus_type;
	}

	/**
	 * Set the consensus type that will be used when this
	 * chain is created.
	 * Default 'solo'
	 *
	 * @param {string} consensus type
	 */
	setConsensusType(consensus_type) {
		this._consensus_type = consensus_type;
	}

	/**
	 * Get the initial epoch that will be used when this
	 * chain is created.
	 * @return {int} initial epoch
	 */
	getInitialEpoch() {
		return this._initial_epoch;
	}

	/**
	 * Set the initial epoch that will be used when this
	 * chain is created. Value must be a positive integer.
	 * Default 0
	 *
	 * @param {int} initial epoch
	 */
	setInitialEpoch(initial_epoch) {
		if(!Number.isInteger(initial_epoch) || initial_epoch < 0) {
			throw new Error('initial epoch must be a positive integer');
		}
		this._initial_epoch = initial_epoch;
	}

	/**
	 * Get the initial maximum message count that will be used when this
	 * chain is created.
	 * @return {int} initial maximum message count
	 */
	getInitialMaxMessageCount() {
		return this._initial_max_message_count;
	}

	/**
	 * Set the initial maximum message count that will be used when this
	 * chain is created.
	 * Default 10
	 *
	 * @param {int} initial maximum message count
	 */
	setInitialMaxMessageCount(initial_max_message_count) {
		if(!Number.isInteger(initial_max_message_count) || initial_max_message_count < 0) {
			throw new Error('initial maximum message count must be a positive integer');
		}
		this._initial_max_message_count = initial_max_message_count;
	}

	/**
	 * Get the initial absolute maximum bytes that will be used when this
	 * chain is created.
	 * @return {int} initial absolute maximum bytes
	 */
	getInitialAbsoluteMaxBytes() {
		return this._initial_absolute_max_bytes;
	}

	/**
	 * Set the initial absolute maximum bytes that will be used when this
	 * chain is created.
	 * Default 0
	 *
	 * @param {int} initial absolute maximum bytes
	 */
	setInitialAbsoluteMaxBytes(initial_absolute_max_bytes) {
		if(!Number.isInteger(initial_absolute_max_bytes) || initial_absolute_max_bytes < 0) {
			throw new Error('initial absolute maximum bytes must be a positive integer');
		}
		this._initial_absolute_max_bytes = initial_absolute_max_bytes;
	}

	/**
	 * Get the initial preferred maximum bytes that will be used when this
	 * chain is created.
	 * @return {int} initial preferred maximum bytes
	 */
	getInitialPreferredMaxBytes() {
		return this._initial_preferred_max_bytes;
	}

	/**
	 * Set the initial preferred maximum bytes that will be used when this
	 * chain is created.
	 * Default 0
	 *
	 * @param {int} initial preferred maximum bytes
	 */
	setInitialPreferredMaxBytes(initial_preferred_max_bytes) {
		if(!Number.isInteger(initial_preferred_max_bytes) || initial_preferred_max_bytes < 0) {
			throw new Error('initial preferred maximum bytes must be a positive integer');
		}
		this._initial_preferred_max_bytes = initial_preferred_max_bytes;
	}
	/**
	 * Get the initial transaction ID that will be used when this
	 * chain is created.
	 * @return {string} transaction ID
	 */
	getInitialTransactionId() {
		return this._initial_transaction_id;
	}

	/**
	 * Set the initial transaction ID that will be used when this
	 * chain is created. This value must be set before the
	 * initializeChain() method is called.
	 * There is no default.
	 *
	 * @param {int} initial transaction ID
	 */
	setInitialTransactionId(initial_transaction_id) {
		this._initial_transaction_id = initial_transaction_id;
	}

	/**
	 * Calls the orderer(s) to start building the new chain, which is a combination
	 * of opening new message stream and connecting the list of participating peers.
	 * This is a long-running process. Only one of the application instances needs
	 * to call this method. Once the chain is successfully created, other application
	 * instances only need to call getChain() to obtain the information about this chain.
	 * @returns {boolean} Whether the chain initialization process was successful.
	 */
	initializeChain() {
		logger.debug('initializeChain - start');

		// verify that we have an orderer configured
		if(!this.getOrderers()[0]) {
			logger.error('initializeChain - no primary orderer defined');
			return Promise.reject(new Error('no primary orderer defined'));
		}

		// verify that we have a user configured
		if(!this._clientContext._userContext) {
			logger.error('initializeChain - no user defined');
			return Promise.reject(new Error('no user defined'));
		}

		// verify that we have a name configured
		if(!this._name) {
			logger.error('initializeChain - no chain id defined');
			return Promise.reject(new Error('Chain name is not defined'));
		}

		// verify that we have a transactionid configured
		if(!this._initial_transaction_id) {
			logger.error('initializeChain - no transaction id defined');
			return Promise.reject(new Error('Initial transaction id is not defined'));
		}

		var self = this;
		var chain_id = this._name;
		var orderer = self.getOrderers()[0];
		var userContext = null;

		return this._clientContext.getUserContext()
		.then(
			function(foundUserContext) {
				userContext = foundUserContext;

				logger.debug('initializeChain - building broadcast message');
				// build fields to use when building the configuration items
				var configItemChainHeader =	buildChainHeader(
					_commonProto.HeaderType.CONFIGURATION_ITEM,
					chain_id,
					self._initial_transaction_id,
					self._initial_epoch
				);

				var orderer_type =
					_configurationProto.ConfigurationItem.ConfigurationType.Orderer;
				var policy_type =
					_configurationProto.ConfigurationItem.ConfigurationType.Policy;
				var last_modified = '0';
				var mod_policy = 'DefaultModificationPolicy';

				var creation_items = [];

				// build configuration items
				var consensusType = new _ordererConfigurationProto.ConsensusType();
				consensusType.setType(self.getConsensusType());
				var consensusTypeItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'ConsensusType',
					consensusType.toBuffer()
				);
				creation_items.push(consensusTypeItem.getConfigurationItem().toBuffer());

				var batchSize = new _ordererConfigurationProto.BatchSize();
				batchSize.setMaxMessageCount(self.getInitialMaxMessageCount());
				batchSize.setAbsoluteMaxBytes(self.getInitialAbsoluteMaxBytes());
				batchSize.setPreferredMaxBytes(self.getInitialPreferredMaxBytes());
				var batchSizeItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'BatchSize',
					batchSize.toBuffer()
				);
				creation_items.push(batchSizeItem.getConfigurationItem().toBuffer());

				// TODO how do we deal with KafkaBrokers ?
				var chainCreatorPolicyName = 'AcceptAllPolicy';

//				var chainCreators = new _ordererConfigurationProto.ChainCreators();
//				chainCreators.setPolicies([chainCreatorPolicyName]);
//				var chainCreatorsItem = buildSignedConfigurationItem(
//					configItemChainHeader,
//					orderer_type,
//					last_modified,
//					mod_policy,
//					'ChainCreators',
//					chainCreators.toBuffer()
//				);
//				creation_items.push(chainCreatorsItem.getConfigurationItem().toBuffer());

				var ingressPolicy = new _ordererConfigurationProto.IngressPolicyNames();
				ingressPolicy.setNames([chainCreatorPolicyName]);
				var ingressPolicyItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'IngressPolicyNames',
					ingressPolicy.toBuffer()
				);
				creation_items.push(ingressPolicyItem.getConfigurationItem().toBuffer());

				var egressPolicy = new _ordererConfigurationProto.EgressPolicyNames();
				egressPolicy.setNames([chainCreatorPolicyName]);
				var egressPolicyItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'EgressPolicyNames',
					egressPolicy.toBuffer()
				);
				creation_items.push(egressPolicyItem.getConfigurationItem().toBuffer());

				var acceptAllPolicy = buildAcceptAllPolicy();
				logger.debug('accept policy::'+JSON.stringify(acceptAllPolicy));
				var acceptAllPolicyItem = buildSignedConfigurationItem(
					configItemChainHeader,
					policy_type,
					last_modified,
					mod_policy,
					chainCreatorPolicyName,
					acceptAllPolicy.toBuffer()
				);
				creation_items.push(
					acceptAllPolicyItem.getConfigurationItem().toBuffer()
				);

				var rejectAllPolicy = buildRejectAllPolicy();
				logger.debug('reject policy::'+JSON.stringify(rejectAllPolicy));
				var defaultModificationPolicyItem = buildSignedConfigurationItem(
					configItemChainHeader,
					policy_type,
					last_modified,
					mod_policy,
					'DefaultModificationPolicy',
					rejectAllPolicy.toBuffer()
				);
				creation_items.push(defaultModificationPolicyItem.getConfigurationItem().toBuffer());

				var keyinfo = new _mspConfigProto.KeyInfo();
				keyinfo.setKeyIdentifier('PEER');
				keyinfo.setKeyMaterial(Buffer.from('peer')); //TODO get keys

				var sigid = new _mspConfigProto.SigningIdentityInfo();
				sigid.setPublicSigner(Buffer.from('signcert[0]')); //TODO get cert
				sigid.setPrivateSigner(keyinfo);

				var fmspconf = new _mspConfigProto.FabricMSPConfig();
				fmspconf.setAdmins([Buffer.from('admincert')]); //TODO get certs
				fmspconf.setRootCerts([Buffer.from('cacerts')]); //TODO get certs
				fmspconf.setSigningIdentity(sigid);
				fmspconf.setName('DEFAULT');

				var mspconf = new _mspConfigProto.MSPConfig();
				mspconf.setConfig(fmspconf.toBuffer());
				mspconf.setType(0);

				var mspConfigItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'MSP',
					mspconf.toBuffer()
				);
				creation_items.push(mspConfigItem.getConfigurationItem().toBuffer());

				logger.debug('initializeChain - all policies built');

				// hash all the bytes of all items
				var itemBytes = Buffer.concat(creation_items);
				logger.debug('initializeChain - itemBytes::'+itemBytes.toString('hex'));
				//var creation_items_hash = this.cryptoPrimitives.hash(itemBytes);
				var hashPrimitives = require('./hash.js');
				var creation_items_hash = hashPrimitives.shake_256(itemBytes, 512);
				logger.debug('initializeChain - creation_item_hash::'+creation_items_hash);

				// final item to contain hash of all others
				var creationPolicy = new _ordererConfigurationProto.CreationPolicy();
				creationPolicy.setPolicy(chainCreatorPolicyName);
				creationPolicy.setDigest(Buffer.from(creation_items_hash, 'hex'));
				//creationPolicy.setDigest(creation_items_hash);
				var createPolicyItem = buildSignedConfigurationItem(
					configItemChainHeader,
					orderer_type,
					last_modified,
					mod_policy,
					'CreationPolicy',
					creationPolicy.toBuffer()
				);

				logger.debug('initializeChain - all items built');

				//bundle all the items
				var configurationEnvelope = new _configurationProto.ConfigurationEnvelope();
				configurationEnvelope.setItems([
					createPolicyItem,
					consensusTypeItem,
					batchSizeItem,
//					chainCreatorsItem,
					ingressPolicyItem,
					egressPolicyItem,
					acceptAllPolicyItem,
					defaultModificationPolicyItem,
					mspConfigItem
				]);

				// build a chain header for later to be
				// used in the atomic broadcast
				var newChainHeader = buildChainHeader(
					_commonProto.HeaderType.CONFIGURATION_TRANSACTION,
					chain_id,
					self._initial_transaction_id,
					self._initial_epoch
				);
				var broadcastHeader = buildHeader(userContext.getIdentity(), newChainHeader, utils.getNonce());
				var payload = new _commonProto.Payload();
				payload.setHeader(broadcastHeader);
				payload.setData(configurationEnvelope.toBuffer());
				var payload_bytes = payload.toBuffer();
				//logger.debug('initializeChain - Here is the envelope to broadcast :: '+ JSON.stringify(payload));
				let sig = userContext.getSigningIdentity().sign(payload_bytes);
				let signature = Buffer.from(sig);

				// building manually or will get protobuf errors on send
				var envelope = {
					signature: signature,
					payload : payload_bytes
				};

				return orderer.sendBroadcast(envelope);
			}
		)
		.then(
			function(results) {
				logger.debug('initializeChain - good results from broadcast :: %j',results);
				return Promise.resolve(results);
			}
		)
		.catch(
			function(error) {
				logger.error('initializeChain - system error ::' + error.stack ? error.stack : error);
				return Promise.reject(new Error(error));
			}
		);
	}

	/**
	 * Sends a join channel proposal to one or more endorsing peers.
	 *
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 */
	sendJoinChannelProposal(request) {
		logger.debug('sendJoinChannelProposal - start');
		var errorMsg = null;

		// verify that we have an orderer configured
		if(!this.getOrderers()[0]) {
			errorMsg = 'Missing orderer object for the join channel proposal';
		}

		// Verify that a Peer has been added
		if (this.getPeers().length < 1) {
			errorMsg = 'Missing peer objects for the join channel proposal';
		}

		if(errorMsg) {
			logger.error('sendJoinChannelProposal error '+ errorMsg);
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
				//logger.debug('initializeChain - seekInfo ::' + JSON.stringify(seekInfo));

				// build the header for use with the seekInfo payload
				var seekInfoHeader = buildChainHeader(
					_commonProto.HeaderType.DELIVER_SEEK_INFO,
					self._name,
					self._initial_transaction_id,
					self._initial_epoch
				);

				var seekHeader = buildHeader(userContext.getIdentity(), seekInfoHeader, utils.getNonce());
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
				logger.debug('sendJoinChannelProposal - good results from seek block '); // :: %j',results);
				// verify that we have the genesis block
				if(block) {
					logger.debug('sendJoinChannelProposal - found genesis block');
				}
				else {
					logger.error('sendJoinChannelProposal - did not find genesis block');
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
				chaincodeSpec.setChaincodeID(chaincodeID);
				chaincodeSpec.setInput(chaincodeInput);

				var chainHeader = buildChainHeader(
					_commonProto.HeaderType.CONFIGURATION_TRANSACTION,
					'',
					self._initial_transaction_id,
					null, //no epoch
					'cscc'
					);

				var header = buildHeader(userContext.getIdentity(), chainHeader, utils.getNonce());
				var proposal = self._buildProposal(chaincodeSpec, header);
				var signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

				return Chain._sendPeersProposal(self.getPeers(), signed_proposal);
			}
		).then(
			function(responses) {
				return Promise.resolve(responses);
			}
		).catch(
			function(err) {
				logger.error('Failed Proposal. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			}
		);
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
	 * @returns {object} With height, currently the only useful info.
	 */
	queryInfo() {
		//to do
	}

	/**
	 * Queries the ledger for Block by block number.
	 * @param {number} blockNumber The number which is the ID of the Block.
	 * @returns {object} Object containing the block.
	 */
	queryBlock(blockNumber) {
		//to do
	}

	/**
	 * Queries the ledger for Transaction by number.
	 * @param {number} transactionID
	 * @returns {object} Transaction information containing the transaction.
	 */
	queryTransaction(transactionID) {
		//to do
	}

	/**
	 * Sends a deployment proposal to one or more endorsing peers.
	 *
	 * @param {Object} request - An object containing the following fields:
	 *		<br>`chaincodePath` : required - String of the path to location of
	 *                            the source code of the chaincode
	 *		<br>`chaincodeId` : required - String of the name of the chaincode
	 *		<br>`chainId` : required - String of the name of the chain
	 *		<br>`txId` : required - String of the transaction id
	 *		<br>`nonce` : required - Integer of the once time number
	 *		<br>`fcn` : optional - String of the function to be called on
	 *                  the chaincode once deployed (default 'init')
	 *		<br>`args` : optional - String Array arguments specific to
	 *                   the chaincode being deployed
	 *		<br>`dockerfile-contents` : optional - String defining the
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 * @see /protos/peer/fabric_proposal_response.proto
	 */
	sendDeploymentProposal(request) {
		var errorMsg = null;

		// Verify that a Peer has been added
		if (this.getPeers().length < 1) {
			errorMsg = 'Missing peer objects in Deployment proposal chain';
			logger.error('Chain.sendDeploymentProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// Verify that chaincodePath is being passed
		if (request && (!request.chaincodePath || request.chaincodePath === '')) {
			errorMsg = 'Missing chaincodePath parameter in Deployment proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
		}

		if(errorMsg) {
			logger.error('Chain.sendDeploymentProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}
		let self = this;

		return packageChaincode(request.chaincodePath, request.chaincodeId, request['dockerfile-contents'])
		.then(
			function(data) {
				var targzFilePath = data;

				logger.debug('Chain.sendDeployment- Successfully generated chaincode deploy archive and name (%s)', request.chaincodeId);

				// at this point, the targzFile has been successfully generated

				// step 1: construct a ChaincodeSpec
				var args = [];
				args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

				for (let i=0; i<request.args.length; i++)
					args.push(Buffer.from(request.args[i], 'utf8'));

				let ccSpec = {
					type: _ccProto.ChaincodeSpec.Type.GOLANG,
					chaincodeID: {
						name: request.chaincodeId
					},
					input: {
						args: args
					}
				};

				// step 2: construct the ChaincodeDeploymentSpec
				let chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
				chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);

				return new Promise(function(resolve, reject) {
					fs.readFile(targzFilePath, function(err, data) {
						if(err) {
							reject(new Error(util.format('Error reading deployment archive [%s]: %s', targzFilePath, err)));
						} else {
							chaincodeDeploymentSpec.setCodePackage(data);

							// TODO add ESCC/VSCC info here ??????
							let lcccSpec = {
								type: _ccProto.ChaincodeSpec.Type.GOLANG,
								chaincodeID: {
									name: 'lccc'
								},
								input: {
									args: [Buffer.from('deploy', 'utf8'), Buffer.from('default', 'utf8'), chaincodeDeploymentSpec.toBuffer()]
								}
							};

							var header, proposal;
							return self._clientContext.getUserContext()
							.then(
								function(userContext) {
									var chainHeader = buildChainHeader(
										_commonProto.HeaderType.ENDORSER_TRANSACTION,
										request.chainId,
										request.txId,
										null,
										'lccc'
									);
									header = buildHeader(userContext.getIdentity(), chainHeader, request.nonce);
									proposal = self._buildProposal(lcccSpec, header);
									let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

									return Chain._sendPeersProposal(self.getPeers(), signed_proposal);
								}
							).then(
								function(responses) {
									resolve([responses, proposal, header]);
								}
							).catch(
								function(err) {
									logger.error('Sending the deployment proposal failed. Error: %s', err.stack ? err.stack : err);
									reject(err);
								}
							);
						}
					});
				});
			}
		).catch(
			function(err) {
				logger.error('Building the deployment proposal failed. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
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
	 *		<br>`args` : an array of arguments specific to the chaincode 'innvoke'
	 * @returns {Promise} A Promise for a `ProposalResponse`
	 */
	sendTransactionProposal(request) {
		logger.debug('Chain.sendTransactionProposal - start');
		var errorMsg = null;

		// Verify that a Peer has been added
		if (this.getPeers().length < 1) {
			errorMsg = 'Missing peer objects in Transaction proposal chain';
			logger.error('Chain.sendDeploymentProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		// args is not optional because we need for transaction to execute
		if (request && !request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else {
			errorMsg = Chain._checkProposalRequest(request);
		}

		if(errorMsg) {
			logger.error('Chain.sendTransactionProposal error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		var args = [];
		// leaving this for now... but this call is always an invoke and we are not telling caller to include 'fcn' any longer
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('Chain.sendTransactionProposal - adding function arg:%s', request.fcn ? request.fcn : 'invoke');

		for (let i=0; i<request.args.length; i++) {
			args.push(Buffer.from(request.args[i], 'utf8'));
			logger.debug('Chain.sendTransactionProposal - adding arg:%s', request.args[i]);
		}

		let invokeSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincodeID: {
				name: request.chaincodeId
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
				var chainHeader = buildChainHeader(
					_commonProto.HeaderType.ENDORSER_TRANSACTION,
					request.chainId,
					request.txId,
					null,
					request.chaincodeId
					);
				header = buildHeader(userContext.getIdentity(), chainHeader, request.nonce);
				proposal = self._buildProposal(invokeSpec, header);
				let signed_proposal = self._signProposal(userContext.getSigningIdentity(), proposal);

				return Chain._sendPeersProposal(self.getPeers(), signed_proposal);
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
	 * @see fabric_proposal_response.proto
	 * @param {Proposal} chaincodeProposal - A Proposal object containing the original
	 *        request for endorsement(s)
	 * @see fabric_proposal.proto
	 * @returns {Promise} A Promise for a `BroadcastResponse`.
	 *         This will be an acknowledgement from the orderer of successfully submitted transaction.
	 * @see the ./proto/atomicbroadcast/ab.proto
	 */
	sendTransaction(request) {
		logger.debug('Chain.sendTransaction - start :: chain '+this._chain);
		var errorMsg = null;

		if (request) {
			// Verify that data is being passed in
			if (!request.proposalResponses) {
				errorMsg = 'Missing "proposalResponse" parameter in transaction request';
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
			logger.error('Chain.sendTransaction error '+ errorMsg);
			return Promise.reject(new Error(errorMsg));
		}

		let proposalResponses = request.proposalResponses;
		let chaincodeProposal = request.proposal;
		let header            = request.header;

		// verify that we have an orderer configured
		if(!this.getOrderers()) {
			logger.error('Chain.sendTransaction - no orderers defined');
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
		chaincodeProposalPayloadNoTrans.transient = null;
		var payload_hash = this.cryptoPrimitives.hash(chaincodeProposalPayloadNoTrans.toBuffer());
		chaincodeActionPayload.setChaincodeProposalPayload(Buffer.from(payload_hash, 'hex'));

		var transactionAction = new _transProto.TransactionAction();
		transactionAction.setHeader(header.getSignatureHeader().toBuffer());
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
				logger.debug('Chain-queryByChaincode - response %j', responses);
				if(responses && Array.isArray(responses)) {
					var results = [];
					for(let i = 0; i < responses.length; i++) {
						if(responses[i].response && responses[i].response.payload) {
							results.push(responses[i].response.payload);
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
				responses.push(result.reason());
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
			proposalBytes : proposal_bytes
		};
		return signedProposal;
	}

	/*
	 * @private
	 */
	static _checkProposalRequest(request) {
		var errorMsg = null;

		if(request) {
			if(!request.chaincodeId) {
				errorMsg = 'Missing "chaincodeId" parameter in the proposal request';
			} else if(!request.chainId) {
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

function toKeyValueStoreName(name) {
	return 'member.' + name;
}

function packageChaincode(chaincodePath, chaincodeId, dockerfileContents) {

	// Determine the user's $GOPATH
	let goPath =  process.env['GOPATH'];

	// Compose the path to the chaincode project directory
	let projDir = goPath + '/src/' + chaincodePath;

	// Compose the Dockerfile commands
	if (dockerfileContents === undefined) {
		dockerfileContents = utils.getConfigSetting('dockerfile-contents', undefined);
	}

	// Substitute the hashStrHash for the image name
	dockerfileContents = util.format(dockerfileContents, chaincodeId);

	return new Promise(function(resolve, reject) {
		// Create a Docker file with dockerFileContents
		let dockerFilePath = projDir + '/Dockerfile';
		fs.writeFile(dockerFilePath, dockerfileContents, function(err) {
			if (err) {
				reject(new Error(util.format('Error writing file [%s]: %s', dockerFilePath, err)));
			} else {
				// Create the .tar.gz file of the chaincode package
				let targzFilePath = '/tmp/deployment-package.tar.gz';
				// Create the compressed archive
				return utils.generateTarGz(projDir, targzFilePath)
				.then(
					function(targzFilePath) {
						// return both the hash and the tar.gz file path as resolved data
						resolve(targzFilePath);
					}
				).catch(
					function(err) {
						logger.error('Failed to build chaincode package: %s', err.stack ? err.stack : err);
						reject(err);
					}
				);
			}
		});
	});
}

//utility method to build a common chain header
function buildChainHeader(type, chain_id, tx_id, epoch, chaincode_id) {
	logger.debug('buildChainHeader - type %s chain_id %s tx_id %d epoch % chaincode_id %s',
			type, chain_id, tx_id, epoch, chaincode_id);
	var chainHeader = new _commonProto.ChainHeader();
	chainHeader.setType(type); // int32
	chainHeader.setVersion(1); // int32
	//chainHeader.setTimeStamp(time_stamp); // google.protobuf.Timestamp
	chainHeader.setChainID(chain_id); //string
	chainHeader.setTxID(tx_id.toString()); //string
	if(epoch) {
		chainHeader.setEpoch(epoch); // uint64
	}
	if(chaincode_id) {
		let chaincodeID = new _ccProto.ChaincodeID();
		chaincodeID.setName(chaincode_id);

		let headerExt = new _proposalProto.ChaincodeHeaderExtension();
		headerExt.setChaincodeID(chaincodeID);

		chainHeader.setExtension(headerExt.toBuffer());
	}
	return chainHeader;
};

// utility method to build the header
function buildHeader(creator, chainHeader, nonce) {
	let signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setCreator(creator.serialize());
	signatureHeader.setNonce(nonce);

	let header = new _commonProto.Header();
	header.setSignatureHeader(signatureHeader);
	header.setChainHeader(chainHeader);

	return header;
}

//utility method to build a signed configuration item
function buildSignedConfigurationItem(
		chain_header,
		type,
		last_modified,
		mod_policy,
		key,
		value,
		signatures) {
	var configurationItem = new _configurationProto.ConfigurationItem();
	configurationItem.setHeader(chain_header); // ChainHeader
	configurationItem.setType(type); // ConfigurationType
	configurationItem.setLastModified(last_modified); // uint64
	configurationItem.setModificationPolicy(mod_policy); // ModificationPolicy
	configurationItem.setKey(key); // string
	configurationItem.setValue(value); // bytes

	var signedConfigurationItem = new _configurationProto.SignedConfigurationItem();
	signedConfigurationItem.setConfigurationItem(configurationItem.toBuffer());
	if(signatures) {
		signedConfigurationItem.setSignatures(signatures);
	}

	return signedConfigurationItem;
};

//utility method to build an accept all policy
function buildAcceptAllPolicy() {
	return buildPolicyEnvelope(0);
}

//utility method to build a reject all policy
function buildRejectAllPolicy() {
	return buildPolicyEnvelope(1);
}

//utility method to build a policy with a signature policy envelope
function buildPolicyEnvelope(nOf) {
	logger.debug('buildPolicyEnvelope - building policy with nOf::'+nOf);
	var nOutOf = new _configurationProto.SignaturePolicy.NOutOf();
	nOutOf.setN(nOf);
	nOutOf.setPolicies([]);
	var signaturePolicy = new _configurationProto.SignaturePolicy();
	signaturePolicy.setFrom(nOutOf);
	var signaturePolicyEnvelope = new _configurationProto.SignaturePolicyEnvelope();
	signaturePolicyEnvelope.setVersion(0);
	signaturePolicyEnvelope.setPolicy(signaturePolicy);
//	var identity = new _mspPrProto.MSPPrincipal();
//	identity.setPrincipalClassification(_mspPrProto.MSPPrincipal.Classification.ByIdentity);
//	identity.setPrincipal(Buffer.from('Admin'));
	signaturePolicyEnvelope.setIdentities([]);

	var policy = new _configurationProto.Policy();
	policy.setType(_configurationProto.Policy.PolicyType.SIGNATURE);
	policy.setPolicy(signaturePolicyEnvelope.toBuffer());
	return policy;
};

module.exports = Chain;
