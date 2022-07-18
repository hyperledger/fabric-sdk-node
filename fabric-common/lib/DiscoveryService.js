/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'DiscoveryService';

const {checkParameter, getLogger} = require('./Utils.js');
const ServiceAction = require('./ServiceAction.js');
const DiscoveryHandler = require('./DiscoveryHandler.js');

const logger = getLogger(TYPE);

const fabproto6 = require('fabric-protos');
const {SYSTEMCHAINCODES} = require('./Endorser.js');
const DiscoveryResultsProcessor = require('./DiscoveryResultsProcessor.js');

/**
 * The DiscoveryService class represents a peer in the target fabric network that
 * is providing the discovery service for the channel.
 *
 * @class
 * @extends ServiceAction
 */
class DiscoveryService extends ServiceAction {

	/**
	 * Construct a DiscoveryService object with the name.
	 * Use the connect method with options to establish a
	 * connection with the fabric network endpoint.
	 *
	 * @param {string} name - The name of this discovery peer
	 * @param {Client} client - The client instance
	 * @param {Channel} channel
	 * @returns {DiscoveryService} The DiscoveryService instance.
	 */
	constructor(name = checkParameter('name'), channel = checkParameter('channel')) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name);
		this.channel = channel;
		this.client = channel.client;
		this.type = TYPE;
		this.refreshAge = 5 * 60 * 1000; // 5 minutes default
		this.refreshRunning = false;

		this.discoveryResults = null;
		this.asLocalhost = false;

		this.currentTarget = null;
		this.targets = null; // will be used when targets are not provided

	}

	/**
	 * Use this method to set the ServiceEndpoint for this ServiceAction class
	 * The {@link Discoverer} a ServiceEndpoint must be connected before making
	 * this assignment.
	 * @property {Discoverer[]} targets - The connected Discoverer instances to
	 *  be used when no targets are provided on the send.
	 */
	setTargets(targets = checkParameter('targets')) {
		const method = `setTargets[${this.name}]`;
		logger.debug('%s - start', method);

		if (!Array.isArray(targets)) {
			throw Error('targets parameter is not an array');
		}

		if (targets.length < 1) {
			throw Error('No targets provided');
		}

		for (const discoverer of targets) {
			if (discoverer.isConnectable()) {
				logger.debug('%s - target is connectable%s', method, discoverer.name);
			} else {
				throw Error(`Discoverer ${discoverer.name} is not connectable`);
			}
		}
		// must be all targets are connected
		this.targets = targets;

		return this;
	}

	/**
	 * Use this method to get a new handler that will use this
	 * instance of the DiscoveryService service.
	 *
	 * @returns {DiscoveryHandler} Discovery handler
	 */
	newHandler() {
		const method = `newHandler[${this.name}]`;
		logger.debug(`${method} - start`);

		return new DiscoveryHandler(this);
	}

	/**
	 * @typedef {Object} BuildDiscoveryRequest - This Discovery request
	 *  is a GRPC object to be signed and sent to the Discovery service
	 *  of the Peer. The request will be based on either the proposal
	 *  or the interests parameters. This request must be signed before
	 *  sending to the peer.
	 * @property {Endorsement} [endorsement] - Optional. Include the endorsement
	 *  instance to build the discovery request based on the proposal.
	 *  This will get the discovery interest (chaincode names, collections and "no private reads")
	 *  from the endorsement instance. Use the {@link Proposal#addCollectionInterest}
	 *  to add collections to the endorsement's chaincode.
	 *  Use the {@link Proposal#setNoPrivateReads} to set the proposals "no private reads"
	 *  setting of the discovery interest.
	 *  Use the {@link Proposal#addCollectionInterest} to add chaincodes,
	 *  collections, and no private reads that will be used to get an endorsement plan
	 *  from the peer's discovery service.
	 * @property {DiscoveryChaincode} [interest] - Optional. An
	 *  array of {@link DiscoveryChaincodeInterest} that have chaincodes, collections,
	 *  and "no private reads" to help the peer's discovery service calculate the
	 *  endorsement plan.
	 * @example <caption>"single chaincode"</caption>
	 *  [
	 *     { name: "mychaincode"}
	 *  ]
	 * @example <caption>"chaincode to chaincode"</caption>
	 *  [
	 *      { name: "mychaincode"}, { name: "myotherchaincode"}
	 *  ]
	 * @example <caption>"single chaincode with a collection"</caption>
	 *  [
	 *     { name: "mychaincode", collectionNames: ["mycollection"] }
	 *  ]
	 * @example <caption>"single chaincode with a collection allowing no private data reads"</caption>
	 *  [
	 *     { name: "mychaincode", collectionNames: ["mycollection"], noPrivateReads: true }
	 *  ]
	 * @example <caption>"chaincode to chaincode with a collection"</caption>
	 *  [
	 *     { name: "mychaincode", collectionNames: ["mycollection"] },
	 *     { name: "myotherchaincode", collectionNames: ["mycollection"] }}
	 *  ]
	 * @example <caption>"chaincode to chaincode with collections"</caption>
	 *  [
	 *     { name: "mychaincode", collectionNames: ["mycollection", "myothercollection"] },
	 *     { name: "myotherchaincode", collectionNames: ["mycollection", "myothercollection"] }}
	 *  ]
	 */

	/**
	 * @typedef {Object} DiscoveryChaincodesInterest
	 * @property {DiscoveryChaincodeCall[]} interest - An array of
	 *  {@link DiscoveryChaincodeCall} objects.
	 */

	/**
	 * @typedef {Object} DiscoveryChaincodeCall
	 * @property {string} name - The name of the chaincode
	 * @property {string[]} [collectionNames] - The names of the related collections
	 * @property {boolean} [noPrivateReads] - Indicates we do not need to read from private data
	 */

	/**
	 * Use this method to build a discovery request.
	 *
	 * @param {IdentityContext} idContext - Contains the {@link User} object
	 * needed to build this request.
	 * @param {BuildDiscoveryRequest} request - The discovery settings of the request.
	 */
	build(idContext = checkParameter('idContext'), request = {}) {
		const method = `build[${this.name}]`;
		logger.debug(`${method} - start`);

		// always get the config, we need the MSPs, do not need local
		const {config = true, local = false, interest, endorsement} = request;
		this._reset();

		const authentication = fabproto6.discovery.AuthInfo.create({
			client_identity: idContext.serializeIdentity(),
			client_tls_cert_hash: this.client.getClientCertHash(),
		});

		let fullproposalInterest = null;

		if (endorsement) {
			fullproposalInterest = endorsement.buildProposalInterest();
			logger.debug('%s - endorsement built interest: %j', method, fullproposalInterest);
		} else if (interest) {
			fullproposalInterest = interest;
			logger.debug('%s - request interest: %j', method, fullproposalInterest);
		}

		// remove all legacy non endorsement policy system chaincodes
		let proposalInterest = null;
		if (fullproposalInterest) {
			proposalInterest = [];
			for (const fullinterest of fullproposalInterest) {
				if (SYSTEMCHAINCODES.includes(fullinterest.name)) {
					logger.debug('%s - not adding %s interest', method, fullinterest.name);
				} else {
					proposalInterest.push(fullinterest);
				}
			}
		}

		// be sure to add all entries to this array before setting into the grpc object
		const queries = [];

		if (config) {
			const configQuery = fabproto6.discovery.Query.create({
				channel: this.channel.name,
				config_query: fabproto6.discovery.ConfigQuery.create()
			});
			logger.debug(`${method} - adding config query`);
			queries.push(configQuery);

			const membershipQuery = fabproto6.discovery.Query.create({
				channel: this.channel.name,
				peer_query: fabproto6.discovery.PeerMembershipQuery.create()
			});
			logger.debug(`${method} - adding peer membership query`);
			queries.push(membershipQuery);
		}

		if (local) {
			const localQuery = fabproto6.discovery.Query.create({
				local_peers: fabproto6.discovery.LocalPeerQuery.create()
			});
			logger.debug(`${method} - adding local peers query`);
			queries.push(localQuery);
		}

		// add a discovery chaincode query to get endorsement plans
		if (proposalInterest && proposalInterest.length > 0) {
			const interests = [];
			const chaincodeInterest = this._buildProtoChaincodeInterest(proposalInterest);
			interests.push(chaincodeInterest);

			const ccQuery = fabproto6.discovery.ChaincodeQuery.create({
				interests: interests
			});

			const query = fabproto6.discovery.Query.create({
				channel: this.channel.name,
				cc_query: ccQuery
			});
			logger.debug('%s - adding chaincodes/collections query', method);
			queries.push(query);
		} else {
			logger.debug('%s - NOT adding chaincodes/collections query', method);
		}

		if (queries.length === 0) {
			throw Error('No discovery interest provided');
		}

		this._action.request = fabproto6.discovery.Request.create({
			queries: queries,
			authentication: authentication,

		});
		this._payload  = fabproto6.discovery.Request.encode(
			this._action.request
		).finish();

		logger.debug('%s - end', method);
		return this._payload;
	}

	/**
	 * @typedef {Object} DiscoverRequest
	 * @property {boolean} [asLocalhost] - Optional. When discovery is running in a
	 *  virtual environment, the host name of peers and orderers created by this
	 *  service may have to converted to localhost for connections to be established.
	 * @property {number} [requestTimeout] - Optional. The request timeout
	 * @property {number} [refreshAge] - Optional. The milliseconds before the
	 *  discovery results will be refreshed automatically. When the {@link Discovery#getDiscoveryResults}
	 *  is called with refresh = true and the age of the discovery results
	 *  is older then 'refreshAge' the current signed request will be sent
	 *  to the peer's discovery service.
	 *  Default: 5 minutes.
	 * @property {Discoverer[]} targets - Optional. An array of {@link Discoverer}
	 *  instances. When not included the assigned discoverer will be used. The
	 *  discoverer may be assigned anytime before the {@link DiscoveryService#send} is called.
	 */

	/**
	 * Send a signed transaction proposal to peer(s)
	 *
	 * @param {DiscoverRequest} request
	 * @returns {DiscoveryResults}
	 */
	async send(request = {}) {
		const method = `send[${this.name}]`;
		logger.debug(`${method} - start`);

		const {requestTimeout, asLocalhost, refreshAge, targets} = request;

		if (typeof asLocalhost === 'boolean') {
			this.asLocalhost = asLocalhost;
		}
		this.refreshAge = refreshAge;
		this.requestTimeout = requestTimeout;
		if (targets && Array.isArray(targets) && targets.length > 0)  {
			this.targets = targets;
		} else if (this.targets) {
			logger.debug('%s - using preassigned targets', method);
		} else {
			checkParameter('targets');
		}

		const signedEnvelope = this.getSignedEnvelope();

		let response;
		for (const target of this.targets) {
			logger.debug(`${method} - about to discover on ${target.endpoint.url}`);
			try {
				const isConnected = await target.checkConnection();
				if (isConnected) {
					response = await target.sendDiscovery(signedEnvelope, this.requestTimeout);
					this.currentTarget = target;
					break;
				}
			} catch (error) {
				response = error;
			}
		}

		if (response instanceof Error) {
			throw response;
		}

		// -----
		logger.debug(`${method} - processing discovery response`);
		if (!response || !response.results) {
			logger.error('%s - no discovery results', method);
			throw new Error('DiscoveryService has failed to return results');
		}

		logger.debug(`${method} - parse discovery response.results`);

		const processor = new DiscoveryResultsProcessor(this, response.results);
		const results = await processor.parseDiscoveryResults();
		results.timestamp = currentTimestamp();
		this.discoveryResults = results;
		return results;
	}

	/**
	 * Get the discovered results. The results are from the discovery service
	 * of the Peer and based on the discovery request of {@link DiscoveryService#BuildDiscoveryRequest}
	 * that was sent to the Peer with {@link Discover#discover}.
	 * @param {boolean} [refresh] - Optional. Refresh the discovery results if
	 *  results are older then the refresh age.
	 */
	async getDiscoveryResults(refresh) {
		const method = `getDiscoveryResults[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!this.discoveryResults) {
			throw Error('No discovery results found');
		}

		if (refresh && !this.refreshRunning && this._isRefreshRequired()) {
			logger.debug(`${method} - will refresh`);
			this.refreshRunning = true;
			try {
				await this.send({asLocalhost: this.asLocalhost, requestTimeout: this.requestTimeout, targets: this.targets});
			} finally {
				this.refreshRunning = false;
			}
		} else {
			logger.debug(`${method} - not refreshing`);
		}

		return this.discoveryResults;
	}

	_isRefreshRequired() {
		const resultsAge = currentTimestamp() - this.discoveryResults.timestamp;
		return resultsAge > this.refreshAge;
	}

	/**
	 * Indicates if this discovery service has retreived results
	 */
	hasDiscoveryResults() {
		const method = `hasDiscoveryResults[${this.name}]`;
		logger.debug(`${method} - start`);

		return !!this.discoveryResults;
	}

	_buildUrl(hostname = checkParameter('hostname'), port = checkParameter('port')) {
		const method = `_buildUrl[${this.name}]`;
		logger.debug(`${method} - start`);

		let t_hostname = hostname;
		// endpoints may be running in containers on the local system
		if (this.asLocalhost) {
			t_hostname = 'localhost';
		}

		// If we connect to a discovery peer over TLS, any endpoints returned by
		// discovery should also use TLS.
		let protocol = null;
		let isTLS = true;
		if (this.currentTarget) {
			isTLS = this.currentTarget.endpoint.isTLS();
		}
		protocol = isTLS ? 'grpcs' : 'grpc';
		// but if not, use the following to override
		const overrideProtocol = this.client.getConfigSetting('discovery-override-protocol');
		if (overrideProtocol) {
			protocol = overrideProtocol;
		}

		return `${protocol}://${t_hostname}:${port}`;
	}

	/* internal method
	 *  Takes an array of {@link DiscoveryChaincodeCall} that represent the
	 *  chaincodes and associated collections to build an interest.
	 *  The interest becomes part of the query object needed by the discovery
	 *  service to calculate the endorsement plan for an invocation.
	 */
	_buildProtoChaincodeInterest(interest = []) {
		logger.debug(`_buildProtoChaincodeInterest[${this.name}] - start`);
		const chaincodeCalls = [];
		for (const chaincode of interest) {
			const chaincodeCall = fabproto6.discovery.ChaincodeCall.create();
			if (typeof chaincode.name === 'string') {
				chaincodeCall.name = chaincode.name;
				if (chaincode.noPrivateReads) {
					chaincodeCall.no_private_reads = chaincode.noPrivateReads;
				}
				// support both names
				if (chaincode.collection_names) {
					_getCollectionNames(chaincode.collection_names, chaincodeCall);
				} else if (chaincode.collectionNames) {
					_getCollectionNames(chaincode.collectionNames, chaincodeCall);
				}
				chaincodeCalls.push(chaincodeCall);
			} else {
				throw Error('Chaincode name must be a string');
			}
		}
		const chaincodeInterest = fabproto6.discovery.ChaincodeInterest.create({
			chaincodes: chaincodeCalls
		});

		return chaincodeInterest;
	}

	/**
	 * Close the connection of the discovery service.
	 */
	close() {
		const method = `close[${this.name}]`;
		logger.debug(`${method} - start`);

		if (this.targets) {
			for (const target of this.targets) {
				target.disconnect();
			}
		}
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return `DiscoveryService: {name: ${this.name}, channel: ${this.channel.name}}`;
	}
}

function _getCollectionNames(names, chaincodeCall) {
	if (Array.isArray(names)) {
		const collection_names = [];
		names.map(name => {
			if (typeof name === 'string') {
				collection_names.push(name);
			} else {
				throw Error('The collection name must be a string');
			}
		});
		// this collection_names must be in snake case as it will
		// be used by the gRPC create message
		chaincodeCall.collection_names = collection_names;
	} else {
		throw Error('Collection names must be an array of strings');
	}
}

function currentTimestamp() {
	return new Date().getTime();
}

module.exports = DiscoveryService;
