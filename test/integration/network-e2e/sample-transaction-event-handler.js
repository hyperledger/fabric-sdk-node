/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// --- Plug-in event handler sample where the user takes full responsibility for event hub connection and event handling

/**
 * Handler that listens for commit events for a specific transaction from a set of event hubs.
 * A new instance of this class is created to handle each transaction as it maintains state
 * related to events for a given transaction.
 *
 * This implementation will unblock once all the event hubs have either supplied a vaid transaction commit event or
 * disconnected.
 */
class SampleTransactionEventHandler {
	/**
	 * Constructor.
	 * @param {Transaction} transaction Transaction ID for which events will be received.
	 * @param {ChannelEventHub[]} eventHubs Event hubs from which events will be received.
	 * @param {Object} [options] Additional configuration options.
	 * @param {Number} [options.commitTimeout] Time in seconds to wait for commit events to be reveived.
	 */
	constructor(transaction, eventHubs, options) {
		this.transactionId = transaction.getTransactionID().getTransactionID();
		this.eventHubs = eventHubs;

		const defaultOptions = {
			commitTimeout: 120 // 2 minutes (120 seconds)
		};
		this.options = Object.assign(defaultOptions, options);

		this.notificationPromise = new Promise((resolve, reject) => {
			this._resolveNotificationPromise = resolve;
			this._rejectNotificationPromise = reject;
		});
		this.eventCounts = {
			expected: this.eventHubs.length,
			received: 0
		};
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @throws {Error} if not in a state where the handling strategy can be satified and the transaction should
	 * be aborted. For example, if insufficient event hubs could be connected.
	 */
	async startListening() {
		if (this.eventHubs.length > 0) {
			this._setListenTimeout();
			this._registerTxEventListeners();
		} else {
			// Assume success if no event hubs
			this._resolveNotificationPromise();
		}
	}

	/**
     * Wait until enough events have been received from the event hubs to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
     */
	async waitForEvents() {
		await this.notificationPromise;
	}

	/**
     * Cancel listening for events.
     */
	cancelListening() {
		clearTimeout(this.timeoutHandler);
		this.eventHubs.forEach(eventHub => eventHub.unregisterTxEvent(this.transactionId));
	}

	_setListenTimeout() {
		if (this.options.commitTimeout <= 0) {
			return;
		}

		this.timeoutHandler = setTimeout(() => {
			this._fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`));
		}, this.options.commitTimeout * 1000);
	}

	_registerTxEventListeners() {
		this.eventHubs.forEach(eventHub => {
			eventHub.registerTxEvent(
				this.transactionId,
				(txId, code) => this._onEvent(eventHub, txId, code),
				(err) => this._onError(eventHub, err)
			);
			eventHub.connect();
		});
	}

	_onEvent(eventHub, txId, code) {
		if (code !== 'VALID') {
			// Peer has rejected the transaction so stop listening with a failure
			const message = `Peer ${eventHub.getPeerAddr()} has rejected transaction ${txId} with code ${code}`;
			this._fail(new Error(message));
		} else {
			// --------------------------------------------------------------
			// Handle processing of successful transaction commit events here
			// --------------------------------------------------------------
			this._responseReceived();
		}
	}

	_onError(eventHub, err) { // eslint-disable-line no-unused-vars
		// ----------------------------------------------------------
		// Handle processing of event hub communication failures here
		// ----------------------------------------------------------
		this._responseReceived();
	}

	/**
	 * Simple event handling logic that is satisfied once all of the event hubs have either responded with valid
	 * events or disconnected.
	 */
	_responseReceived() {
		this.eventCounts.received++;
		if (this.eventCounts.received === this.eventCounts.expected) {
			this._success();
		}
	}

	_fail(error) {
		this.cancelListening();
		this._rejectNotificationPromise(error);
	}

	_success() {
		this.cancelListening();
		this._resolveNotificationPromise();
	}
}

/**
 * Factory function called for each submitted transaction, which supplies a commit handler instance for that
 * transaction. This implementation returns a commit handler that listens to all eventing peers in the user's
 * organization.
 * @param {Transaction} transaction The transaction being submitted.
 * @param {DefaultEventHandlerOptions} [options] Options for the event handler capability.
 */
function createTransactionEventHandler(transaction, options) {
	const network = transaction.getNetwork();
	const channel = network.getChannel();
	const peers = channel.getPeersForOrg().filter(hasEventSourceRole);
	const eventHubs = peers.map(peer => channel.getChannelEventHub(peer.getName()));
	return new SampleTransactionEventHandler(transaction, eventHubs, options);
}

function hasEventSourceRole(peer) {
	return peer.isInRole('eventSource');
}

module.exports = createTransactionEventHandler;
