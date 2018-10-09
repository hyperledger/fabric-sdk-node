/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//--- Plug-in event handler sample where we provide an event hub factory to help user obtain and connect event hubs

/**
 * Handler that listens for commit events for a specific transaction from a set of event hubs.
 * A new instance of this class should be created to handle each transaction as it maintains state
 * related to events for a given transaction.
 * @class
 */
class SampleTransactionEventHandler {
	/**
	 * Constructor.
	 * @param {String} transactionId Transaction ID for which events will be received.
	 * @param {Promise.ChannelEventHub[]} eventHubsPromise Connected event hubs from which events will be received.
	 * @param {Object} [options] Additional configuration options.
	 * @param {Number} [options.commitTimeout] Time in seconds to wait for commit events to be reveived.
	 */
	constructor(transactionId, eventHubsPromise, options) {
		this.transactionId = transactionId;
		this.eventHubsPromise = eventHubsPromise;

		const defaultOptions = {
			commitTimeout: 120 // 2 minutes
		};
		this.options = Object.assign(defaultOptions, options);

		this.eventHubs = [];

		this.notificationPromise = new Promise((resolve, reject) => {
			this._txResolve = resolve;
			this._txReject = reject;
		});
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @async
	 * @throws {Error} if not in a state where the handling strategy can be satified and the transaction should
	 * be aborted. For example, if insufficient event hubs could be connected.
	 */
	async startListening() {
		this.eventHubs = await this._getConnectedEventHubs();
		if (this.eventHubs.length > 0) {
			this.eventCounts = {
				expected: this.eventHubs.length,
				received: 0
			};
			this._registerTxEventListeners();
			this._setListenTimeout();
		} else {
			// Assume success if unable to listen for events
			this._txResolve();
		}
	}

	/**
     * Wait until enough events have been received from the event hubs to satisfy the event handling strategy.
     * @async
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
		this.eventHubs.forEach((eventHub) => {
			eventHub.unregisterTxEvent(this.transactionId);
		});
	}

	async _getConnectedEventHubs() {
		const eventHubs = await this.eventHubsPromise;
		return eventHubs.filter((eventHub) => eventHub.isconnected());
	}

	_registerTxEventListeners() {
		for (const eventHub of this.eventHubs) {
			eventHub.registerTxEvent(this.transactionId,
				(txId, code) => this._onEvent(eventHub, txId, code),
				(err) => this._onError(eventHub, err));
		}
	}

	_onEvent(eventHub, txId, code) {
		eventHub.unregisterTxEvent(this.transactionId);
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
		eventHub.unregisterTxEvent(this.transactionId);
		// --------------------------------------------------
		// Handle processing of event hub disconnections here
		// --------------------------------------------------
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

	_setListenTimeout() {
		if (this.options.commitTimeout > 0) {
			return;
		}

		this.timeoutHandler = setTimeout(() => {
			this._fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`));
		}, this.options.commitTimeout * 1000);
	}

	_fail(error) {
		this.cancelListening();
		this._txReject(error);
	}

	_success() {
		this.cancelListening();
		this._txResolve();
	}
}

function createTransactionEventHandler(transactionId, network) {
	const channel = network.getChannel();
	const peers = channel.getPeersForOrg();
	const eventHubsPromise = network.getEventHubFactory().getEventHubs(peers);
	return new SampleTransactionEventHandler(transactionId, eventHubsPromise);
}

module.exports = {
	sampleEventStrategy: createTransactionEventHandler
};
