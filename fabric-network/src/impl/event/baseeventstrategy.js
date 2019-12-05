/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('BaseEventStrategy');

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
class BaseEventStrategy {
	/**
	 * Constructor.
	 * @param {EventService[]} eventServices - Event services for which to process events.
	 */
	constructor(eventServices) {
		if (!eventServices || !Array.isArray(eventServices)  || eventServices.length < 1) {
			const message = 'No event services for strategy';
			logger.error('constructor:', message);
			throw new Error(message);
		}

		this.eventServices = eventServices;
		this.counts = {
			success: 0,
			fail: 0,
			expected: eventServices.length
		};
	}

	/**
	 * Called by event handler to obtain the event services to which it should listen. Gives an opportunity for
	 * the strategy to store information on the events it expects to receive for later use in event handling.
	 * @returns {EventService[]} Event services.
	 */
	getEventServices() {
		return this.eventServices;
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
	 * @property {Number} expected Number of event services for which response events (or errors) are expected.
	 */

	/**
	 * Called when a successful event or error is received.
	 * @private
	 * @param {EventCount} counts Count of events received.
	 * @param {Function} successFn Callback function to invoke if the strategy is successful.
	 * @param {Function} failFn Callback function to invoke if the strategy fails.
	 */
	checkCompletion(counts, successFn, failFn) { // eslint-disable-line no-unused-vars
		throw new Error('BaseEventStrategy.checkCompletion() not implemented');
	}
}

module.exports = BaseEventStrategy;
