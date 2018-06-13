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
const logger = utils.getLogger('BasicCommitHandler');


/**
 * This is an implementation of the [CommitHandler]{@link module:api.CommitHandler} API.
 * It will submit transactions to be committed to one orderer at time from a provided
 * list or a list currently assigned to the channel.
 *
 * @class
 * @extends module:api.CommitHandler
 */
class BasicCommitHandler extends api.CommitHandler {

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
	 * Factory method to create an instance of a committer handler.
	 *
	 * @param {Channel} channel - the channel instance that this commit
	 *        handler will be servicing.
	 * @returns {BasicCommitHandler} The instance of the handler
	 */
	static create(channel) {
		return new BasicCommitHandler(channel);
	}

	initialize() {
		logger.debug('initialize - start');
	}

	async commit(params) {
		const method = 'commit';
		logger.debug('%s - start', method);


		let errorMsg = null;
		if (!params) {
			errorMsg = 'Missing all required input parameters';
		} else if (!params.request){
			errorMsg = 'Missing "request" input parameter';
		} else if (!params.signed_envelope) {
			errorMsg = 'Missing "signed_envelope" input parameter';
		}

		if (errorMsg) {
			logger.error('Commit Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		const request = Object.assign({}, params.request);

		let timeout = utils.getConfigSetting('request-timeout');
		if(params.timeout) {
			timeout = params.timeout;
		}

		if(!request.orderer) {
			logger.debug('%s - using commit handler', method);
			// this will check the age of the results and get new results if needed
			try {
				await this._channel.getDiscoveryResults(); //this will cause a refresh if using discovery and the results are old
			} catch(error) {
				// No problem, user may not be using discovery
				logger.debug('%s - no discovery results %s', method, error);
			}

			// Orderers will be assigned to the channel by this point
			return this._commit(params.signed_envelope, params.timeout);
		} else {
			logger.debug('%s - using single orderer', method);
			const orderer = this._channel._getOrderer(request.orderer, Constants.NetworkConfig.ENDORSING_PEER_ROLE);
			try {

				return orderer.sendBroadcast(params.signed_envelope, params.timeout);
			} catch(error) {
				logger.error(error.stack);
			}
			throw new Error('Failed to send to the orderer');
		}
	}

	async _commit(envelope, timeout) {
		const method = '_commit';

		const orderers = this._channel.getOrderers();
		let return_error = null;
		if(orderers && orderers.length > 0) {
			logger.debug('%s - found %s orderers assigned to channel', method, orderers.length);
			// loop through the orderers trying to complete one successfully
			for(let orderer of orderers) {
				logger.debug('%s - starting orderer %s', method, orderer.getName());
				try {
					const results =  await orderer.sendBroadcast(envelope, timeout);
					if (results) {
						if(results.status === 'SUCCESS') {
							logger.debug('%s - Successfully sent transaction to the orderer %s', method, orderer.getName());
							return results;
						} else {
							logger.debug('%s - Failed to send transaction successfully to the orderer status:%s', method, results.status);
							return_error = new Error('Failed to send transaction successfully to the orderer status:' + results.status);
						}
					} else {
						return_error = new Error('Failed to send transaction to the orderer');
						logger.debug('%s - Failed to send transaction to the orderer %s', method, orderer.getName());
					}
				} catch(error) {
					logger.debug('%s - Caught: %s', method, error.toString());
					return_error = error;
				}

				logger.debug('%s - finished orderer %s ', method, orderer.getName());
			}

			logger.debug('%s - return error %s ', method, return_error.toString());
			throw return_error;
		} else {
			throw new Error('No orderers assigned to the channel');
		}
	}
}



module.exports = BasicCommitHandler;
