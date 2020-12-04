/*
 * Copyright 2018, 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricError } from '../../errors/fabricerror';
import { QueryHandler } from './queryhandler';
import { Query } from './query';

import { Endorser } from 'fabric-common';

import util = require('util');

import * as Logger from '../../logger';
const logger = Logger.getLogger('SingleQueryHandler');

export class SingleQueryHandler implements QueryHandler {
	private readonly peers: Endorser[];
	private currentPeerIndex = 0;

	constructor(peers: Endorser[]) {
		logger.debug('constructor: peers=%j', peers.map((peer) => peer.name));
		this.peers = peers;
	}

	async evaluate(query: Query) {
		const method = 'evaluate';
		logger.debug('%s - start', method);

		const startPeerIndex = this.currentPeerIndex;
		const errorMessages = [];

		for (let i = 0; i < this.peers.length; i++) {
			const peerIndex = (startPeerIndex + i) % this.peers.length;
			this.currentPeerIndex = peerIndex;

			const peer = this.peers[peerIndex];
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
					const responseError = Object.assign(new Error('peer error response: ' + result.message), result);
					throw responseError;
				}
			}
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new FabricError(message);
		logger.error('evaluate:', error);
		throw error;
	}
}
