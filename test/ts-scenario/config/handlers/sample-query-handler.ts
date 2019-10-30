/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Sample query handler that will use all queryable peers within the network to evaluate transactions, with preference
// given to peers within the same organization.

import { Network, Query, QueryHandler, QueryHandlerFactory, QueryResults } from 'fabric-network';

import { ChannelPeer } from 'fabric-client';

import util = require('util');
import Client = require('fabric-client');

/**
 * Query handler implementation that simply tries all the peers it is given in order until it gets a result.
 */
class SampleQueryHandler implements QueryHandler {
	private peers: ChannelPeer[];

	constructor(peers: ChannelPeer[]) {
		this.peers = peers;
	}

	public async evaluate(query: Query): Promise<Buffer> {
		const errorMessages: string[] = [];

		for (const peer of this.peers) {
			const results: QueryResults = await query.evaluate([peer]);
			const result: Buffer | Client.ProposalErrorResponse = results[peer.getName()];

			if (!(result instanceof Error)) {
				// Good response from peer
				return result;
			}
			if (result.isProposalResponse) {
				// Error response from peer
				throw result;
			}
			// Failed to get response from peer
			errorMessages.push(result.message);
		}

		const message: string = util.format('Evaluate failed with the following errors: %j', errorMessages);
		throw new Error(message);
	}
}

function filterQueryablePeers(peers: ChannelPeer[]): ChannelPeer[] {
	return peers.filter((peer: ChannelPeer) => peer.isInRole('chaincodeQuery'));
}

/**
 * Factory function for creating sample query handlers.
 * @param {Network} network The network where transactions are to be evaluated.
 * @returns {QueryHandler} A query handler implementation.
 */
const createQueryHandler: QueryHandlerFactory = (network: Network): SampleQueryHandler => {
	const channel: Client.Channel = network.getChannel();
	const orgPeers: ChannelPeer[] = filterQueryablePeers(channel.getPeersForOrg());
	const networkPeers: ChannelPeer[] = filterQueryablePeers(channel.getChannelPeers())
		.filter((peer: ChannelPeer) => !orgPeers.includes(peer)); // Exclude peers already in the orgPeer array

	const allPeers: ChannelPeer[] = orgPeers.concat(networkPeers); // Peers in our organization first
	return new SampleQueryHandler(allPeers);
};

export = createQueryHandler; // Plain JavaScript compatible node module export
