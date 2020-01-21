/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricError = require('fabric-network/lib/errors/fabricerror');

const util = require('util');

const logger = require('fabric-network/lib/logger').getLogger('SingleQueryHandler');

class SingleQueryHandler {
	constructor(peers, options = {}) {
		logger.debug('constructor: peers=%j', peers.map((peer) => peer.name));
		this._peers = peers;
		this._currentPeerIndex = 0;
		this._options = options;
	}

	async evaluate(query) {
		const method = 'evaluate';
		logger.debug('%s - start', method);

		const startPeerIndex = this._currentPeerIndex;
		const errorMessages = [];
		const options = {requestTimeout: 3000};
		// use the timeout as the requestTimeout or let default
		if (Number.isInteger(this._options.timeout)) {
			options.requestTimeout = this._options.timeout * 1000; // in ms;
		}

		for (let i = 0; i < this._peers.length; i++) {
			const peerIndex = (startPeerIndex + i) % this._peers.length;
			this._currentPeerIndex = peerIndex;
			const peer = this._peers[peerIndex];
			logger.debug('%s - query sending to peer %s', method, peer.name);
			try {
				const results = await query.send({targets:[peer]}, options);
				if (results && results.errors && results.errors.length > 0) {
					logger.error('%s - problem with query to peer %s error:%s', method, peer.name, results.errors[0]);
					// since only one peer, only one error
					errorMessages.push(results.errors[0].message);
				} else if (results && results.responses && results.responses[0].response.status < 400) {
					logger.debug('%s - peer response status %s', method, results.responses[0].response.status);
					return results.responses[0].response.payload;
				} else if (results && results.responses && results.responses[0].response.message) {
					logger.debug('%s - peer response status: %s message: %s', method,
						results.responses[0].response.status,
						results.responses[0].response.message);
					errorMessages.push(results.responses[0].response.message);
				} else {
					logger.error('%s - no results returned from the query', method);
					errorMessages.push('No response from query');
				}
			} catch (error) {
				logger.error('%s - problem with query to peer %s error:%s', method, peer.name, error);
				errorMessages.push(error.message);
			}
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new FabricError(message);
		logger.error('evaluate:', error);
		throw error;
	}
}

module.exports = SingleQueryHandler;
