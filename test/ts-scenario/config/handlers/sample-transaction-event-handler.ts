/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Transaction } from 'fabric-network';

// --- Plug-in event handler sample where the user takes full responsibility for event handling

/**
 * Handler that does nothing but make test the calling
 */
class SampleTransactionEventHandler {

	protected transactionId: string;
	protected options: any;
	protected notificationPromise: any;
	protected _resolveNotificationPromise: any;
	protected _rejectNotificationPromise: any;
	protected timeoutHandler: any;

	/**
	 * Constructor.
	 * @param {Transaction} transaction Transaction ID for which events will be received.
	 * @param {ChannelEventHub[]} eventHubs Event hubs from which events will be received.
	 * @param {Object} [options] Additional configuration options.
	 * @param {Number} [options.commitTimeout] Time in seconds to wait for commit events to be received.
	 */
	constructor(transaction: Transaction, options: any) {
		this.transactionId = options.transactionId;
		this.options = options;

		this.notificationPromise = new Promise((resolve: any, reject: any): any => {
			this._resolveNotificationPromise = resolve;
			this._rejectNotificationPromise = reject;
		});
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @throws {Error} if not in a state where the handling strategy can be satisfied and the transaction should
	 * be aborted. For example, if insufficient event hubs could be connected.
	 */
	async startListening(): Promise<void> {
		this._setListenTimeout();
	}

	/**
	 * Wait until enough events have been received from the event hubs to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
	 */
	async waitForEvents(): Promise<void> {
		await this.notificationPromise;
	}

	/**
	 * Cancel listening for events.
	 */
	cancelListening(): void {
		clearTimeout(this.timeoutHandler);
	}

	_setListenTimeout(): void {
		this.timeoutHandler = setTimeout(() => {
			// this._fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`));
			this._success();
		}, 1000);
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
