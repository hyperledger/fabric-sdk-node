/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Sample query handler that will use all queryable peers within the network to evaluate transactions, with preference
// given to peers within the same organization.

import { Network, QueryHandler, QueryHandlerFactory } from 'fabric-network';
import { Query } from 'fabric-common';

/**
 * Query handler implementation
 */
class SampleQueryHandler implements QueryHandler {
	private readonly peers: any;
	private readonly requestTimeout: number;

	constructor(peers: any, requestTimeout: number) {
		this.peers = peers;
		this.requestTimeout = requestTimeout;
	}

	public async evaluate(query: Query): Promise<Buffer> {
		// send to all
		const results = await query.send({targets: this.peers}, {requestTimeout: this.requestTimeout});

		// check the results
		if (results) {
			// first check to see if we have results (any result with a payload will be here)
			if (results && results.queryResults && results.queryResults.length > 0) {
				return results.queryResults[0];
			// maybe the request failed
			} else if (results && results.errors && results.errors.length > 0) {
				throw results.errors[0];
			// maybe the query failed
			} else if (results.responses) {
				for (const response of results.responses) {
					if (response.response.message) {
						// return the first one found
						throw new Error(`Query failed status:${response.response.status} message:${response.response.message}`);
					}
				}
				throw new Error('Unknown result');
			}
		}

		// seems that we did not get anything worth returning
		throw new Error('No results returned');
	}
}

/**
 * Factory function for creating sample query handlers.
 * @param {Network} network The network where transactions are to be evaluated.
 * @returns {QueryHandler} A query handler implementation.
 */
const createQueryHandler: QueryHandlerFactory = (network: Network, options: any): SampleQueryHandler => {
	let timeout: number = 3000; // default 3 seconds
	if (Number.isInteger(options.timeout)) {
		timeout = options.timeout * 1000; // convert to ms;
	}
	const peers = network.channel.getEndorsers(network.mspid);
	return new SampleQueryHandler(peers, timeout);
};

export = createQueryHandler; // Plain JavaScript compatible node module export
