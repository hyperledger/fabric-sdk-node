/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { CommitEvent, CommitError, CommitListener, Transaction, Network } from 'fabric-network';
import { Endorser } from 'fabric-common';

// --- Plug-in event handler sample where the user takes full responsibility for event handling

/**
 * Handler that does nothing but make test the calling
 */
class SampleTransactionEventHandler {

	private readonly network: Network;
	private readonly transactionId: string;
	private readonly options: any;
	private readonly notificationPromise: any;
	private _resolveNotificationPromise: any;
	private _rejectNotificationPromise: any;
	private timeoutHandler: any;
	private readonly listener: CommitListener;
	private readonly endorsers: Endorser[];
	private eventCount: number = 0;

	/**
	 * Constructor.
	 * @param {Transaction} transaction Transaction ID for which events will be received.
	 * @param {ChannelEventHub[]} eventHubs Event hubs from which events will be received.
	 * @param {Object} [options] Additional configuration options.
	 * @param {Number} [options.commitTimeout] Time in seconds to wait for commit events to be received.
	 */
	constructor(transaction: Transaction, options: any) {
		this.network = transaction.getNetwork();
		this.transactionId = transaction.transactionId;
		this.options = options;
		this.endorsers = this.network.channel.getEndorsers();

		this.notificationPromise = new Promise((resolve: any, reject: any): any => {
			this._resolveNotificationPromise = resolve;
			this._rejectNotificationPromise = reject;
		});

		this.listener = (error, event) => this._eventCallback(error, event);
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @throws {Error} if not in a state where the handling strategy can be satisfied and the transaction should
	 * be aborted. For example, if insufficient event hubs could be connected.
	 */
	async startListening(): Promise<void> {
		this._setListenTimeout();
		await this.network.addCommitListener(this.listener, this.endorsers, this.transactionId);
	}

	/**
	 * Wait until enough events have been received from the event hubs to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
	 */
	async waitForEvents(): Promise<void> {
		await this.notificationPromise;
	}

	_eventCallback(error?: CommitError, event?: CommitEvent) {
		this.eventCount++;
		console.log(`_eventCallback:${this.eventCount}`, error, event); // tslint:disable-line:no-console

		if (event?.status !== 'VALID') {
			return this._fail(new Error(event?.status));
		}

		if (this.eventCount >= this.endorsers.length) {
			return this._success();
		}
	}

	/**
	 * Cancel listening for events.
	 */
	cancelListening(): void {
		clearTimeout(this.timeoutHandler);
		this.network.removeCommitListener(this.listener);
	}

	_setListenTimeout(): void {
		this.timeoutHandler = setTimeout(() => {
			this._fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`));
		}, 30 * 1000);
	}

	_fail(error: Error): void {
		this.cancelListening();
		this._rejectNotificationPromise(error);
	}

	_success(): void {
		this.cancelListening();
		this._resolveNotificationPromise();
	}
}

/**
 * Factory function called for each submitted transaction, which supplies a commit handler instance for that
 * transaction. This implementation returns a commit handler that listens to all eventing peers in the user's
 * organization.
 * @param {Transaction} transaction The transaction being submitted.
 * @param {Network} network The network where the transaction is being submitted.
 */
function createTransactionEventHandler(transaction: Transaction, options: any): SampleTransactionEventHandler {
	return new SampleTransactionEventHandler(transaction, options);
}

module.exports = createTransactionEventHandler;
