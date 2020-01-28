/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('Query');

/**
 * @typedef {Object} Query~QueryResponse
 * @memberof module:fabric-network
 * @property {number} status - The status value from the endorsement. This attriibute
 * will be set by the chaincode.
 * @property {Buffer} payload - The payload value from the endorsement. This attribute
 * may be considered the query value if the status code is exceptable.
 * @property {Buffer} payload - The message value from the endorsement. This attribute
 * will have a value when there is not a payload and status value indicates an issue
 * with determining the payload (the query value).
 */
/**
 * Used by query handler implementations to evaluate transactions on peers of their choosing.
 * @memberof module:fabric-network
 */
class Query {
	/**
	 * Builds a Query instance to send and then work with the results returned
	 * by the fabric-common/Query.
	 * @param {module:fabric-common.Query} query - The query instance of the proposal
	 * @returns {Object} options - options to be used when sending the request to
	 * fabric-common service endpoint {Endorser} peer.
	 */
	constructor(query, options = {}) {
		this.query = query;
		this.requestTimeout = 3000; // default 3 seconds
		if (Number.isInteger(options.timeout)) {
			this.requestTimeout = options.timeout * 1000; // need ms;
		}
	}

	/**
	 * Sends a signed proposal to the specified peers. The peer endorsment
	 * responses are
	 * @param {Endorser[]} peers - The peers to query
	 * @returns {Object.<String, (QueryResponse | Error)>} Object with peer name keys and associated values that are either
	 * QueryResponse objects or Error objects.
	 */
	async evaluate(peers) {
		const method = 'evaluate';
		logger.debug('%s - start', method);

		const results = {};
		try {
			const responses = await this.query.send({targets: peers, requestTimeout: this.requestTimeout});
			if (responses) {
				if (responses.errors) {
					for (const resultError of responses.errors) {
						results[resultError.connection.name] = resultError;
						logger.debug('%s - problem with query to peer %s error:%s', method, resultError.connection.name, resultError);
					}
				}
				if (responses.responses) {
					for (const peer_response of responses.responses) {
						if (peer_response.response) {
							const response = {};
							response.status = peer_response.response.status;
							response.payload = peer_response.response.payload;
							response.message = peer_response.response.message;
							response.isEndorsed = peer_response.endorsement ? true : false;
							results[peer_response.connection.name] = response;
							logger.debug('%s - have results - peer: %s with status:%s',
								method,
								peer_response.connection.name,
								response.status);
						}
					}
				}

				// check to be sure we got results for each peer requested
				for (const peer of peers) {
					if (!results[peer.name]) {
						logger.error('%s - no results for peer: %s', method, peer.name);
						results[peer.name] = new Error('Missing response from peer');
					}
				}
			} else {
				throw Error('No responses returned for query');
			}
		} catch (error) {
			// if we get an error, return this error for each peer
			for (const peer of peers) {
				results[peer.name] = error;
				logger.error('%s - problem with query to peer %s error:%s', method, peer.name, error);
			}
		}

		logger.debug('%s - end', method);
		return results;
	}
}

module.exports = Query;
