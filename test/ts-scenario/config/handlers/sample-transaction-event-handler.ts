/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Network, Transaction } from 'fabric-network';
import { ChannelPeer, ChannelEventHub } from 'fabric-client';
import Client = require('fabric-client');

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

	protected transactionId: string;
	protected eventHubs: ChannelEventHub[];
	protected options: any;
	protected notificationPromise: any;
	protected _resolveNotificationPromise: any;
	protected _rejectNotificationPromise: any;
	protected eventCounts: any;
	protected timeoutHandler: any;

	/**
	 * Constructor.
	 * @param {Transaction} transaction Transaction ID for which events will be received.
	 * @param {ChannelEventHub[]} eventHubs Event hubs from which events will be received.
	 * @param {Object} [options] Additional configuration options.
	 * @param {Number} [options.commitTimeout] Time in seconds to wait for commit events to be received.
	 */
	constructor(transaction: Transaction, eventHubs: ChannelEventHub[], options: object) {
		this.transactionId = transaction.getTransactionID().getTransactionID();
		this.eventHubs = eventHubs;

		const defaultOptions: any = {
			commitTimeout: 120 // 2 minutes (120 seconds)
		};
		this.options = Object.assign(defaultOptions, options);

		this.notificationPromise = new Promise((resolve: any, reject: any): any => {
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
	 * @throws {Error} if not in a state where the handling strategy can be satisfied and the transaction should
	 * be aborted. For example, if insufficient event hubs could be connected.
	 */
	async startListening(): Promise<void> {
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
	async waitForEvents(): Promise<void> {
		await this.notificationPromise;
	}

	/**
	 * Cancel listening for events.
	 */
	cancelListening(): void {
		clearTimeout(this.timeoutHandler);
		this.eventHubs.forEach((eventHub: ChannelEventHub) => eventHub.unregisterTxEvent(this.transactionId));
	}

	_setListenTimeout(): void {
		if (this.options.commitTimeout <= 0) {
			return;
		}

		this.timeoutHandler = setTimeout(() => {
			this._fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`));
		}, this.options.commitTimeout * 1000);
	}

	_registerTxEventListeners(): void {
		this.eventHubs.forEach((eventHub: ChannelEventHub) => {
			eventHub.registerTxEvent(
				this.transactionId,
				(txId: string, code: string) => this._onEvent(eventHub, txId, code),
				(err: Error) => this._onError(eventHub, err)
			);
			eventHub.connect();
		});
	}

	_onEvent(eventHub: ChannelEventHub, txId: string, code: string): void {
		if (code !== 'VALID') {
			// Peer has rejected the transaction so stop listening with a failure
			const message: string = `Peer ${eventHub.getPeerAddr()} has rejected transaction ${txId} with code ${code}`;
			this._fail(new Error(message));
		} else {
			// --------------------------------------------------------------
			// Handle processing of successful transaction commit events here
			// --------------------------------------------------------------
			this._responseReceived();
		}
	}

	_onError(eventHub: ChannelEventHub, err: Error): void  { // eslint-disable-line no-unused-vars
		// ----------------------------------------------------------
		// Handle processing of event hub communication failures here
		// ----------------------------------------------------------
		this._responseReceived();
	}

	/**
	 * Simple event handling logic that is satisfied once all of the event hubs have either responded with valid
	 * events or disconnected.
	 */
	_responseReceived(): void {
		this.eventCounts.received++;
		if (this.eventCounts.received === this.eventCounts.expected) {
			this._success();
		}
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
function createTransactionEventHandler(transaction: Transaction, network: Network): SampleTransactionEventHandler {
	const channel: Client.Channel = network.getChannel();
	const peers: ChannelPeer[] = channel.getPeersForOrg().filter(hasEventSourceRole);
	const eventHubs: ChannelEventHub[] = peers.map((peer: ChannelPeer) => channel.getChannelEventHub(peer.getName()));
	return new SampleTransactionEventHandler(transaction, eventHubs, {});
}

function hasEventSourceRole(peer: ChannelPeer): boolean {
	return peer.isInRole('eventSource');
}

module.exports = createTransactionEventHandler;
