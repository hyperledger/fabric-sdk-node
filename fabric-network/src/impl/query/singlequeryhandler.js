/**
 * Copyright 2018, 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {FabricError} = require('../../errors/fabricerror');

const util = require('util');

const logger = require('../../logger').getLogger('SingleQueryHandler');

class SingleQueryHandler {
	constructor(peers) {
		logger.debug('constructor: peers=%j', peers.map((peer) => peer.name));
		this._peers = peers;
		this._currentPeerIndex = 0;
	}

	async evaluate(query) {
		const method = 'evaluate';
		logger.debug('%s - start', method);

		const startPeerIndex = this._currentPeerIndex;
		const errorMessages = [];

		for (let i = 0; i < this._peers.length; i++) {
			const peerIndex = (startPeerIndex + i) % this._peers.length;
			this._currentPeerIndex = peerIndex;

			const peer = this._peers[peerIndex];
			logger.debug('%s - sending to peer %s', method, peer.name);

			const results = await query.evaluate([peer]);
			const result = results[peer.name];
			if (result instanceof Error) {
				errorMessages.push(result.toString());
			} else {
				if (result.isEndorsed) {
					logger.debug('%s - return peer response status: %s', method, result.status);
					return result.payload;
				} else {
					logger.debug('%s - throw peer response status: %s message: %s', method, result.status, result.message);
					throw Error(result.message);
				}
			}
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new FabricError(message);
		logger.error('evaluate:', error);
		throw error;
	}
}

module.exports = SingleQueryHandler;
