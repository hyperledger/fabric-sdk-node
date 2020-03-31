/**
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

const fabprotos = require('fabric-protos');

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
			if (discoverer.connected || discoverer.isConnectable()) {
				logger.debug('%s - target is or could be connected %s', method, discoverer.name);
			} else {
				throw Error(`Discoverer ${discoverer.name} is not connected`);
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
	 *  This will get the discovery interest (chaincode names and collections)
	 *  from the endorsement instance. Use the {@link Proposal#addCollectionInterest}
	 *  to add collections to the endorsement's chaincode. Use the
	 *  {@link Proposal#addChaincodeCollectionsInterest} to add chaincodes
	 *  and collections that will be called by the endorsement's chaincode.
	 * @property {DiscoveryChaincode} [interest] - Optional. An
	 *  array of {@link DiscoveryChaincodeInterest} that have chaincodes
	 *  and collections to calculate the endorsement plans.
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
	 *     { name: "mychaincode", collection_names: ["mycollection"] }
	 *  ]
	 * @example <caption>"chaincode to chaincode with a collection"</caption>
	 *  [
	 *     { name: "mychaincode", collection_names: ["mycollection"] },
	 *     { name: "myotherchaincode", collection_names: ["mycollection"] }}
	 *  ]
	 * @example <caption>"chaincode to chaincode with collections"</caption>
	 *  [
	 *     { name: "mychaincode", collection_names: ["mycollection", "myothercollection"] },
	 *     { name: "myotherchaincode", collection_names: ["mycollection", "myothercollection"] }}
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
	 * @property {string[]} [collection_names] - The names of the related collections
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

		const discovery_request = new fabprotos.discovery.Request();
		const authentication = new fabprotos.discovery.AuthInfo();
		authentication.setClientIdentity(idContext.serializeIdentity());
		const cert_hash = this.client.getClientCertHash();
		authentication.setClientTlsCertHash(cert_hash);
		discovery_request.setAuthentication(authentication);

		// be sure to add all entries to this array before setting into the grpc object
		const queries = [];

		if (config) {
			let query = new fabprotos.discovery.Query();
			queries.push(query);
			query.setChannel(this.channel.name);

			const config_query = new fabprotos.discovery.ConfigQuery();
			query.setConfigQuery(config_query);
			logger.debug(`${method} - adding config query`);

			query = new fabprotos.discovery.Query();
			queries.push(query);
			query.setChannel(this.channel.name);

			const peer_query = new fabprotos.discovery.PeerMembershipQuery();
			query.setPeerQuery(peer_query);
			logger.debug(`${method} - adding peer membership query`);
		}

		if (local) {
			const query = new fabprotos.discovery.Query();
			const local_peers = new fabprotos.discovery.LocalPeerQuery();
			query.setLocalPeers(local_peers);
			logger.debug(`${method} - adding local peers query`);
			queries.push(query);
		}

		// add a chaincode query to get endorsement plans
		if (endorsement) {
			const query = new fabprotos.discovery.Query();
			query.setChannel(this.channel.name);

			const _interests = [];
			const proposal_interest = endorsement.buildProposalInterest();
			const proto_interest = this._buildProtoChaincodeInterest(proposal_interest);
			_interests.push(proto_interest);

			const cc_query = new fabprotos.discovery.ChaincodeQuery();
			cc_query.setInterests(_interests);
			query.setCcQuery(cc_query);
			logger.debug(`${method} - adding proposal chaincodes/collections query`);
			queries.push(query);
		} else if (interest) {
			const query = new fabprotos.discovery.Query();
			query.setChannel(this.channel.name);

			const _interests = [];
			const proto_interest = this._buildProtoChaincodeInterest(interest);
			_interests.push(proto_interest);

			const cc_query = new fabprotos.discovery.ChaincodeQuery();
			cc_query.setInterests(_interests);
			query.setCcQuery(cc_query);
			logger.debug('%s - adding interest chaincodes/collections query %j', method, interest);
			queries.push(query);
		}

		if (queries.length === 0) {
			throw Error('No discovery interest provided');
		} else {
			// be sure to set the array after completely building it
			discovery_request.setQueries(queries);
		}

		this._action.request = discovery_request;
		this._payload = discovery_request.toBuffer();

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
				response = await target.sendDiscovery(signedEnvelope, this.requestTimeout);
				this.currentTarget = target;
				break;
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
			let error_msg = null;
			logger.debug(`${method} - parse discovery response.results`);
			for (const index in response.results) {
				const result = response.results[index];
				if (result.result === 'error') {
					logger.error(`${method} - Channel:${this.channel.name} received discovery error:${result.error.content}`);
					error_msg = result.error.content;
					break;
				} else {
					logger.debug(`${method} - process result index:${index}`);
					if (result.config_result) {
						logger.debug(`${method} - process result - have config_result in ${index}`);
						const config = this._processConfig(result.config_result);
						this.discoveryResults.msps = config.msps;
						this.discoveryResults.orderers = await this._buildOrderers(config.orderers);
					}
					if (result.members) {
						logger.debug(`${method} - process result - have members in ${index}`);
						this.discoveryResults.peers_by_org = await this._processMembership(result.members);
					}
					if (result.cc_query_res) {
						logger.debug(`${method} - process result - have cc_query_res in ${index}`);
						this.discoveryResults.endorsement_plan = await this._processChaincode(result.cc_query_res);
					}
					logger.debug(`${method} - completed processing result ${index}`);
				}
			}

			if (error_msg) {
				throw Error(`DiscoveryService: ${this.name} error: ${error_msg}`);
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
		if (!this.discoveryResults) {
			throw Error('No discovery results found');
		}
		if (refresh && (new Date()).getTime() - this.discoveryResults.timestamp > this.refreshAge) {
			await this.send({asLocalhost: this.asLocalhost, requestTimeout: this.requestTimeout, targets: this.targets});
		} else {
			logger.debug(`${method} - not refreshing`);
		}
		return this.discoveryResults;
	}


	/* internal method
	 *  Takes an array of {@link DiscoveryChaincodeCall} that represent the
	 *  chaincodes and associated collections to build an interest.
	 *  The interest becomes part of the query object needed by the discovery
	 *  service to calculate the endorsement plan for an invocation.
	 */
	_buildProtoChaincodeInterest(interest = []) {
		logger.debug(`_buildProtoChaincodeInterest[${this.name}] - start`);
		const chaincode_calls = [];
		for (const chaincode of interest) {
			const chaincode_call = new fabprotos.discovery.ChaincodeCall();
			if (typeof chaincode.name === 'string') {
				chaincode_call.setName(chaincode.name);
				if (chaincode.collection_names) {
					_getCollectionNames(chaincode.collection_names, chaincode_call);
				} else if (chaincode.collectionNames) {
					_getCollectionNames(chaincode.collectionNames, chaincode_call);
				}
				chaincode_calls.push(chaincode_call);
			} else {
				throw Error('Chaincode name must be a string');
			}
		}
		const interest_proto = new fabprotos.discovery.ChaincodeInterest();
		interest_proto.setChaincodes(chaincode_calls);

		return interest_proto;
	}

	// -- process the ChaincodeQueryResult - discovery.QueryResult.ChaincodeQueryResult
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
						organizational_unit_identifiers: q_msp.organizational_unit_identifiers,
						root_certs: byteToNormalizedPEM(q_msp.root_certs),
						intermediate_certs: byteToNormalizedPEM(q_msp.intermediate_certs),
						admins: byteToNormalizedPEM(q_msp.admins),
						tls_root_certs: byteToNormalizedPEM(q_msp.tls_root_certs),
						tls_intermediate_certs: byteToNormalizedPEM(q_msp.tls_intermediate_certs)
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
		const peers_by_org = {};
		if (q_members.peers_by_org) {
			for (const mspid in q_members.peers_by_org) {
				logger.debug(`${method} - found org:${mspid}`);
				peers_by_org[mspid] = {};
				peers_by_org[mspid].peers = await this._processPeers(q_members.peers_by_org[mspid].peers);
			}
		} else {
			logger.debug(`${method} - missing peers by org`);
		}
		return peers_by_org;
	}

	// message Peers
	async _processPeers(q_peers) {
		const method = `_processPeers[${this.name}]`;
		const peers = [];
		// message Peer
		for (const q_peer of q_peers) {
			const peer = {};
			// IDENTITY
			const q_identity = fabprotos.msp.SerializedIdentity.decode(q_peer.identity);
			peer.mspid = q_identity.mspid;

			// MEMBERSHIP - Peer.membership_info
			// gossip.Envelope.payload
			const q_membership_message = fabprotos.gossip.GossipMessage.decode(q_peer.membership_info.payload);
			peer.endpoint = q_membership_message.alive_msg.membership.endpoint;
			peer.name = q_membership_message.alive_msg.membership.endpoint;
			logger.debug(`${method} - peer :${peer.endpoint}`);

			// STATE
			if (q_peer.state_info) {
				const message_s = fabprotos.gossip.GossipMessage.decode(q_peer.state_info.payload);
				peer.ledger_height = Long.fromValue(message_s.state_info.properties.ledger_height);
				logger.debug(`${method} - ledger_height :${peer.ledger_height}`);
				peer.chaincodes = [];
				for (const index in message_s.state_info.properties.chaincodes) {
					const q_chaincode = message_s.state_info.properties.chaincodes[index];
					const chaincode = {};
					chaincode.name = q_chaincode.getName();
					chaincode.version = q_chaincode.getVersion();
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

		const address = `${host}:${port}`;
		const found = this.channel.getCommitter(address);
		if (found) {
			logger.debug('%s - orderer is already added to the channel - %s', method, address);
			return found.name;
		}

		const url = this._buildUrl(host, port);
		logger.debug(`${method} - create a new orderer ${url}`);
		const orderer = this.client.newCommitter(address, msp_id);
		const end_point = this.client.newEndpoint(this._buildOptions(address, url, host, msp_id));
		try {
			await orderer.connect(end_point);
			this.channel.addCommitter(orderer);
		} catch (error) {
			logger.error(`${method} - Unable to connect to the discovered orderer ${address} due to ${error}`);
		}

		return address;
	}

	async _buildPeer(discovery_peer) {
		const method = `_buildPeer[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!discovery_peer) {
			throw Error('Missing discovery_peer parameter');
		}
		const address = discovery_peer.endpoint;
		const msp_id = discovery_peer.mspid;

		const found = this.channel.getEndorser(address); // address is used as name
		if (found) {
			logger.debug(`${method} - endorser is already added to the channel - ${address}`);
			return found;
		}
		logger.debug(`${method} - did not find endorser ${address}`);
		const host_port = address.split(':');
		const url = this._buildUrl(host_port[0], host_port[1]);
		logger.debug(`${method} - create a new endorser ${url}`);
		const peer = this.client.newEndorser(address, msp_id);
		const end_point = this.client.newEndpoint(this._buildOptions(address, url, host_port[0], msp_id));
		try {
			logger.debug(`${method} - about to connect to endorser ${address} url:${url}`);
			await peer.connect(end_point);
			this.channel.addEndorser(peer);
			logger.debug(`${method} - connected to peer ${address} url:${url}`);
		} catch (error) {
			logger.error(`${method} - Unable to connect to the discovered peer ${address} due to ${error}`);
		}

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
		let msp;
		if (this.discoveryResults && this.discoveryResults.msps) {
			msp = this.discoveryResults.msps[msp_id];
		} else {
			logger.error('Missing MSPs discovery results');
			return ca_roots;
		}
		if (msp) {
			logger.debug(`Found msp ${msp_id}`);
		} else {
			logger.error(`Missing msp ${msp_id} in discovery results`);
			return ca_roots;
		}
		if (msp.tls_root_certs) {
			ca_roots = ca_roots + msp.tls_root_certs;
		} else {
			logger.debug('%s - no tls root certs', method);
		}
		if (msp.tls_intermediate_certs) {
			ca_roots = ca_roots + msp.tls_intermediate_certs;
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

function _getCollectionNames(names, chaincode_call) {
	if (Array.isArray(names)) {
		const collection_names = [];
		names.map(name => {
			if (typeof name === 'string') {
				collection_names.push(name);
			} else {
				throw Error('The collection name must be a string');
			}
		});
		chaincode_call.setCollectionNames(collection_names);
	} else {
		throw Error('Collection names must be an array of strings');
	}
}

module.exports = DiscoveryService;
