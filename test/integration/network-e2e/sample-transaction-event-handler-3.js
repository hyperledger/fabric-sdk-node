/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//--- Plug-in event handler sample where we provide both an event handler factory and our transaction event handler.
//--- The user just implements a plug-in strategy for the event handler, which exposes an additional API.

const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

class SampleEventHandlerStrategy {
	/**
	 * Constructor.
	 * @param {Promise.ChannelEventHub[]} eventHubsPromise Promise to event hubs for which to process events.
	 */
	constructor(eventHubsPromise) {
		this.eventHubsPromise = eventHubsPromise;
	}

	/**
	 * Called by event handler to obtain the event hubs to which it should listen. Gives an opportunity for
	 * the strategy to store information on the events it expects to receive for later use in event handling.
	 * @async
	 * @returns {ChannelEventHubs[]} connected event hubs.
	 * @throws {Error} if the connected event hubs do not satisfy the strategy.
	 */
	async getConnectedEventHubs() {
		const eventHubs = await this.eventHubsPromise;
		const connectedEventHubs = eventHubs.filter((eventHub) => eventHub.isconnected());

		this.eventCounts = {
			expected: connectedEventHubs.length,
			received: 0
		};

		return connectedEventHubs;
	}

	/**
	 * Called when an event is received.
	 * @param {Function} successFn Callback function to invoke if this event satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this event fails the strategy.
	 */
	eventReceived(successFn, failFn) {
		this._responseReceived(successFn, failFn);
	}

	/**
	 * Called when an error is received.
	 * @param {Function} successFn Callback function to invoke if this error satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this error fails the strategy.
	 */
	errorReceived(successFn, failFn) {
		this._responseReceived(successFn, failFn);
	}

	/**
	 * Simple event handling logic that is satisfied once all of the event hubs have either responded with valid
	 * events or disconnected.
	 * @param {Function} successFn Callback function to invoke if the strategy is successful.
	 * @param {Function} failFn Callback function to invoke if the strategy fails.
	 */
	_responseReceived(successFn, failFn) { // eslint-disable-line no-unused-vars
		this.eventCounts.received++;
		if (this.eventCounts.received === this.eventCounts.expected) {
			successFn();
		}
	}
}

function createTransactionEventHandler(transactionId, network) {
	const peers = network.getChannel().getPeersForOrg();
	const eventHubsPromise = network.getEventHubFactory().getEventHubs(peers);
	const strategy = new SampleEventHandlerStrategy(eventHubsPromise);
	const options = {
		commitTimeout: 120
	};
	return new TransactionEventHandler(transactionId, strategy, options);
}

module.exports = {
	sampleEventStrategy: createTransactionEventHandler
};
