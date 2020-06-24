/*
 Copyright 2019 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const TYPE = 'DiscoveryHandler';

const Long = require('long');
const settle = require('promise-settle');

const ServiceHandler = require('./ServiceHandler.js');
const {randomize, checkParameter, getLogger, getConfigSetting, convertToLong} = require('./Utils.js');

const logger = getLogger(TYPE);

const BLOCK_HEIGHT = 'ledgerHeight';
const RANDOM = 'random';

/**
 * This is an implementation for a handler.
 *
 * @class
 * @extends ServiceHandler
 */
class DiscoveryHandler extends ServiceHandler {

	/**
	 * constructor
	 *
	 * @param {DiscoveryService} discovery - The discovery service for this handler.
	 */
	constructor(discovery) {
		logger.debug('DiscoveryHandler.constructor - start');
		super();
		this.discovery = discovery;
		this.type = TYPE;
	}

	/**
	 * This will send transactions to all peers found by discovery.
	 * @param {*} signedProposal
	 * @param {Object} request - Include a 'mspid' when just peers from
	 *  an organization are required
	 */
	async query(signedProposal = checkParameter('signedProposal'), request = {}) {
		const method = 'query';
		logger.debug('%s - start', method);

		const {requestTimeout, mspid} = request;
		let results;

		let timeout = getConfigSetting('requestTimeout');
		if (requestTimeout) {
			timeout = requestTimeout;
		}

		// forces a refresh if needed
		await this.discovery.getDiscoveryResults(true);
		const responses = [];
		const endorsers = this.discovery.channel.getEndorsers(mspid);
		if (endorsers && endorsers.length > 0) {
			logger.debug('%s - found %s endorsers assigned to channel', method, endorsers.length);
			const promises = endorsers.map(async (endorser) => {
				return endorser.sendProposal(signedProposal, timeout);
			});
			results = await settle(promises);
			results.forEach((result) => {
				if (result.isFulfilled()) {
					logger.debug(`query - Promise is fulfilled: ${result.value()}`);
					responses.push(result.value());
				} else {
					logger.debug(`query - Promise is rejected: ${result.reason()}`);
					responses.push(result.reason());
				}
			});
		} else {
			throw new Error('No endorsers assigned to the channel');
		}

		return responses;
	}

	/**
	 * This will submit transactions to be committed to one committer at time from a provided
	 *  list or a list currently assigned to the channel.
	 * @param {*} signedProposal
	 * @param {Object} request
	 */
	async commit(signedEnvelope = checkParameter('signedEnvelope'), request = {}) {
		const method = 'commit';
		logger.debug('%s - start', method);

		const {requestTimeout, mspid} = request;

		let timeout = getConfigSetting('requestTimeout');
		if (requestTimeout) {
			timeout = requestTimeout;
		}

		// force a refresh if needed
		await this.discovery.getDiscoveryResults(true);

		const committers = this.discovery.channel.getCommitters(mspid);
		let return_error = null;
		if (committers && committers.length > 0) {
			logger.debug('%s - found %s committers assigned to channel', method, committers.length);
			randomize(committers);

			// loop through the committers trying to complete one successfully
			for (const committer of committers) {
				logger.debug('%s - sending to committer %s', method, committer.name);
				try {
					const results = await committer.sendBroadcast(signedEnvelope, timeout);
					if (results) {
						if (results.status === 'SUCCESS') {
							logger.debug('%s - Successfully sent transaction to the committer %s', method, committer.name);
							return results;
						} else {
							logger.debug('%s - Failed to send transaction successfully to the committer status:%s', method, results.status);
							return_error = new Error('Failed to send transaction successfully to the committer status:' + results.status);
						}
					} else {
						return_error = new Error('Failed to send transaction to the committer');
						logger.debug('%s - Failed to send transaction to the committer %s', method, committer.name);
					}
				} catch (error) {
					logger.debug('%s - Caught: %s', method, error.toString());
					return_error = error;
				}
			}

			logger.debug('%s - return error %s ', method, return_error.toString());
			throw return_error;
		} else {
			throw new Error('No committers assigned to the channel');
		}
	}

	/**
	 * This method will submit transactions to be endorsed to endorsers as
	 * determined by the endorser's discovery service
	 * @param {*} signedProposal
	 * @param {*} request
	 */
	async endorse(signedProposal = checkParameter('signedProposal'), request = {}) {
		const method = 'endorse';
		logger.debug('%s - start', method);

		let timeout = getConfigSetting('requestTimeout');
		if (request.requestTimeout) {
			timeout = request.requestTimeout;
		}

		const results = await this.discovery.getDiscoveryResults(true);

		if (results && results.endorsement_plan) {
			const working_discovery = JSON.parse(JSON.stringify(results.endorsement_plan));

			return this._endorse(working_discovery, request, signedProposal, timeout);
		} else {
			throw Error('No endorsement plan available');
		}
	}

	async _endorse(endorsement_plan = checkParameter('endorsement_plan'), request = {}, proposal = checkParameter('proposal'), timeout) {
		const method = '_endorse';
		logger.debug('%s - starting', method);

		endorsement_plan.endorsements = {};
		const results = {};
		results.endorsements = null; // will be from just one layout
		results.failed_endorsements = []; // from all failed layouts
		results.success = false;

		const required = this._create_map(request.required, 'endpoint');
		const preferred = this._create_map(request.preferred, 'endpoint');
		const ignored = this._create_map(request.ignored, 'endpoint');
		const required_orgs = this._create_map(request.requiredOrgs, 'mspid');
		const preferred_orgs = this._create_map(request.preferredOrgs, 'mspid');
		const ignored_orgs = this._create_map(request.ignoredOrgs, 'mspid');

		let preferred_height_gap = null;
		try {
			if (Number.isInteger(request.preferredHeightGap) || request.preferredHeightGap) {
				preferred_height_gap = convertToLong(request.preferredHeightGap, true);
			}
		} catch (error) {
			throw Error('preferred_height_gap setting is not a number');
		}

		let sort = BLOCK_HEIGHT;
		if (request.sort) {
			if (request.sort === BLOCK_HEIGHT) {
				sort = BLOCK_HEIGHT;
			} else if (request.sort === RANDOM) {
				sort = RANDOM;
			} else {
				throw Error('sort parameter is not valid');
			}
		}

		// fix the peer group lists to reflect the options the user has provided
		this._modify_groups(
			required,
			preferred,
			ignored,
			required_orgs,
			preferred_orgs,
			ignored_orgs,
			preferred_height_gap,
			sort,
			endorsement_plan
		);

		// always randomize the layouts
		endorsement_plan.layouts = this._getRandom(endorsement_plan.layouts);

		// loop through the layouts trying to complete one successfully
		for (const layout_index in endorsement_plan.layouts) {
			logger.debug('%s - starting layout plan %s', method, layout_index);
			const layout_results = await this._endorse_layout(layout_index, endorsement_plan, proposal, timeout);
			// if this layout is successful then we are done
			if (layout_results.success) {
				logger.debug('%s - layout plan %s completed successfully', method, layout_index);
				results.endorsements = layout_results.endorsements;
				results.success = true;
				break;
			} else {
				logger.debug('%s - layout plan %s did not complete successfully, try another layout plan', method, layout_index);
				results.failed_endorsements = results.failed_endorsements.concat(layout_results.endorsements);
			}
		}

		if (!results.success) {
			const error = new Error('Endorsement has failed');
			error.endorsements = results.failed_endorsements;
			return [error];
		}

		return results.endorsements;
	}

	async _endorse_layout(layout_index, endorsement_plan, proposal, timeout) {
		const method = '_endorse_layout';
		logger.debug('%s - start', method);

		const results = {};
		results.endorsements = [];
		results.success = true;
		const layout = endorsement_plan.layouts[layout_index];
		let endorser_process_index = 0;
		const endorsers = [];
		for (const group_name in layout) {
			const required = layout[group_name];
			const group = endorsement_plan.groups[group_name];
			// make sure there are enough peers in the group to satisfy required
			if (required > group.peers.length) {
				results.success = false;
				const error = new Error(`Endorsement plan group does not contain enough peers (${group.peers.length}) to satisfy policy (required:${required})`);
				logger.error(error);
				results.endorsements.push(error);
				break; // no need to look at other groups, this layout failed
			}
			for (let x = 0; x < required; x++) {
				const endorser_process =
					this._build_endorse_group_member(endorsement_plan, group, proposal, timeout, endorser_process_index++, group_name);
				endorsers.push(endorser_process);
			}
		}

		if (results.success) {
			results.endorsements = await this._execute_endorsements(endorsers);
			for (const endorsement of results.endorsements) {
				if (endorsement instanceof Error) {
					results.success = false;
				} else if (typeof endorsement.success === 'boolean' && endorsement.success === false) {
					results.success = false;
				}
			}
		}

		return results;
	}

	async _execute_endorsements(endorser_processes) {
		const method = '_execute_endorsements';
		logger.debug('%s - start', method);

		const results = await Promise.all(endorser_processes);
		const responses = [];
		for (const result of results) {
			if (result instanceof Error) {
				logger.debug('%s - endorsement failed: %s', method, result);
			} else {
				logger.debug('%s - endorsement is complete', method);
			}
			responses.push(result);
		}

		return responses;
	}

	/*
	 * utility method to build a promise that will return one of the required
	 * endorsements or an error object
	 */
	_build_endorse_group_member(endorsement_plan, group, proposal, timeout, endorser_process_index, group_name) {
		const method = '_build_endorse_group_member >> ' + group_name + ':' + endorser_process_index;
		logger.debug('%s - start', method);

		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve) => {
			let endorsement = null;
			for (const peer_info of group.peers) {
				endorsement = endorsement_plan.endorsements[peer_info.name];
				if (endorsement) {
					logger.debug('%s - existing peer %s endorsement will be used', method, peer_info.name);
				} else {
					if (peer_info.in_use) {
						logger.debug('%s - peer in use %s, skipping', method, peer_info.name);
					} else {
						const peer = this._getPeer(peer_info.endpoint);
						if (peer) {
							logger.debug('%s - send endorsement to %s', method, peer_info.name);
							peer_info.in_use = true;
							try {
								endorsement = await peer.sendProposal(proposal, timeout);
								// save this endorsement results in case we try this peer again
								logger.debug('%s - endorsement completed to %s', method, peer_info.name);
							} catch (error) {
								endorsement = error;
								logger.error('%s - error on endorsement to %s error %s', method, peer_info.name, error);
							}
							// save this endorsement results in case we try this peer again
							// eslint-disable-next-line require-atomic-updates
							endorsement_plan.endorsements[peer_info.name] = endorsement;
						} else {
							logger.debug('%s - peer %s not assigned to this channel', method, peer_info.name);
						}
					}
				}
				if (endorsement && !(endorsement instanceof Error)) {
					logger.debug('%s - peer %s endorsement will be used', method, peer_info.name);
					break;
				}
			}

			if (endorsement) {
				logger.debug('%s - returning endorsement', method);
				resolve(endorsement);
			} else {
				logger.error('%s - returning an error endorsement, no endorsement made', method);
				resolve(new Error('No endorsement available'));
			}
		});
	}

	/*
	 * utility method that will take a group of peers and modify the order
	 * of the peers within the group based on the user's requirements
	 *
	 * for each group
	 *  - remove the ignored and all non required
	 *  - sort group list by ledger height (larger on top) or randomly
	 *  - walk sorted list
	 *      -- put the preferred peers & organizations in the priority bucket if ledger height acceptable
	 *      -- put others in non priority bucket
	 *  - build final modified group (this will maintain how they were sorted)
	 *      -- pull peers from priority bucket
	 *      -- pull peers from non priority bucket
	 *  - return modified group
	 */
	_modify_groups(required, preferred, ignored, required_orgs, preferred_orgs, ignored_orgs, preferred_height_gap, sort, endorsement_plan) {
		const method = '_modify_groups';
		logger.debug('%s - start', method);
		logger.debug('%s - required:%j', method, required);
		logger.debug('%s - preferred:%j', method, preferred);
		logger.debug('%s - ignored:%j', method, ignored);
		logger.debug('%s - required_orgs:%j', method, required_orgs);
		logger.debug('%s - preferred_orgs:%j', method, preferred_orgs);
		logger.debug('%s - ignored_orgs:%j', method, ignored_orgs);
		logger.debug('%s - preferred_height_gap:%s', method, preferred_height_gap);
		logger.debug('%s - sort: %s', method, sort);
		logger.debug('%s - endorsement_plan:%j', method, endorsement_plan);

		for (const group_name in endorsement_plan.groups) {
			const group = endorsement_plan.groups[group_name];
			for (const peer of group.peers) {
				peer.ledgerHeight = new Long(peer.ledgerHeight.low, peer.ledgerHeight.high);
			}
			// remove ignored and non-required
			const clean_list = this._removePeers(ignored, ignored_orgs, required, required_orgs, group.peers);
			// get the highest ledger height if needed
			let highest = null;
			if (preferred_height_gap) {
				highest = this._findHighest(clean_list);
			} else {
				logger.debug('%s - no preferred height gap', method);
			}
			// sort based on ledger height or randomly
			const sorted_list = this._sortPeerList(sort, clean_list);
			// pop the priority peers off the sorted list
			const split_lists = this._splitList(preferred, preferred_orgs, highest, preferred_height_gap, sorted_list);
			// put the priorities on top
			const reordered_list = split_lists.priority.concat(split_lists.non_priority);
			// set the rebuilt peer list into the group
			group.peers = reordered_list;
		}

		logger.debug('%s - updated endorsement_plan:%j', method, endorsement_plan);
	}

	_create_map(array) {
		const map = new Map();
		if (array && Array.isArray(array)) {
			array.forEach((item) => {
				map.set(item, item);
			});
		}

		return map;
	}

	/*
	 * utility method to remove peers that are ignored or not on the required list
	 */
	_removePeers(ignored_peers, ignored_orgs, required_peers, required_orgs, peers) {
		const method = '_removePeers';
		logger.debug('%s - start', method);

		const keep_list = [];
		for (const peer of peers) {
			let found = ignored_peers.has(peer.name);
			if (!found) {
				found = ignored_orgs.has(peer.mspid);
				if (!found) {
					// if the user has requested required peers/orgs
					// then all peers that stay on the list must be
					// one of those peers or in one of those orgs
					if (required_peers.size || required_orgs.size) {
						found = required_peers.has(peer.name);
						if (!found) {
							found = required_orgs.has(peer.mspid);
						}
						// if we did not find it on a either list then
						// this peer will not be added to the keep list
						if (!found) {
							continue; // do not add this peer to the keep list
						}
					}

					// looks like this peer is not on the ignored list and
					// is on the required list (if being used);
					keep_list.push(peer);
				}
			}
		}

		return keep_list;
	}

	_findHighest(peers) {
		let highest = Long.fromValue(0);
		for (const peer of peers) {
			try {
				if (peer.ledgerHeight.greaterThan(highest)) {
					highest = peer.ledgerHeight;
				}
			} catch (error) {
				logger.error('problem finding highest block with %s', error);
				throw Error(`Unable to find highest block value :: ${error.toString()}`);
			}
		}

		return highest;
	}

	_sortPeerList(sort, peers) {
		const method = '_sortList';
		logger.debug('%s - start - %s', method, sort);

		let sorted = null;

		if (sort === BLOCK_HEIGHT) {
			sorted = peers.sort((a, b) => {
				logger.debug('%s - sorting descending', method);
				if (a.ledgerHeight && !b.ledgerHeight) {
					logger.debug('%s - a exist (%s) - b does not exist', method, a.ledgerHeight);

					return -1;
				} else if (!a.ledgerHeight && b.ledgerHeight) {
					logger.debug('%s - a does not exist - b exist (%s)', method, b.ledgerHeight);

					return 1;
				} else {
					const result = -1 * a.ledgerHeight.compare(b.ledgerHeight);
					logger.debug('%s - compare result: %s for a:(%s) b:(%s) ', method, result, a.ledgerHeight.toString(), b.ledgerHeight.toString());

					return result;
				}
			});
		} else { // must be random
			sorted = this._getRandom(peers);
		}

		return sorted;
	}


	_splitList(preferred_peers, preferred_orgs, preferred_height_gap, highest, sorted_list) {
		const method = '_splitList';
		logger.debug('%s - start', method);

		const priority = [];
		const non_priority = [];

		for (const peer of sorted_list) {
			// first see if on the preferred lists
			let found = preferred_peers.has(peer.name);
			if (!found) {
				logger.debug('%s - peer %s not found on the preferred peer list', method, peer.name);
				found = preferred_orgs.has(peer.mspid);
				if (found) {
					logger.debug('%s - peer %s found on preferred org list', method, peer.name);
				} else {
					logger.debug('%s - peer %s not found on preferred org list', method, peer.name);
				}
			} else {
				logger.debug('%s - peer %s found on the preferred peer list', method, peer.name);
			}

			// if not on the preferred lists, see if it should be on the priority list
			// because it has a low gap, meaning it should be up to date on with ledger
			// changes compared with other peers
			if (!found && highest && preferred_height_gap) {
				if (peer.ledgerHeight) {
					logger.debug('%s - checking preferred gap of %s', method, preferred_height_gap);
					logger.debug('%s - peer.ledgerHeight %s', method, peer.ledgerHeight);
					if (highest.subtract(peer.ledgerHeight).greaterThan(preferred_height_gap)) {
						found = false; // this peer should not be on the priority list
						logger.debug('%s -gap too big, peer should not be on priority list', method, peer.name);
					} else {
						found = true; // this peer should not be on the priority list
						logger.debug('%s - gap is OK, peer should be on priority list', method, peer.name);
					}
				} else {
					logger.debug('%s - peer has no ledgerHeight, not a priority peer');
					found = false;
				}

			} else {
				logger.debug('%s - not checking the preferred height gap', method);
			}
			if (found) {
				priority.push(peer);
			} else {
				non_priority.push(peer);
			}
		}

		return {priority, non_priority};
	}

	/*
	 * utility function to return a random list
	 */
	_getRandom(start_list) {
		let len = start_list.length;
		const result_list = new Array(len);
		const taken = new Array(len);
		let n = len;
		while (n--) {
			const x = Math.floor(Math.random() * len);
			result_list[n] = start_list[x in taken ? taken[x] : x];
			taken[x] = --len in taken ? taken[len] : len;
		}

		return result_list;
	}

	/*
	 * utility function to return a peer with the requested url
	 */
	_getPeer(address) {
		let result = null;
		if (address) {
			const host_port = address.split(':');
			const url = this.discovery._buildUrl(host_port[0], host_port[1]);
			const peers = 	this.discovery.channel.getEndorsers();
			for (const peer of peers) {
				if (peer.endpoint && peer.endpoint.url === url) {
					result = peer;
					break;
				}
			}
		}

		return result;
	}

	toString() {
		return `{type:${this.type}, discoveryService:${this.discovery.name}}`;
	}
}

module.exports = DiscoveryHandler;
