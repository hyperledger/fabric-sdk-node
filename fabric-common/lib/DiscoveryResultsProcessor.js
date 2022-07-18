/*
 * Copyright 2022 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'DiscoveryResultsProcessor';
const Long = require('long');

const {byteToNormalizedPEM, checkParameter, getLogger} = require('./Utils.js');

const logger = getLogger(TYPE);

const fabproto6 = require('fabric-protos');

class DiscoveryResultsProcessor {
	constructor(service, results) {
		this.service = service;
		this.results = results;
		this.parsedResults = {};
	}

	async parseDiscoveryResults() {
		const method = `parseDiscoveryResults[${this.service.name}]`;
		logger.debug(`${method} - start`);

		for (const index in this.results) {
			const result = this.results[index];
			if (result.result === 'error') {
				logger.error(`${method} - Channel:${this.service.channel.name} received discovery error:${result.error.content}`);
				throw Error(`DiscoveryService: ${this.service.name} error: ${result.error.content}`);
			}

			logger.debug(`${method} - process result index:${index}`);
			if (result.config_result) {
				logger.debug(`${method} - process result - have configResult in ${index}`);
				const config = this._processConfig(result.config_result);
				this.parsedResults.msps = config.msps;
				this.parsedResults.orderers = await this._buildOrderers(config.orderers);
			}
			if (result.members) {
				logger.debug(`${method} - process result - have members in ${index}`);
				this.parsedResults.peers_by_org = await this._processMembership(result.members);
			}
			if (result.cc_query_res) {
				logger.debug(`${method} - process result - have ccQueryRes in ${index}`);
				this.parsedResults.endorsement_plan = await this._processChaincode(result.cc_query_res);
			}
			logger.debug(`${method} - completed processing result ${index}`);
		}

		return this.parsedResults;
	}

	_processConfig(q_config) {
		const method = `_processConfig[${this.service.name}]`;
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
					this.service.channel.addMsp(msp_config, true);
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

	async _buildOrderers(orderers) {
		const method = `_buildOrderers[${this.service.name}]`;
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
		const method = `_buildOrderer[${this.service.name}]`;
		logger.debug(`${method} - start mspid:${msp_id} endpoint:${host}:${port}`);

		const name = `${host}:${port}`;
		const url = this.service._buildUrl(host, port);
		logger.debug(`${method} - create a new orderer ${url}`);
		const orderer = this.service.client.newCommitter(name, msp_id);
		const end_point = this.service.client.newEndpoint(this._buildOptions(name, url, host, msp_id));
		try {
			// first check to see if orderer is already on this channel
			let same;
			const channelOrderers = this.service.channel.getCommitters();
			for (const channelOrderer of channelOrderers) {
				logger.debug('%s - checking %s', method, channelOrderer);
				if (channelOrderer.endpoint && channelOrderer.endpoint.url === url) {
					same = channelOrderer;
					break;
				}
			}
			if (!same) {
				await orderer.connect(end_point);
				this.service.channel.addCommitter(orderer);
			} else {
				await same.checkConnection();
				logger.debug('%s - orderer already added to this channel', method);
			}
		} catch (error) {
			logger.error(`${method} - Unable to connect to the discovered orderer ${name} due to ${error}`);
		}

		return name;
	}

	_buildOptions(name, url, host, msp_id) {
		const method = `_buildOptions[${this.service.name}]`;
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
		const method = `_buildTlsRootCerts[${this.service.name}]`;
		logger.debug(`${method} - start`);
		let ca_roots = '';

		if (!this.parsedResults.msps) {
			logger.error('Missing MSPs discovery results');
			return ca_roots;
		}

		const mspDiscovered = this.parsedResults.msps[msp_id];
		if (!mspDiscovered) {
			logger.error(`Missing msp ${msp_id} in discovery results`);
			return ca_roots;
		}

		logger.debug(`Found msp ${msp_id}`);

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

	async _processMembership(q_members) {
		const method = `_processMembership[${this.service.name}]`;
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
		const method = `_processPeers[${this.service.name}]`;
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

	async _buildPeer(discovery_peer) {
		const method = `_buildPeer[${this.service.name}]`;
		logger.debug(`${method} - start`);

		if (!discovery_peer) {
			throw Error('Missing discovery_peer parameter');
		}
		const address = discovery_peer.endpoint;
		const msp_id = discovery_peer.mspid;

		const host_port = address.split(':');
		const url = this.service._buildUrl(host_port[0], host_port[1]);

		// first check to see if peer is already on this channel
		let peer;
		const channelPeers = this.service.channel.getEndorsers();
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
			peer = this.service.client.newEndorser(address, msp_id);
			const end_point = this.service.client.newEndpoint(this._buildOptions(address, url, host_port[0], msp_id));
			try {
				logger.debug(`${method} - about to connect to endorser ${address} url:${url}`);
				await peer.connect(end_point);
				this.service.channel.addEndorser(peer);
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
}

module.exports = DiscoveryResultsProcessor;
