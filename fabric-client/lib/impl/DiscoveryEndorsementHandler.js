/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const fs = require('fs-extra');
const path = require('path');
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
	 * @param {Object} parm1 - Something
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
		// let discovery_results = await this._channel.getDiscoveryResults();
		// if(discovery_results && !request.targets) {
		//
		// } else {
		logger.debug('%s - not using discovery', method);
		const targets = this._channel._getTargets(request.targets, Constants.NetworkConfig.ENDORSING_PEER_ROLE);

		return client_utils.sendPeersProposal(targets, params.signed_proposal, timeout);
		// }

	}
}

module.exports = DiscoveryEndorsementHandler;
