/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const Long = require('long');
const util = require('util');

const utils = require('../utils');
const api = require('../api.js');
const logger = utils.getLogger('DiscoveryEndorsementHandler');
const client_utils = require('fabric-client/lib/client-utils.js');


const BLOCK_HEIGHT = 'ledgerHeight';
const RANDOM = 'random';
const DEFAULT = 'default';


/**
 * This is an implementation of the [EndorsementHandler]{@link module:api.EndorsementHandler} API.
 * It will submit transactions to be endorsed to a target list generated from the
 * results of service discovery.
 *
 * @class
 * @extends module:api.EndorsementHandler
 */
class DiscoveryEndorsementHandler extends api.EndorsementHandler {

	/**
	 * constructor
	 *
	 * @param {Channel} channel - The channel for this handler.
	 */
	constructor(channel) {
		super();
		this._channel = channel;
	}

	/**
	 * Factory method to create an instance of an endorsement handler.
	 *
	 * @param {Channel} channel - the channel instance that this endorsement
	 *        handler will be servicing.
	 * @returns {DiscoveryEndorsementHandler} The instance of the handler
	 */
	static create(channel) {
		return new DiscoveryEndorsementHandler(channel);
	}

	initialize() {
		logger.debug('initialize - start');
	}

	async endorse(params) {
		const method = 'endorse';
		logger.debug('%s - start', method);


		let errorMsg = null;
		if (!params) {
			errorMsg = 'Missing all required input parameters';
		} else if (!params.request) {
			errorMsg = 'Missing "request" input parameter';
		} else if (!params.signed_proposal) {
			errorMsg = 'Missing "signed_proposal" input request parameter';
		} else if (!params.endorsement_hint) {
			errorMsg = 'Missing "endorsement_hint" parameter in the proposal request';
		}

		if (errorMsg) {
			logger.error('Endorsement Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		const request = Object.assign({}, params.request);

		if (!request.txId) {
			errorMsg = 'Missing "txId" parameter in the proposal request';
		} else if (!request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		}

		if (errorMsg) {
			logger.error('Endorsement Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		let timeout = utils.getConfigSetting('request-timeout');
		if (request['request-timeout']) {
			timeout = request['request-timeout'];
		}
		if (params.timeout) {
			timeout = params.timeout;
		}

		// when targets specified then do not use discovery
		if (params.request.targets) {
			logger.debug('%s - running without discovery', method);
			const responses = await client_utils.sendPeersProposal(params.request.targets, params.signed_proposal, timeout);

			return responses;
		}

		let endorsement_plan = null;
		try {
			// this will check the age of the results and get a new plan if needed
			logger.debug('%s - get endorsement plans for %j', method, params.endorsement_hint);
			endorsement_plan = await this._channel.getEndorsementPlan(params.endorsement_hint);
		} catch (error) {
			logger.error('%s - error getting discovery results  :: %s', method, error);
		}

		if (endorsement_plan) {
			const working_discovery = JSON.parse(JSON.stringify(endorsement_plan));
			return this._endorse(working_discovery, request, params.signed_proposal, timeout);
		} else {
			logger.error('%s - no endorsement plan found for %j', method, params.endorsement_hint);
			throw Error('No endorsement plan available for ' + JSON.stringify(params.endorsement_hint));
		}
	}

	async _endorse(endorsement_plan, request, proposal, timeout) {
		const method = '_endorse';
		logger.debug('%s - start', method);

		// see if we have an endorsement plan for the requested chaincodes/collection call
		if (endorsement_plan) {
			logger.debug('%s - starting discovery endorsement plan', method);
			endorsement_plan.endorsements = {};
			const results = {};
			results.endorsements = [];
			results.failed_endorsements = [];
			results.success = false;

			const required = this._create_map(request.required, 'required');
			const preferred = this._create_map(request.preferred, 'preferred');
			const ignored = this._create_map(request.ignored, 'ignored');
			const required_orgs = this._create_map(request.requiredOrgs, 'requiredOrgs');
			const preferred_orgs = this._create_map(request.preferredOrgs, 'preferredOrgs');
			const ignored_orgs = this._create_map(request.ignoredOrgs, 'ignoredOrgs');
			let preferred_height_gap = null;
			try {
				preferred_height_gap = Long.fromValue(request.preferredHeightGap);
			} catch (error) {
				logger.debug('%s - preferred_height_gap setting is not a number', method);
			}

			let sort = DEFAULT;
			if (request.sort) {
				if (request.sort === BLOCK_HEIGHT) {
					sort = BLOCK_HEIGHT;
				} else if (request.sort === RANDOM) {
					sort = RANDOM;
				}
			}

			this._modify_groups(required, preferred, ignored, required_orgs, preferred_orgs,
				ignored_orgs, preferred_height_gap, sort, endorsement_plan);

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
				logger.error('%s - endorsement failed::%s', method, error.stack);
				error.endorsements = results.failed_endorsements;
				for (const endorsement of results.endorsements) {
					if (endorsement instanceof Error) {
						logger.error('%s - %s', method, endorsement.stack);
					}
				}
				throw error;
			}

			return results.endorsements;
		} else {
			throw new Error('No discovery endorsement plan found');
		}
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
				const error = new Error(util.format('Endorsement plan group does not contain' +
					' enough peers (%s) to satisfy policy (required:%s)', group.peers.length, required));
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
		const responses = [];
		return Promise.all(endorser_processes).then((results) => {
			results.forEach((result) => {
				if (result instanceof Error) {
					logger.debug('%s - endorsement failed: %s', method, result);
				} else {
					logger.debug('%s - endorsement is complete', method);
				}
				responses.push(result);
			});

			return responses;
		});
	}

	/*
	 * utility method to build a promise that will return one of the required
	 * endorsements or an error object
	 */
	_build_endorse_group_member(endorsement_plan, group, proposal, timeout, endorser_process_index, group_name) {
		const method = '_build_endorse_group_member >> ' + group_name + ':' + endorser_process_index;
		logger.debug('%s - start', method);
		let error = null;
		const self = this;
		return new Promise(async (resolve) => {
			for (const peer_info of group.peers) {
				const previous_endorsement = endorsement_plan.endorsements[peer_info.name];
				if (previous_endorsement && previous_endorsement.endorsement) {
					if (previous_endorsement.success) {
						logger.debug('%s - this peer has been previously endorsed successfully: %s', method, peer_info.name);
						resolve(previous_endorsement.endorsement);
						return;
					} else {
						logger.debug('%s - this peer has been previously endorsed unsuccessfully: %s', method, peer_info.name);
						error = previous_endorsement.endorsement;
					}
				} else if (!peer_info.in_use) {
					const peer = self._channel.getPeer(peer_info.name);
					if (peer) {
						logger.debug('%s - send endorsement to %s', method, peer_info.name);
						peer_info.in_use = true;
						try {
							const endorsement = await peer.sendProposal(proposal, timeout);
							// save this endorsement results in case we try this peer again
							endorsement_plan.endorsements[peer_info.name] = {endorsement, success: true};
							logger.debug('%s - endorsement completed to %s - %s', method, peer_info.name, endorsement.response.status);
							resolve(endorsement);
							return;
						} catch (caught_error) {
							if (!(caught_error instanceof Error)) {
								error = new Error(caught_error.toString());
								// if this peer failed to connect then close it
								if (error.connectFailed) {
									logger.warn('%s - connect fail to peer - %s', peer.getUrl());
									peer.close();
								}
							} else {
								error = caught_error;
							}
							// save this endorsement results in case we try this peer again
							endorsement_plan.endorsements[peer_info.name] = {endorsement: error, success: false};
							logger.warn('%s - endorsement failed - %s', method, error.toString());
						}
					} else {
						logger.debug('%s - peer %s not assigned to this channel', method, peer_info.name);
					}
				} else {
					logger.debug('%s - peer in use %s', method, peer_info.name);
				}
			}

			logger.debug('%s - not able to get a completed endorsement', method);
			if (error) {
				resolve(error);
			} else {
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
		logger.debug('%s - sort: %s', method, sort);
		logger.debug('%s - endorsement_plan:%j', method, endorsement_plan);

		for (const group_name in endorsement_plan.groups) {
			const group = endorsement_plan.groups[group_name];
			logger.debug('%s starting - group: %s - size: %s', method, group_name, group.peers.length);
			// remove ignored and non-required
			const clean_list = this._removePeers(ignored, ignored_orgs, required, required_orgs, group.peers);
			logger.debug('%s removed - group: %s - size: %s', method, group_name, clean_list.length);

			// get the highest ledger height if needed
			let highest = null;
			if (preferred_height_gap) {
				highest = this._findHighest(clean_list);
			}
			// sort based on ledger height or randomly
			const sorted_list = this._sortPeerList(sort, clean_list);
			logger.debug('%s sorted - group: %s - size: %s', method, group_name, sorted_list.length);
			// pop the priority peers off the sorted list
			const split_lists = this._splitList(preferred, preferred_orgs, highest, preferred_height_gap, sorted_list);
			// put the priorities on top
			const reordered_list = split_lists.priority.concat(split_lists.non_priority);
			logger.debug('%s reordered - group: %s - size: %s', method, group_name, reordered_list.length);

			// set the rebuilt peer list into the group
			group.peers = reordered_list;
		}

		logger.debug('%s - updated endorsement_plan:%j', method, endorsement_plan);
	}

	_create_map(items, type) {
		const method = '_create_map';
		logger.debug('%s - start for %s', method, type);
		const map = new Map();
		if (items && Array.isArray(items)) {
			items.forEach((item) => {
				logger.debug('%s - adding %s', method, item);
				map.set(item, item);
			});
		}

		return map;
	}

	/*
	 *utility method to remove peers that are ignored or not on the required list
	 */
	_removePeers(ignored_peers, ignored_orgs, required_peers, required_orgs, peers) {
		const method = '_removePeers';
		logger.debug('%s - start size:%s', method, peers.length);
		const keep_list = [];
		for (const peer of peers) {
			let found = ignored_peers.has(peer.name);
			if (!found) {
				found = ignored_orgs.has(peer.mspid);
				if (!found) {
					logger.debug('%s - not found in ignored list - peer:%s', method, peer.name);
					// if the user has requested required peers/orgs
					// then all peers that stay on the list must be
					// one of those peers or in one of those orgs
					if (required_peers.size > 0 || required_orgs.size > 0) {
						found = required_peers.has(peer.name);
						if (!found) {
							logger.debug('%s - not found in required peers - peer:%s', method, peer.name);
							found = required_orgs.has(peer.mspid);
						}
						// if we did not find it on a either list then
						// this peer will not be added to the keep list
						if (!found) {
							logger.debug('%s - removing peer:%s', method, peer.name);
							continue; // do not add this peer to the keep list
						}
					}

					// looks like this peer is not on the ignored list and
					// is on the required list (if being used);
					logger.debug('%s - keeping peer:%s', method, peer.name);
					keep_list.push(peer);
				}
			} else {
				logger.debug('%s - found in ignored list - peer:%s', method, peer.name);
			}
		}

		logger.debug('%s - end size:%s', method, keep_list.length);
		return keep_list;
	}

	_findHighest(peers) {
		let highest = Long.fromValue(0);
		for (const peer of peers) {
			try {
				if (peer.ledger_height.greaterThan(highest)) {
					highest = peer.ledger_height;
				}
			} catch (error) {
				logger.warn('problem finding highest block:%s', error);
			}
		}

		return highest;
	}

	_sortPeerList(sort, peers) {
		const method = '_sortPeerList';
		logger.debug('%s - start - sort:%s - size:%s', method, sort, peers.length);
		let sorted = null;

		if (!sort || sort === BLOCK_HEIGHT || sort === DEFAULT) {
			sorted = peers.sort((a, b) => {
				logger.debug('%s - sorting descending', method);
				if (!a || !b) {
					return 0;
				}
				if (a.ledger_height && !b.ledger_height) {
					logger.debug('%s - a exist (%s) - b does not exist', method, a.ledger_height);

					return -1;
				}
				if (!a.ledger_height && b.ledger_height) {
					logger.debug('%s - a does not exist - b exist (%s)', method, b.ledger_height);

					return 1;
				}
				if (!a && !b) {
					logger.debug('%s - a does not exist - b does not exist', method);

					return 0;
				}
				if (a.ledger_height && a.ledger_height.compare) {
					const result = -1 * a.ledger_height.compare(b.ledger_height);
					logger.debug('%s - compare result: %s for a:(%s) b:(%s) ', method, result, a.ledger_height.toString(), b.ledger_height.toString());

					return result;
				}
				logger.debug('%s - compare not available (%s) (%s)', method, typeof (a.ledger_height), typeof (b.ledger_height));

				return 1;
			});
		} else if (sort === RANDOM) {
			sorted = this._getRandom(peers);
		}

		return sorted;
	}


	_splitList(preferred_peers, preferred_orgs, preferred_height_gap, highest, sorted_list) {
		const method = '_splitList';
		logger.debug('%s - start size:%s', method, sorted_list.length);
		const list = {};
		list.priority = [];
		list.non_priority = [];

		for (const peer of sorted_list) {
			let found = preferred_peers.has(peer.name);
			if (!found) {
				found = preferred_orgs.has(peer.mspid);
				if (found) {
					logger.debug('%s - peer %s found on preferred org list', method, peer.name);
				} else {
					logger.debug('%s - peer %s not found on preferred org list', method, peer.name);
				}
			} else {
				logger.debug('%s - peer %s found on the preferred peer list', method, peer.name);
			}
			if (found && preferred_height_gap) {
				logger.debug('%s - checking preferred gap of %s', method, preferred_height_gap);
				logger.debug('%s - peer.ledger_height %s', method, peer.ledger_height);
				if (highest.subtract(peer.ledger_height).greaterThan(preferred_height_gap)) {
					found = false; // this peer should not be on the priority list
					logger.debug('%s - peer should not be on priority list', method, peer.name);
				}
			} else {
				logger.debug('%s - not checking the preferred height gap', method);
			}
			if (found) {
				list.priority.push(peer);
			} else {
				list.non_priority.push(peer);
			}
		}

		logger.debug('%s - end - priority:%s - non_priority:%s', method, list.priority.length, list.non_priority.length);
		return list;
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
}

module.exports = DiscoveryEndorsementHandler;
