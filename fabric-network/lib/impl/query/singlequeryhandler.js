/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricError = require('fabric-network/lib/errors/fabricerror');

const util = require('util');

const logger = require('fabric-network/lib/logger').getLogger('SingleQueryHandler');

class SingleQueryHandler {
	constructor(peers) {
		logger.debug('constructor: peers=%j', peers.map((peer) => peer.getName()));
		this._peers = peers;
		this._currentPeerIndex = 0;
	}

	async evaluate(query) {
		const startPeerIndex = this._currentPeerIndex;
		const errorMessages = [];

		for (let i = 0; i < this._peers.length; i++) {
			const peerIndex = (startPeerIndex + i) % this._peers.length;
			this._currentPeerIndex = peerIndex;

			const peer = this._peers[peerIndex];
			const results = await query.evaluate([peer]);
			const result = results[peer.getName()];

			if (!(result instanceof Error)) {
				return result;
			}
			if (result.isProposalResponse) {
				throw result;
			}
			errorMessages.push(result.message);
		}

		const message = util.format('No peers available to query. Errors: %j', errorMessages);
		const error = new FabricError(message);
		logger.error('evaluate:', error);
		throw error;
	}
}

module.exports = SingleQueryHandler;
