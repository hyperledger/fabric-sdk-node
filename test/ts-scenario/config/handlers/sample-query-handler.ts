/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Sample query handler that will use all queryable peers within the network to evaluate transactions, with preference
// given to peers within the same organization.

import { Network, QueryHandler, QueryHandlerFactory, Query, QueryResults} from 'fabric-network';
import {Endorser} from 'fabric-common';
import util = require('util');

/**
 * Query handler implementation
 */
class SampleQueryHandler implements QueryHandler {
	private readonly peers: Endorser[];

	constructor(peers: Endorser[]) {
		this.peers = peers;
	}

	public async evaluate(query: Query): Promise<Buffer> {
		const errorMessages: string[] = [];

		for (const peer of this.peers) {
			const results: QueryResults = await query.evaluate([peer]);
			const result = results[peer.name];
			if (result instanceof Error) {
				errorMessages.push(result.toString());
			} else {
				if (result.isEndorsed) {
					return result.payload;
				}
				throw new Error(result.message);
			}
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new Error(message);
		throw error;
	}
}

/**
 * Factory function for creating sample query handlers.
 * @param {Network} network The network where transactions are to be evaluated.
 * @returns {QueryHandler} A query handler implementation.
 */
const createQueryHandler: QueryHandlerFactory = (network: Network): SampleQueryHandler => {
	const orgPeers = network.channel.getEndorsers(network.mspid);
	const otherPeers = network.channel.getEndorsers().filter((peer) => !orgPeers.includes(peer));
	const allPeers = orgPeers.concat(otherPeers);
	return new SampleQueryHandler(allPeers);
};

export = createQueryHandler; // Plain JavaScript compatible node module export
