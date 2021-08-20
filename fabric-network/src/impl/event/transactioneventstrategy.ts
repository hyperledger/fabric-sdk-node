/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Endorser} from 'fabric-common';

import * as Logger from '../../logger';
const logger = Logger.getLogger('TransactionEventStrategy');

export interface EventCount {
	success: number;
	fail: number;
	readonly expected: number;
}

export type SuccessCallback = () => void;
export type FailCallback = (error: Error) => void;

/**
 * Event handling strategy base class that keeps counts of success and fail events to allow
 * subclasses to implement concrete event handling strategies. On each success or fail event,
 * the checkCompletion() function is called, which must be implemented by
 * subclasses.
 *
 * Instances of the strategy are stateful and must only be used for a single transaction.
 * @private
 * @class
 */
export abstract class TransactionEventStrategy {
	private readonly peers: Endorser[];
	private readonly counts: EventCount;

	/**
	 * Constructor.
	 * @param {Endorser[]} peers - Peers for which to process events.
	 */
	constructor(peers: Endorser[]) {
		if (!peers || !Array.isArray(peers) || peers.length < 1) {
			const message = 'No peers for strategy';
			logger.error('constructor:', message);
			throw new Error(message);
		}

		this.peers = peers;
		this.counts = {
			success: 0,
			fail: 0,
			expected: peers.length
		};
	}

	/**
	 * Called by event handler to obtain the peers to which it should listen.
	 * @returns {Endorser[]} Peers.
	 */
	getPeers(): Endorser[] {
		return this.peers;
	}

	/**
	 * Called when an event is received.
	 * @param {Function} successFn Callback function to invoke if this event satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this event fails the strategy.
	 */
	eventReceived(successFn: SuccessCallback, failFn: FailCallback): void {
		this.counts.success++;
		this.checkCompletion(this.counts, successFn, failFn);
	}

	/**
	 * Called when an error is received.
	 * @param {Function} successFn Callback function to invoke if this error satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this error fails the strategy.
	 */
	errorReceived(successFn: SuccessCallback, failFn: FailCallback): void {
		this.counts.fail++;
		this.checkCompletion(this.counts, successFn, failFn);
	}
	/**
	 * @typedef {Object} EventCount
	 * @property {Number} success Number of successful events received.
	 * @property {Number} fail Number of errors received.
	 * @property {Number} expected Number of event services for which response events (or errors) are expected.
	 */

	/**
	 * Called when a successful event or error is received.
	 * @private
	 * @param {EventCount} counts Count of events received.
	 * @param {Function} successFn Callback function to invoke if the strategy is successful.
	 * @param {Function} failFn Callback function to invoke if the strategy fails.
	 */
	protected abstract checkCompletion(counts: EventCount, successFn: SuccessCallback, failFn: FailCallback): void;
}
