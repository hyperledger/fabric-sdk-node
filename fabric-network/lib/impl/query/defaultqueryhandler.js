/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');
const QueryHandler = require('../../api/queryhandler');
const logger = require('../../logger').getLogger('DefaultQueryHandler');

/**
 * Class to provide intelligence on how to query peers when peers are not available.
 * This is an initial implementation which could iterate and perhaps be pushed back
 * into the fabric node-sdk in future
 *
 * The current implementation creates a list of query peers. The top of the list
 * contains peers for the callers org, followed by peers in all other orgs.
 * It will search through the list looking for a peer to respond successfully to
 * a query then remember that peer, until it fails, then it will start looking
 * for a new peer from the top of the list, ignoring the one that just failed.
 * @private
 */
class DefaultQueryHandler extends QueryHandler {

	/**
     * constructor
     */
	constructor(channel, mspId, peerMap, queryOptions) {
		const method = 'constructor';
		super(channel, mspId, peerMap, queryOptions);
		this.allQueryablePeers = [];
		const peersInMspId = peerMap.get(mspId);
		if (peersInMspId && peersInMspId.length > 0) {
			this.allQueryablePeers = peersInMspId.filter((peer) => {
				return peer.isInRole(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE);
			});
		}
		logger.debug('%s - queryable peers %j', method, this.allQueryablePeers.map((peer) => {
			return peer.getName();
		}));
		this.queryPeerIndex = -1;
	}

	/**
     * Query Chaincode using the following rules
     * 1. try the last successful peer
     * 2. If that fails or this is the first time try all query peers in order
     * Currently the implementation restricts to only peers in the same organisation, not across the channel.
	 * @param {string} chaincodeId the chaincode id to use
     * @param {string} functionName the function name to invoke
     * @param {string[]} args the arguments
     * @param {TransactionID} txId the transaction id to use
	 * @param {object} [transientMap] transient data
     * @returns {object} asynchronous response or async error.
     */
	async queryChaincode(chaincodeId, txId, functionName, args, transientMap) {
		const method = 'queryChaincode';
		let success = false;
		let payload;
		const allErrors = [];

		if (this.allQueryablePeers.length === 0) {
			const newError = new Error('No peers have been provided that can be queried');
			throw newError;
		}

		// try the last successful peer
		if (this.queryPeerIndex !== -1) {
			const peer = this.allQueryablePeers[this.queryPeerIndex];
			try {
				logger.debug('%s - querying previously successful peer: %s', method, peer.getName());
				payload = await this._querySinglePeer(peer, chaincodeId, txId, functionName, args, transientMap);
				success = true;
			} catch (error) {
				logger.warn('%s - error response trying previously successful peer: %s. Error: %s', method, peer.getName(), error);
				allErrors.push(error);
			}
		}

		if (!success) {

			// last successful peer failed or this is the first attempt at any query, so try to find a
			// new peer to query.
			const failedPeer = this.queryPeerIndex;  // could be -1 if first attempt
			this.queryPeerIndex = -1;
			for (let i = 0; i < this.allQueryablePeers.length && !success; i++) {
				if (i === failedPeer) {
					continue;
				}
				const peer = this.allQueryablePeers[i];
				try {
					logger.debug('%s - querying new peer: %s', method, peer.getName());
					payload = await this._querySinglePeer(peer, chaincodeId, txId, functionName, args, transientMap);
					this.queryPeerIndex = i;
					success = true;
					break;
				} catch (error) {
					logger.warn('%s - error response trying new peer: %s. Error: %s', method, peer.getName(), error);
					allErrors.push(error);
				}
			}
		}

		if (!success) {
			const newError = new Error(`No peers available to query. last error was ${allErrors[allErrors.length - 1]}`);
			logger.error('%s - No peers out of a total of %i were available to query', method, this.allQueryablePeers.length);
			throw newError;
		}

		if (payload instanceof Error) {
			throw payload;
		}

		return payload;

	}

	/**
     * Send a query
     * @param {Peer} peer The peer to query
     * @param {string} chaincodeId the chaincode id to use
     * @param {string} functionName the function name of the query
     * @param {array} args the arguments to ass
     * @param {TransactionID} txId the transaction id to use
	 * @param {object} [transientMap] transient data
     * @returns {Buffer} asynchronous response to query
     */
	async _querySinglePeer(peer, chaincodeId, txId, functionName, args, transientMap) {
		const method = '_querySinglePeer';
		const request = {
			targets: [peer],
			chaincodeId,
			txId: txId,
			fcn: functionName,
			args: args
		};
		if (transientMap) {
			request.transientMap = transientMap;
		}

		const payloads = await this.channel.queryByChaincode(request);
		if (!payloads.length) {
			logger.error('%s - No payloads were returned from request %s', method, functionName);
			throw new Error('No payloads were returned from request:' + functionName);
		}
		const payload = payloads[0];

		// If the error has a isProposalResponse then we know this got to the peer so we consider
		// this as a valid response to the query and don't need to find another peer.
		// otherwise we should throw the error
		if (payload instanceof Error && !payload.isProposalResponse) {
			throw payload;
		}

		return payload;

	}
}

module.exports = DefaultQueryHandler;

