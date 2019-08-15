/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('Query');

/**
 * Describes a transaction to be evaluated on a specified set of peers.
 * Used by query handler implementations to evaluate transactions on peers of their choosing.
 * @memberof module:fabric-network
 */
class Query {
	constructor(channel, request) {
		this._channel = channel;
		this._request = request;
	}

	/**
     * Evaluates the query on the specified peers.
     * @param {ChannelPeer[]} peers The peers to query
     * @returns {Object.<String, (Buffer | Error)>} Object with peer name keys and associated values that are either
	 * Buffer or Error objects.
     */
	async evaluate(peers) {
		const request = Object.assign({targets: peers}, this._request);

		const peerNames = peers.map((peer) => peer.getName());
		logger.debug('evaluate: name=%s, transactionId=%s, peers=%j', this._request.fcn, this._request.txId, peerNames);

		const payloads = await this._channel.queryByChaincode(request);

		const result = {};
		for (let i = 0; i < peerNames.length; i++) {
			const peerName = peerNames[i];
			const payload = payloads[i];
			result[peerName] = payload;

			if (payload instanceof Error) {
				logger.warn(`evaluate: Query ID "${request.txId}" of peer "${peerName}" failed:`, payload);
			}
		}
		return result;
	}
}

module.exports = Query;
