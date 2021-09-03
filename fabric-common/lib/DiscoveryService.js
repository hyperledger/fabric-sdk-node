/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'DiscoveryService';
const Long = require('long');

const {byteToNormalizedPEM, checkParameter, getLogger} = require('./Utils.js');
const ServiceAction = require('./ServiceAction.js');
const DiscoveryHandler = require('./DiscoveryHandler.js');

const logger = getLogger(TYPE);

const fabproto6 = require('fabric-protos');
const {SYSTEMCHAINCODES} = require('./Endorser.js');

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
		this.discoveryResults = {};
		logger.debug(`${method} - processing discovery response`);
		if (response && response.results) {
			let errorMsg = null;
			logger.debug(`${method} - parse discovery response.results`);
			for (const index in response.results) {
				const result = response.results[index];
				if (result.result === 'error') {
					logger.error(`${method} - Channel:${this.channel.name} received discovery error:${result.error.content}`);
					errorMsg = result.error.content;
					break;
				} else {
					logger.debug(`${method} - process result index:${index}`);
					if (result.config_result) {
						logger.debug(`${method} - process result - have configResult in ${index}`);
						const config = this._processConfig(result.config_result);
						this.discoveryResults.msps = config.msps;
						this.discoveryResults.orderers = await this._buildOrderers(config.orderers);
					}
					if (result.members) {
						logger.debug(`${method} - process result - have members in ${index}`);
						this.discoveryResults.peers_by_org = await this._processMembership(result.members);
					}
					if (result.cc_query_res) {
						logger.debug(`${method} - process result - have ccQueryRes in ${index}`);
						this.discoveryResults.endorsement_plan = await this._processChaincode(result.cc_query_res);
					}
					logger.debug(`${method} - completed processing result ${index}`);
				}
			}

			if (errorMsg) {
				throw Error(`DiscoveryService: ${this.name} error: ${errorMsg}`);
			} else {
				this.discoveryResults.timestamp = (new Date()).getTime();
				return this.discoveryResults;
			}
		} else {
			logger.error('%s - no discovery results', method);
			throw new Error('DiscoveryService has failed to return results');
		}
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
		if (!this.discoveryResults && !this.savedResults) {
			throw Error('No discovery results found');
		}
		// when savedResults exist, then a refresh is running
		if (this.savedResults) {
			logger.debug(`${method} - using the saved results`);
			return this.savedResults;
		}

		if (refresh && (new Date()).getTime() - this.discoveryResults.timestamp > this.refreshAge) {
			logger.debug(`${method} - will refresh`);
			this.savedResults = this.discoveryResults;
			await this.send({asLocalhost: this.asLocalhost, requestTimeout: this.requestTimeout, targets: this.targets});
			this.savedResults = null;
		} else {
			logger.debug(`${method} - not refreshing`);
		}
		return this.discoveryResults;
	}

	/**
	 * Indicates if this discovery service has retreived results
	 */
	hasDiscoveryResults() {
		const method = `hasDiscoveryResults[${this.name}]`;
		logger.debug(`${method} - start`);

		if (this.discoveryResults) {
			return true;
		}

		return false;
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

	// -- process the ChaincodeQueryResult - fabproto6.discovery.QueryResult.ChaincodeQueryResult
	async _processChaincode(q_chaincodes) {
		const method = '_processChaincode';
		logger.debug(`${method} - start`);
		const endorsement_plan = {};
		// repeated EndorsementDescriptor content, but we should only have one
		if (q_chaincodes && q_chaincodes.content && Array.isArray(q_chaincodes.content)) {
			for (const q_endors_desc of q_chaincodes.content) {
				endorsement_plan.chaincode = q_endors_desc.chaincode;

				// named groups of Peers
				endorsement_plan.groups = {};
				for (const group_name in q_endors_desc.endorsers_by_groups) {
					logger.debug(`${method} - found group: ${group_name}`);
					const group = {};
					group.peers = await this._processPeers(q_endors_desc.endorsers_by_groups[group_name].peers);
					// all done with this group
					endorsement_plan.groups[group_name] = group;
				}

				// LAYOUTS
				endorsement_plan.layouts = [];
				for (const q_layout of q_endors_desc.layouts) {
					const layout = Object.assign({}, q_layout.quantities_by_group);
					logger.debug(`${method} - layout :${layout}`);
					endorsement_plan.layouts.push(layout);
				}
			}
		} else {
			throw Error('Plan layouts are invalid');
		}

		return endorsement_plan;
	}

	_processConfig(q_config) {
		const method = `_processConfig[${this.name}]`;
		logger.debug(`${method} - start`);
		const config = {};
		config.msps = {};
		config.orderers = {};

		try {
			if (q_config.msps) {
				for (const id in q_config.msps) {
					logger.debug(`${method} - found organization ${id}`);
					const q_msp = q_config.msps[id];
					const msp_config = {
						id: id,
						name: id,
						organizationalUnitIdentifiers: q_msp.organizational_unit_identifiers,
						rootCerts: byteToNormalizedPEM(q_msp.root_certs),
						intermediateCerts: byteToNormalizedPEM(q_msp.intermediate_certs),
						admins: byteToNormalizedPEM(q_msp.admins),
						tlsRootCerts: byteToNormalizedPEM(q_msp.tls_root_certs),
						tlsIntermediateCerts: byteToNormalizedPEM(q_msp.tls_intermediate_certs)
					};
					config.msps[id] = msp_config;
					this.channel.addMsp(msp_config, true);
				}
			} else {
				logger.debug(`${method} - no msps found`);
			}
			/*
			"orderers":{"OrdererMSP":{"endpoint":[{"host":"orderer.example.com","port":7050}]}}}
			*/
			if (q_config.orderers) {
				for (const mspid in q_config.orderers) {
					logger.debug(`${method} - found orderer org: ${mspid}`);
					config.orderers[mspid] = {};
					config.orderers[mspid].endpoints = [];
					for (const endpoint of q_config.orderers[mspid].endpoint) {
						config.orderers[mspid].endpoints.push(endpoint);
					}
				}
			} else {
				logger.debug(`${method} - no orderers found`);
			}
		} catch (err) {
			logger.error(`${method} - Problem with discovery config: ${err}`);
		}

		return config;
	}

	async _processMembership(q_members) {
		const method = `_processMembership[${this.name}]`;
		logger.debug(`${method} - start`);
		const peersByOrg = {};
		if (q_members.peers_by_org) {
			for (const mspid in q_members.peers_by_org) {
				logger.debug(`${method} - found org:${mspid}`);
				peersByOrg[mspid] = {};
				peersByOrg[mspid].peers = await this._processPeers(q_members.peers_by_org[mspid].peers);
			}
		} else {
			logger.debug(`${method} - missing peers by org`);
		}
		return peersByOrg;
	}

	// message Peers
	async _processPeers(q_peers) {
		const method = `_processPeers[${this.name}]`;
		const peers = [];
		// message Peer
		for (const q_peer of q_peers) {
			const peer = {};
			// IDENTITY
			const q_identity = fabproto6.msp.SerializedIdentity.decode(q_peer.identity);
			peer.mspid = q_identity.mspid;

			// MEMBERSHIP - Peer.membership_info
			// fabproto6.gossip.Envelope.payload
			const q_membership_message = fabproto6.gossip.GossipMessage.decode(q_peer.membership_info.payload);
			peer.endpoint = q_membership_message.alive_msg.membership.endpoint;
			peer.name = q_membership_message.alive_msg.membership.endpoint;
			logger.debug(`${method} - peer :${peer.endpoint}`);

			// STATE
			if (q_peer.state_info) {
				const message_s = fabproto6.gossip.GossipMessage.decode(q_peer.state_info.payload);
				peer.ledgerHeight = Long.fromValue(message_s.state_info.properties.ledger_height);
				logger.debug(`${method} - ledgerHeight :${peer.ledgerHeight}`);
				peer.chaincodes = [];
				for (const index in message_s.state_info.properties.chaincodes) {
					const q_chaincode = message_s.state_info.properties.chaincodes[index];
					const chaincode = {};
					chaincode.name = q_chaincode.name;
					chaincode.version = q_chaincode.version;
					// TODO metadata ?
					logger.debug(`${method} - chaincode :${JSON.stringify(chaincode)}`);
					peer.chaincodes.push(chaincode);
				}
			} else {
				logger.debug(`${method} - no state info for peer ${peer.endpoint}`);
			}

			// all done with this peer
			peers.push(peer);
			// build the GRPC instance
			await this._buildPeer(peer);
		}

		return peers;
	}

	async _buildOrderers(orderers) {
		const method = `_buildOrderers[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!orderers) {
			logger.debug('%s - no orderers to build', method);
		} else {
			for (const msp_id in orderers) {
				logger.debug(`${method} - orderer msp:${msp_id}`);
				for (const endpoint of orderers[msp_id].endpoints) {
					endpoint.name = await this._buildOrderer(endpoint.host, endpoint.port, msp_id);
				}
			}
		}

		return orderers;
	}

	async _buildOrderer(host, port, msp_id) {
		const method = `_buildOrderer[${this.name}]`;
		logger.debug(`${method} - start mspid:${msp_id} endpoint:${host}:${port}`);

		const name = `${host}:${port}`;
		const url = this._buildUrl(host, port);
		logger.debug(`${method} - create a new orderer ${url}`);
		const orderer = this.client.newCommitter(name, msp_id);
		const end_point = this.client.newEndpoint(this._buildOptions(name, url, host, msp_id));
		try {
			// first check to see if orderer is already on this channel
			let same;
			const channelOrderers = this.channel.getCommitters();
			for (const channelOrderer of channelOrderers) {
				logger.debug('%s - checking %s', method, channelOrderer);
				if (channelOrderer.endpoint && channelOrderer.endpoint.url === url) {
					same = channelOrderer;
					break;
				}
			}
			if (!same) {
				await orderer.connect(end_point);
				this.channel.addCommitter(orderer);
			} else {
				await same.checkConnection();
				logger.debug('%s - orderer already added to this channel', method);
			}
		} catch (error) {
			logger.error(`${method} - Unable to connect to the discovered orderer ${name} due to ${error}`);
		}

		return name;
	}

	async _buildPeer(discovery_peer) {
		const method = `_buildPeer[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!discovery_peer) {
			throw Error('Missing discovery_peer parameter');
		}
		const address = discovery_peer.endpoint;
		const msp_id = discovery_peer.mspid;

		const host_port = address.split(':');
		const url = this._buildUrl(host_port[0], host_port[1]);

		// first check to see if peer is already on this channel
		let peer;
		const channelPeers = this.channel.getEndorsers();
		for (const channelPeer of channelPeers) {
			logger.debug('%s - checking channel peer %s', method, channelPeer.name);
			if (channelPeer.endpoint && channelPeer.endpoint.url === url) {
				logger.debug('%s - url: %s - already added to this channel', method, url);
				peer = channelPeer;
				break;
			}
		}
		if (!peer) {
			logger.debug(`${method} - create a new endorser ${url}`);
			peer = this.client.newEndorser(address, msp_id);
			const end_point = this.client.newEndpoint(this._buildOptions(address, url, host_port[0], msp_id));
			try {
				logger.debug(`${method} - about to connect to endorser ${address} url:${url}`);
				await peer.connect(end_point);
				this.channel.addEndorser(peer);
				logger.debug(`${method} - connected to peer ${address} url:${url}`);
			} catch (error) {
				logger.error(`${method} - Unable to connect to the discovered peer ${address} due to ${error}`);
			}
		} else {
			// make sure the existing connect is still good
			await peer.checkConnection();
		}

		// indicate that this peer has been touched by the discovery service
		peer.discovered = true;

		// make sure that this peer has all the found installed chaincodes
		if (discovery_peer.chaincodes) {
			for (const chaincode of discovery_peer.chaincodes) {
				logger.debug(`${method} - adding chaincode ${chaincode.name} to peer ${peer.name}`);
				peer.addChaincode(chaincode.name);
			}
		}

		logger.debug(`${method} - end`);
		return peer;
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

	_buildOptions(name, url, host, msp_id) {
		const method = `_buildOptions[${this.name}]`;
		logger.debug(`${method} - start`);
		const caroots = this._buildTlsRootCerts(msp_id);
		return {
			url: url,
			pem: caroots,
			'ssl-target-name-override': host,
			name: name
		};
	}

	_buildTlsRootCerts(msp_id = checkParameter('msp_id')) {
		const method = `_buildTlsRootCerts[${this.name}]`;
		logger.debug(`${method} - start`);
		let ca_roots = '';
		let mspDiscovered;
		if (this.discoveryResults && this.discoveryResults.msps) {
			mspDiscovered = this.discoveryResults.msps[msp_id];
		} else {
			logger.error('Missing MSPs discovery results');
			return ca_roots;
		}
		if (mspDiscovered) {
			logger.debug(`Found msp ${msp_id}`);
		} else {
			logger.error(`Missing msp ${msp_id} in discovery results`);
			return ca_roots;
		}
		if (mspDiscovered.tlsRootCerts) {
			ca_roots = ca_roots + mspDiscovered.tlsRootCerts;
		} else {
			logger.debug('%s - no tls root certs', method);
		}
		if (mspDiscovered.tlsIntermediateCerts) {
			ca_roots = ca_roots + mspDiscovered.tlsIntermediateCerts;
		} else {
			logger.debug('%s - no tls intermediate certs', method);
		}

		return ca_roots;
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

module.exports = DiscoveryService;
