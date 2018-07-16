/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const fs = require('fs-extra');
const path = require('path');
const Long = require('long');
const utils = require('../utils');
const client_utils = require('../client-utils.js');
const Constants = require('../Constants.js');
const Channel = require('../Channel.js');
const Peer = require('../Peer.js');
const ChannelEventHub = require('../ChannelEventHub.js');
const Orderer = require('../Orderer.js');
const api = require('../api.js');
const logger = utils.getLogger('DiscoveryEndorsementHandler');


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
		} else if (!params.request){
			errorMsg = 'Missing "request" input parameter';
		} else if (!params.signed_proposal) {
			errorMsg = 'Missing "signed_proposal" input request parameter';
		}

		if (errorMsg) {
			logger.error('Endorsement Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		const request = Object.assign({}, params.request);

		if (!request.chaincodeId) {
			errorMsg = 'Missing "chaincodeId" parameter in the proposal request';
		} else if (!request.txId) {
			errorMsg = 'Missing "txId" parameter in the proposal request';
		} else if (!request.args) {
			errorMsg = 'Missing "args" in Transaction proposal request';
		}

		if (errorMsg) {
			logger.error('Endorsement Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		let timeout = utils.getConfigSetting('request-timeout');
		if(params.timeout) {
			timeout = params.timeout;
		}


		// this will check the age of the results and get new results if needed
		let discovery_results = null;
		try {
			discovery_results = await this._channel.getDiscoveryResults();
		} catch(error) {
			logger.debug('%s - no discovery results %s', method, error);
		}
		if(discovery_results && !request.targets) {
			const working_discovery = JSON.parse(JSON.stringify(discovery_results));

			return this._endorse(working_discovery, request, params.signed_proposal);
		} else {
			logger.debug('%s - not using discovery', method);
			const targets = this._channel._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

			return client_utils.sendPeersProposal(targets, params.signed_proposal, timeout);
		}

	}

	async _endorse(discovery_plan, request, proposal) {
		const method = '_endorse';
		// see if we have an endorsement plan for the requested chaincode
		if(discovery_plan && discovery_plan.endorsement_targets && discovery_plan.endorsement_targets[request.chaincodeId]) {
			logger.debug('%s - found discovery endorsement plan for %s', method, request.chaincodeId);
			const chaincode_plan = discovery_plan.endorsement_targets[request.chaincodeId];
			chaincode_plan.endorsements = {};
			let results = {};

			const preferred = this._create_map(request.preferred);
			const ignore = this._create_map(request.ignore);
			this._modify_groups(preferred, ignore, chaincode_plan);
			// loop through the layouts trying to complete one successfully
			for(let layout_index in chaincode_plan.layouts) {
				logger.debug('%s - starting layout plan %s', method, layout_index);
				results = await this._endorse_layout(layout_index, request.chaincodeId, chaincode_plan, proposal, request.timeout);
				if(results.successful) {
					logger.debug('%s - layout plan %s completed successfully', method, layout_index);
					return Promise.resolve(results.endorsements);
				} else {
					logger.debug('%s - layout plan %s did not complete successfully, try another layout plan', method, layout_index);
				}
			}

			return Promise.reject(results.endorsements);
		} else {
			throw new Error('No discovery endorsement targets for chaincodeId '+ request.chaincodeId);
		}
	}

	async _endorse_layout(layout_index, chaincodeId, chaincode_plan, proposal, timeout) {
		const method = '_endorse_layout';
		const results = {};
		results.endorsements = [];
		results.successful = true;
		const layout = chaincode_plan.layouts[layout_index];
		let endorser_process_index = 0;
		const endorsers = [];
		for(let group_name in layout) {
			const required = layout[group_name];
			const group = chaincode_plan.groups[group_name];
			for(let x=0;x<required; x++) {
				const endorser_process = this._endorse_group_member(chaincode_plan, group, proposal, timeout, endorser_process_index++, group_name);
				endorsers.push(endorser_process);
			}
		}
		results.endorsements = await this._execute_endorsements(endorsers);
		for(let endorsement of results.endorsements) {
			if(endorsement instanceof Error) {
				results.successful = false;
			}
		}

		return results;
	}

	async _execute_endorsements(endorser_processes) {
		const method = '_execute_endorsements';
		const responses = [];
		return Promise.all(endorser_processes).then(function (results) {
			results.forEach(function (result) {
				if (result instanceof Error) {
					logger.debug('%s - endorsement failed: %s', method, result);
					responses.push(result);
				} else {
					logger.debug('%s - endorsement is complete', method);
					responses.push(result);
				}
			});

			return responses;
		});
	}

	/*
	 * utility method to build a promise that will return one of the required
	 * endorsements or an error object
	 */
	_endorse_group_member(plan, group, proposal, timeout, endorser_process_index, group_name) {
		const method = '_endorse_group_member >> ' + group_name + ':' + endorser_process_index;
		logger.debug('%s - start', method);
		let error = null;
		const self = this;
		return new Promise(async (resolve, reject) => {
			for(let peer_info of group.peers) {
				const previous_endorsement = plan.endorsements[peer_info.name];
				if(previous_endorsement && previous_endorsement.endorsement) {
					if(previous_endorsement.success) {
						logger.debug('%s - this peer has been previously endorsed successfully: %s', method, peer_info.name);
						resolve(previous_endorsement.endorsement);
						return;
					} else {
						logger.debug('%s - this peer has been previously endorsed unsuccessfully: %s', method, peer_info.name);
						error = previous_endorsement.endorsement;
					}
				} else if(!peer_info.in_use) {
					const peer = self._channel.getPeer(peer_info.name);
					if(peer) {
						logger.debug('%s - send endorsement to %s', method, peer_info.name);
						peer_info.in_use = true;
						try{
							const endorsement = await peer.sendProposal(proposal, timeout);
							// if the endorsement is OK, then return it and quit
							plan.endorsements[peer_info.name] = {endorsement, success: true};
							logger.debug('%s - endorsement completed to %s - %s', method, peer_info.name, endorsement.response.status);
							resolve(endorsement);
							return;
						} catch(caught_error) {
							if(!(caught_error instanceof Error)) {
								error = new Error(caught_error.toString());
							} else {
								error = caught_error;
							}
							plan.endorsements[peer_info.name] = {};
							plan.endorsements[peer_info.name].endorsement = error;
							plan.endorsements[peer_info.name].success = false;
							logger.error('%s - endorsement failed - %s', method, error.toString());
						}
					} else {
						logger.debug('%s - peer %s not assigned to this channel', method, peer_info.name);
					}
				} else {
					logger.debug('%s - peer in use %s', method, peer_info.name);
				}
			}

			logger.debug('%s - not able to get a completed endorsement', method);
			if(error) {
				resolve(error);
			} else {
				resolve(new Error('Failed to have the endorsement complete successfully'));
			}
		});
	}

	_modify_groups(preferred, ignore, chaincode_plan) {
		const method = '_modify_groups';
		logger.debug('%s - start', method);
		logger.debug('%s - preferred:%j', method, preferred);
		logger.debug('%s - ignore:%j', method, ignore);
		logger.debug('%s - chaincode_plan:%j', method, chaincode_plan);

		for(let group_name in chaincode_plan.groups) {
			const group = chaincode_plan.groups[group_name];
			const un_sorted = [];
			for(let peer_index in group.peers) {
				const peer = group.peers[peer_index];
				let found = ignore[peer.endpoint];
				if(!found) {
					found = preferred[peer.endpoint];
					if(found) {
						peer.ledger_height = Long.MAX_VALUE;
					} else {
						peer.ledger_height = new Long(peer.ledger_height);
					}
					un_sorted.push(peer);
				}
			}
			logger.debug('%s - about to sort');
			const sorted = un_sorted.sort((a,b)=>{
				logger.debug('%s - sorting descending');
				if(!a || !b) {
					return 0;
				}
				if(a.ledger_height && !b.ledger_height) {
					logger.debug('%s - a exist (%s) - b does not exist', method, a.ledger_height);

					return -1;
				}
				if( !a.ledger_height && b.ledger_height ) {
					logger.debug('%s - a does not exist - b exist (%s)', method, b.ledger_height);

					return 1;
				}
				if(!a && !b) {
					logger.debug('%s - a does not exist - b does not exist', method);

					return 0;
				}
				if(a.ledger_height && a.ledger_height.compare) {
					const result = -1 * a.ledger_height.compare(b.ledger_height);
					logger.debug('%s - compare result: %s for a:(%s) b:(%s) ', method, result, a.ledger_height.toString(), b.ledger_height.toString());

					return result;
				}
				logger.debug('%s - compare not available (%s) (%s)', method, typeof(a.ledger_height), typeof(b.ledger_height));

				return 1;
			});
			group.peers = sorted;
		}

		logger.debug('%s - updated chaincode_plan:%j', method, chaincode_plan);
	}

	_create_map(array) {
		const map = {};
		if(array && Array.isArray(array)) {
			array.forEach((item) => {
				map[item] = item;
			});
		}

		return map;
	}
}

module.exports = DiscoveryEndorsementHandler;
