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
			const results = await query.send({targets:[peer]}, options);

			if (results.errors.length > 0) {
				logger.error('%s - problem with query to peer %s error:%s', method, peer.name, results.errors[0]);
				// since only one peer, only one error
				errorMessages.push(results.errors[0].message);
				continue;
			}

			const endorsementResponse = results.responses[0];

			if (!endorsementResponse.endorsement) {
				logger.debug('%s - peer response status: %s message: %s',
					method,
					endorsementResponse.response.status,
					endorsementResponse.response.message);
				throw new Error(endorsementResponse.response.message);
			}

			logger.debug('%s - peer response status %s', method, endorsementResponse.response.status);
			return endorsementResponse.response.payload;
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new FabricError(message);
		logger.error('evaluate:', error);
		throw error;
	}
}

module.exports = SingleQueryHandler;
