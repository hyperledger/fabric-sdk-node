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

var utils = require('./utils.js');
var clientUtils = require('./client-utils.js');
var util = require('util');
var path = require('path');
var ChannelEventHub = require('./ChannelEventHub.js');
var BlockDecoder = require('./BlockDecoder.js');
var TransactionID = require('./TransactionID.js');
var grpc = require('grpc');
var logger = utils.getLogger('Channel.js');
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

const ImplicitMetaPolicy_Rule = { 0: 'ANY', 1: 'ALL', 2: 'MAJORITY' };

/**
 * In fabric v1.0, channels are the recommended way to isolate data and maintain privacy.
 * <br><br>
 * A Channel object captures the settings needed to interact with a fabric backend in the
 * context of a channel. These settings including the list of participating organizations,
 * represented by instances of Membership Service Providers (MSP), the list of endorsing peers,
 * and an orderer.
 * <br><br>
 * A client application can use the Channel object to create new channels with the orderer,
 * update an existing channel, send various channel-aware requests to the peers such as
 * invoking chaincodes to process transactions or queries.
 * <br><br>
 * A Channel object is also responsible for verifying endorsement signatures in transaction
 * proposal responses. A channel object must be initialized after it has been configured with
 * the list of peers and orderers. The initialization sends a get configuration block request
 * to the primary orderer to retrieve the configuration settings for this channel.
 *
 * @class
 */
var Channel = class {

	/**
	 * Returns a new instance of the class. This is a client-side-only call. To create a new channel
	 * in the fabric, call [createChannel()]{@link Client#createChannel}.
	 *
	 * @param {string} name - Name to identify the channel. This value is used as the identifier
	 *                        of the channel when making channel-aware requests with the fabric,
	 *                        such as invoking chaincodes to endorse transactions. The naming of
	 *                        channels is enforced by the ordering service and must be unique within
	 *                        the fabric backend
	 * @param {Client} clientContext - The client instance, which provides operational context
	 *                                 such as the signing identity
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
	 * Close the service connection off all assigned peers and orderers
	 */
	close() {
		logger.info('close - closing connections');
		var closer = function (ep) {
			ep.close();
		};
		this._peers.map(closer);
		this._orderers.map(closer);
	}

	/**
	 * Initializes the channel object with the Membership Service Providers (MSPs). The channel's
	 * MSPs are critical in providing applications the ability to validate certificates and verify
	 * signatures in messages received from the fabric backend. For instance, after calling
	 * [sendTransactionProposal()]{@link Channel#sendTransactionProposal}, the application can
	 * verify the signatures in the proposal response's endorsements to ensure they have not been
	 * tampered with.
	 * <br><br>
	 * This method retrieves the configuration from the orderer if no "config" parameter is passed in.
	 * Optionally a configuration may be passed in to initialize this channel without making the call
	 * to the orderer.
	 *
	 * @param {byte[]} config - Optional. An encoded (a.k.a un-decoded) byte array of the protobuf "ConfigUpdate"
	 * @return {Promise} A Promise that will resolve when the action is complete
	 */
	initialize(config_update) {
		if (config_update) {
			this.loadConfigUpdate(config_update);
			return Promise.resolve(true);
		}

		var self = this;
		return this.getChannelConfig()
			.then(
				function (config_envelope) {
					logger.debug('initialize - got config envelope from getChannelConfig :: %j', config_envelope);
					var config_items = self.loadConfigEnvelope(config_envelope);
					return Promise.resolve(config_items);
				}
			)
			.catch(
				function (error) {
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
	 * @returns {string[]} Array of MSP identifiers representing the channel's
	 *                     participating organizations
	 */
	getOrganizations() {
		logger.debug('getOrganizationUnits - start');
		var msps = this._msp_manager.getMSPs();
		var orgs = [];
		if (msps) {
			var keys = Object.keys(msps);
			for (var key in keys) {
				var msp = msps[keys[key]];
				var msp_org = { id: msp.getId() };
				logger.debug('getOrganizationUnits - found %j', msp_org);
				orgs.push(msp_org);
			}
		}
		logger.debug('getOrganizationUnits - orgs::%j', orgs);
		return orgs;
	}

	/**
	 * Set the MSP Manager for this channel. This utility method will
	 * not normally be use as the [initialize()]{@link Channel#initialize}
	 * method will read this channel's current configuration and reset
	 * MSPManager with the MSP's found in the channel configuration.
	 *
	 * @param {MSPManager} msp_manager - The msp manager for this channel
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
	 * Add the peer object to the channel object. A channel object can be optionally
	 * configured with a list of peer objects, which will be used when calling certain
	 * methods such as [sendInstantiateProposal()]{@link Channel#sendInstantiateProposal},
	 * [sendUpgradeProposal()]{@link Channel#sendUpgradeProposal},
	 * [sendTransactionProposal]{@link Channel#sendTransactionProposal}.
	 *
	 * @param {Peer} peer - An instance of the Peer class that has been initialized with URL
	 *                      and other gRPC options such as TLS credentials and request timeout.
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
	 * Remove the first peer object in the channel object's list of peers
	 * whose endpoint url property matches the url of the peer that is
	 * passed in.
	 *
	 * @param {Peer} peer - An instance of the Peer class.
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
	 * Returns the list of peers of this channel object.
	 * @returns {Peer[]} The peer list on the channel.
	 */
	getPeers() {
		logger.debug('getPeers - list size: %s.', this._peers.length);
		return this._peers;
	}

	/**
	 * Add the orderer object to the channel object, this is a client-side-only operation.
	 * An application may add more than one orderer object to the channel object, however
	 * the SDK only uses the first one in the list to send broadcast messages to the
	 * orderer backend.
	 *
	 * @param {Orderer} orderer - An instance of the Orderer class.
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
	 * Remove the first orderer object in the channel object's list of orderers
	 * whose endpoint url property matches the url of the orderer that is
	 * passed in.
	 *
	 * @param {Orderer} orderer - An instance of the Orderer class.
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
	 * Returns the orderers of this channel object.
	 * @returns {Orderer[]} The list of orderers in the channel object
	 */
	getOrderers() {
		return this._orderers;
	}

	/**
	 * Returns an {@link ChannelEventHub} object. An event hub object encapsulates the
	 * properties of an event stream on a peer node, through which the peer publishes
	 * notifications of blocks being committed in the channel's ledger.
	 *
	 * @returns {ChannelEventHub} The ChannnelEventHub instance
	 */
	newChannelEventHub(peer) {
		peer = this._getPeerForEvents(peer);
		var event_hub = new ChannelEventHub(this, peer);
		return event_hub;
	}

	/**
	 * Returns a list of {@link ChannelEventHub} based on the peers that are
	 * defined in this channel that are in the named orgainization of the
	 * currently loaded connection profile. If no connetion profile is loaded,
	 * an error will be thrown.
	 * When called with no organization name, the organization named in the
	 * currently active connection profile configuration's client section will
	 * be used. A peer with the "eventSource" role setting of true will be added
	 * to the list (a role will default to true if not defined).
	 *
	 * @param {string} org_name - Optional - The name of an organization
	 * @returns {ChannelEventHub[]} An array of ChannelEventHub instances
	 */
	getChannelEventHubsForOrg(org_name) {
		let method = 'getChannelEventHubsForOrg';
		logger.debug('%s - starting', method);
		var channel_event_hubs = [];
		let working_org_name = null;
		let found_peers = {};
		if (this._clientContext && this._clientContext._network_config) {
			if (!org_name && this._clientContext._network_config.hasClient()) {
				let client = this._clientContext._network_config.getClientConfig();
				working_org_name = client.organization;
			} else {
				working_org_name = org_name;
			}
			if (working_org_name) {
				let organization = this._clientContext._network_config.getOrganization(working_org_name);
				if (organization) {
					let channel_peers = this.getPeers();
					let org_peers = organization.getPeers();
					for (let j in channel_peers) {
						let channel_peer = channel_peers[j];
						logger.debug('%s - looking at channel peer:%s', method, channel_peer.getName());
						if (channel_peer.isInRole(Constants.NetworkConfig.EVENT_SOURCE_ROLE)) {
							for (let k in org_peers) {
								let org_peer = org_peers[k];
								logger.debug('%s - looking at org peer:%s', method, org_peer.getName());
								if (org_peer.getName() === channel_peer.getName()) {
									found_peers[org_peer.getName()] = org_peer;//to avoid Duplicate Peers
									logger.debug('%s - adding peer to list:%s', method, org_peer.getName());
								}
							}
						}
					}
				} else {
					throw new Error(util.format('Organization definition not found for %s', working_org_name));
				}
			} else {
				throw new Error('No organization name provided');
			}
		} else {
			throw new Error('No connecton profile has been loaded');
		}

		for (let name in found_peers) {
			logger.debug('%s - final list has:%s', method, name);
			let peer = found_peers[name];
			let channel_event_hub = new ChannelEventHub(this, peer);
			channel_event_hubs.push(channel_event_hub);
		}
		return channel_event_hubs;
	}

	/**
	 * @typedef {Object} OrdererRequest
	 * @property {TransactionID} txId - Optional. Object with the transaction id and nonce
	 * @property {Orderer} orderer - Optional. The orderer instance or string name
	 *                     of the orderer to retrieve genesis block from
	 */

	/**
	 * A channel's first block is called the "genesis block". This block captures the
	 * initial channel configuration. For a peer node to join the channel, it must be
	 * provided the genesis block. This method must be called before calling
	 * [joinChannel()]{@link Channel#joinChannel}.
	 *
	 * @param {OrdererRequest} request - Optional - A transaction ID object
	 * @returns {Promise} A Promise for an encoded protobuf "Block"
	 */
	getGenesisBlock(request) {
		logger.debug('getGenesisBlock - start');

		if (!request) {
			request = {};
		}

		// verify that we have an orderer configured
		var orderer = this._clientContext.getTargetOrderer(request.orderer, this._orderers, this._name);
		var signer = null;
		var tx_id = request.txId;
		if (!tx_id) {
			signer = this._clientContext._getSigningIdentity(true);
			tx_id = new TransactionID(signer, true);
		} else {
			signer = this._clientContext._getSigningIdentity(tx_id.isAdmin());
		}

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
			this._name,
			tx_id.getTransactionID(),
			this._initial_epoch,
			null,
			clientUtils.buildCurrentTimestamp(),
			orderer.getClientCertHash()
		);

		var seekHeader = clientUtils.buildHeader(signer, seekInfoHeader, tx_id.getNonce());
		var seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		var seekPayloadBytes = seekPayload.toBuffer();

		let sig = signer.sign(seekPayloadBytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload: seekPayloadBytes
		};

		return orderer.sendDeliver(envelope);
	}

	/**
	 * A protobuf message that gets returned by endorsing peers on proposal requests.
	 * The peer node runs the target chaincode, as designated by the proposal, and
	 * decides on whether to endorse the proposal or not, and sends back the endorsement
	 * result along with the [read and write sets]{@link http://hyperledger-fabric.readthedocs.io/en/latest/arch-deep-dive.html?highlight=readset#the-endorsing-peer-simulates-a-transaction-and-produces-an-endorsement-signature}
	 * inside the proposal response message.
	 *
	 * @typedef {Object} ProposalResponse
	 * @property {number} version
	 * @property {Timestamp} timestamp - Time the proposal was created by the submitter
	 * @property {Response} response
	 * @property {byte[]} payload - The payload of the response. It is the encoded bytes of
	 *                              the "ProposalResponsePayload" protobuf message
	 * @property {Endorsement} endorsement - The endorsement of the proposal, basically the
	 *                                       endorser's signature over the payload
	 */

	/**
	 * A response message indicating whether the endorsement of the proposal was successful
	 *
	 * @typedef {Object} Response
	 * @property {number} status - Status code. Follows [HTTP status code definitions]{@link https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html}
	 * @property {string} message - A message associated with the response status code
	 * @property {byte[]} payload - A payload that can be used to include metadata with this response
	 */

	/**
	 * @typedef {Object} JoinChannelRequest
	 * @property {Peer[]} targets - Optional. An array of Peer objects or Peer names that will
	 *                              be asked to join this channel. When using Peer names or left
	 *                              empty (use default targets) there must be a loaded network
	 *                              configuration.
	 *                              See [loadFromConfig()]{@link Client#loadFromConfig}
	 * @property {byte[]} block - The encoded bytes of the channel's genesis block.
	 *                            See [getGenesisBlock()]{@link Channel#getGenesisBlock} method
	 * @property {TransactionID} txId - Required. TransactionID object with the transaction id and nonce
	 */

	/**
	 * For a peer node to become part of a channel, it must be sent the genesis
	 * block, as explained [here]{@link Channel#getGenesisBlock}. This method
	 * sends a join channel proposal to one or more endorsing peers.
	 *
	 * @param {JoinChannelRequest} request
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the {@link Peer} instance(s) and the global timeout in the config settings.
	 * @returns {Promise} A Promise for an array of {@link ProposalResponse} from the target peers
	 */
	joinChannel(request, timeout) {
		logger.debug('joinChannel - start');
		var errorMsg = null;

		// verify that we have targets (Peers) to join this channel
		// defined by the caller
		if (!request) {
			errorMsg = 'Missing all required input request parameters';
		}
		// verify that we have transaction id
		else if (!request.txId) {
			errorMsg = 'Missing txId input parameter with the required transaction identifier';
		}
		else if (!request.block) {
			errorMsg = 'Missing block input parameter with the required genesis block';
		}

		if (errorMsg) {
			logger.error('joinChannel - error ' + errorMsg);
			throw new Error(errorMsg);
		}

		var targets = this._getTargets(request.targets); //no role, will get all peers
		var signer = this._clientContext._getSigningIdentity(request.txId.isAdmin());
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
			Constants.CSCC,
			clientUtils.buildCurrentTimestamp(),
			targets[0].getClientCertHash()
		);

		var header = clientUtils.buildHeader(signer, channelHeader, request.txId.getNonce());
		var proposal = clientUtils.buildProposal(chaincodeSpec, header);
		var signed_proposal = clientUtils.signProposal(signer, proposal);

		return clientUtils.sendPeersProposal(targets, signed_proposal, timeout)
			.then(
				function (responses) {
					return Promise.resolve(responses);
				}
			).catch(
				function (err) {
					logger.error('joinChannel - Failed Proposal. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}
	/**
	 * Asks the peer for the current (latest) configuration block for this channel.
	 * @param {string | Peer} target - Optional. The peer to be used to make the
	 *        request.
	 * @returns {Promise} A Promise for a {@link ConfigEnvelope} object containing the configuration items.
	 */
	getChannelConfig(target) {
		let method = 'getChannelConfig';
		logger.debug('%s - start for channel %s', method, this._name);
		var targets = this._getTargetForQuery(target);
		var signer = this._clientContext._getSigningIdentity(true);
		var tx_id = new TransactionID(signer, true);
		var request = {
			targets: targets,
			chaincodeId: Constants.CSCC,
			txId: tx_id,
			signer: signer,
			fcn: 'GetConfigBlock',
			args: [this._name]
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					var responses = results[0];
					// var proposal = results[1];
					logger.debug('%s - results received', method);
					if (responses && Array.isArray(responses)) {
						let response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						else if (response.response && response.response.payload) {
							let block = _commonProto.Block.decode(response.response.payload);
							let envelope = _commonProto.Envelope.decode(block.data.data[0]);
							let payload = _commonProto.Payload.decode(envelope.payload);
							let config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);
							return Promise.resolve(config_envelope);
						}
						else {
							logger.error('%s - unknown response ::%s', method, response);
							return Promise.reject(new Error(response));
						}
					}
					return Promise.reject(new Error('Payload results are missing from the get channel config'));
				}
			).catch(
				function (err) {
					logger.error('%s - Failed getting channel config. Error: %s', method, err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Asks the orderer for the current (latest) configuration block for this channel.
	 * This is similar to [getGenesisBlock()]{@link Channel#getGenesisBlock}, except
	 * that instead of getting block number 0 it gets the latest block that contains
	 * the channel configuration, and only returns the decoded {@link ConfigEnvelope}.
	 *
	 * @returns {Promise} A Promise for a {@link ConfigEnvelope} object containing the configuration items.
	 */
	getChannelConfigFromOrderer() {
		let method = 'getChannelConfigFromOrderer';
		logger.debug('%s - start for channel %s', method, this._name);

		var self = this;
		var orderer = this._clientContext.getTargetOrderer(null, this._orderers, this._name);

		var signer = this._clientContext._getSigningIdentity();
		var txId = new TransactionID(signer);

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
			self._initial_epoch,
			null,
			clientUtils.buildCurrentTimestamp(),
			orderer.getClientCertHash()
		);

		var seekHeader = clientUtils.buildHeader(signer, seekInfoHeader, txId.getNonce());
		var seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		var seekPayloadBytes = seekPayload.toBuffer();

		let sig = signer.sign(seekPayloadBytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload: seekPayloadBytes
		};
		// This will return us a block
		return orderer.sendDeliver(envelope)
			.then(
				function (block) {
					logger.debug('%s - good results from seek block ', method); // :: %j',results);
					// verify that we have the genesis block
					if (block) {
						logger.debug('%s - found latest block', method);
					}
					else {
						logger.error('%s - did not find latest block', method);
						return Promise.reject(new Error('Failed to retrieve latest block', method));
					}

					logger.debug('%s - latest block is block number %s', block.header.number);
					// get the last config block number
					var metadata = _commonProto.Metadata.decode(block.metadata.metadata[_commonProto.BlockMetadataIndex.LAST_CONFIG]);
					var last_config = _commonProto.LastConfig.decode(metadata.value);
					logger.debug('%s - latest block has config block of %s', method, last_config.index);

					var txId = new TransactionID(signer);

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
					//logger.debug('initializeChannel - seekInfo ::' + JSON.stringify(seekInfo));

					// build the header for use with the seekInfo payload
					var seekInfoHeader = clientUtils.buildChannelHeader(
						_commonProto.HeaderType.DELIVER_SEEK_INFO,
						self._name,
						txId.getTransactionID(),
						self._initial_epoch,
						null,
						clientUtils.buildCurrentTimestamp(),
						orderer.getClientCertHash()
					);

					var seekHeader = clientUtils.buildHeader(signer, seekInfoHeader, txId.getNonce());
					var seekPayload = new _commonProto.Payload();
					seekPayload.setHeader(seekHeader);
					seekPayload.setData(seekInfo.toBuffer());
					var seekPayloadBytes = seekPayload.toBuffer();

					let sig = signer.sign(seekPayloadBytes);
					let signature = Buffer.from(sig);

					// building manually or will get protobuf errors on send
					var envelope = {
						signature: signature,
						payload: seekPayloadBytes
					};
					// this will return us a block
					return orderer.sendDeliver(envelope);
				}
			).then(
				function (block) {
					if (!block) {
						return Promise.reject(new Error('Config block was not found'));
					}
					// lets have a look at the block
					logger.debug('%s -  config block number ::%s  -- numberof tx :: %s', method, block.header.number, block.data.data.length);
					if (block.data.data.length != 1) {
						return Promise.reject(new Error('Config block must only contain one transaction'));
					}
					var envelope = _commonProto.Envelope.decode(block.data.data[0]);
					var payload = _commonProto.Payload.decode(envelope.payload);
					var channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
					if (channel_header.type != _commonProto.HeaderType.CONFIG) {
						return Promise.reject(new Error(util.format('Block must be of type "CONFIG" (%s), but got "%s" instead', _commonProto.HeaderType.CONFIG, channel_header.type)));
					}

					var config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);

					// send back the envelope
					return Promise.resolve(config_envelope);
				}
			).catch(
				function (err) {
					logger.error('%s - Failed Proposal. Error: %s', method, err.stack ? err.stack : err);
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
		if (channel_header.type != _commonProto.HeaderType.CONFIG_UPDATE) {
			return new Error('Data must be of type "CONFIG_UPDATE"');
		}

		var config_update_envelope = _configtxProto.ConfigUpdateEnvelope.decode(payload.data);
		return this.loadConfigUpdate(config_update_envelope.config_update);
	}

	loadConfigUpdate(config_update_bytes) {
		var config_update = _configtxProto.ConfigUpdate.decode(config_update_bytes);
		logger.debug('loadConfigData - channel ::' + config_update.channel_id);

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
		this._anchor_peers = config_items.anchor_peers;

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
	 * @typedef {Object} BlockchainInfo
	 * @property {number} height - How many blocks exist on the channel's ledger
	 * @property {byte[]} currentBlockHash - A block hash is calculated by hashing over the concatenated
	 *                                       ASN.1 encoded bytes of: the block number, previous block hash,
	 *                                       and current block data hash. It's the chain of the block
	 *                                       hashs that guarantees the immutability of the ledger
	 * @property {byte[]} previousBlockHash - The block hash of the previous block.
	 */

	/**
	 * Queries for various useful information on the state of the Channel
	 * (height, known peers).
	 *
	 * @param {Peer} target - Optional. The peer that is the target for this query.  If no target is passed,
	 *                        the query will use the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @returns {Promise} A Promise for a {@link BlockchainInfo} object with blockchain height,
	 *                        current block hash and previous block hash.
	 */
	queryInfo(target, useAdmin) {
		logger.debug('queryInfo - start');
		var targets = this._getTargetForQuery(target);
		var signer = this._clientContext._getSigningIdentity(useAdmin);
		var tx_id = new TransactionID(signer, useAdmin);
		var request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: tx_id,
			signer: signer,
			fcn: 'GetChainInfo',
			args: [this._name]
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					var responses = results[0];
					if (responses && Array.isArray(responses)) {
						logger.debug('queryInfo - got responses=' + responses.length);
						//will only be one response as we are only querying the primary peer
						if (responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						let response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						if (response.response) {
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
				function (err) {
					logger.error('Failed Query channel info. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Queries the ledger on the target peer for a Block TransactionID.
	 *
	 * @param {string} tx_id - The TransactionID of the Block in question.
	 * @param {Peer} target - Optional. The peer to send the query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @returns {Promise} A Promise for a {@link Block} matching the tx_id, fully decoded into an object.
	 */
	queryBlockByTxID(tx_id, target, useAdmin) {
		logger.debug('queryBlockByTxID - start');
		if (!tx_id || !(typeof tx_id === 'string')) {
			throw new Error('tx_id as string is required');
		}

		const args = [this._name,tx_id];
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);

		const request = {
			targets,
			chaincodeId: Constants.QSCC,
			txId: new TransactionID(signer,useAdmin),
			fcn: 'GetBlockByTxID',
			args
		};
		return this.sendTransactionProposal(request)
			.then((results)=> {
				const responses = results[0];
				if (responses && Array.isArray(responses)) {
					logger.debug('queryBlockByTxID - got response',responses.length);
					//will only be one response as we are only querying the primary peer
					if (responses.length > 1) {
						return Promise.reject(new Error('Too many results returned'));
					}
					const response = responses[0];
					if (response instanceof Error) {
						return Promise.reject(response);
					}
					if (response.response) {
						logger.debug('queryBlockByTxID - response status %d:', response.response.status);
						const block = BlockDecoder.decode(response.response.payload);
						logger.debug('queryBlockByTxID - looking at block :: %s', block.header.number);
						return Promise.resolve(block);
					}
					// no idea what we have, lets fail it and send it back
					return Promise.reject(response);
				}
				return Promise.reject(new Error('Payload results are missing from the query'));
			}).catch((err)=> {
				logger.error('Failed Query block. Error: %s', err.stack ? err.stack : err);
				return Promise.reject(err);
			});
	}

	/**
	 * Queries the ledger on the target peer for a Block by block hash.
	 *
	 * @param {byte[]} block hash of the Block in question.
	 * @param {Peer} target - Optional. The peer to send the query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @returns {Promise} A Promise for a {@link Block} matching the hash, fully decoded into an object.
	 */
	queryBlockByHash(blockHash, target, useAdmin) {
		logger.debug('queryBlockByHash - start');
		if (!blockHash) {
			throw new Error('Blockhash bytes are required');
		}
		var targets = this._getTargetForQuery(target);
		var signer = this._clientContext._getSigningIdentity(useAdmin);
		var txId = new TransactionID(signer, useAdmin);
		var request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetBlockByHash',
			args: [this._name],
			argbytes: blockHash
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					var responses = results[0];
					logger.debug('queryBlockByHash - got response');
					if (responses && Array.isArray(responses)) {
						//will only be one response as we are only querying the primary peer
						if (responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						let response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						if (response.response) {
							logger.debug('queryBlockByHash - response status %d:', response.response.status);
							var block = BlockDecoder.decode(response.response.payload);
							logger.debug('queryBlockByHash - looking at block :: %s', block.header.number);
							return Promise.resolve(block);
						}
						// no idea what we have, lets fail it and send it back
						return Promise.reject(response);
					}
					return Promise.reject(new Error('Payload results are missing from the query'));
				}
			).catch(
				function (err) {
					logger.error('Failed Query block. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Queries the ledger on the target peer for Block by block number.
	 *
	 * @param {number} blockNumber - The number of the Block in question.
	 * @param {Peer} target - Optional. The peer to send this query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @returns {Promise} A Promise for a {@link Block} at the blockNumber slot in the ledger, fully decoded into an object.
	 */
	queryBlock(blockNumber, target, useAdmin) {
		logger.debug('queryBlock - start blockNumber %s', blockNumber);
		var block_number = null;
		if (Number.isInteger(blockNumber) && blockNumber >= 0) {
			block_number = blockNumber.toString();
		} else {
			throw new Error('Block number must be a positive integer');
		}
		var targets = this._getTargetForQuery(target);
		var signer = this._clientContext._getSigningIdentity(useAdmin);
		var txId = new TransactionID(signer, useAdmin);
		var request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetBlockByNumber',
			args: [this._name, block_number]
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					var responses = results[0];
					logger.debug('queryBlock - got response');
					if (responses && Array.isArray(responses)) {
						//will only be one response as we are only querying the primary peer
						if (responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						let response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						if (response.response) {
							logger.debug('queryBlock - response status %d:', response.response.status);
							var block = BlockDecoder.decode(response.response.payload);
							logger.debug('queryBlock - looking at block :: %s', block.header.number);
							return Promise.resolve(block);
						}
						// no idea what we have, lets fail it and send it back
						return Promise.reject(response);
					}
					return Promise.reject(new Error('Payload results are missing from the query'));
				}
			).catch(
				function (err) {
					logger.error('Failed Query block. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Queries the ledger on the target peer for Transaction by id.
	 *
	 * @param {string} tx_id - The id of the transaction
	 * @param {Peer} target - Optional. The peer to send this query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @returns {Promise} A Promise for a fully decoded {@link ProcessedTransaction} object.
	 */
	queryTransaction(tx_id, target, useAdmin) {
		logger.debug('queryTransaction - start transactionID %s', tx_id);
		if (tx_id) {
			tx_id = tx_id.toString();
		} else {
			throw new Error('Missing "tx_id" parameter');
		}
		var targets = this._getTargetForQuery(target);
		var signer = this._clientContext._getSigningIdentity(useAdmin);
		var txId = new TransactionID(signer, useAdmin);
		var request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetTransactionByID',
			args: [this._name, tx_id]
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					var responses = results[0];
					logger.debug('queryTransaction - got response');
					if (responses && Array.isArray(responses)) {
						//will only be one response as we are only querying the primary peer
						if (responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						let response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						if (response.response) {
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
				function (err) {
					logger.error('Failed Transaction Query. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Queries the ledger on the target peer for instantiated chaincodes on this channel.
	 *
	 * @param {Peer} target - Optional. The peer to send this query to. If no
	 *        target is passed, the query is sent to the first peer that was
	 *        added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials
	 *        should be used in making this call to the peer. An administrative
	 *        identity must have been loaded by network configuration or by
	 *        using the 'setAdminSigningIdentity' method.
	 * @returns {Promise} A Promise for a fully decoded {@link ChaincodeQueryResponse} object.
	 */
	queryInstantiatedChaincodes(target, useAdmin) {
		logger.debug('queryInstantiatedChaincodes - start');
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.LSCC,
			txId: txId,
			signer: signer,
			fcn: 'getchaincodes',
			args: []
		};
		return this.sendTransactionProposal(request)
			.then(
				function (results) {
					const responses = results[0];
					logger.debug('queryInstantiatedChaincodes - got response');
					if (responses && Array.isArray(responses)) {
						//will only be one response as we are only querying one peer
						if (responses.length > 1) {
							return Promise.reject(new Error('Too many results returned'));
						}
						const response = responses[0];
						if (response instanceof Error) {
							return Promise.reject(response);
						}
						if (response.response) {
							logger.debug('queryInstantiatedChaincodes - response status :: %d', response.response.status);
							const queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
							logger.debug('queryInstantiatedChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
							for (let chaincode of queryTrans.chaincodes) {
								logger.debug('queryInstantiatedChaincodes - name %s, version %s, path %s', chaincode.name, chaincode.version, chaincode.path);
							}
							return Promise.resolve(queryTrans);
						}
						// no idea what we have, lets fail it and send it back
						return Promise.reject(response);
					}
					return Promise.reject(new Error('Payload results are missing from the query'));
				}
			).catch(
				function (err) {
					logger.error('Failed Instantiated Chaincodes Query. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * @typedef {Object} ChaincodeInstantiateUpgradeRequest
	 * @property {Peer[]} targets - Optional. An array of endorsing
	 *           {@link Peer} objects as the targets of the request. When this
	 *           parameter is omitted the target list will include peers assigned
	 *           to this channel instance that are in the endorsing role.
	 * @property {string} chaincodeType - Optional. Type of chaincode. One of
	 *           'golang', 'car', 'java' or 'node'. Default is 'golang'. Note that 'java'
	 *           is not supported as of v1.0.
	 * @property {string} chaincodeId - Required. The name of the chaincode
	 * @property {string} chaincodeVersion - Required. Version string of the chaincode,
	 *           such as 'v1'
	 * @property {TransactionID} txId - Required. Object with the transaction id
	 *           and nonce
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be
	 *           used by the chaincode during intialization, but not saved in the
	 *           ledger. Data such as cryptographic information for encryption can
	 *           be passed to the chaincode using this technique.
	 * @property {string} fcn - Optional. The function name to be returned when
	 *           calling <code>stub.GetFunctionAndParameters()</code> in the target
	 *           chaincode. Default is 'init'.
	 * @property {string[]} args - Optional. Array of string arguments to pass to
	 *           the function identified by the <code>fcn</code> value.
	 * @property {Object} endorsement-policy - Optional. EndorsementPolicy object
	 *           for this chaincode (see examples below). If not specified, a default
	 *           policy of "a signature by any member from any of the organizations
	 *           corresponding to the array of member service providers" is used.
	 *           <b>WARNING:</b> The default policy is NOT recommended for production,
	 *           because this allows an application to bypass the proposal endorsement
	 *           and send a manually constructed transaction, with arbitrary output
	 *           in the write set, to the orderer directly. An application's own
	 *           signature would allow the transaction to be successfully validated
	 *           and committed to the ledger.
	 * @example <caption>Endorsement policy: "Signed by any member from one of the organizations"</caption>
	 * {
	 *   identities: [
	 *     { role: { name: "member", mspId: "org1" }},
	 *     { role: { name: "member", mspId: "org2" }}
	 *   ],
	 *   policy: {
	 *     "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
	 *   }
	 * }
	 * @example <caption>Endorsement policy: "Signed by admin of the ordererOrg and any member from one of the peer organizations"</caption>
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
	 */

	/**
	 * Sends a chaincode instantiate proposal to one or more endorsing peers.
	 *
	 * A chaincode must be instantiated on a channel-by-channel basis before it can
	 * be used. The chaincode must first be installed on the endorsing peers where
	 * this chaincode is expected to run, by calling [client.installChaincode()]{@link Client#installChaincode}.
	 * <br><br>
	 * Instantiating a chaincode is a full transaction operation, meaning it must be
	 * first endorsed as a proposal, then the endorsements are sent to the orderer
	 * to be processed for ordering and validation. When the transaction finally gets
	 * committed to the channel's ledger on the peers, the chaincode is then considered
	 * activated and the peers are ready to take requests to process transactions.
	 *
	 * @param {ChaincodeInstantiateUpgradeRequest} request
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the Peer instance and the global timeout in the config settings.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}
	 */
	sendInstantiateProposal(request, timeout) {
		return this._sendChaincodeProposal(request, 'deploy', timeout);
	}

	/**
	 * Sends a chaincode upgrade proposal to one or more endorsing peers.
	 *
	 * Upgrading a chaincode involves steps similar to instantiating a chaincode.
	 * The new chaincode must first be installed on the endorsing peers where
	 * this chaincode is expected to run.
	 * <br><br>
	 * Similar to instantiating a chaincode, upgrading chaincodes is also a full transaction
	 * operation.
	 *
	 * @param {ChaincodeInstantiateUpgradeRequest} request
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the Peer instance and the global timeout in the config settings.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}
	 */
	sendUpgradeProposal(request, timeout) {
		return this._sendChaincodeProposal(request, 'upgrade', timeout);
	}

	/*
	 * Internal method to handle both chaincode calls
	 */
	_sendChaincodeProposal(request, command, timeout) {
		let errorMsg = null;

		//validate the incoming request
		if (!errorMsg) errorMsg = clientUtils.checkProposalRequest(request);
		if (!errorMsg) errorMsg = clientUtils.checkInstallRequest(request);
		if (errorMsg) {
			logger.error('sendChainCodeProposal error ' + errorMsg);
			return Promise.reject(new Error(errorMsg));
		}
		const peers = this._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}

		// step 1: construct a ChaincodeSpec
		const args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

		for (let arg of request.args)
			args.push(Buffer.from(arg, 'utf8'));

		const ccSpec = {
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
		const chaincodeDeploymentSpec = new _ccProto.ChaincodeDeploymentSpec();
		chaincodeDeploymentSpec.setChaincodeSpec(ccSpec);

		const signer = this._clientContext._getSigningIdentity(request.txId.isAdmin());
		const lcccSpec_args = [
			Buffer.from(command),
			Buffer.from(this._name),
			chaincodeDeploymentSpec.toBuffer()
		];
		if (request['endorsement-policy']) {
			lcccSpec_args[3] = this._buildEndorsementPolicy(request['endorsement-policy']);
		}

		const lcccSpec = {
			// type: _ccProto.ChaincodeSpec.Type.GOLANG,
			type: clientUtils.translateCCType(request.chaincodeType),
			chaincode_id: { name: Constants.LSCC },
			input: { args: lcccSpec_args }
		};

		const channelHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			this._name,
			request.txId.getTransactionID(),
			null,
			Constants.LSCC,
			clientUtils.buildCurrentTimestamp(),
			peers[0].getClientCertHash()
		);
		const header = clientUtils.buildHeader(signer, channelHeader, request.txId.getNonce());
		const proposal = clientUtils.buildProposal(lcccSpec, header, request.transientMap);
		const signed_proposal = clientUtils.signProposal(signer, proposal);

		return clientUtils.sendPeersProposal(peers, signed_proposal, timeout)
			.then(
				function (responses) {
					return [responses, proposal];
				}
			);
	}

	/**
	 * @typedef {Object} ChaincodeInvokeRequest
	 * @property {Peer[]} targets - Optional. The peers that will receive this request,
	 *				                when not provided the list of peers added to this channel object will be used.
	 * @property {string} chaincodeId - Required. The id of the chaincode to process the transaction proposal
	 * @property {TransactionID} txId - Required. TransactionID object with the transaction id and nonce
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be used by the chaincode but not
	 *			                      saved in the ledger, such as cryptographic information for encryption
	 * @property {string} fcn - Optional. The function name to be returned when calling <code>stub.GetFunctionAndParameters()</code>
	 *                          in the target chaincode. Default is 'invoke'
	 * @property {string[]} args - An array of string arguments specific to the chaincode's 'Invoke' method
	 */

	/**
	 * Sends a transaction proposal to one or more endorsing peers.
	 *
	 * After a chaincode gets [installed]{@link Client#installChaincode} and
	 * [instantiated]{@link Channel#instantiateChaincode}, it's ready to take endorsement
	 * proposals and participating in transaction processing. A chaincode transaction
	 * starts with a proposal that gets sent to the endorsing peers, which executes
	 * the target chaincode and decides whether the proposal should be endorsed (if it
	 * executes successfully) or not (if the chaincode returns an error).
	 *
	 * @param {ChaincodeInvokeRequest} request
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the Peer instance and the global timeout in the config settings.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}
	 */
	sendTransactionProposal(request, timeout) {
		logger.debug('sendTransactionProposal - start');

		if (!request) {
			throw new Error('Missing request object for this transaction proposal');
		}
		request.targets = this._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

		return Channel.sendTransactionProposal(request, this._name, this._clientContext, timeout);
	}

	/*
	 * Internal static method to allow transaction proposals to be called without
	 * creating a new channel
	 */
	static sendTransactionProposal(request, channelId, clientContext, timeout) {
		// Verify that a Peer has been added
		var errorMsg = clientUtils.checkProposalRequest(request);

		if (errorMsg) {
			// do nothing so we skip the rest of the checks
		} else if (!request.args) {
			// args is not optional because we need for transaction to execute
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else if (!request.targets || request.targets.length < 1) {
			errorMsg = 'Missing peer objects in Transaction proposal';
		}

		if (errorMsg) {
			logger.error('sendTransactionProposal error ' + errorMsg);
			throw new Error(errorMsg);
		}

		var args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('sendTransactionProposal - adding function arg:%s', request.fcn ? request.fcn : 'invoke');

		for (let i = 0; i < request.args.length; i++) {
			logger.debug('sendTransactionProposal - adding arg:%s', request.args[i]);
			args.push(Buffer.from(request.args[i], 'utf8'));
		}
		//special case to support the bytes argument of the query by hash
		if (request.argbytes) {
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
		var signer = null;
		if (request.signer) {
			signer = request.signer;
		} else {
			signer = clientContext._getSigningIdentity(request.txId.isAdmin());
		}
		var channelHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			channelId,
			request.txId.getTransactionID(),
			null,
			request.chaincodeId,
			clientUtils.buildCurrentTimestamp(),
			request.targets[0].getClientCertHash()
		);
		header = clientUtils.buildHeader(signer, channelHeader, request.txId.getNonce());
		proposal = clientUtils.buildProposal(invokeSpec, header, request.transientMap);
		let signed_proposal = clientUtils.signProposal(signer, proposal);

		return clientUtils.sendPeersProposal(request.targets, signed_proposal, timeout)
			.then(
				function (responses) {
					return Promise.resolve([responses, proposal]);
				}
			).catch(
				function (err) {
					logger.error('Failed Proposal. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * @typedef {Object} TransactionRequest
	 * @property {array} proposalResponses - An array of or a single
	 *           {@link ProposalResponse} object containing the response from the
	 *           [endorsement]{@link Channel#sendTransactionProposal} call
	 * @property {Object} proposal - A Proposal object containing the original
	 *           request for endorsement(s)
	 * @property {Object} txID - Optional. - Must be the transaction ID object
	 *           used in the proposal endorsement. The transactionID will
	 *           only be used to determine if the signing of the request
	 *           should be done by the admin identity or the user assigned
	 *           to the client instance.
	 */

	/**
	 * Send the proposal responses that contain the endorsements of a transaction proposal
	 * to the orderer for further processing. This is the 2nd phase of the transaction
	 * lifecycle in the fabric. The orderer will globally order the transactions in the
	 * context of this channel and deliver the resulting blocks to the committing peers for
	 * validation against the chaincode's endorsement policy. When the committering peers
	 * successfully validate the transactions, it will mark the transaction as valid inside
	 * the block. After all transactions in a block have been validated, and marked either as
	 * valid or invalid (with a [reason code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/transaction.proto#L125}),
	 * the block will be appended (committed) to the channel's ledger on the peer.
	 * <br><br>
	 * The caller of this method must use the proposal responses returned from the endorser along
	 * with the original proposal that was sent to the endorser. Both of these objects are contained
	 * in the {@link ProposalResponseObject} returned by calls to any of the following methods:
	 * <li>[installChaincode()]{@link Client#installChaincode}
	 * <li>[sendInstantiateProposal()]{@link Channel#sendInstantiateProposal}
	 * <li>[sendUpgradeProposal()]{@link Channel#sendUpgradeProposal}
	 * <li>[sendTransactionProposal()]{@link Channel#sendTransactionProposal}
	 *
	 * @param {TransactionRequest} request
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by the orderer that contains a
	 *                    single "status" field for a standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *                    This will be an acknowledgement from the orderer of successfully submitted transaction.
	 */
	sendTransaction(request) {
		logger.debug('sendTransaction - start :: channel %s', this);
		var errorMsg = null;

		if (request) {
			// Verify that data is being passed in
			if (!request.proposalResponses) {
				errorMsg = 'Missing "proposalResponses" parameter in transaction request';
			}
			if (!request.proposal) {
				errorMsg = 'Missing "proposal" parameter in transaction request';
			}
		} else {
			errorMsg = 'Missing input request object on the transaction request';
		}

		if (errorMsg) {
			logger.error('sendTransaction error ' + errorMsg);
			throw new Error(errorMsg);
		}

		let proposalResponses = request.proposalResponses;
		let chaincodeProposal = request.proposal;

		var endorsements = [];
		let proposalResponse = proposalResponses;
		if (Array.isArray(proposalResponses)) {
			for (let i = 0; i < proposalResponses.length; i++) {
				// make sure only take the valid responses to set on the consolidated response object
				// to use in the transaction object
				if (proposalResponses[i].response && proposalResponses[i].response.status === 200) {
					proposalResponse = proposalResponses[i];
					endorsements.push(proposalResponse.endorsement);
				}
			}
		} else {
			if (proposalResponse && proposalResponse.response && proposalResponse.response.status === 200) {
				endorsements.push(proposalResponse.endorsement);
			}
		}

		if (endorsements.length < 1) {
			logger.error('sendTransaction - no valid endorsements found');
			throw new Error('no valid endorsements found');
		}

		// verify that we have an orderer configured
		var orderer = this._clientContext.getTargetOrderer(request.orderer, this._orderers, this._name);

		var use_admin_signer = false;
		if (request.txId) {
			use_admin_signer = request.txId.isAdmin();
		}

		let header = _commonProto.Header.decode(chaincodeProposal.getHeader());

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

		var signer = this._clientContext._getSigningIdentity(use_admin_signer);
		let sig = signer.sign(payload_bytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		var envelope = {
			signature: signature,
			payload: payload_bytes
		};

		return orderer.sendBroadcast(envelope);
	}

	/**
	 * @typedef {Object} ChaincodeQueryRequest
	 * @property {Peer[]} targets - Optional. The peers that will receive this request,
	 *				                when not provided the list of peers added to this channel object will be used.
	 * @property {string} chaincodeId - Required. The id of the chaincode to process the transaction proposal
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be used by the chaincode but not
	 *			                      saved in the ledger, such as cryptographic information for encryption
	 * @property {string} fcn - Optional. The function name to be returned when calling <code>stub.GetFunctionAndParameters()</code>
	 *                          in the target chaincode. Default is 'invoke'
	 * @property {string[]} args - An array of string arguments specific to the chaincode's 'Invoke' method
	 */

	/**
	 * Sends a proposal to one or more endorsing peers that will be handled by the chaincode.
	 * In fabric v1.0, there is no difference in how the endorsing peers process a request
	 * to invoke a chaincode for transaction vs. to invoke a chaincode for query. All requests
	 * will be presented to the target chaincode's 'Invoke' method which must be implemented to
	 * understand from the arguments that this is a query request. The chaincode must also return
	 * results in the byte array format and the caller will have to be able to decode
	 * these results.
	 *
	 * @param {ChaincodeQueryRequest} request
	 * @returns {Promise} A Promise for an array of byte array results returned from the chaincode
	 *                    on all Endorsing Peers
	 * @example
	 * <caption>Get the list of query results returned by the chaincode</caption>
	 * channel.queryByChaincode(request)
	 * .then((response_payloads) => {
	 *		for(let i = 0; i < response_payloads.length; i++) {
	 *			console.log(util.format('Query result from peer [%s]: %s', i, response_payloads[i].toString('utf8')));
	 *		}
	 *	});
	 */
	queryByChaincode(request, useAdmin) {
		logger.debug('queryByChaincode - start');
		if (!request) {
			throw new Error('Missing request object for this queryByChaincode call.');
		}

		var targets = this._getTargets(request.targets, Constants.NetworkConfig.CHAINCODE_QUERY_ROLE);
		var signer = this._clientContext._getSigningIdentity(useAdmin);
		var txId = new TransactionID(signer, useAdmin);

		// make a new request object so we can add in the txId and not change the user's
		var trans_request = {
			targets: targets,
			chaincodeId: request.chaincodeId,
			fcn: request.fcn,
			args: request.args,
			transientMap: request.transientMap,
			txId: txId,
			signer: signer
		};

		return this.sendTransactionProposal(trans_request)
			.then(
				function (results) {
					var responses = results[0];
					// var proposal = results[1];
					logger.debug('queryByChaincode - results received');
					if (responses && Array.isArray(responses)) {
						let results = [];
						for (let i = 0; i < responses.length; i++) {
							let response = responses[i];
							if (response instanceof Error) {
								results.push(response);
							}
							else if (response.response && response.response.payload) {
								results.push(response.response.payload);
							}
							else {
								logger.error('queryByChaincode - unknown or missing results in query ::' + results);
								results.push(new Error(response));
							}
						}
						return Promise.resolve(results);
					}
					return Promise.reject(new Error('Payload results are missing from the chaincode query'));
				}
			).catch(
				function (err) {
					logger.error('Failed Query by chaincode. Error: %s', err.stack ? err.stack : err);
					return Promise.reject(err);
				}
			);
	}

	/**
	 * Utility method to verify a single proposal response. It checks the
	 * following aspects:
	 * <li>The endorser's identity belongs to a legitimate MSP of the channel
	 *     and can be successfully deserialized
	 * <li>The endorsement signature can be successfully verified with the
	 *     endorser's identity certificate
	 * <br><br>
	 * This method requires that the initialize method of this channel object
	 * has been called to load this channel's MSPs. The MSPs will have the
	 * trusted root certificates for this channel.
	 *
	 * @param {ProposalResponse} proposal_response - The endorsement response from the peer,
	 *                             includes the endorser certificate and signature over the
	 *                             proposal + endorsement result + endorser certificate.
	 * @returns {boolean} A boolean value of true when both the identity and
	 *                    the signature are valid, false otherwise.
	 */
	verifyProposalResponse(proposal_response) {
		logger.debug('verifyProposalResponse - start');
		if (!proposal_response) {
			throw new Error('Missing proposal response');
		}
		if (!proposal_response.endorsement) {
			throw new Error('Parameter must be a ProposalResponse Object');
		}

		let endorsement = proposal_response.endorsement;

		var sid = _identityProto.SerializedIdentity.decode(endorsement.endorser);
		var mspid = sid.getMspid();
		logger.debug('getMSPbyIdentity - found mspid %s', mspid);
		var msp = this._msp_manager.getMSP(mspid);

		if (!msp) {
			throw new Error(util.format('Failed to locate an MSP instance matching the endorser identity\'s orgainization %s', mspid));
		}
		logger.debug('verifyProposalResponse - found endorser\'s MSP');

		try {
			var identity = msp.deserializeIdentity(endorsement.endorser, false);
			if (!identity) {
				throw new Error('Unable to find the endorser identity');
			}
		}
		catch (error) {
			logger.error('verifyProposalResponse - getting endorser identity failed with: ', error);
			return false;
		}

		try {
			// see if the identity is trusted
			if (!identity.isValid()) {
				logger.error('Endorser identity is not valid');
				return false;
			}
			logger.debug('verifyProposalResponse - have a valid identity');

			// check the signature against the endorser and payload hash
			var digest = Buffer.concat([proposal_response.payload, endorsement.endorser]);
			if (!identity.verify(digest, endorsement.signature)) {
				logger.error('Proposal signature is not valid');
				return false;
			}
		}
		catch (error) {
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
	 *
	 * @param {ProposalResponse[]} The proposal responses from all endorsing peers
	 * @returns {boolean} True when all proposals compare equally, false otherwise.
	  */
	compareProposalResponseResults(proposal_responses) {
		logger.debug('compareProposalResponseResults - start');
		if (!proposal_responses) {
			throw new Error('Missing proposal responses');
		}
		if (!Array.isArray(proposal_responses)) {
			throw new Error('Parameter must be an array of ProposalRespone Objects');
		}

		if (proposal_responses.length == 0) {
			throw new Error('Parameter proposal responses does not contain a PorposalResponse');
		}
		var first_one = _getProposalResponseResults(proposal_responses[0]);
		for (var i = 1; i < proposal_responses.length; i++) {
			var next_one = _getProposalResponseResults(proposal_responses[i]);
			if (next_one.equals(first_one)) {
				logger.debug('compareProposalResponseResults - read/writes result sets match index=%s', i);
			}
			else {
				logger.error('compareProposalResponseResults - read/writes result sets do not match index=%s', i);
				return false;
			}
		}

		return true;
	}

	/*
	 *  utility method to decide on the peer for events
	 */
	_getPeerForEvents(peer) {
		if (!peer) {
			throw new Error('"peer" parameter is missing');
		}
		var peers = this._getTargets(peer, Constants.NetworkConfig.EVENT_SOURCE_ROLE, true);
		// only want to return one peer
		if (peers && peers.length > 0) {
			return peers[0];
		}

		throw new Error('No Peers available to be an event source');
	}

	/*
	 *  utility method to decide on the target for queries that only need ledger access
	 */
	_getTargetForQuery(target) {
		if (Array.isArray(target)) {
			throw new Error('"target" parameter is an array, but should be a singular peer object' +
				' ' + 'or peer name according to the network configuration loaded by the client instance');
		}
		let targets = this._getTargets(target, Constants.NetworkConfig.LEDGER_QUERY_ROLE, true);
		// only want to query one peer
		if (targets.length > 1) {
			targets = [targets[0]];
		}

		return targets;
	}

	/*
	 * utility method to decide on the targets for requests
	 */
	_getTargets(request_targets, role, isTarget) {
		let targets = null;
		if (request_targets) {
			// first check to see if they have passed a peer or peer name
			targets = this._clientContext.getTargetPeers(request_targets);
		}

		// nothing yet, maybe there are peers on the channel
		if (!targets || targets.length < 1) {
			const peers = this.getPeers();
			targets = [];
			for (let peer of peers) {
				if (peer.isInRole(role)) {
					targets.push(peer);
				}
			}
		}

		// so nothing passed in or set on channel, let's
		// see if we can find in the network configuration
		if (!targets || targets.length < 1) {
			targets = this._getTargetsFromConfig(role);
		}

		if (!targets || targets.length < 1) {
			let target_msg = 'targets';
			if (isTarget) target_msg = 'target';
			if (role === Constants.NetworkConfig.EVENT_SOURCE_ROLE) target_msg = 'peer';
			throw new Error(util.format('"%s" parameter not specified and no peers'
				+ ' ' + 'are set on this Channel instance'
				+ ' ' + 'or specfied for this channel in the network ', target_msg));
		}

		return targets;
	}

	/*
	 * Utility method to return a list of targets from the network configuration
	 * that are in this role of operation
	 */
	_getTargetsFromConfig(role) {
		var method = '_getTargetsFromConfig';
		logger.debug('%s - start  ::role %s', method, role);
		var targets = [];
		if (role) {
			var found = false;
			for (let i in Constants.NetworkConfig.ROLES) {
				if (role === Constants.NetworkConfig.ROLES[i]) {
					found = true;
					break;
				}
			}
			if (!found) {
				throw Error('Target role is unknown');
			}
		}

		/*
		 * Need to list all the organizations from the network configuration.
		 * Check each peer in each organization to see if it is on the channel.
		 * If peer is on the channel and in the role, add this peer to a new list
		 * of peers for this organization. Keep all these new lists in a list keyed
		 * by the organization name. Once we have all the peers on the channel
		 * sorted by organization, then we can randomly take one of those peers
		 * for each organization and add it to the final target list.
		 */
		if (this._clientContext._network_config) {
			var orgs = this._clientContext._network_config.getOrganizations();
			if (orgs) {
				//first get all the peers on the channel divided up by orgs
				var peers_by_org = {};
				for (let i in orgs) {
					let org = orgs[i];
					var peers_in_org_and_in_channel = [];
					peers_by_org[org.getName()] = peers_in_org_and_in_channel;
					var org_peers = org.getPeers();
					logger.debug('%s - org:%s has %s peers', method, org.getName(), org_peers.length);
					for (let j in org_peers) {
						let org_peer = org_peers[j];
						var channel_peers = this.getPeers();
						for (let k in channel_peers) {
							let channel_peer = channel_peers[k];
							if (!channel_peer) {
								logger.debug('%s - no peers on this channel', method);
								break;
							}
							if (!org_peer) {
								logger.debug('%s - null peer on this org', method);
								break;
							}
							logger.debug('%s - comparing channel peer:%s to org peer:%s', method, channel_peer.getName(), org_peer.getName());
							if (channel_peer.getName() === org_peer.getName()) {
								// only peers in the request role get added
								if (channel_peer.isInRole(role)) {
									peers_in_org_and_in_channel.push(channel_peer);
									logger.debug('%s - added peer %s', method, channel_peer.toString());
								}
								break;
							}
						}
					}
				}
				// now add just one peer from each org to targets if in role
				for (let org_name in peers_by_org) {
					let peers_org = peers_by_org[org_name];
					if (peers_org && peers_org.length > 0) {
						logger.debug('%s - orgs %s has %s peers', method, org_name, peers_org.length);
						let which_peer = Math.floor(Math.random() * peers_org.length);
						logger.debug('%s - peer index:%s', method, which_peer);
						let peer_org = peers_org[which_peer];
						targets.push(peer_org);
						logger.debug('%s - added target peer %s', method, peer_org.toString());
					} else {
						logger.debug('%s - no peers in this org %s', method, org_name);
					}
				}
			}

			if (targets.length == 0) {
				logger.warn('No peers found in the loaded network configuration that can be used as the target of this operation');
			}
			return targets;
		}
	}

	// internal utility method to build chaincode policy
	_buildEndorsementPolicy(policy) {
		return Policy.buildPolicy(this.getMSPManager().getMSPs(), policy);
	}

	/**
	 * return a printable representation of this channel object
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
	if (!proposal_response.payload) {
		throw new Error('Parameter must be a ProposalResponse Object');
	}
	var payload = _responseProto.ProposalResponsePayload.decode(proposal_response.payload);
	var extension = _proposalProto.ChaincodeAction.decode(payload.extension);
	// TODO should we check the status of this action
	logger.debug('_getWriteSet - chaincode action status:%s message:%s', extension.response.status, extension.response.message);
	// return a buffer object which has an equals method
	return extension.results.toBuffer();
}

//internal utility method to combine MSPs
function _combineMSPs(current, configuration) {
	var results = new Map();
	_arrayToMap(results, current);
	// do these second to replace any of the same name
	_arrayToMap(results, configuration);

	return results;
}

//internal utility method to add msps to a map
function _arrayToMap(map, msps) {
	if (msps) {
		var keys = Object.keys(msps);
		for (let key in keys) {
			let id = keys[key];
			let msp = msps[id];
			let mspid = msp.getId();
			logger.debug('_arrayToMap - add msp ::%s', mspid);
			map.set(mspid, msp);
		}
	}
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
	if (!group) {
		logger.debug('loadConfigGroup - %s - no group', name);
		logger.debug('loadConfigGroup - %s - < group', name);
		return;
	}

	var isOrderer = (name.indexOf('base.Orderer') > -1);
	logger.debug('loadConfigGroup - %s   - version %s', name, group.version);
	logger.debug('loadConfigGroup - %s   - mod policy %s', name, group.mod_policy);

	var groups = null;
	if (top) {
		groups = group.groups;
		versions.version = group.version;
	}
	else {
		groups = group.value.groups;
		versions.version = group.value.version;
	}
	logger.debug('loadConfigGroup - %s - >> groups', name);

	if (groups) {
		let keys = Object.keys(groups.map);
		versions.groups = {};
		if (keys.length == 0) {
			logger.debug('loadConfigGroup - %s   - no groups', name);
		}
		for (let i = 0; i < keys.length; i++) {
			let key = keys[i];
			logger.debug('loadConfigGroup - %s   - found config group ==> %s', name, key);
			versions.groups[key] = {};
			// The Application group is where config settings are that we want to find
			loadConfigGroup(config_items, versions.groups[key], groups.map[key], name + '.' + key, key, false);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no groups', name);
	}
	logger.debug('loadConfigGroup - %s - << groups', name);

	logger.debug('loadConfigGroup - %s - >> values', name);
	var values = null;
	if (top) {
		values = group.values;
	}
	else {
		values = group.value.values;
	}
	if (values) {
		versions.values = {};
		let keys = Object.keys(values.map);
		for (let i = 0; i < keys.length; i++) {
			let key = keys[i];
			versions.values[key] = {};
			var config_value = values.map[key];
			loadConfigValue(config_items, versions.values[key], config_value, name, org, isOrderer);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no values', name);
	}
	logger.debug('loadConfigGroup - %s - << values', name);

	logger.debug('loadConfigGroup - %s - >> policies', name);
	var policies = null;
	if (top) {
		policies = group.policies;
	}
	else {
		policies = group.value.policies;
	}
	if (policies) {
		versions.policies = {};
		let keys = Object.keys(policies.map);
		for (let i = 0; i < keys.length; i++) {
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

	logger.debug('loadConfigGroup - %s - < group', name);
}

/*
 * utility method to load in a config value
 * @see /protos/common/configtx.proto
 * @see /protos/msp/mspconfig.proto
 * @see /protos/orderer/configuration.proto
 * @see /protos/peer/configuration.proto
 */
function loadConfigValue(config_items, versions, config_value, group_name, org, isOrderer) {
	logger.debug('loadConfigValue - %s -  value name: %s', group_name, config_value.key);
	logger.debug('loadConfigValue - %s    - version: %s', group_name, config_value.value.version);
	logger.debug('loadConfigValue - %s    - mod_policy: %s', group_name, config_value.value.mod_policy);

	versions.version = config_value.value.version;
	try {
		switch (config_value.key) {
		case 'AnchorPeers':
			var anchor_peers = _peerConfigurationProto.AnchorPeers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - AnchorPeers :: %s', group_name, anchor_peers);
			if (anchor_peers && anchor_peers.anchor_peers) for (var i in anchor_peers.anchor_peers) {
				var anchor_peer = {
					host: anchor_peers.anchor_peers[i].host,
					port: anchor_peers.anchor_peers[i].port,
					org: org
				};
				config_items['anchor-peers'].push(anchor_peer);
				logger.debug('loadConfigValue - %s    - AnchorPeer :: %s:%s:%s', group_name, anchor_peer.host, anchor_peer.port, anchor_peer.org);
			}
			break;
		case 'MSP':
			var msp_value = _mspConfigProto.MSPConfig.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - MSP found', group_name);
			if (!isOrderer) config_items.msps.push(msp_value);
			break;
		case 'ConsensusType':
			var consensus_type = _ordererConfigurationProto.ConsensusType.decode(config_value.value.value);
			config_items.settings['ConsensusType'] = consensus_type;
			logger.debug('loadConfigValue - %s    - Consensus type value :: %s', group_name, consensus_type.type);
			break;
		case 'BatchSize':
			var batch_size = _ordererConfigurationProto.BatchSize.decode(config_value.value.value);
			config_items.settings['BatchSize'] = batch_size;
			logger.debug('loadConfigValue - %s    - BatchSize  max_message_count :: %s', group_name, batch_size.maxMessageCount);
			logger.debug('loadConfigValue - %s    - BatchSize  absolute_max_bytes :: %s', group_name, batch_size.absoluteMaxBytes);
			logger.debug('loadConfigValue - %s    - BatchSize  preferred_max_bytes :: %s', group_name, batch_size.preferredMaxBytes);
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
			if (orderer_addresses && orderer_addresses.addresses) {
				for (let address of orderer_addresses.addresses) {
					config_items.orderers.push(address);
				}
			}
			break;
		case 'KafkaBrokers':
			var kafka_brokers = _ordererConfigurationProto.KafkaBrokers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - KafkaBrokers addresses value :: %s', group_name, kafka_brokers.brokers);
			if (kafka_brokers && kafka_brokers.brokers) {
				for (let broker of kafka_brokers.brokers) {
					config_items['kafka-brokers'].push(broker);
				}
			}
			break;
		default:
			logger.debug('loadConfigValue - %s    - value: %s', group_name, config_value.value.value);
		}
	}
	catch (err) {
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

function loadPolicy(config_items, versions, key, policy, group_name) {
	try {
		if(policy.type === _policiesProto.Policy.PolicyType.SIGNATURE){
			let signature_policy = _policiesProto.SignaturePolicyEnvelope.decode(policy.policy);
			logger.debug('loadPolicy - %s - policy SIGNATURE :: %s %s', group_name, signature_policy.encodeJSON(), this.decodeSignaturePolicy(signature_policy.getIdentities()));
		}else if(policy.type === _policiesProto.Policy.PolicyType.IMPLICIT_META){
			let implicit_policy = _policiesProto.ImplicitMetaPolicy.decode(policy.value);
			let rule = ImplicitMetaPolicy_Rule[implicit_policy.getRule()];
			logger.debug('loadPolicy - %s - policy IMPLICIT_META :: %s %s', group_name, rule, implicit_policy.getSubPolicy());
		}else{
			logger.error('loadPolicy - Unknown policy type :: %s', policy.type);
			throw new Error('Unknown Policy type ::' + policy.type);
		}
	}
	catch (err) {
		logger.debug('loadPolicy - %s - name: %s - unable to parse policy %s', group_name, key, err);
	}
}

function decodeSignaturePolicy(identities) {
	var results = [];
	for (let i in identities) {
		let identity = identities[i];
		switch (identity.getPrincipalClassification()) {
		case _mspPrincipalProto.MSPPrincipal.Classification.ROLE:
			results.push(_mspPrincipalProto.MSPRole.decode(identity.getPrincipal()).encodeJSON());
		}
	}
	return results;
}

module.exports = Channel;
