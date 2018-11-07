/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * QueryHandler defines the interface for pluggable query handlers.
 * @private
 * @interface
 * @memberof module:fabric-network
 */
class QueryHandler {

	constructor(channel, mspId, peerMap, queryOptions) {
		this.channel = channel;
		this.mspId = mspId;
		this.peerMap = peerMap;
		this.queryOptions = queryOptions;
	}

	async initialize() {
		return;
	}

	// eslint-disable-next-line no-unused-vars
	async queryChaincode(chaincodeId, txId, functionName, args) {
		throw new Error('Not implemented');
	}

	dispose() {
		return;
	}
}

module.exports = QueryHandler;
