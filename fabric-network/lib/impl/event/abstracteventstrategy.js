/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const logger = require('fabric-network/lib/logger').getLogger('AbstractStrategy');

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
class AbstractEventStrategy {
	/**
	 * Constructor.
	 * @param {EventHubFactory} eventHubFactory Factory for obtaining event hubs for peers.
	 * @param {ChannelPeer[]} peers Peers from which to process events.
	 */
	constructor(eventHubFactory, peers) {
		if (!eventHubFactory) {
			const message = 'Event hub factory not set';
			logger.error('constructor:', message);
			throw new Error(message);
		}
		if (!peers || peers.length === 0) {
			const message = 'Peers not set';
			logger.error('constructor:', message);
			throw new Error(message);
		}

		this.eventHubFactory = eventHubFactory;
		this.peers = peers;
		this.counts = {
			success: 0,
			fail: 0,
			expected: 0
		};
	}

	/**
	 * Called by event handler to obtain the event hubs to which it should listen. Gives an opportunity for
	 * the strategy to store information on the events it expects to receive for later use in event handling.
	 * @async
	 * @throws {Error} if the connected event hubs do not satisfy the strategy.
	 */
	async getConnectedEventHubs() {
		const eventHubs = await this.eventHubFactory.getEventHubs(this.peers);
		const connectedEventHubs = eventHubs.filter((eventHub) => eventHub.isconnected());

		if (connectedEventHubs.length === 0) {
			const message = 'No available event hubs found for strategy';
			const eventHubNames = eventHubs.map((eventHub) => eventHub.getName());
			logger.error('getConnectedEventHubs:', message, eventHubNames);
			throw new Error(message);
		}

		this.counts.expected = connectedEventHubs.length;

		return connectedEventHubs;
	}

	/**
	 * Called when an event is received.
	 * @param {Function} successFn Callback function to invoke if this event satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this event fails the strategy.
	 */
	eventReceived(successFn, failFn) {
		this.counts.success++;
		this.checkCompletion(this.counts, successFn, failFn);
	}

	/**
	 * Called when an error is received.
	 * @param {Function} successFn Callback function to invoke if this error satisfies the strategy.
	 * @param {Function} failFn Callback function to invoke if this error fails the strategy.
	 */
	errorReceived(successFn, failFn) {
		this.counts.fail++;
		this.checkCompletion(this.counts, successFn, failFn);
	}
	/**
	 * @typedef {Object} EventCount
	 * @property {Number} success Number of successful events received.
	 * @property {Number} fail Number of errors received.
	 * @property {Number} expected Number of event hubs for which response events (or errors) are expected.
	 */

	/**
	 * Called when a successful event or error is received.
	 * @private
	 * @param {EventCount} counts Count of events received.
	 * @param {Function} successFn Callback function to invoke if the strategy is successful.
	 * @param {Function} failFn Callback function to invoke if the strategy fails.
	 */
	//eslint-disable-next-line no-unused-vars
	checkCompletion(counts, successFn, failFn) {
		throw new Error('AbstractEventStrategy.checkCompletion() not implemented');
	}

	reset() {
		this.counts.success = 0;
		this.counts.fail = 0;
	}
}

module.exports = AbstractEventStrategy;
