/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const sdk_utils = require('./utils.js');
const client_utils = require('./client-utils.js');
const util = require('util');
const path = require('path');
const Peer = require('./Peer.js');
const ChannelEventHub = require('./ChannelEventHub.js');
const Orderer = require('./Orderer.js');
const BlockDecoder = require('./BlockDecoder.js');
const TransactionID = require('./TransactionID.js');
const grpc = require('grpc');
const Long = require('long');
const logger = sdk_utils.getLogger('Channel.js');
const MSPManager = require('./msp/msp-manager.js');
const Policy = require('./Policy.js');
const Constants = require('./Constants.js');
const CollectionConfig = require('./SideDB.js');
const { Identity } = require('./msp/identity.js');
const ChannelHelper = require('./utils/ChannelHelper');

const _ccProto = grpc.load(__dirname + '/protos/peer/chaincode.proto').protos;
const _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
const _proposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
const _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
const _queryProto = grpc.load(__dirname + '/protos/peer/query.proto').protos;
const _peerConfigurationProto = grpc.load(__dirname + '/protos/peer/configuration.proto').protos;
const _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
const _configtxProto = grpc.load(__dirname + '/protos/common/configtx.proto').common;
const _policiesProto = grpc.load(__dirname + '/protos/common/policies.proto').common;
const _ledgerProto = grpc.load(__dirname + '/protos/common/ledger.proto').common;
const _commonConfigurationProto = grpc.load(__dirname + '/protos/common/configuration.proto').common;
const _ordererConfigurationProto = grpc.load(__dirname + '/protos/orderer/configuration.proto').orderer;
const _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
const _mspConfigProto = grpc.load(__dirname + '/protos/msp/msp_config.proto').msp;
const _mspPrincipalProto = grpc.load(__dirname + '/protos/msp/msp_principal.proto').common;
const _identityProto = grpc.load(path.join(__dirname, '/protos/msp/identities.proto')).msp;
const _discoveryProto = grpc.load(__dirname + '/protos/discovery/protocol.proto').discovery;
const _gossipProto = grpc.load(__dirname + '/protos/gossip/message.proto').gossip;
const _collectionProto = grpc.load(__dirname + '/protos/common/collection.proto').common;

const ImplicitMetaPolicy_Rule = { 0: 'ANY', 1: 'ALL', 2: 'MAJORITY' };

const PEER_NOT_ASSIGNED_MSG = 'Peer with name "%s" not assigned to this channel';
const ORDERER_NOT_ASSIGNED_MSG = 'Orderer with name "%s" not assigned to this channel';

/**
 * Channels provide data isolation for a set of participating organizations.
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
const Channel = class {

	/**
	 * Returns a new instance of the class. This is a client-side-only call. To
	 * create a new channel in the fabric, call [createChannel()]{@link Client#createChannel}.
	 *
	 * @param {string} name - Name to identify the channel. This value is used
	 *        as the identifier of the channel when making channel-aware requests
	 *        with the fabric, such as invoking chaincodes to endorse transactions.
	 *        The naming of channels is enforced by the ordering service and must
	 *        be unique within the fabric backend. Channel name in fabric network
	 *        is subject to a pattern revealed in the configuration setting
	 *        <code>channel-name-regx-checker</code>.
	 * @param {Client} clientContext - The client instance, which provides
	 *        operational context such as the signing identity
	 */
	constructor(name, clientContext) {
		if (!name) {
			throw new Error('Failed to create Channel. Missing requirement "name" parameter.');
		}
		if (typeof name !== 'string') {
			throw new Error('Failed to create Channel. channel name should be a string');
		}
		const channelNameRegxChecker = sdk_utils.getConfigSetting('channel-name-regx-checker');
		if (channelNameRegxChecker) {
			const { pattern, flags } = channelNameRegxChecker;
			const namePattern = new RegExp(pattern ? pattern : '', flags ? flags : '');
			if (!(name.match(namePattern))) {
				throw new Error(util.format('Failed to create Channel. channel name should match Regex %s, but got %j', namePattern, name));
			}
		}
		if (!clientContext) {
			throw new Error('Failed to create Channel. Missing requirement "clientContext" parameter.');
		}

		this._name = name;
		this._channel_peers = new Map();
		this._anchor_peers = [];
		this._orderers = new Map();
		this._kafka_brokers = [];
		this._clientContext = clientContext;
		this._msp_manager = new MSPManager();
		this._discovery_interests = new Map();
		this._discovery_results = null;
		this._last_discover_timestamp = null;
		this._discovery_peer = null;
		this._use_discovery = sdk_utils.getConfigSetting('initialize-with-discovery', false);
		this._endorsement_handler = null; //will be setup during initialization
		this._commit_handler = null;

		logger.debug('Constructed Channel instance: name - %s, network mode: %s', this._name, !this._devMode);
	}

	/**
	 * Close the service connections of all assigned peers and orderers
	 */
	close() {
		logger.debug('close - closing connections');
		this._channel_peers.forEach((channel_peer) => {
			channel_peer.close();
		});
		this._orderers.forEach((orderer) => {
			orderer.close();
		});
	}

	/**
	 * @typedef {Object} InitializeRequest
	 * @property {string | Peer | ChannelPeer} target - Optional. The target peer to be used
	 *           to make the initialization requests for configuration information.
	 *           Default is to use the first ChannelPeer assigned to this channel.
	 * @property {boolean} discover - Optional. Use the discovery service on the
	 *           the target peer to load the configuration and network information.
	 *           Default is false. When false, the target peer will use the
	 *           Peer query to load only the configuration information.
	 * @property {string} endorsementHandler - Optional. The path to a custom
	 *           endorsement handler implementing {@link EndorsementHandler}.
	 * @property {string} commitHandler - Optional. The path to a custom
	 *           commit handler implementing {@link CommitHandler}.
	 * @property {boolean} asLocalhost - Optional. Convert discovered host addresses
	 *           to be 'localhost'. Will be needed when running a docker composed
	 *           fabric network on the local system.
	 * @property {byte[]} configUpdate - Optional. To initialize this channel with
	 *           a serialized ConfigUpdate protobuf object.
	 */

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
	 * @param {InitializeRequest} request - Optional.  a {@link InitializeRequest}
	 * @return {Promise} A Promise that will resolve when the action is complete
	 */
	async initialize(request) {
		const method = 'initialize';
		logger.debug('%s - start', method);

		let endorsement_handler_path = null;
		let commit_handler_path = null;

		if (request) {
			if (request.configUpate) {
				logger.debub('%s - have a configupdate', method);
				this.loadConfigUpdate(request.configUpate);

				return true;
			} else {
				if (typeof request.discover !== 'undefined') {
					if (typeof request.discover === 'boolean') {
						logger.debug('%s - user requested discover %s', method, request.discover);
						this._use_discovery = request.discover;
					} else {
						throw new Error('Request parameter "discover" must be boolean');
					}
				}
				if (request.endorsementHandler) {
					logger.debug('%s - user requested endorsementHandler %s', method, request.endorsementHandler);
					endorsement_handler_path = request.endorsementHandler;
				}
				if (request.commitHandler) {
					logger.debug('%s - user requested commitHandler %s', method, request.commitHandler);
					commit_handler_path = request.commitHandler;
				}
			}
		}

		// setup the endorsement handler
		if(!endorsement_handler_path && this._use_discovery) {
			endorsement_handler_path = sdk_utils.getConfigSetting('endorsement-handler');
			logger.debug('%s - using config setting for endorsement handler ::%s', method, endorsement_handler_path);
		}
		if (endorsement_handler_path) {
			this._endorsement_handler = require(endorsement_handler_path).create(this);
			await this._endorsement_handler.initialize();
		}

		// setup the commit handler
		if(!commit_handler_path) {
			commit_handler_path = sdk_utils.getConfigSetting('commit-handler');
			logger.debug('%s - using config setting for commit handler ::%s', method, commit_handler_path);
		}
		if (commit_handler_path) {
			this._commit_handler = require(commit_handler_path).create(this);
			await this._commit_handler.initialize();
		}

		const results = await this._initialize(request);

		return results;
	}

	async _initialize(request) {
		const method = '_initialize';
		logger.debug('%s - start', method);

		this._discovery_results = null;
		this._last_discover_timestamp = null;
		this._last_refresh_request = Object.assign({}, request);
		let target_peer = this._discovery_peer;

		if (request && request.target) {
			target_peer = request.target;
		}

		if (this._use_discovery) {
			logger.debug('%s - starting discovery', method);
			target_peer = this._getTargetForDiscovery(target_peer);
			if (!target_peer) {
				throw new Error('No target provided for discovery services');
			}

			try {
				const discover_request = {
					target: target_peer,
					config: true
				};

				const discovery_results = await this._discover(discover_request);
				if (discovery_results) {
					if (discovery_results.msps) {
						this._buildDiscoveryMSPs(discovery_results);
					} else {
						throw Error('No MSP information found');
					}
					if (discovery_results.orderers) {
						this._buildDiscoveryOrderers(discovery_results, discovery_results.msps, request);
					}
					if (discovery_results.peers_by_org) {
						this._buildDiscoveryPeers(discovery_results, discovery_results.msps, request);
					}
				}

				discovery_results.endorsement_plans = [];

				const interests = [];
				const plan_ids = [];
				this._discovery_interests.forEach((interest, plan_id) =>{
					logger.debug('%s - have interest of:%s', method, plan_id);
					plan_ids.push(plan_id);
					interests.push(interest);
				});

				for(const i in plan_ids) {
					const plan_id = plan_ids[i];
					const interest = interests[i];

					const discover_request = {
						target: target_peer,
						interests: [interest]
					};

					let discover_interest_results = null;
					try {
						discover_interest_results = await this._discover(discover_request);
					} catch(error) {
						logger.error('Not able to get an endorsement plan for %s', plan_id);
					}

					if(discover_interest_results && discover_interest_results.endorsement_plans && discover_interest_results.endorsement_plans[0]) {
						const plan = this._buildDiscoveryEndorsementPlan(discover_interest_results, plan_id, discovery_results.msps, request);
						discovery_results.endorsement_plans.push(plan);
						logger.debug('Added an endorsement plan for %s', plan_id);
					} else {
						logger.debug('Not adding an endorsement plan for %s', plan_id);
					}
				}

				discovery_results.timestamp = Date.now();
				this._discovery_results = discovery_results;
				this._discovery_peer = target_peer;
				this._last_discover_timestamp = discovery_results.timestamp;

				return discovery_results;
			} catch(error) {
				logger.error(error);
				throw Error('Failed to discover ::'+ error.toString());
			}
		} else {
			target_peer = this._getFirstAvailableTarget(target_peer);
			if (!target_peer) {
				throw new Error('No target provided for non-discovery initialization');
			}
			const config_envelope = await this.getChannelConfig(target_peer);
			logger.debug('initialize - got config envelope from getChannelConfig :: %j', config_envelope);
			const config_items = this.loadConfigEnvelope(config_envelope);

			return config_items;

		}
	}

	_buildDiscoveryMSPs(discovery_results) {
		const method = '_buildDiscoveryMSPs';
		logger.debug('%s - build msps', method);

		for (const msp_name in discovery_results.msps) {
			const msp = discovery_results.msps[msp_name];
			const config = {
				rootCerts: msp.rootCerts,
				intermediateCerts: msp.intermediateCerts,
				admins: msp.admins,
				cryptoSuite: this._clientContext._cryptoSuite,
				id: msp.id,
				orgs: msp.orgs,
				tls_root_certs: msp.tls_root_certs,
				tls_intermediate_certs: msp.tls_intermediate_certs
			};
			this._msp_manager.addMSP(config);
		}
	}

	_buildDiscoveryOrderers(discovery_results, msps, options) {
		const method = '_buildDiscoveryOrderers';
		logger.debug('%s - build orderers', method);

		for (const msp_id in discovery_results.orderers) {
			logger.debug('%s - orderers msp:%s', method, msp_id);
			const endpoints = discovery_results.orderers[msp_id].endpoints;
			for (const endpoint of endpoints) {
				logger.debug('%s - orderer mspid:%s endpoint:%s:%s', method, msp_id, endpoint.host, endpoint.port);
				endpoint.name = this._buildOrdererName(
					msp_id,
					endpoint.host,
					endpoint.port,
					msps,
					options
				);
			}
		}
	}

	_buildDiscoveryPeers(discovery_results, msps, options) {
		const method = '_buildDiscoveryPeers';
		logger.debug('%s - build peers', method);

		for (const msp_id in discovery_results.peers_by_org) {
			logger.debug('%s - peers msp:%s', method, msp_id);
			const peers = discovery_results.peers_by_org[msp_id].peers;
			for (const peer of peers) {
				for (const chaincode of  peer.chaincodes) {
					const interest = this._buildDiscoveryInterest(chaincode.name);
					const plan_id = JSON.stringify(interest);
					logger.debug('%s - looking at adding plan_id of  %s', method, plan_id);
					this._discovery_interests.set(plan_id, interest); //will replace existing
					logger.debug('%s - adding new interest of single chaincode ::%s', method, plan_id);
				}
				peer.name = this._buildPeerName(
					peer.endpoint,
					peer.mspid,
					msps,
					options
				);
				logger.debug('%s - peer:%j', method, peer);
			}
		}
	}

	_buildDiscoveryEndorsementPlan(discovery_results, plan_id, msps, options){
		const method = '_buildDiscoveryEndorsementPlan';
		logger.debug('%s - build endorsement plan for %s', method, plan_id);

		const endorsement_plan = discovery_results.endorsement_plans[0];
		endorsement_plan.plan_id = plan_id;
		for (const group_name in endorsement_plan.groups) {
			logger.debug('%s - endorsing peer group %s', method, group_name);
			const peers = endorsement_plan.groups[group_name].peers;
			for (const peer of peers) {
				peer.name = this._buildPeerName(
					peer.endpoint,
					peer.mspid,
					msps,
					options
				);
				logger.debug('%s - peer:%j', method, peer);
			}
		}

		return endorsement_plan;
	}

	/**
	 * Get the channel name.
	 * @returns {string} The name of the channel.
	 */
	getName() {
		return this._name;
	}

	/**
	 * @typedef {Object} DiscoveryResultMSPConfig
	 * @property {string} rootCerts List of root certificates trusted by this MSP.
	 *           They are used upon certificate validation.
	 * @property {string} intermediateCerts List of intermediate certificates
	 *           trusted by this MSP. They are used upon certificate validation
	 *           as follows:
	 *           Validation attempts to build a path from the certificate to be
	 *           validated (which is at one end of the path) and one of the certs
	 *           in the RootCerts field (which is at the other end of the path).
	 *           If the path is longer than 2, certificates in the middle are
	 *           searched within the IntermediateCerts pool.
	 * @property {string} admins Identity denoting the administrator of this MSP
	 * @property {string} id the identifier of the MSP
	 * @property {string[]} orgs fabric organizational unit identifiers that
	 *           belong to this MSP configuration
	 * @property {string} tls_root_certs TLS root certificates trusted by this MSP
	 * @property {string} tls_intermediate_certs TLS intermediate certificates
	 *           trusted by this MSP
	 */

	/**
	 * @typedef {Object} DiscoveryResultEndpoints
	 * @property {DiscoveryResultEndpoint[]} endpoints
	 */

	/**
	 * @typedef {Object} DiscoveryResultEndpoint
	 * @property {string} host
	 * @property {number} port
	 * @property {string} name Optional. the name of this endpoint
	 */

	/**
	 * @typedef {Object} DiscoveryResultPeers
	 * @property {DiscoveryResultPeer[]} peers
	 */

	/**
	 * @typedef {Object} DiscoveryResultPeer
	 * @property {string} mspid
	 * @property {string} endpoint host:port for this peer
	 * @property {Long} ledger_height
	 * @property {string} name
	 * @property {DiscoveryResultChaincode[]} chaincodes
	 */

	/**
	 * @typedef {Object} DiscoveryResultChaincode
	 * @property {string} name
	 * @property {string} version
	 */

	/**
	 * @typedef {Object} DiscoveryResultEndorsementPlan
	 * @property {string} chaincode The chaincode name that is the first
	 *           chaincode in the interest that was used to calculate this plan.
	 * @property {string} plan_id The string of the JSON object that represents
	 *           the hint that was used to build the query for this result. The
	 *           hint is a {@link DiscoveryChaincodeInterest} that contains chaincode
	 *           names and collections that the discovery service uses to calculate
	 *           the returned plan.
	 * @property {Object.<string, DiscoveryResultEndorsementGroup>} groups Specifies
	 *           the endorsers, separated to groups.
	 * @property {DiscoveryResultEndorsementLayout[]} layouts Specifies options
	 *           of fulfulling the endorsement policy
	 */

	/**
	 * @typedef {Object.<string, number>} DiscoveryResultEndorsementLayout lists
	 *          the group names, and the amount of signatures needed from each group.
	 */

	/**
	 * @typedef {Object} DiscoveryResultEndorsementGroup
	 * @property {DiscoveryResultPeer[]} peers the peers in this group
	 */

	/**
	 * @typedef {Object} DiscoveryResults
	 * @property {Object.<string, DiscoveryResultMSPConfig>} msps - Optional. The msp config found.
	 * @property {Object.<string, DiscoveryResultEndpoints>} orderers - Optional. The orderers found.
	 * @property {Object.<string, DiscoveryResultPeers>} peers_by_org - Optional. The peers by org found.
	 * @property {DiscoveryResultEndorsementPlan[]} endorsement_plans - Optional.
	 * @property {number} timestamp - The timestamp at which the discovery results are updated.
	 */

	/**
	 * @typedef {Object} DiscoveryChaincodeQuery
	 *          Requests DiscoveryResults for a given list invocations.
	 *          Each interest is a separate invocation of one or more chaincodes,
	 *          which may include invocation on collections.
	 *          The endorsement policy is evaluated independantly for each given
	 *          interest.
	 * @property {DiscoveryChaincodeInterest[]} interests - defines interests
	 *           in an invocations of chaincodes
	 *
	 * @example <caption>"chaincode and no collection"</caption>
	 * {
	 *   interests: [
	 *     { chaincodes: [{ name: "mychaincode"}]}
	 *   ]
	 * }
	 *
	 * @example <caption>"chaincode with collection"</caption>
	 * {
	 *   interests: [
	 *     { chaincodes: [{ name: "mychaincode", collection_names: ["mycollection"] }]}
	 *   ]
	 * }
	 *
	 * @example <caption>"chaincode to chaincode with collection"</caption>
	 * {
	 *   interests: [
	 *      { chaincodes: [
	 *          { name: "mychaincode", collection_names: ["mycollection"] }},
	 *          { name: "myotherchaincode", collection_names: ["mycollection"] }}
	 *        ]
	 *      }
	 *   ]
	 * }
	 *
	 * @example <caption>"query for multiple invocations"</caption>
	 * {
	 *   interests: [
	 *      { chaincodes: [
	 *          { name: "mychaincode", collection_names: ["mycollection"] }},
	 *          { name: "myotherchaincode", collection_names: ["mycollection"] }}
	 *        ]
	 *      },
	 *     { chaincodes: [{ name: "mychaincode", collection_names: ["mycollection"] }]},
	 *     { chaincodes: [{ name: "mychaincode"}]}
	 *   ]
	 * }
	 */

	/**
	 * @typedef {Object} DiscoveryChaincodeInterest
	 * @property {DiscoveryChaincodeCall[]} chaincodes The chaincodes names and collections
	 *           that will be sent to the discovery service to calculate an endorsement
	 *           plan.
	 */

	/**
	 * @typedef {Object} DiscoveryChaincodeCall
	 * @property {string} name - The name of the chaincode
	 * @property {string[]} collection_names - The names of the related collections
	 * @example <caption>"single chaincode"</caption>
	 *   { name: "mychaincode"}
	 *
	 * @example <caption>"chaincode to chaincode"</caption>
	 *   [ { name: "mychaincode"}, { name: "myotherchaincode"} ]
	 *
	 * @example <caption>"single chaincode with a collection"</caption>
	 *   { name: "mychaincode", collection_names: ["mycollection"] }
	 *
	 * @example <caption>"chaincode to chaincode with a collection"</caption>
	 *   [
	 *     { name: "mychaincode", collection_names: ["mycollection"] },
	 *     { name: "myotherchaincode", collection_names: ["mycollection"] }}
	 *   ]
	 *
	 * @example <caption>"chaincode to chaincode with collections"</caption>
	 *   [
	 *     { name: "mychaincode", collection_names: ["mycollection", "myothercollection"] },
	 *     { name: "myotherchaincode", collection_names: ["mycollection", "myothercollection"] }}
	 *   ]
	 */

	/**
	 * Return the discovery results.
	 * Discovery results are only available if this channel has been initialized.
	 * If the results are too old, they will be refreshed
	 * @param {DiscoveryChaincodeInterest[]} endorsement_hints - Indicate to discovery
	 *        how to calculate the endorsement plans.
	 * @returns {Promise<DiscoveryResults>}
	 */
	async getDiscoveryResults(endorsement_hints) {
		const method = 'getDiscoveryResults';
		logger.debug('%s - start', method);

		if (this._discovery_results) {
			const have_new_interests = this._merge_hints(endorsement_hints);
			const allowed_age = sdk_utils.getConfigSetting('discovery-cache-life', 300000); //default is 5 minutes
			const now = Date.now();
			if (have_new_interests || now - this._last_discover_timestamp > allowed_age) {
				logger.debug('%s - need to refresh :: have_new_interests %s', method, have_new_interests);
				await this.refresh();
			}

			logger.debug('%s - returning results', method);
			return this._discovery_results;
		} else {
			logger.debug('No discovery results to return');
			// not working with discovery or we have not been initialized
			throw new Error('This Channel has not been initialized or not initialized with discovery support');
		}
	}

	/**
	 * Return a single endorsment plan based off a {@link DiscoveryChaincodeInterest}.
	 * @param {DiscoveryChaincodeInterest} endorsement_hint - The chaincodes and
	 *        collections of how the discovery service will calculate an endorsement plan.
	 * @return {DiscoveryResultEndorsementPlan} The endorsement plan based on the hint provided.
	 */
	async getEndorsementPlan(endorsement_hint) {
		const method = 'getEndorsementPlan';
		logger.debug('%s - start - %j', method, endorsement_hint);

		let endorsement_plan = null;
		const discovery_results = await this.getDiscoveryResults(endorsement_hint);
		const plan_id = JSON.stringify(endorsement_hint);
		logger.debug('%s - looking at plan_id of  %s', method, plan_id);
		if(discovery_results && discovery_results.endorsement_plans) {
			for(const plan of discovery_results.endorsement_plans) {
				if(plan.plan_id === plan_id) {
					endorsement_plan = plan;
					logger.debug('%s -  found plan in known plans ::%s', method, plan_id);
					break;
				}
			}
		}

		if(endorsement_plan) {
			return JSON.parse(JSON.stringify(endorsement_plan));
		} else {
			logger.debug('%s - plan not found in known plans', method, plan_id);
			return null;
		}
	}

	/**
	 * Refresh the channel's configuration.  The MSP configurations, peers,
	 * orderers, and endorsement plans will be queired from the peer using
	 * the Discover Service. The queries will be made to the peer used previously
	 * for discovery if the 'target' parameter is not provided.
	 *
	 * @return {DiscoveryResults} - The results of refreshing
	 */
	async refresh() {
		const method = 'refresh';
		logger.debug('%s - using last initialize settings', method);

		try {
			const results = await this._initialize(this._last_refresh_request);

			return results;
		} catch(error) {
			logger.error('%s - failed:%s', method, error);

			throw error;
		}
	}

	/**
	 * @typedef {Object} OrganizationIdentifier
	 * @property {string} id The organization's MSP id
	 */

	/**
	 * Get organization identifiers from the MSP's for this channel
	 * @returns {OrganizationIdentifier[]} Array of OrganizationIdentifier Objects
	 *          representing the channel's participating organizations
	 */
	getOrganizations() {
		const method = 'getOrganizations';
		logger.debug('%s - start', method);
		const msps = this._msp_manager.getMSPs();
		const orgs = [];
		if (msps) {
			const keys = Object.keys(msps);
			for (const key in keys) {
				const msp = msps[keys[key]];
				const msp_org = { id: msp.getId() };
				logger.debug('%s - found %j', method, msp_org);
				orgs.push(msp_org);
			}
		}
		logger.debug('%s - orgs::%j', method, orgs);
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
	 *        and other gRPC options such as TLS credentials and request timeout.
	 * @param {string} mspid - The mpsid of the organization this peer belongs.
	 * @param {ChannelPeerRoles} roles - Optional. The roles this peer will perform
	 *        on this channel.  A role that is not defined will default to true
	 * @param {boolean} replace - If a peer exist with the same name, replace
	 *        with this one.
	 */
	addPeer(peer, mspid, roles, replace) {
		const name = peer.getName();
		const check = this._channel_peers.get(name);
		if (check) {
			if (replace) {
				logger.debug('/n removing old peer  --name: %s --URL: %s', peer.getName(), peer.getUrl());

				this.removePeer(check);
			} else {
				const error = new Error();
				error.name = 'DuplicatePeer';
				error.message = 'Peer ' + name + ' already exists';
				logger.error(error.message);
				throw error;
			}
		}
		logger.debug('/n adding a new peer  --name: %s --URL: %s', peer.getName(), peer.getUrl());

		const channel_peer = new ChannelPeer(mspid, this, peer, roles);
		this._channel_peers.set(name, channel_peer);
	}

	/**
	 * Remove the peer object in the channel object's list of peers
	 * whose endpoint url property matches the url or name of the peer that is
	 * passed in.
	 *
	 * @param {Peer} peer - An instance of the Peer class.
	 */
	removePeer(peer) {
		this._channel_peers.delete(peer.getName());
	}

	/**
	 * This method will return a {@link ChannelPeer} instance if assigned to this
	 * channel. Peers that have been created by the {@link Client#newPeer}
	 * method and then added to this channel may be reference by the url if no
	 * name was provided in the options during the create.
	 * A {@link ChannelPeer} provides a reference to peer and channel event hub along
	 * with how this peer is being used on this channel.
	 *
	 * @param {string} name - The name of the peer
	 * @returns {ChannelPeer} The ChannelPeer instance.
	 */
	getPeer(name) {
		const channel_peer = this._channel_peers.get(name);

		if (!channel_peer) {
			throw new Error(util.format(PEER_NOT_ASSIGNED_MSG, name));
		}

		return channel_peer;
	}

	/**
	 * This method will return a {@link ChannelPeer}. This object holds a reference
	 * to the {@link Peer} and the {@link ChannelEventHub} objects and the attributes
	 * of how the peer is defined on the channel.
	 *
	 * @param {string} name - The name of the peer assigned to this channel
	 * @returns {ChannelPeer} The ChannelPeer instance
	 */
	getChannelPeer(name) {
		const channel_peer = this._channel_peers.get(name);

		if (!channel_peer) {
			throw new Error(util.format(PEER_NOT_ASSIGNED_MSG, name));
		}

		return channel_peer;
	}

	/**
	 * Returns a list of {@link ChannelPeer} assigned to this channel instance.
	 * A {@link ChannelPeer} provides a reference to peer and channel event hub along
	 * with how this peer is being used on this channel.
	 * @returns {ChannelPeer[]} The channel peer list on the channel.
	 */
	getPeers() {
		logger.debug('getPeers - list size: %s.', this._channel_peers.size);
		const peers = [];
		this._channel_peers.forEach((channel_peer) => {
			peers.push(channel_peer);
		});
		return peers;
	}

	/**
	 * Returns a list of {@link ChannelPeer} assigned to this channel instance.
	 * A {@link ChannelPeer} provides a reference to peer and channel event hub along
	 * with how this peer is being used on this channel.
	 * @returns {ChannelPeer[]} The channel peer list on the channel.
	 */
	getChannelPeers() {
		return this.getPeers();
	}

	/**
	 * Add the orderer object to the channel object, this is a client-side-only operation.
	 * An application may add more than one orderer object to the channel object, however
	 * the SDK only uses the first one in the list to send broadcast messages to the
	 * orderer backend.
	 *
	 * @param {Orderer} orderer - An instance of the Orderer class.
	 * @param {boolean} replace - If an orderer exist with the same name, replace
	 *        with this one.
	 */
	addOrderer(orderer, replace) {
		const name = orderer.getName();
		const check = this._orderers.get(name);
		if (check) {
			if (replace) {
				this.removeOrderer(check);
			} else {
				const error = new Error();
				error.name = 'DuplicateOrderer';
				error.message = 'Orderer ' + name + ' already exists';
				logger.error(error.message);
				throw error;
			}
		}
		this._orderers.set(name, orderer);
	}

	/**
	 * Remove the first orderer object in the channel object's list of orderers
	 * whose endpoint url property matches the url of the orderer that is
	 * passed in.
	 *
	 * @param {Orderer} orderer - An instance of the Orderer class.
	 */
	removeOrderer(orderer) {
		this._orderers.delete(orderer.getName());
	}

	/**
	 * This method will return a {@link Orderer} instance if assigned to this
	 * channel. Peers that have been created by the {@link Client#newOrderer}
	 * method and then added to this channel may be reference by the url if no
	 * name was provided in the options during the create.
	 *
	 * @param {string} name - The name or url of the orderer
	 * @returns {Orderer} The Orderer instance.
	 */
	getOrderer(name) {
		const orderer = this._orderers.get(name);

		if (!orderer) {
			throw new Error(util.format(ORDERER_NOT_ASSIGNED_MSG, name));
		}

		return orderer;
	}

	/**
	 * Returns the orderers of this channel object.
	 * @returns {Orderer[]} The list of orderers in the channel object
	 */
	getOrderers() {
		logger.debug('getOrderers - list size: %s.', this._orderers.size);
		const orderers = [];
		this._orderers.forEach((orderer) => {
			orderers.push(orderer);
		});
		return orderers;
	}

	/**
	 * Returns an {@link ChannelEventHub} object. An event hub object encapsulates the
	 * properties of an event stream on a peer node, through which the peer publishes
	 * notifications of blocks being committed in the channel's ledger.
	 * This method will create a new ChannelEventHub and not save a reference.
	 * Use the {getChannelEventHub} to reuse a ChannelEventHub.
	 *
	 * @param {Peer | string} peer A Peer instance or the name of a peer that has
	 *        been assigned to the channel.
	 * @returns {ChannelEventHub} The ChannelEventHub instance
	 */
	newChannelEventHub(peer) {
		const peers = this._getTargets(peer, Constants.NetworkConfig.EVENT_SOURCE_ROLE, true);
		// will only return one
		if (peers && peers.length > 0) {
			const channel_event_hub = new ChannelEventHub(this, peers[0]);
			return channel_event_hub;
		} else {
			throw new Error(util.format(PEER_NOT_ASSIGNED_MSG, peer));
		}
	}

	/**
	 * Returns an {@link ChannelEventHub} object. An event hub object encapsulates the
	 * properties of an event stream on a peer node, through which the peer publishes
	 * notifications of blocks being committed in the channel's ledger.
	 * This method will create a new ChannelEventHub if one does not exist.
	 *
	 * @param {string} name - The peer name associated with this channel event hub.
	 *        Use the {@link Peer#getName} method to get the name of a
	 *        peer instance that has been added to this channel.
	 * @returns {ChannelEventHub} - The ChannelEventHub associated with the peer.
	 */
	getChannelEventHub(name) {
		if (!(typeof name === 'string')) {
			throw new Error('"name" parameter must be a Peer name.');
		}
		const _channel_peer = this._channel_peers.get(name);
		if (!_channel_peer) {
			throw new Error(util.format(PEER_NOT_ASSIGNED_MSG, name));
		}

		return _channel_peer.getChannelEventHub();
	}

	/**
	 * Returns a list of {@link ChannelEventHub} based on the peers that are
	 * defined in this channel that are in the organization.
	 *
	 * @param {string} mspid - Optional - The mspid of an organization
	 * @returns {ChannelEventHub[]} An array of ChannelEventHub instances
	 */
	getChannelEventHubsForOrg(mspid) {
		const method = 'getChannelEventHubsForOrg';
		let _mspid = null;
		if (!mspid) {
			_mspid = this._clientContext.getMspid();
			logger.debug('%s - starting - using client mspid: %s', method, _mspid);
		} else {
			_mspid = mspid;
			logger.debug('%s - starting - mspid: %s', method, _mspid);
		}

		const channel_event_hubs = [];
		this._channel_peers.forEach((channel_peer) => {
			if (channel_peer.isInOrg(_mspid)) {
				if (channel_peer.isInRole(Constants.NetworkConfig.EVENT_SOURCE_ROLE)) {
					channel_event_hubs.push(channel_peer.getChannelEventHub());
				} else {
					logger.debug('%s - channel peer:%s is not an event source', method, channel_peer.getName());
				}
			}
		});

		return channel_event_hubs;
	}

	/**
	 * Returns a list of {@link Peer} that are
	 * defined in this channel that are in the named organization.
	 *
	 * @param {string} mspid - Optional - The name of an organization
	 * @returns {Peer[]} An array of Peer instances
	 */
	getPeersForOrg(mspid) {
		const method = 'getPeersForOrg';
		let _mspid = null;
		if (!mspid) {
			_mspid = this._clientContext._mspid;
			logger.debug('%s - starting - using client mspid: %s', method, _mspid);
		} else {
			_mspid = mspid;
			logger.debug('%s - starting - mspid: %s', method, _mspid);
		}

		const peers = [];
		this._channel_peers.forEach((channel_peer) => {
			if (channel_peer.isInOrg(_mspid)) {
				peers.push(channel_peer);
			}
		});

		return peers;
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
		const orderer = this._clientContext.getTargetOrderer(request.orderer, this.getOrderers(), this._name);
		let signer = null;
		let tx_id = request.txId;
		if (!tx_id) {
			signer = this._clientContext._getSigningIdentity(true);
			tx_id = new TransactionID(signer, true);
		} else {
			signer = this._clientContext._getSigningIdentity(tx_id.isAdmin());
		}

		// now build the seek info, will be used once the channel is created
		// to get the genesis block back
		//   build start
		const seekSpecifiedStart = new _abProto.SeekSpecified();
		seekSpecifiedStart.setNumber(0);
		const seekStart = new _abProto.SeekPosition();
		seekStart.setSpecified(seekSpecifiedStart);

		//   build stop
		const seekSpecifiedStop = new _abProto.SeekSpecified();
		seekSpecifiedStop.setNumber(0);
		const seekStop = new _abProto.SeekPosition();
		seekStop.setSpecified(seekSpecifiedStop);

		// seek info with all parts
		const seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);

		// build the header for use with the seekInfo payload
		const seekInfoHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			this._name,
			tx_id.getTransactionID(),
			this._initial_epoch,
			null,
			client_utils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);

		const seekHeader = client_utils.buildHeader(signer, seekInfoHeader, tx_id.getNonce());
		const seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		// building manually or will get protobuf errors on send
		const envelope = client_utils.toEnvelope(client_utils.signProposal(signer, seekPayload));

		return orderer.sendDeliver(envelope);
	}

	/*
	 * Internal use only
	 *
	 * @typedef {Object} DiscoveryRequest
	 * @property {Peer | string} target - Optional. A Peer object or Peer name that
	 *           will be asked to discovery information about this channel.
	 *           Default is the first peer assigned to this channel that has the
	 *           'discover' role.
	 * @property {DiscoveryChaincodeInterest[]} interests - Optional. An
	 *           Array of {@link DiscoveryChaincodeInterest} that have chaincodes
	 *           and collections to calculate the endorsement plans.
	 * @property {boolean} config - Optional. To indicate that the channel configuration
	 *           should be included in the discovery query.
	 * @property {boolean} local - Optional. To indicate that the local endpoints
	 *           should be included in the discovery query.
	 * @property {boolean} useAdmin - Optional. To indicate that the admin identity
	 *           should be used to make the discovery request
	 */

	/**
	 * Send a request to a known peer to discover information about the fabric
	 * network.
	 *
	 * @param {DiscoveryRequest} request -
	 * @returns {DiscoveryResponse} The results from the discovery service
	 */
	async _discover(request) {
		const method = 'discover';
		const self = this;
		logger.debug('%s - start', method);
		const results = {};
		if (!request) {
			request = {};
		}

		let useAdmin = true; //default
		if(typeof request.useAdmin === 'boolean') {
			useAdmin = request.useAdmin;
		}
		const target_peer = this._getTargetForDiscovery(request.target);
		const signer = this._clientContext._getSigningIdentity(useAdmin); //use the admin if assigned
		const discovery_request = new _discoveryProto.Request();

		const authentication = new _discoveryProto.AuthInfo();
		authentication.setClientIdentity(signer.serialize());
		const cert_hash = this._clientContext.getClientCertHash(true);
		if (cert_hash) {
			authentication.setClientTlsCertHash(cert_hash);
		}
		discovery_request.setAuthentication(authentication);

		// be sure to add all entries to this array before setting into the
		// grpc object
		const queries = [];

		// if doing local it will be index 0 of the results
		if (request.local) {
			const query = new _discoveryProto.Query();
			queries.push(query);

			const local_peers = new _discoveryProto.LocalPeerQuery();
			query.setLocalPeers(local_peers);
			logger.debug('%s - adding local peers query', method);
		}

		if (request.config) {
			let query = new _discoveryProto.Query();
			queries.push(query);
			query.setChannel(this.getName());

			const config_query = new _discoveryProto.ConfigQuery();
			query.setConfigQuery(config_query);
			logger.debug('%s - adding config query', method);

			query = new _discoveryProto.Query();
			queries.push(query);
			query.setChannel(this.getName());

			const peer_query = new _discoveryProto.PeerMembershipQuery();
			query.setPeerQuery(peer_query);
			logger.debug('%s - adding channel peers query', method);
		}

		// add a chaincode query to get endorsement plans
		if (request.interests && request.interests.length > 0) {
			const query = new _discoveryProto.Query();
			queries.push(query);
			query.setChannel(this.getName());

			const interests = [];
			for(const interest of request.interests) {
				const proto_interest = this._buildProtoChaincodeInterest(interest);
				interests.push(proto_interest);
			}

			const cc_query = new _discoveryProto.ChaincodeQuery();
			cc_query.setInterests(interests);
			query.setCcQuery(cc_query);
			logger.debug('%s - adding chaincodes/collection query', method);
		}

		// be sure to set the array after completely building it
		discovery_request.setQueries(queries);

		// build up the outbound request object
		const signed_request = client_utils.toEnvelope(client_utils.signProposal(signer, discovery_request));

		const response = await target_peer.sendDiscovery(signed_request);
		logger.debug('%s - processing discovery response', method);
		if (response && response.results) {
			let error_msg = null;
			logger.debug('%s - parse discovery response', method);
			for (const index in response.results) {
				const result = response.results[index];
				if (!result) {
					error_msg = 'Discover results are missing';
					break;
				} else if (result.result === 'error') {
					logger.error('Channel:%s received discovery error:%s', self.getName(), result.error.content);
					error_msg = result.error.content;
					break;
				} else {
					logger.debug('%s - process results', method);
					if (result.config_result) {
						const config = self._processDiscoveryConfigResults(result.config_result);
						results.msps = config.msps;
						results.orderers = config.orderers;
					}
					if (result.members) {
						if (request.local && index === 0) {
							results.local_peers = self._processDiscoveryMembershipResults(result.members);
						} else {
							results.peers_by_org = self._processDiscoveryMembershipResults(result.members);
						}
					}
					if (result.cc_query_res) {
						results.endorsement_plans = self._processDiscoveryChaincodeResults(result.cc_query_res);
					}
					logger.debug('%s - completed processing results', method);
				}
			}

			if (error_msg) {
				throw Error('Channel:' + self.getName() + ' Discovery error:' + error_msg);
			} else {

				return results;
			}
		} else {
			throw new Error('Discovery has failed to return results');
		}
	}

	_processDiscoveryChaincodeResults(q_chaincodes) {
		const method = '_processDiscoveryChaincodeResults';
		logger.debug('%s - start', method);
		const endorsement_plans = [];
		if (q_chaincodes && q_chaincodes.content) {
			if (Array.isArray(q_chaincodes.content)) {
				for (const index in q_chaincodes.content) {
					const q_endors_desc = q_chaincodes.content[index];
					const endorsement_plan = {};
					endorsement_plan.chaincode = q_endors_desc.chaincode;
					endorsement_plans.push(endorsement_plan);

					// GROUPS
					endorsement_plan.groups = {};
					for (const group_name in q_endors_desc.endorsers_by_groups) {
						logger.debug('%s - found group: %s', method, group_name);
						const group = {};
						group.peers = this._processPeers(q_endors_desc.endorsers_by_groups[group_name].peers);
						//all done with this group
						endorsement_plan.groups[group_name] = group;
					}

					// LAYOUTS
					endorsement_plan.layouts = [];
					for (const index in q_endors_desc.layouts) {
						const q_layout = q_endors_desc.layouts[index];
						const layout = {};
						for (const group_name in q_layout.quantities_by_group) {
							layout[group_name] = q_layout.quantities_by_group[group_name];
						}
						logger.debug('%s - layout :%j', method, layout);
						endorsement_plan.layouts.push(layout);
					}
				}
			}
		}

		return endorsement_plans;
	}

	_processDiscoveryConfigResults(q_config) {
		const method = '_processDiscoveryConfigResults';
		logger.debug('%s - start', method);
		const config = {};
		if (q_config) try {
			if (q_config.msps) {
				config.msps = {};
				for (const id in q_config.msps) {
					logger.debug('%s - found organization %s', method, id);
					const q_msp = q_config.msps[id];
					const msp_config = {
						id: id,
						orgs: q_msp.organizational_unit_identifiers,
						rootCerts: sdk_utils.convertBytetoString(q_msp.root_certs),
						intermediateCerts: sdk_utils.convertBytetoString(q_msp.intermediate_certs),
						admins: sdk_utils.convertBytetoString(q_msp.admins),
						tls_root_certs: sdk_utils.convertBytetoString(q_msp.tls_root_certs),
						tls_intermediate_certs: sdk_utils.convertBytetoString(q_msp.tls_intermediate_certs)
					};
					config.msps[id] = msp_config;
				}
			}
			/*
			"orderers":{"OrdererMSP":{"endpoint":[{"host":"orderer.example.com","port":7050}]}}}
			*/
			if (q_config.orderers) {
				config.orderers = {};
				for (const mspid in q_config.orderers) {
					logger.debug('%s - found orderer org: ', method, mspid);
					config.orderers[mspid] = {};
					config.orderers[mspid].endpoints = [];
					for (const index in q_config.orderers[mspid].endpoint) {
						config.orderers[mspid].endpoints.push(q_config.orderers[mspid].endpoint[index]);
					}
				}
			}
		} catch (err) {
			logger.error('Problem with discovery config: %s', err);
		}

		return config;
	}

	_processDiscoveryMembershipResults(q_members) {
		const method = '_processDiscoveryChannelMembershipResults';
		logger.debug('%s - start', method);
		const peers_by_org = {};
		if (q_members && q_members.peers_by_org) {
			for (const mspid in q_members.peers_by_org) {
				logger.debug('%s - found org:%s', method, mspid);
				peers_by_org[mspid] = {};
				peers_by_org[mspid].peers = this._processPeers(q_members.peers_by_org[mspid].peers);
			}
		}
		return peers_by_org;
	}

	_processPeers(q_peers) {
		const method = '_processPeers';
		const peers = [];
		q_peers.forEach((q_peer) => {
			const peer = {};
			// IDENTITY
			const q_identity = _identityProto.SerializedIdentity.decode(q_peer.identity);
			peer.mspid = q_identity.mspid;

			// MEMBERSHIP
			const q_membership_message = _gossipProto.GossipMessage.decode(q_peer.membership_info.payload);
			peer.endpoint = q_membership_message.alive_msg.membership.endpoint;
			logger.debug('%s - found peer :%s', method, peer.endpoint);

			// STATE
			if (q_peer.state_info) {
				const message_s = _gossipProto.GossipMessage.decode(q_peer.state_info.payload);
				if (message_s && message_s.state_info && message_s.state_info.properties && message_s.state_info.properties.ledger_height) {
					peer.ledger_height = Long.fromValue(message_s.state_info.properties.ledger_height);
				} else {
					logger.debug('%s - did not find ledger_height', method);
					peer.ledger_height = Long.fromValue(0);
				}
				logger.debug('%s - found ledger_height :%s', method, peer.ledger_height);
				peer.chaincodes = [];
				for (const index in message_s.state_info.properties.chaincodes) {
					const q_chaincode = message_s.state_info.properties.chaincodes[index];
					const chaincode = {};
					chaincode.name = q_chaincode.getName();
					chaincode.version = q_chaincode.getVersion();
					//TODO metadata ?
					logger.debug('%s - found chaincode :%j', method, chaincode);
					peer.chaincodes.push(chaincode);
				}
			}

			//all done with this peer
			peers.push(peer);
		});

		return peers;
	}

	_buildOrdererName(msp_id, host, port, msps, request) {
		const method = '_buildOrdererName';
		logger.debug('%s - start', method);

		const name = host + ':' + port;
		const url = this._buildUrl(host, port, request);
		let found = null;
		this._orderers.forEach((orderer) => {
			if (orderer.getUrl() === url) {
				logger.debug('%s - found existing orderer %s', method, url);
				found = orderer;
			}
		});
		if (!found) {
			if (msps[msp_id]) {
				logger.debug('%s - create a new orderer %s', method, url);
				found = new Orderer(url, this._buildOptions(name, url, host, msps[msp_id]));
				this.addOrderer(found, true);
			} else {
				throw new Error('No TLS cert information available');
			}
		}

		return found.getName();
	}

	_buildPeerName(endpoint, msp_id, msps, request) {
		const method = '_buildPeerName';
		logger.debug('%s - start', method);

		const name = endpoint;
		const host_port = endpoint.split(':');
		const url = this._buildUrl(host_port[0], host_port[1], request);
		let found = null;
		this._channel_peers.forEach((peer) => {
			if (peer.getUrl() === url) {
				logger.debug('%s - found existing peer %s', method, url);
				found = peer;
			}
		});
		if (!found) {
			if (msp_id && msps && msps[msp_id]) {
				logger.debug('%s - create a new peer %s', method, url);
				found = new Peer(url, this._buildOptions(name, url, host_port[0], msps[msp_id]));
				this.addPeer(found, msp_id, null, true);
			} else {
				throw new Error('No TLS cert information available');
			}
		}

		return found.getName();
	}

	_buildUrl(hostname, port, request) {
		const method = '_buildUrl';
		logger.debug('%s - start', method);

		let t_hostname = hostname;

		// endpoints may be running in containers on the local system
		if (request && request.asLocalhost) {
			t_hostname = 'localhost';
		}

		const protocol = sdk_utils.getConfigSetting('discovery-protocol', 'grpcs');
		const url = protocol + '://' + t_hostname + ':' + port;

		return url;
	}

	_buildOptions(name, url, host, msp) {
		const method = '_buildOptions';
		logger.debug('%s - start', method);

		const caroots = this._buildTlsRootCerts(msp);
		const opts = {
			'pem': caroots,
			'ssl-target-name-override': host,
			'name': name
		};
		this._clientContext.addTlsClientCertAndKey(opts);

		return opts;
	}

	_buildTlsRootCerts(msp) {
		let caroots = '';
		if (msp.tls_root_certs) {
			caroots = caroots + msp.tls_root_certs;
		}
		if (msp.tls_intermediate_certs) {
			caroots = caroots + msp.tls_intermediate_certs;
		}

		return caroots;
	}

	/* internal method
	 *  Takes an array of {@link DiscoveryChaincodeCall} that represent the
	 *  chaincodes and associated collections to build an interest.
	 *  The interest becomes part of the query object needed by the discovery
	 *  service to calculate the endorsement plan for an invocation.
	 */
	_buildProtoChaincodeInterest(interest) {
		const chaincode_calls = [];
		for(const chaincode of interest.chaincodes) {
			const chaincode_call = new _discoveryProto.ChaincodeCall();
			if(typeof chaincode.name === 'string') {
				chaincode_call.setName(chaincode.name);
				if(chaincode.collection_names) {
					if(Array.isArray(chaincode.collection_names)) {
						const collection_names = [];
						chaincode.collection_names.map(name =>{
							if(typeof name === 'string') {
								collection_names.push(name);
							} else {
								throw Error('The collection name must be a string');
							}
						});
						chaincode_call.setCollectionNames(collection_names);
					} else {
						throw Error('collection_names must be an array of strings');
					}
				}
				chaincode_calls.push(chaincode_call);
			} else {
				throw Error('Chaincode name must be a string');
			}
		}
		const interest_proto = new _discoveryProto.ChaincodeInterest();
		interest_proto.setChaincodes(chaincode_calls);

		return interest_proto;
	}

	/* internal method
	 * takes an array of interest and checks to see if they exist on the current
	 * interests, if not adds in any that do not already exist
	 */
	_merge_hints(endorsement_hints) {
		const method = '_merge_hints';
		if(!endorsement_hints) {
			logger.debug('%s - no hint return false', method);
			return false;
		}
		let results = false;
		let hints = endorsement_hints;
		if(!Array.isArray(endorsement_hints)) {
			hints = [endorsement_hints];
		}
		for(const hint of hints) {
			const key = JSON.stringify(hint);
			const value = this._discovery_interests.get(key);
			logger.debug('%s - key %s', method, key);
			if(value) {
				logger.debug('%s - found interest exist %s', method, key);
			} else {
				logger.debug('%s - add new interest %s', method, key);
				this._discovery_interests.set(key, hint);
				results = true;
			}
		}

		return results;
	}

	/* internal method
	 * takes a single string that represents a chaincode and optional array of strings
	 * that represent collections and builds a JSON
	 * object that may be used as input to building of the GRPC objects to send
	 * to the discovery service.
	 */
	_buildDiscoveryInterest(name, collections) {
		logger.debug('_buildDiscoveryInterest - name %s', name);
		const interest = {};
		interest.chaincodes = [];
		const chaincodes = this._buildDiscoveryChaincodeCall(name, collections);
		interest.chaincodes.push(chaincodes);

		return interest;
	}

	/* internal metnod
	 * takes a single string name and an array of collection names and builds
	 * a JSON object that may be used as input to the building of the GRPC
	 * objects to send to the discovery service.
	 */
	_buildDiscoveryChaincodeCall(name, collection_names) {
		const chaincode_call = {};
		if(typeof name === 'string') {
			chaincode_call.name = name;
			if(collection_names) {
				if(Array.isArray(collection_names)) {
					chaincode_call.collection_names = [];
					collection_names.map(name =>{
						if(typeof name === 'string') {
							chaincode_call.collection_names.push(name);
						} else {
							throw Error('The collection name must be a string');
						}
					});
				} else {
					throw Error('Collections names must be an array of strings');
				}
			}
		} else {
			throw Error('Chaincode name must be a string');
		}

		return chaincode_call;
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
	 * @property {Peer[] | string[]} targets - Optional. An array of Peer objects or Peer names that will
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
		let errorMsg = null;

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

		const targets = this._getTargets(request.targets, 'ALL ROLES');
		const signer = this._clientContext._getSigningIdentity(request.txId.isAdmin());
		const chaincodeInput = new _ccProto.ChaincodeInput();
		const args = [];
		args.push(Buffer.from('JoinChain', 'utf8'));
		args.push(request.block.toBuffer());

		chaincodeInput.setArgs(args);

		const chaincodeID = new _ccProto.ChaincodeID();
		chaincodeID.setName(Constants.CSCC);

		const chaincodeSpec = new _ccProto.ChaincodeSpec();
		chaincodeSpec.setType(_ccProto.ChaincodeSpec.Type.GOLANG);
		chaincodeSpec.setChaincodeId(chaincodeID);
		chaincodeSpec.setInput(chaincodeInput);

		const channelHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			'',
			request.txId.getTransactionID(),
			null, //no epoch
			Constants.CSCC,
			client_utils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);

		const header = client_utils.buildHeader(signer, channelHeader, request.txId.getNonce());
		const proposal = client_utils.buildProposal(chaincodeSpec, header);
		const signed_proposal = client_utils.signProposal(signer, proposal);

		return client_utils.sendPeersProposal(targets, signed_proposal, timeout).catch((err) => {
			logger.error('joinChannel - Failed Proposal. Error: %s', err.stack ? err.stack : err);
			return Promise.reject(err);
		});
	}

	/**
	 * Asks the peer for the current (latest) configuration block for this channel.
	 * @param {string | Peer} target - Optional. The peer to be used to make the
	 *        request.
	 * @param {Number} timeout - Optional. A number indicating milliseconds to wait
	 *                           on the response before rejecting the promise with a
	 *                           timeout error. This overrides the default timeout
	 *                           of the {@link Peer} instance(s) and the global timeout
	 *                           in the config settings.
	 * @returns {Promise} A Promise for a {@link ConfigEnvelope} object containing the configuration items.
	 */
	async getChannelConfig(target, timeout) {
		const method = 'getChannelConfig';
		logger.debug('%s - start for channel %s', method, this._name);
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(true);
		const tx_id = new TransactionID(signer, true);
		const request = {
			targets: targets,
			chaincodeId: Constants.CSCC,
			txId: tx_id,
			signer: signer,
			fcn: 'GetConfigBlock',
			args: [this._name]
		};
		request.targets = this._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, timeout);
		const responses = results[0];
		// const proposal = results[1];
		logger.debug('%s - results received', method);
		if (responses && Array.isArray(responses)) {
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			else if (response.response && response.response.payload && response.response.status === 200) {
				const block = _commonProto.Block.decode(response.response.payload);
				const envelope = _commonProto.Envelope.decode(block.data.data[0]);
				const payload = _commonProto.Payload.decode(envelope.payload);
				const config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);
				return config_envelope;
			}
			else {
				logger.error('%s - unknown response ::%s', method, response);
				throw new Error(response);
			}
		}
		throw new Error('Payload results are missing from the get channel config');
	}

	/**
	 * Asks the orderer for the current (latest) configuration block for this channel.
	 * This is similar to [getGenesisBlock()]{@link Channel#getGenesisBlock}, except
	 * that instead of getting block number 0 it gets the latest block that contains
	 * the channel configuration, and only returns the decoded {@link ConfigEnvelope}.
	 *
	 * @returns {Promise} A Promise for a {@link ConfigEnvelope} object containing the configuration items.
	 */
	async getChannelConfigFromOrderer() {
		const method = 'getChannelConfigFromOrderer';
		logger.debug('%s - start for channel %s', method, this._name);

		const self = this;
		const orderer = this._clientContext.getTargetOrderer(null, this.getOrderers(), this._name);

		const signer = this._clientContext._getSigningIdentity(true);
		let txId = new TransactionID(signer, true);

		// seek the latest block
		let seekSpecifiedStart = new _abProto.SeekNewest();
		let seekStart = new _abProto.SeekPosition();
		seekStart.setNewest(seekSpecifiedStart);

		let seekSpecifiedStop = new _abProto.SeekNewest();
		let seekStop = new _abProto.SeekPosition();
		seekStop.setNewest(seekSpecifiedStop);

		// seek info with all parts
		let seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);

		// build the header for use with the seekInfo payload
		let seekInfoHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			txId.getTransactionID(),
			self._initial_epoch,
			null,
			client_utils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);

		let seekHeader = client_utils.buildHeader(signer, seekInfoHeader, txId.getNonce());
		let seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());

		// building manually or will get protobuf errors on send
		let envelope = client_utils.toEnvelope(client_utils.signProposal(signer, seekPayload));
		// This will return us a block
		let block = await orderer.sendDeliver(envelope);
		logger.debug('%s - good results from seek block ', method); // :: %j',results);
		// verify that we have the genesis block
		if (block) {
			logger.debug('%s - found latest block', method);
		}
		else {
			logger.error('%s - did not find latest block', method);
			throw new Error('Failed to retrieve latest block', method);
		}

		logger.debug('%s - latest block is block number %s', block.header.number);
		// get the last config block number
		const metadata = _commonProto.Metadata.decode(block.metadata.metadata[_commonProto.BlockMetadataIndex.LAST_CONFIG]);
		const last_config = _commonProto.LastConfig.decode(metadata.value);
		logger.debug('%s - latest block has config block of %s', method, last_config.index);

		txId = new TransactionID(signer);

		// now build the seek info to get the block called out
		// as the latest config block
		seekSpecifiedStart = new _abProto.SeekSpecified();
		seekSpecifiedStart.setNumber(last_config.index);
		seekStart = new _abProto.SeekPosition();
		seekStart.setSpecified(seekSpecifiedStart);

		//   build stop
		seekSpecifiedStop = new _abProto.SeekSpecified();
		seekSpecifiedStop.setNumber(last_config.index);
		seekStop = new _abProto.SeekPosition();
		seekStop.setSpecified(seekSpecifiedStop);

		// seek info with all parts
		seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);
		//logger.debug('initializeChannel - seekInfo ::' + JSON.stringify(seekInfo));

		// build the header for use with the seekInfo payload
		seekInfoHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			self._name,
			txId.getTransactionID(),
			self._initial_epoch,
			null,
			client_utils.buildCurrentTimestamp(),
			self._clientContext.getClientCertHash()
		);

		seekHeader = client_utils.buildHeader(signer, seekInfoHeader, txId.getNonce());
		seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());

		// building manually or will get protobuf errors on send
		envelope = client_utils.toEnvelope(client_utils.signProposal(signer, seekPayload));
		// this will return us a block
		block = await orderer.sendDeliver(envelope);
		if (!block) {
			throw new Error('Config block was not found');
		}
		// lets have a look at the block
		logger.debug('%s -  config block number ::%s  -- numberof tx :: %s', method, block.header.number, block.data.data.length);
		if (block.data.data.length !== 1) {
			throw new Error('Config block must only contain one transaction');
		}
		envelope = _commonProto.Envelope.decode(block.data.data[0]);
		const payload = _commonProto.Payload.decode(envelope.payload);
		const channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
		if (channel_header.type !== _commonProto.HeaderType.CONFIG) {
			throw new Error(`Block must be of type "CONFIG" (${_commonProto.HeaderType.CONFIG}), but got "${channel_header.type}" instead`);
		}

		const config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);

		// send back the envelope
		return config_envelope;
	}

	/*
	 * Utility method to load this channel with configuration information
	 * from an Envelope that contains a Configuration
	 * @param {byte[]} the envelope with the configuration update items
	 * @see /protos/common/configtx.proto
	 */
	loadConfigUpdateEnvelope(data) {
		logger.debug('loadConfigUpdateEnvelope - start');
		const envelope = _commonProto.Envelope.decode(data);
		const payload = _commonProto.Payload.decode(envelope.payload);
		const channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
		if (channel_header.type != _commonProto.HeaderType.CONFIG_UPDATE) {
			return new Error('Data must be of type "CONFIG_UPDATE"');
		}

		const config_update_envelope = _configtxProto.ConfigUpdateEnvelope.decode(payload.data);
		return this.loadConfigUpdate(config_update_envelope.config_update);
	}

	loadConfigUpdate(config_update_bytes) {
		const config_update = _configtxProto.ConfigUpdate.decode(config_update_bytes);
		logger.debug('loadConfigData - channel ::' + config_update.channel_id);

		const read_group = config_update.read_set;
		const write_group = config_update.write_set;

		const config_items = {};
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

		const group = config_envelope.config.channel_group;

		const config_items = {};
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
	async queryInfo(target, useAdmin) {
		logger.debug('queryInfo - start');
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const tx_id = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: tx_id,
			signer: signer,
			fcn: 'GetChainInfo',
			args: [this._name]
		};

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		if (responses && Array.isArray(responses)) {
			logger.debug('queryInfo - got responses=' + responses.length);
			//will only be one response as we are only querying the primary peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response && response.response.status && response.response.status === 200) {
				logger.debug('queryInfo - response status %d:', response.response.status);
				return _ledgerProto.BlockchainInfo.decode(response.response.payload);
			} else if (response.response && response.response.status) {
				// no idea what we have, lets fail it and send it back
				throw new Error(response.response.message);
			}
		}
		throw new Error('Payload results are missing from the query channel info');
	}

	/**
	 * Queries the ledger on the target peer for a Block TransactionID.
	 *
	 * @param {string} tx_id - The TransactionID of the Block in question.
	 * @param {Peer} target - Optional. The peer to send the query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @param {boolean} skipDecode - Optional. If true, this function returns an encoded block.
	 * @returns {Promise} A Promise for a {@link Block} matching the tx_id, fully decoded into an object.
	 */
	async queryBlockByTxID(tx_id, target, useAdmin, skipDecode) {
		logger.debug('queryBlockByTxID - start');
		if (!tx_id || !(typeof tx_id === 'string')) {
			throw new Error('tx_id as string is required');
		}

		const args = [this._name, tx_id];
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);

		const request = {
			targets,
			chaincodeId: Constants.QSCC,
			txId: new TransactionID(signer, useAdmin),
			fcn: 'GetBlockByTxID',
			args
		};

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		if (responses && Array.isArray(responses)) {
			logger.debug('queryBlockByTxID - got response', responses.length);
			//will only be one response as we are only querying the primary peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response && response.response.status && response.response.status === 200) {
				logger.debug('queryBlockByTxID - response status %d:', response.response.status);
				if (skipDecode) {
					return response.response.payload;
				} else {
					const block = BlockDecoder.decode(response.response.payload);
					logger.debug('queryBlockByTxID - looking at block :: %s', block.header.number);
					return block;
				}
			} else if (response.response && response.response.status) {
				// no idea what we have, lets fail it and send it back
				throw new Error(response.response.message);
			}
		}
		throw new Error('Payload results are missing from the query');
	}

	/**
	 * Queries the ledger on the target peer for a Block by block hash.
	 *
	 * @param {byte[]} blockHash of the Block in question.
	 * @param {Peer} target - Optional. The peer to send the query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @param {boolean} skipDecode - Optional. If true, this function returns an encoded block.
	 * @returns {Promise} A Promise for a {@link Block} matching the hash, fully decoded into an object.
	 */
	async queryBlockByHash(blockHash, target, useAdmin, skipDecode) {
		logger.debug('queryBlockByHash - start');
		if (!blockHash) {
			throw new Error('Blockhash bytes are required');
		}
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetBlockByHash',
			args: [this._name],
			argbytes: blockHash
		};

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		logger.debug('queryBlockByHash - got response');
		if (responses && Array.isArray(responses)) {
			//will only be one response as we are only querying the primary peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response && response.response.status && response.response.status === 200) {
				logger.debug('queryBlockByHash - response status %d:', response.response.status);
				if (skipDecode) {
					return response.response.payload;
				} else {
					const block = BlockDecoder.decode(response.response.payload);
					logger.debug('queryBlockByHash - looking at block :: %s', block.header.number);
					return block;
				}
			} else if (response.response && response.response.status) {
				// no idea what we have, lets fail it and send it back
				throw new Error(response.response.message);
			}
		}
		throw new Error('Payload results are missing from the query');
	}

	/**
	 * Queries the ledger on the target peer for Block by block number.
	 *
	 * @param {number} blockNumber - The number of the Block in question.
	 * @param {Peer} target - Optional. The peer to send this query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @param {boolean} skipDecode - Optional. If true, this function returns an encoded block.
	 * @returns {Promise} A Promise for a {@link Block} at the blockNumber slot in the ledger, fully decoded into an object.
	 */
	async queryBlock(blockNumber, target, useAdmin, skipDecode) {
		logger.debug('queryBlock - start blockNumber %s', blockNumber);
		let block_number = null;
		if (Number.isInteger(blockNumber) && blockNumber >= 0) {
			block_number = blockNumber.toString();
		} else {
			throw new Error('Block number must be a positive integer');
		}
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetBlockByNumber',
			args: [this._name, block_number]
		};

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		logger.debug('queryBlock - got response');
		if (responses && Array.isArray(responses)) {
			//will only be one response as we are only querying the primary peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response && response.response.status && response.response.status === 200) {
				logger.debug('queryBlock - response status %d:', response.response.status);
				if (skipDecode) {
					return response.response.payload;
				} else {
					const block = BlockDecoder.decode(response.response.payload);
					logger.debug('queryBlock - looking at block :: %s', block.header.number);
					return block;
				}
			} else if (response.response && response.response.status) {
				// no idea what we have, lets fail it and send it back
				throw new Error(response.response.message);
			}
		}
		throw new Error('Payload results are missing from the query');
	}

	/**
	 * Queries the ledger on the target peer for Transaction by id.
	 *
	 * @param {string} tx_id - The id of the transaction
	 * @param {Peer} target - Optional. The peer to send this query to. If no target is passed,
	 *                        the query is sent to the first peer that was added to the channel object.
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call to the peer.
	 * @param {boolean} skipDecode - Optional. If true, this function returns an encoded transaction.
	 * @returns {Promise} A Promise for a fully decoded {@link ProcessedTransaction} object.
	 */
	async queryTransaction(tx_id, target, useAdmin, skipDecode) {
		logger.debug('queryTransaction - start transactionID %s', tx_id);
		if (tx_id) {
			tx_id = tx_id.toString();
		} else {
			throw new Error('Missing "tx_id" parameter');
		}
		const targets = this._getTargetForQuery(target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);
		const request = {
			targets: targets,
			chaincodeId: Constants.QSCC,
			txId: txId,
			signer: signer,
			fcn: 'GetTransactionByID',
			args: [this._name, tx_id]
		};

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		logger.debug('queryTransaction - got response');
		if (responses && Array.isArray(responses)) {
			//will only be one response as we are only querying the primary peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response && response.response.status && response.response.status === 200) {
				logger.debug('queryTransaction - response status :: %d', response.response.status);
				if (skipDecode) {
					return response.response.payload;
				} else {
					return BlockDecoder.decodeTransaction(response.response.payload);
				}
			} else if (response.response && response.response.status) {
				// no idea what we have, lets fail it and send it back
				throw new Error(response.response.message);
			}

		}
		throw new Error('Payload results are missing from the query');
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
	async queryInstantiatedChaincodes(target, useAdmin) {
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

		const results = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
		const responses = results[0];
		logger.debug('queryInstantiatedChaincodes - got response');
		if (responses && Array.isArray(responses)) {
			//will only be one response as we are only querying one peer
			if (responses.length > 1) {
				throw new Error('Too many results returned');
			}
			const response = responses[0];
			if (response instanceof Error) {
				throw response;
			}
			if (response.response) {
				if (response.response.status === 200) {
					logger.debug('queryInstantiatedChaincodes - response status :: %d', response.response.status);
					const queryTrans = _queryProto.ChaincodeQueryResponse.decode(response.response.payload);
					logger.debug('queryInstantiatedChaincodes - ProcessedTransaction.chaincodeInfo.length :: %s', queryTrans.chaincodes.length);
					for (const chaincode of queryTrans.chaincodes) {
						logger.debug('queryInstantiatedChaincodes - name %s, version %s, path %s', chaincode.name, chaincode.version, chaincode.path);
					}
					return queryTrans;
				} else {
					if (response.response.message) {
						throw new Error(response.response.message);
					}
				}
			}
			// no idea what we have, lets fail it and send it back
			throw new Error(response);
		}
		throw new Error('Payload results are missing from the query');
	}

	async queryCollectionsConfig(options, useAdmin) {
		const method = 'queryCollectionsConfig';
		logger.debug('%s - start. options:%j, useAdmin:%s', method, options, useAdmin);
		if (!options || !options.chaincodeId || typeof options.chaincodeId !== 'string') {
			throw new Error('Missing required argument \'options.chaincodeId\' or \'options.chaincodeId\' is not of type string');
		}

		const targets = this._getTargetForQuery(options.target);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);

		const request = {
			targets,
			txId,
			signer,
			chaincodeId: Constants.LSCC,
			fcn: 'GetCollectionsConfig',
			args: [options.chaincodeId],
		};

		try {
			const [responses] = await Channel.sendTransactionProposal(request, this._name, this._clientContext, null);
			if (responses && Array.isArray(responses)) {
				if (responses.length > 1) {
					throw new Error('Too many results returned');
				}
				const [response] = responses;
				if (response instanceof Error) {
					throw response;
				}
				if (!response.response) {
					throw new Error('Didn\'t receive a valid peer response');
				}
				logger.debug('%s - response status :: %d', method, response.response.status);

				if (response.response.status !== 200) {
					logger.debug('%s - response:%j', method, response);
					if (response.response.message) {
						throw new Error(response.response.message);
					}
					throw new Error('Failed to retrieve collections config from peer');
				}
				const queryResponse = decodeCollectionsConfig(response.response.payload);
				logger.debug('%s - get %s collections for chaincode %s from peer', method, queryResponse.length, options.chaincodeId);
				return queryResponse;
			}
			throw new Error('Failed to retrieve collections config from peer');
		} catch (e) {
			throw e;
		}
	}

	/**
	 * @typedef {Object} ChaincodeInstantiateUpgradeRequest
	 * @property {Peer[] | string[]} targets - Optional. An array of endorsing
	 *           {@link Peer} objects or peer names as the targets of the request.
	 *           When this parameter is omitted the target list will include peers assigned
	 *           to this channel instance that are in the endorsing role.
	 * @property {string} chaincodeType - Optional. Type of chaincode. One of
	 *           'golang', 'car', 'java' or 'node'. Default is 'golang'. Note that 'java'
	 *           is not yet supported.
	 * @property {string} chaincodeId - Required. The name of the chaincode
	 * @property {string} chaincodeVersion - Required. Version string of the chaincode,
	 *           such as 'v1'
	 * @property {TransactionID} txId - Required. Object with the transaction id
	 *           and nonce
	 * @property {string} collections-config - Optional. The path to the collections
	 *           config. More details can be found at this [tutorial]{@link https://fabric-sdk-node.github.io/tutorial-private-data.html}
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be
	 *           used by the chaincode during initialization, but not saved in the
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
	 *           in the write set, to the orderer directly. The user context assigned
	 *           to the client instance that creates the signature will allow the
	 *           transaction to be successfully validated
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
	async _sendChaincodeProposal(request, command, timeout) {
		let errorMsg = null;

		//validate the incoming request
		if (!errorMsg) errorMsg = client_utils.checkProposalRequest(request, true);
		if (!errorMsg) errorMsg = client_utils.checkInstallRequest(request);
		if (errorMsg) {
			logger.error('sendChainCodeProposal error ' + errorMsg);
			throw new Error(errorMsg);
		}
		const peers = this._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

		// args is optional because some chaincode may not need any input parameters during initialization
		if (!request.args) {
			request.args = [];
		}

		// step 1: construct a ChaincodeSpec
		const args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'init', 'utf8'));

		for (const arg of request.args)
			args.push(Buffer.from(arg, 'utf8'));

		const ccSpec = {
			type: client_utils.translateCCType(request.chaincodeType),
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
		/**
		 * lcccSpec_args:
		 * args[0] is the command
		 * args[1] is the channel name
		 * args[2] is the ChaincodeDeploymentSpec
		 *
		 * the following optional arguments here (they can each be nil and may or may not be present)
		 * args[3] is a marshaled SignaturePolicyEnvelope representing the endorsement policy
		 * args[4] is the name of escc
		 * args[5] is the name of vscc
		 * args[6] is a marshaled CollectionConfigPackage struct
		 */
		const lcccSpec_args = [
			Buffer.from(command),
			Buffer.from(this._name),
			chaincodeDeploymentSpec.toBuffer(),
			Buffer.from(''),
			Buffer.from(''),
			Buffer.from(''),
		];
		if (request['endorsement-policy']) {
			lcccSpec_args[3] = this._buildEndorsementPolicy(request['endorsement-policy']);
		}
		if (request['collections-config']) {
			const collectionConfigPackage = CollectionConfig.buildCollectionConfigPackage(request['collections-config']);
			lcccSpec_args[6] = collectionConfigPackage.toBuffer();
		}

		const lcccSpec = {
			// type: _ccProto.ChaincodeSpec.Type.GOLANG,
			type: client_utils.translateCCType(request.chaincodeType),
			chaincode_id: { name: Constants.LSCC },
			input: { args: lcccSpec_args }
		};

		const channelHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			this._name,
			request.txId.getTransactionID(),
			null,
			Constants.LSCC,
			client_utils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);
		const header = client_utils.buildHeader(signer, channelHeader, request.txId.getNonce());
		const proposal = client_utils.buildProposal(lcccSpec, header, request.transientMap);
		const signed_proposal = client_utils.signProposal(signer, proposal);

		const responses = await client_utils.sendPeersProposal(peers, signed_proposal, timeout);
		return [responses, proposal];
	}

	/**
	 * @typedef {Object} ChaincodeInvokeRequest
	 * @property {Peer[] | string[]} targets - Optional. The peers that will receive this request,
	 *           when not provided the list of peers added to this channel object will
	 *           be used. When this channel has been initialized using the discovery
	 *           service the proposal will be sent to the peers on the list provided
	 *           discovery service if no targets are specified.
	 * @property {string} chaincodeId - Required. The id of the chaincode to process
	 *           the transaction proposal
	 * @property {DiscoveryChaincodeIntereset} endorsement_hint - Optional. A
	 *           of {@link DiscoveryChaincodeInterest} object that will be used by
	 *           discovery service to calculate an appropriate endorsement plan.
	 *           The parameter is only required when the endorsement will be preformed
	 *           by a chaincode that will call other chaincodes or if the endorsement
	 *           should be made by only peers within a collection or collections.
	 * @property {TransactionID} txId - Optional. TransactionID object with the
	 *           transaction id and nonce. txId is required for [sendTransactionProposal]{@link Channel#sendTransactionProposal}
	 *           and optional for [generateUnsignedProposal]{@link Channel#generateUnsignedProposal}
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be
	 *           used by the chaincode but not
	 *           saved in the ledger, such as cryptographic information for encryption
	 * @property {string} fcn - Optional. The function name to be returned when
	 *           calling <code>stub.GetFunctionAndParameters()</code>
	 *           in the target chaincode. Default is 'invoke'
	 * @property {string[]} args - An array of string arguments specific to the
	 *           chaincode's 'Invoke' method
	 * @property {string[]} ignore - Optional. An array of strings that represent
	 *           the names of peers that should be ignored by the endorsement.
	 *           This list only applies to endorsements using the discovery service.
	 * @property {string[]} preferred - Optional. An array of strings that represent
	 *           the names of peers that should be given priority by the endorsement.
	 *           This list only applies to endorsements using the discovery service.
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
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}
	 */
	async sendTransactionProposal(request, timeout) {
		const method = 'sendTransactionProposal';
		logger.debug('%s - start', method);

		let errorMsg = client_utils.checkProposalRequest(request, true);

		if (errorMsg) {
			// do nothing so we skip the rest of the checks
		} else if (!request.args) {
			// args is not optional because we need for transaction to execute
			errorMsg = 'Missing "args" in Transaction proposal request';
		}

		if (errorMsg) {
			logger.error('%s error %s', method, errorMsg);
			throw new Error(errorMsg);
		}

		if (!request.targets && this._endorsement_handler) {
			logger.debug('%s - running with endorsement handler', method);
			const proposal = Channel._buildSignedProposal(request, this._name, this._clientContext);

			let endorsement_hint = request.endorsement_hint;
			if(!endorsement_hint && request.chaincodeId) {
				endorsement_hint = this._buildDiscoveryInterest(request.chaincodeId);
			}

			logger.debug('%s - endorse with hint %j', method, endorsement_hint);

			const params = {
				request: request,
				signed_proposal: proposal.signed,
				timeout: timeout,
				endorsement_hint: endorsement_hint
			};

			const responses = await this._endorsement_handler.endorse(params);

			return [responses, proposal.source];
		} else {
			logger.debug('%s - running without endorsement handler', method);
			request.targets = this._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

			return Channel.sendTransactionProposal(request, this._name, this._clientContext, timeout);
		}
	}

	/*
	 * Internal static method to allow transaction proposals to be called without
	 * creating a new channel
	 */
	static async sendTransactionProposal(request, channelId, client_context, timeout) {
		const method = 'sendTransactionProposal(static)';
		logger.debug('%s - start', method);

		let errorMsg = client_utils.checkProposalRequest(request, true);

		if (errorMsg) {
			// do nothing so we skip the rest of the checks
		} else if (!request.args) {
			// args is not optional because we need for transaction to execute
			errorMsg = 'Missing "args" in Transaction proposal request';
		} else if (!request.targets || request.targets.length < 1) {
			errorMsg = 'Missing peer objects in Transaction proposal';
		}

		if (errorMsg) {
			logger.error('%s error %s', method, errorMsg);
			throw new Error(errorMsg);
		}

		const proposal = Channel._buildSignedProposal(request, channelId, client_context);

		const responses = await client_utils.sendPeersProposal(request.targets, proposal.signed, timeout);
		return [responses, proposal.source];
	}

	static _buildSignedProposal(request, channelId, client_context) {
		const method = '_buildSignedProposal';
		logger.debug('%s - start', method);

		const args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('%s - adding function arg:%s', method, request.fcn ? request.fcn : 'invoke');

		for (let i = 0; i < request.args.length; i++) {
			logger.debug('%s - adding arg', method);
			args.push(Buffer.from(request.args[i], 'utf8'));
		}
		//special case to support the bytes argument of the query by hash
		if (request.argbytes) {
			logger.debug('%s - adding the argument :: argbytes', method);
			args.push(request.argbytes);
		}
		else {
			logger.debug('%s - not adding the argument :: argbytes', method);
		}

		logger.debug('%s - chaincode ID:%s', method, request.chaincodeId);
		const invokeSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincode_id: { name: request.chaincodeId },
			input: { args: args }
		};

		let signer = null;
		if (request.signer) {
			signer = request.signer;
		} else {
			signer = client_context._getSigningIdentity(request.txId.isAdmin());
		}

		const channelHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			channelId,
			request.txId.getTransactionID(),
			null,
			request.chaincodeId,
			client_utils.buildCurrentTimestamp(),
			client_context.getClientCertHash()
		);

		const header = client_utils.buildHeader(signer, channelHeader, request.txId.getNonce());
		const proposal = client_utils.buildProposal(invokeSpec, header, request.transientMap);
		const signed_proposal = client_utils.signProposal(signer, proposal);

		return { signed: signed_proposal, source: proposal };
	}

	/**
	 * @typedef {Object} TransactionRequest
	 * @property {ProposalResponse[]} proposalResponses - An array of or a single
	 *           {@link ProposalResponse} object containing the response from the
	 *           [endorsement]{@link Channel#sendTransactionProposal} call
	 * @property {Proposal} proposal - A Proposal object containing the original
	 *           request for endorsement(s)
	 * @property {TransactionId} txID - Optional. - Must be the transaction ID object
	 *           used in the proposal endorsement. The transactionID will
	 *           only be used to determine if the signing of the request
	 *           should be done by the admin identity or the user assigned
	 *           to the client instance.
	 * @property {Orderer|string} orderer - Optional. The orderer instance or string name
	 *                     of the orderer to operate. See {@link Client.getTargetOrderer}
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
	 * @param {TransactionRequest} request - {@link TransactionRequest}
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Orderer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a "BroadcastResponse" message returned by
	 *          the orderer that contains a single "status" field for a
	 *          standard [HTTP response code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L27}.
	 *          This will be an acknowledgement from the orderer of a successfully
	 *          submitted transaction.
	 */
	async sendTransaction(request, timeout) {
		logger.debug('sendTransaction - start :: channel %s', this);

		if (!request) {
			throw Error('Missing input request object on the transaction request');
		}
		// Verify that data is being passed in
		if (!request.proposalResponses) {
			throw Error('Missing "proposalResponses" parameter in transaction request');
		}
		if (!request.proposal) {
			throw Error('Missing "proposal" parameter in transaction request');
		}

		let proposalResponses = request.proposalResponses;
		const chaincodeProposal = request.proposal;

		const endorsements = [];
		if (!Array.isArray(proposalResponses)) {
			//convert to array
			proposalResponses = [proposalResponses];
		}
		for (const proposalResponse of proposalResponses) {
			// make sure only take the valid responses to set on the consolidated response object
			// to use in the transaction object
			if (proposalResponse && proposalResponse.response && proposalResponse.response.status === 200) {
				endorsements.push(proposalResponse.endorsement);
			}
		}

		if (endorsements.length < 1) {
			logger.error('sendTransaction - no valid endorsements found');
			throw new Error('no valid endorsements found');
		}
		const proposalResponse = proposalResponses[0];

		let use_admin_signer = false;
		if (request.txId) {
			use_admin_signer = request.txId.isAdmin();
		}

		const envelope = Channel.buildEnvelope(this._clientContext, chaincodeProposal, endorsements, proposalResponse, use_admin_signer);

		if (this._commit_handler) {
			const params = {
				signed_envelope: envelope,
				request: request,
				timeout: timeout
			};
			return this._commit_handler.commit(params);

		} else {
			// verify that we have an orderer configured
			const orderer = this._clientContext.getTargetOrderer(request.orderer, this.getOrderers(), this._name);
			return orderer.sendBroadcast(envelope, timeout);
		}
	}


	/**
	 * @typedef {Object} ProposalRequest
	 * @property {string} fcn - Required. The function name.
	 * @property {string[]} args - Required. Arguments to send to chaincode.
	 * @property {string} chaincodeId - Required. ChaincodeId.
	 * @property {Buffer} argbytes - Optional. Include when an argument must be included as bytes.
	 * @property {map} transientMap - Optional. <sting, byte[]> The Map that can be
	 *           used by the chaincode but not saved in the ledger, such as
	 *           cryptographic information for encryption.
	 */


	/**
	 * Generates the endorse proposal bytes for a transaction
	 *
	 * Current the [sendTransactionProposal]{@link Channel#sendTransactionProposal}
	 * sign a transaction using the user identity from SDK's context (which
	 * contains the user's private key).
	 *
	 * This method is designed to build the proposal bytes at SDK side,
	 * and user can sign this proposal with their private key, and send
	 * the signed proposal to peer by [sendSignedProposal]
	 *
	 * so the user's private
	 * key would not be required at SDK side.
	 *
	 * @param {ProposalRequest} request chaincode invoke request
	 * @param {string} mspId the mspId for this identity
	 * @param {string} certificate PEM encoded certificate
	 * @param {boolean} admin if this transaction is invoked by admin
	 * @returns {Proposal}
	 */
	generateUnsignedProposal(request, mspId, certificate, admin) {
		const method = 'generateUnsignedProposal';
		logger.debug('%s - start', method);

		const args = [];
		args.push(Buffer.from(request.fcn ? request.fcn : 'invoke', 'utf8'));
		logger.debug('%s - adding function arg:%s', method, request.fcn ? request.fcn : 'invoke');

		// check request && request.chaincodeId
		let errorMsg = client_utils.checkProposalRequest(request, false);

		if (!request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		}
		if (!Array.isArray(request.args)) {
			errorMsg = 'Param "args" in Transaction proposal request should be a string array';
		}

		if (errorMsg) {
			logger.error('%s error %s', method, errorMsg);
			throw new Error(errorMsg);
		}

		request.args.forEach(arg => {
			logger.debug('%s - adding arg %s', method, arg);
			args.push(Buffer.from(arg, 'utf8'));
		});
		//special case to support the bytes argument of the query by hash
		if (request.argbytes) {
			logger.debug('%s - adding the argument :: argbytes', method);
			args.push(request.argbytes);
		} else {
			logger.debug('%s - not adding the argument :: argbytes', method);
		}

		const invokeSpec = {
			type: _ccProto.ChaincodeSpec.Type.GOLANG,
			chaincode_id: { name: request.chaincodeId },
			input: { args }
		};

		// certificate, publicKey, mspId, cryptoSuite
		const identity = new Identity(certificate, null, mspId);
		const txId = new TransactionID(identity, admin);

		const channelHeader = client_utils.buildChannelHeader(
			_commonProto.HeaderType.ENDORSER_TRANSACTION,
			this._name,
			txId.getTransactionID(),
			null,
			request.chaincodeId,
			client_utils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);

		const header = client_utils.buildHeader(identity, channelHeader, txId.getNonce());
		const proposal = client_utils.buildProposal(invokeSpec, header, request.transientMap);
		return { proposal, txId };
	}

	/**
	 * @typedef {Object} SignedProposal
	 * @property {Peer[]} targets - Required. The function name.
	 * @property {Buffer} signedProposal - Required. The signed endorse proposal
	 */

	/**
	 * Send signed transaction proposal to peer
	 *
	 * @param {SignedProposal} request signed endorse transaction proposal, this signed
	 * proposal would be send to peer directly.
	 * @param {number} timeout the timeout setting passed on sendSignedProposal
	 */
	async sendSignedProposal(request, timeout) {
		return Channel.sendSignedProposal(request, timeout);
	}

	/**
	 * Send signed transaction proposal to peer
	 *
	 * @param {SignedProposal} request signed endorse transaction proposal, this signed
	 * proposal would be send to peer directly.
	 * @param {number} timeout the timeout setting passed on sendSignedProposal
	 */
	static async sendSignedProposal(request, timeout) {
		const responses = await client_utils.sendPeersProposal(request.targets, request.signedProposal, timeout);
		return responses;
	}

	/**
	 * generate the commit proposal for a transaction
	 *
	 * @param {TransactionRequest} request
	 */
	generateUnsignedTransaction(request) {
		logger.debug('generateUnsignedTransaction - start :: channel %s', this._name);

		if (!request) {
			throw Error('Missing input request object on the generateUnsignedTransaction() call');
		}
		// Verify that data is being passed in
		if (!request.proposalResponses) {
			throw Error('Missing "proposalResponses" parameter in transaction request');
		}
		if (!request.proposal) {
			throw Error('Missing "proposal" parameter in transaction request');
		}
		let proposalResponses = request.proposalResponses;
		const chaincodeProposal = request.proposal;

		const endorsements = [];
		if (!Array.isArray(proposalResponses)) {
			//convert to array
			proposalResponses = [proposalResponses];
		}
		for (const proposalResponse of proposalResponses) {
			// make sure only take the valid responses to set on the consolidated response object
			// to use in the transaction object
			if (proposalResponse && proposalResponse.response && proposalResponse.response.status === 200) {
				endorsements.push(proposalResponse.endorsement);
			}
		}

		if (endorsements.length < 1) {
			logger.error('sendTransaction - no valid endorsements found');
			throw new Error('no valid endorsements found');
		}
		const proposalResponse = proposalResponses[0];

		let use_admin_signer = false;
		if (request.txId) {
			use_admin_signer = request.txId.isAdmin();
		}

		const proposal = ChannelHelper.buildTransactionProposal(
			chaincodeProposal,
			endorsements,
			proposalResponse,
			use_admin_signer
		);
		return proposal;
	}

	/**
	 * @typedef {Object} SignedCommitProposal
	 * @property {TransactionRequest} request - Required. The commit request
	 * @property {Buffer} signedTransaction - Required. The signed transaction
	 * @property {Orderer|string} orderer - Optional. The orderer instance or string name
	 *                     of the orderer to operate. See {@link Client.getTargetOrderer}
	 */

	/**
	 * send the signed commit proposal for a transaction
	 *
	 * @param {SignedCommitProposal} request the signed commit proposal
	 * @param {number} timeout the timeout setting passed on sendSignedProposal
	 */
	async sendSignedTransaction(request, timeout) {
		const signed_envelope = client_utils.toEnvelope(request.signedProposal);
		if (this._commit_handler) {
			const params = {
				signed_envelope,
				request: request.request,
				timeout: timeout
			};

			return this._commit_handler.commit(params);
		} else {
			// verify that we have an orderer configured
			const orderer = this._clientContext.getTargetOrderer(request.orderer, this.getOrderers(), this._name);
			return orderer.sendBroadcast(signed_envelope, timeout);
		}
	}

	/*
	 * Internal static method to allow transaction envelop to be built without
	 * creating a new channel
	 */
	static buildEnvelope(clientContext, chaincodeProposal, endorsements, proposalResponse, use_admin_signer) {

		const header = _commonProto.Header.decode(chaincodeProposal.getHeader());

		const chaincodeEndorsedAction = new _transProto.ChaincodeEndorsedAction();
		chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
		chaincodeEndorsedAction.setEndorsements(endorsements);

		const chaincodeActionPayload = new _transProto.ChaincodeActionPayload();
		chaincodeActionPayload.setAction(chaincodeEndorsedAction);

		// the TransientMap field inside the original proposal payload is only meant for the
		// endorsers to use from inside the chaincode. This must be taken out before sending
		// to the orderer, otherwise the transaction will be rejected by the validators when
		// it compares the proposal hash calculated by the endorsers and returned in the
		// proposal response, which was calculated without the TransientMap
		const originalChaincodeProposalPayload = _proposalProto.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
		const chaincodeProposalPayloadNoTrans = new _proposalProto.ChaincodeProposalPayload();
		chaincodeProposalPayloadNoTrans.setInput(originalChaincodeProposalPayload.input); // only set the input field, skipping the TransientMap
		chaincodeActionPayload.setChaincodeProposalPayload(chaincodeProposalPayloadNoTrans.toBuffer());

		const transactionAction = new _transProto.TransactionAction();
		transactionAction.setHeader(header.getSignatureHeader());
		transactionAction.setPayload(chaincodeActionPayload.toBuffer());

		const actions = [];
		actions.push(transactionAction);

		const transaction = new _transProto.Transaction();
		transaction.setActions(actions);


		const payload = new _commonProto.Payload();
		payload.setHeader(header);
		payload.setData(transaction.toBuffer());

		const signer = clientContext._getSigningIdentity(use_admin_signer);
		return client_utils.toEnvelope(client_utils.signProposal(signer, payload));
	}
	/**
	 * @typedef {Object} ChaincodeQueryRequest
	 * @property {Peer[]} targets - Optional. The peers that will receive this
	 *           request, when not provided the list of peers added to this channel
	 *           object will be used.
	 * @property {string} chaincodeId - Required. The id of the chaincode to process
	 *           the transaction proposal
	 * @property {map} transientMap - Optional. <string, byte[]> map that can be
	 *           used by the chaincode but not saved in the ledger, such as cryptographic
	 *           information for encryption
	 * @property {string} fcn - Optional. The function name to be returned when
	 *           calling <code>stub.GetFunctionAndParameters()</code>
	 *           in the target chaincode. Default is 'invoke'
	 * @property {string[]} args - An array of string arguments specific to the
	 *           chaincode's 'Invoke' method
	 * @property {integer} request_timeout - The timeout value to use for this request
	 */

	/**
	 * Sends a proposal to one or more endorsing peers that will be handled by the chaincode.
	 * There is no difference in how the endorsing peers process a request
	 * to invoke a chaincode for transaction vs. to invoke a chaincode for query. All requests
	 * will be presented to the target chaincode's 'Invoke' method which must be implemented to
	 * understand from the arguments that this is a query request. The chaincode must also return
	 * results in the byte array format and the caller will have to be able to decode
	 * these results.
	 *
	 * @param {ChaincodeQueryRequest} request
	 * @param {boolean} useAdmin - Optional. Indicates that the admin credentials should be used in making
	 *                  this call
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
	async queryByChaincode(request, useAdmin) {
		logger.debug('queryByChaincode - start');
		if (!request) {
			throw new Error('Missing request object for this queryByChaincode call.');
		}

		const targets = this._getTargets(request.targets, Constants.NetworkConfig.CHAINCODE_QUERY_ROLE);
		const signer = this._clientContext._getSigningIdentity(useAdmin);
		const txId = new TransactionID(signer, useAdmin);

		// make a new request object so we can add in the txId and not change the user's
		const query_request = {
			targets: targets,
			chaincodeId: request.chaincodeId,
			fcn: request.fcn,
			args: request.args,
			transientMap: request.transientMap,
			txId: txId,
			signer: signer
		};

		const results = await Channel.sendTransactionProposal(query_request, this._name, this._clientContext, request.request_timeout);
		const responses = results[0];
		logger.debug('queryByChaincode - results received');
		if (responses && Array.isArray(responses)) {
			const results = [];
			for (let i = 0; i < responses.length; i++) {
				const response = responses[i];
				if (response instanceof Error) {
					results.push(response);
				}
				else if (response.response && response.response.payload) {
					if (response.response.status === 200) {
						results.push(response.response.payload);
					} else {
						if (response.response.message) {
							results.push(new Error(response.response.message));
						} else {
							results.push(new Error(response));
						}
					}
				}
				else {
					logger.error('queryByChaincode - unknown or missing results in query ::' + results);
					results.push(new Error(response));
				}
			}
			return results;
		}
		throw new Error('Payload results are missing from the chaincode query');
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

		const endorsement = proposal_response.endorsement;
		let identity;

		const sid = _identityProto.SerializedIdentity.decode(endorsement.endorser);
		const mspid = sid.getMspid();
		logger.debug('getMSPbyIdentity - found mspid %s', mspid);
		const msp = this._msp_manager.getMSP(mspid);

		if (!msp) {
			throw new Error(util.format('Failed to locate an MSP instance matching the endorser identity\'s organization %s', mspid));
		}
		logger.debug('verifyProposalResponse - found endorser\'s MSP');

		try {
			identity = msp.deserializeIdentity(endorsement.endorser, false);
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
			const digest = Buffer.concat([proposal_response.payload, endorsement.endorser]);
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
		const first_one = _getProposalResponseResults(proposal_responses[0]);
		for (let i = 1; i < proposal_responses.length; i++) {
			const next_one = _getProposalResponseResults(proposal_responses[i]);
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
	 *  utility method to decide on the target for queries that only need ledger access
	 */
	_getTargetForQuery(target) {
		if (Array.isArray(target)) {
			throw new Error('"target" parameter is an array, but should be a singular peer object' +
				' ' + 'or peer name according to the network configuration loaded by the client instance');
		}
		let targets = this._getTargets(target, Constants.NetworkConfig.LEDGER_QUERY_ROLE, true);
		// only want to query one peer
		if (targets && targets.length > 0) {
			targets = [targets[0]];
		}

		return targets;
	}

	/*
	 *  utility method to decide on the target for queries that only need ledger access
	 */
	_getFirstAvailableTarget(target) {
		let targets = this._getTargets(target, Constants.NetworkConfig.ALL_ROLES, true);
		// only want to query one peer
		if (targets && targets.length > 0) {
			targets = targets[0];
		}

		return targets;
	}

	/*
	 *  utility method to decide on the target for discovery
	 */
	_getTargetForDiscovery(target) {
		const targets = this._getTargets(target, Constants.NetworkConfig.DISCOVERY_ROLE, true);
		// only want one peer
		return targets[0];
	}

	/*
	 * utility method to decide on the targets for requests
	 */
	_getTargets(request_targets, role, isTarget) {
		const targets = [];
		if (request_targets) {
			let targetsTemp = request_targets;
			if (!Array.isArray(request_targets)) {
				targetsTemp = [request_targets];
			}
			for (const target_peer of targetsTemp) {
				if (typeof target_peer === 'string') {
					const channel_peer = this._channel_peers.get(target_peer);
					if (channel_peer) {
						targets.push(channel_peer.getPeer());
					} else {
						throw new Error(util.format(PEER_NOT_ASSIGNED_MSG, target_peer));
					}
				} else if (target_peer && target_peer.constructor && target_peer.constructor.name === 'Peer') {
					targets.push(target_peer);
				} else if (target_peer && target_peer.constructor && target_peer.constructor.name === 'ChannelPeer') {
					targets.push(target_peer.getPeer());
				} else {
					throw new Error('Target peer is not a valid peer object instance');
				}
			}
		} else {
			this._channel_peers.forEach((channel_peer) => {
				if (channel_peer.isInRole(role)) {
					targets.push(channel_peer.getPeer());
				}
			});
		}

		if (targets.length == 0) {
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
	 * utility method to decide on the orderer
	 */
	_getOrderer(request_orderer) {
		let orderer = null;
		if (request_orderer) {
			if (typeof request_orderer === 'string') {
				orderer = this._orderers.get(request_orderer);
				if (!orderer) {
					throw new Error(util.format('Orderer %s not assigned to the channel', request_orderer));
				}
			} else if (request_orderer && request_orderer.constructor && request_orderer.constructor.name === 'Orderer') {
				orderer = request_orderer;
			} else {
				throw new Error('Orderer is not a valid orderer object instance');
			}
		} else {
			const orderers = this.getOrderers();
			orderer = orderers[0];
			if (!orderer) {
				throw new Error('No Orderers assigned to this channel');
			}
		}

		return orderer;
	}

	// internal utility method to build chaincode policy
	_buildEndorsementPolicy(policy) {
		return Policy.buildPolicy(this.getMSPManager().getMSPs(), policy);
	}

	/**
	 * return a printable representation of this channel object
	 */
	toString() {
		const orderers = [];
		for (const orderer of this.getOrderers()) {
			orderers.push(orderer.toString());
		}

		const peers = [];
		for (const peer of this.getPeers()) {
			peers.push(peer.toString());
		}

		const state = {
			name: this._name,
			orderers: orderers.length > 0 ? orderers : 'N/A',
			peers: peers.length > 0 ? peers : 'N/A'
		};

		return JSON.stringify(state).toString();
	}

};

//internal utility method to decode and get the write set
//from a proposal response
function _getProposalResponseResults(proposal_response) {
	if (!proposal_response.payload) {
		throw new Error('Parameter must be a ProposalResponse Object');
	}
	const payload = _responseProto.ProposalResponsePayload.decode(proposal_response.payload);
	const extension = _proposalProto.ChaincodeAction.decode(payload.extension);
	// TODO should we check the status of this action
	logger.debug('_getWriteSet - chaincode action status:%s message:%s', extension.response.status, extension.response.message);
	// return a buffer object which has an equals method
	return extension.results.toBuffer();
}

/**
 * utility method to load in a config group
 * @param {Object} config_items - holder of values found in the configuration
 * @param {Object} versions
 * @param {Object} group - used for recursive calls
 * @param {string} name - used to help with the recursive calls
 * @param {string} org - Organizational name
 * @param {bool} top - to handle the  differences in the structure of groups
 * @see /protos/common/configtx.proto
 */
function loadConfigGroup(config_items, versions, group, name, org, top) {
	logger.debug('loadConfigGroup - %s - > group:%s', name, org);
	if (!group) {
		logger.debug('loadConfigGroup - %s - no group', name);
		logger.debug('loadConfigGroup - %s - < group', name);
		return;
	}

	const isOrderer = (name.indexOf('base.Orderer') > -1);
	logger.debug('loadConfigGroup - %s   - version %s', name, group.version);
	logger.debug('loadConfigGroup - %s   - mod policy %s', name, group.mod_policy);

	let groups = null;
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
		const keys = Object.keys(groups.map);
		versions.groups = {};
		if (keys.length === 0) {
			logger.debug('loadConfigGroup - %s   - no groups', name);
		}
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
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
	let values = null;
	if (top) {
		values = group.values;
	}
	else {
		values = group.value.values;
	}
	if (values) {
		versions.values = {};
		const keys = Object.keys(values.map);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			versions.values[key] = {};
			const config_value = values.map[key];
			loadConfigValue(config_items, versions.values[key], config_value, name, org, isOrderer);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no values', name);
	}
	logger.debug('loadConfigGroup - %s - << values', name);

	logger.debug('loadConfigGroup - %s - >> policies', name);
	let policies = null;
	if (top) {
		policies = group.policies;
	}
	else {
		policies = group.value.policies;
	}
	if (policies) {
		versions.policies = {};
		const keys = Object.keys(policies.map);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			versions.policies[key] = {};
			const config_policy = policies.map[key];
			loadConfigPolicy(config_items, versions.policies[key], config_policy, name, org);
		}
	}
	else {
		logger.debug('loadConfigGroup - %s   - no policies', name);
	}
	logger.debug('loadConfigGroup - %s - << policies', name);

	logger.debug('loadConfigGroup - %s - < group', name);
}

/**
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
		case 'AnchorPeers': {
			const anchor_peers = _peerConfigurationProto.AnchorPeers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - AnchorPeers :: %s', group_name, anchor_peers);
			if (anchor_peers && anchor_peers.anchor_peers) for (const i in anchor_peers.anchor_peers) {
				const anchor_peer = {
					host: anchor_peers.anchor_peers[i].host,
					port: anchor_peers.anchor_peers[i].port,
					org: org
				};
				config_items['anchor-peers'].push(anchor_peer);
				logger.debug('loadConfigValue - %s    - AnchorPeer :: %s:%s:%s', group_name, anchor_peer.host, anchor_peer.port, anchor_peer.org);
			}
			break;
		}
		case 'MSP': {
			const msp_value = _mspConfigProto.MSPConfig.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - MSP found', group_name);
			if (!isOrderer) config_items.msps.push(msp_value);
			break;
		}
		case 'ConsensusType': {
			const consensus_type = _ordererConfigurationProto.ConsensusType.decode(config_value.value.value);
			config_items.settings['ConsensusType'] = consensus_type;
			logger.debug('loadConfigValue - %s    - Consensus type value :: %s', group_name, consensus_type.type);
			break;
		}
		case 'BatchSize': {
			const batch_size = _ordererConfigurationProto.BatchSize.decode(config_value.value.value);
			config_items.settings['BatchSize'] = batch_size;
			logger.debug('loadConfigValue - %s    - BatchSize  max_message_count :: %s', group_name, batch_size.maxMessageCount);
			logger.debug('loadConfigValue - %s    - BatchSize  absolute_max_bytes :: %s', group_name, batch_size.absoluteMaxBytes);
			logger.debug('loadConfigValue - %s    - BatchSize  preferred_max_bytes :: %s', group_name, batch_size.preferredMaxBytes);
			break;
		}
		case 'BatchTimeout': {
			const batch_timeout = _ordererConfigurationProto.BatchTimeout.decode(config_value.value.value);
			config_items.settings['BatchTimeout'] = batch_timeout;
			logger.debug('loadConfigValue - %s    - BatchTimeout timeout value :: %s', group_name, batch_timeout.timeout);
			break;
		}
		case 'ChannelRestrictions': {
			const channel_restrictions = _ordererConfigurationProto.ChannelRestrictions.decode(config_value.value.value);
			config_items.settings['ChannelRestrictions'] = channel_restrictions;
			logger.debug('loadConfigValue - %s    - ChannelRestrictions max_count value :: %s', group_name, channel_restrictions.max_count);
			break;
		}
		case 'ChannelCreationPolicy': {
			const creation_policy = _policiesProto.Policy.decode(config_value.value.value);
			loadPolicy(config_items, versions, config_value.key, creation_policy, group_name, org);
			break;
		}
		case 'HashingAlgorithm': {
			const hashing_algorithm_name = _commonConfigurationProto.HashingAlgorithm.decode(config_value.value.value);
			config_items.settings['HashingAlgorithm'] = hashing_algorithm_name;
			logger.debug('loadConfigValue - %s    - HashingAlgorithm name value :: %s', group_name, hashing_algorithm_name.name);
			break;
		}
		case 'Consortium': {
			const consortium_algorithm_name = _commonConfigurationProto.Consortium.decode(config_value.value.value);
			config_items.settings['Consortium'] = consortium_algorithm_name;
			logger.debug('loadConfigValue - %s    - Consortium name value :: %s', group_name, consortium_algorithm_name.name);
			break;
		}
		case 'BlockDataHashingStructure': {
			const blockdata_hashing_structure = _commonConfigurationProto.BlockDataHashingStructure.decode(config_value.value.value);
			config_items.settings['BlockDataHashingStructure'] = blockdata_hashing_structure;
			logger.debug('loadConfigValue - %s    - BlockDataHashingStructure width value :: %s', group_name, blockdata_hashing_structure.width);
			break;
		}
		case 'OrdererAddresses': {
			const orderer_addresses = _commonConfigurationProto.OrdererAddresses.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - OrdererAddresses addresses value :: %s', group_name, orderer_addresses.addresses);
			if (orderer_addresses && orderer_addresses.addresses) {
				for (const address of orderer_addresses.addresses) {
					config_items.orderers.push(address);
				}
			}
			break;
		}
		case 'KafkaBrokers': {
			const kafka_brokers = _ordererConfigurationProto.KafkaBrokers.decode(config_value.value.value);
			logger.debug('loadConfigValue - %s    - KafkaBrokers addresses value :: %s', group_name, kafka_brokers.brokers);
			if (kafka_brokers && kafka_brokers.brokers) {
				for (const broker of kafka_brokers.brokers) {
					config_items['kafka-brokers'].push(broker);
				}
			}
			break;
		}
		default:
			logger.debug('loadConfigValue - %s    - value: %s', group_name, config_value.value.value);
		}
	}
	catch (err) {
		logger.debug('loadConfigValue - %s - name: %s - *** unable to parse with error :: %s', group_name, config_value.key, err);
	}
}

/**
 * @typedef {Object} ChannelPeerRoles
 * @property {boolean} endorsingPeer - Optional. This peer may be sent transaction
 *           proposals for endorsements. The peer must have the chaincode installed.
 *           The app can also use this property to decide which peers to send the
 *           chaincode install request.
 *           Default: true
 *
 * @property {boolean} chaincodeQuery - Optional. This peer may be sent transaction
 *           proposals meant only as a query. The peer must have the chaincode
 *           installed. The app can also use this property to decide which peers
 *           to send the chaincode install request.
 *           Default: true
 *
 * @property {boolean} ledgerQuery - Optional. This peer may be sent query proposals
 *           that do not require chaincodes, like queryBlock(), queryTransaction(), etc.
 *           Default: true
 *
 * @property {boolean} eventSource - Optional. This peer may be the target of a
 *           event listener registration? All peers can produce events, but the
 *           appliatiion typically only needs to connect to one.
 *           Default: true
 *
 * @property {boolean} discover - Optional. This peer may be the target of service
 *           discovery.
 *           Default: true
 */

/**
 * The ChannelPeer class represents a peer in the target blockchain network on this channel.
 *
 * @class
 */
const ChannelPeer = class {
	/**
	 * Construct a ChannelPeer object with the given Peer and opts.
	 * A channel peer object holds channel based references:
	 *   MSP ID of the Organization this peer belongs.
	 *   {@link Channel} object used to know the channel this peer is interacting.
	 *   {@link Peer} object used for interacting with the Hyperledger fabric network.
	 *   {@link ChannelEventHub} object used for listening to block changes on the channel.
	 *   List of {@link ChannelPeerRoles} to indicate the roles this peer performs on the channel.
	 *
	 * The roles this Peer performs on this channel are indicated with is object.
	 *
	 * @param {string} mspid - The mspid of the organization this peer belongs.
	 * @param {Channel} channel - The Channel instance.
	 * @param {Peer} peer - The Peer instance.
	 * @param {ChannelPeerRoles} roles - The roles for this peer.
	 */
	constructor(mspid, channel, peer, roles) {
		this._mspid = mspid;
		if (channel && channel.constructor && channel.constructor.name === 'Channel') {
			if (peer && peer.constructor && peer.constructor.name === 'Peer') {
				this._channel = channel;
				this._name = peer.getName();
				this._peer = peer;
				this._roles = {};
				logger.debug('ChannelPeer.const - url: %s', peer.getUrl());
				if (roles && typeof roles === 'object') {
					this._roles = Object.assign(roles, this._roles);
				}
			} else {
				throw new Error('Missing Peer parameter');
			}
		} else {
			throw new Error('Missing Channel parameter');
		}
	}

	/**
	 * Close the associated peer service connections.
	 * <br>see {@link Peer#close}
	 * <br>see {@link ChannelEventHub#close}
	 */
	close() {
		this._peer.close();
		if (this._channel_event_hub) {
			this._channel_event_hub.close();
		}
	}


	/**
	 * Get the MSP ID.
	 *
	 * @returns {string} The mspId.
	 */
	getMspid() {
		return this._mspid;
	}

	/**
	 * Get the name. This is a client-side only identifier for this
	 * object.
	 *
	 * @returns {string} The name of the object
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the URL of this object.
	 *
	 * @returns {string} Get the URL associated with the peer object.
	 */
	getUrl() {
		return this._peer.getUrl();
	}

	/**
	 * Set a role for this peer.
	 *
	 * @param {string} role - The name of the role
	 * @param {boolean} isIn - The boolean value of does this peer have this role
	 */
	setRole(role, isIn) {
		this._roles[role] = isIn;
	}

	/**
	 * Checks if this peer is in the specified role.
	 * The default is true when the incoming role is not defined.
	 * The default will be true when this peer does not have the role defined.
	 *
	 * @returns {boolean} If this peer has this role.
	 */
	isInRole(role) {
		if (!role) {
			throw new Error('Missing "role" parameter');
		} else if (typeof this._roles[role] === 'undefined') {
			return true;
		} else {
			return this._roles[role];
		}
	}

	/**
	 * Checks if this peer is in the specified organization.
	 * The default is true when the incoming organization name is not defined.
	 * The default will be true when this peer does not have the organization name defined.
	 *
	 * @param {string} mspid - The mspid of the organnization
	 * @returns {boolean} If this peer belongs to the organization.
	 */
	isInOrg(mspid) {
		if (!mspid || !this._mspid) {
			return true;
		} else {
			return mspid === this._mspid;
		}
	}

	/**
	 * Get the channel event hub for this channel peer. The ChannelEventHub instance will
	 * be assigned when using the {@link Channel} newChannelEventHub() method. When using
	 * a common connection profile, the ChannelEventHub will be automatically assigned
	 * on the Channel Peers as they are created and added to the channel.
	 *
	 * @return {ChannelEventHub} - The ChannelEventHub instance associated with this {@link Peer} instance.
	 */
	getChannelEventHub() {
		if (!this._channel_event_hub) {
			this._channel_event_hub = new ChannelEventHub(this._channel, this._peer);
		}

		return this._channel_event_hub;
	}

	/**
	 * Get the Peer instance this ChannelPeer represents on the channel.
	 *
	 * @returns {Peer} The associated Peer instance.
	 */
	getPeer() {
		return this._peer;
	}

	/**
	 * Wrapper method for the associated peer so this object may be used as a {@link Peer}
	 * {@link Peer#sendProposal}
	 */
	sendProposal(proposal, timeout) {
		return this._peer.sendProposal(proposal, timeout);
	}

	/**
	 * Wrapper method for the associated peer so this object may be used as a {@link Peer}
	 * {@link Peer#sendDiscovery}
	 */
	sendDiscovery(request, timeout) {
		return this._peer.sendDiscovery(request, timeout);
	}

	toString() {
		return this._peer.toString();
	}
}; //endof ChannelPeer

/*
 * utility method to load in a config policy
 * @see /protos/common/configtx.proto
 */
function loadConfigPolicy(config_items, versions, config_policy, group_name, org) {
	logger.debug('loadConfigPolicy - %s - policy name: %s', group_name, config_policy.key);
	logger.debug('loadConfigPolicy - %s - version: %s', group_name, config_policy.value.version);
	logger.debug('loadConfigPolicy - %s - mod_policy: %s', group_name, config_policy.value.mod_policy);

	versions.version = config_policy.value.version;
	loadPolicy(config_items, versions, config_policy.key, config_policy.value.policy, group_name, org);
}

function loadPolicy(config_items, versions, key, policy, group_name) {
	try {
		if (policy.type === _policiesProto.Policy.PolicyType.SIGNATURE) {
			const signature_policy = _policiesProto.SignaturePolicyEnvelope.decode(policy.policy);
			logger.debug('loadPolicy - %s - policy SIGNATURE :: %s %s', group_name, signature_policy.encodeJSON(), decodeSignaturePolicy(signature_policy.getIdentities()));
		} else if (policy.type === _policiesProto.Policy.PolicyType.IMPLICIT_META) {
			const implicit_policy = _policiesProto.ImplicitMetaPolicy.decode(policy.value);
			const rule = ImplicitMetaPolicy_Rule[implicit_policy.getRule()];
			logger.debug('loadPolicy - %s - policy IMPLICIT_META :: %s %s', group_name, rule, implicit_policy.getSubPolicy());
		} else {
			logger.error('loadPolicy - Unknown policy type :: %s', policy.type);
			throw new Error('Unknown Policy type ::' + policy.type);
		}
	}
	catch (err) {
		logger.debug('loadPolicy - %s - name: %s - unable to parse policy %s', group_name, key, err);
	}
}

function decodeSignaturePolicy(identities) {
	const results = [];
	for (const i in identities) {
		const identity = identities[i];
		switch (identity.getPrincipalClassification()) {
		case _mspPrincipalProto.MSPPrincipal.Classification.ROLE:
			results.push(_mspPrincipalProto.MSPRole.decode(identity.getPrincipal()).encodeJSON());
		}
	}
	return results;
}

function decodeCollectionsConfig(payload) {
	const configs = [];
	const queryResponse = _collectionProto.CollectionConfigPackage.decode(payload);
	queryResponse.config.forEach((config) => {
		let collectionConfig = {
			type: config.payload,
		};
		if (config.payload === 'static_collection_config') {
			const { static_collection_config } = config;
			const { signature_policy } = static_collection_config.member_orgs_policy;
			const identities = decodeSignaturePolicy(signature_policy.identities);

			// delete member_orgs_policy, and use policy to keep consistency with the format in collections-config.json
			delete static_collection_config.member_orgs_policy;
			static_collection_config.policy = {
				identities: identities.map(i => JSON.parse(i)),
				policy: signature_policy.rule.n_out_of,
			};

			static_collection_config.block_to_live = static_collection_config.block_to_live.toInt();
			collectionConfig = Object.assign(collectionConfig, static_collection_config);
		} else {
			throw new Error(`Do not support collections config of type "${config.payload}"`);
		}
		configs.push(collectionConfig);
	});
	return configs;
}

module.exports = Channel;
