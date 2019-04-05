/*
 Copyright 2019 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const token_utils = require('../token-utils');
const {Utils: utils} = require('fabric-common');
const Constants = require('../Constants.js');
const ProverHandler = require('../ProverHandler');
const logger = utils.getLogger('BasicProverHandler');


/**
 * This is an implementation of the [ProverHandler]{@link ProverHandler} API.
 * It will send a token request to a Prover peer one at a time from a provided
 * list or a list currently assigned to the channel.
 *
 * @class
 * @extends ProverHandler
 */
class BasicProverHandler extends ProverHandler {

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
	 * Factory method to create an instance of a Proverter handler.
	 *
	 * @param {Channel} channel - the channel instance that this Prover
	 *        handler will be servicing.
	 * @returns {BasicProverHandler} The instance of the handler
	 */
	static create(channel) {
		return new BasicProverHandler(channel);
	}

	initialize() {
		logger.debug('initialize - start');
	}

	async processCommand(params) {
		const method = 'processCommand';
		logger.debug('%s - start', method);


		let errorMsg = null;
		if (!params) {
			errorMsg = 'Missing all required input parameters';
		} else if (!params.request) {
			errorMsg = 'Missing "request" input parameter';
		} else if (!params.signed_command) {
			errorMsg = 'Missing "signed_command" input parameter';
		}

		if (!params.request.txId) {
			errorMsg = 'Missing "txId" parameter in the token request';
		}

		if (errorMsg) {
			logger.error('Prover Handler error:' + errorMsg);
			throw new Error(errorMsg);
		}

		let timeout = utils.getConfigSetting('request-timeout');
		if (params.timeout) {
			timeout = params.timeout;
		}

		// Prover peers are not integrated with discovery service yet,
		// so this handler uses request.targets or gets all prover peers if not defined.

		let targetPeers;

		if (!params.request.targets) {
			logger.debug('%s - running prover handler without provided targets', method);
			// find all prover peers added to this channel
			targetPeers = this._channel._getTargets(undefined, Constants.NetworkConfig.PROVER_PEER_ROLE);
		} else {
			logger.debug('%s - running prover handler with provided targets', method);
			// convert any names into peer objects
			targetPeers = this._channel._getTargets(params.request.targets, Constants.NetworkConfig.PROVER_PEER_ROLE);
		}

		// send to one of the peers; if failed, send to next peer
		const responses = await token_utils.sendTokenCommandToPeer(targetPeers, params.signed_command, timeout);
		return responses;

	}
}

module.exports = BasicProverHandler;
