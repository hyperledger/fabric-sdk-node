/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Sample query handler that will use all queryable peers within the network to evaluate transactions, with preference
// given to peers within the same organization.

import {QueryHandler, QueryHandlerFactory, Query, QueryResults} from 'fabric-network';
import {Endorser} from 'fabric-common';
import * as util from 'util';

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
		throw new Error(message);
	}
}

/**
 * Factory function for creating sample query handlers.
 * @param {Network} network The network where transactions are to be evaluated.
 * @returns {QueryHandler} A query handler implementation.
 */
export const createQueryHandler: QueryHandlerFactory = (network) => {
	const mspId = network.getGateway().getIdentity().mspId;
	const channel = network.getChannel();
	const orgPeers = channel.getEndorsers(mspId);
	const otherPeers = channel.getEndorsers().filter((peer) => !orgPeers.includes(peer));
	const allPeers = orgPeers.concat(otherPeers);
	return new SampleQueryHandler(allPeers);
};
