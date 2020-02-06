/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BaseEventListener = require('./baseeventlistener');
const logger = require('fabric-network/lib/logger').getLogger('CommitEventListener');

/**
 * The Commit Event Listener handles transaction commit events
 *
 * @memberof module:fabric-network
 * @class
 * @private
 */
class CommitEventListener extends BaseEventListener {
	/**
	 *
	 * @param {module:fabric-network.Network} network The fabric network
	 * @param {string} transactionId the transaction id being listened to
	 * @param {Function} eventCallback The event callback called when a transaction is committed.
	 * It has signature (err, transactionId, status, blockNumber)
	 * @param {module:fabric-network.Network~EventListenerOptions} options
	 */
	constructor(network, eventCallback, options) {
		super(network, eventCallback, options);
		if (options && options.transactionId) {
			this.transactionId = options.transactionId;
		} else {
			this.transactionId = 'all'; // default to get all
		}
	}

	_registerListener() {
		this.registration  = this.eventService.registerTransactionListener(
			this.transactionId,
			this.onEvent.bind(this),
			this.eventServiceOptions
		);
	}

	/*
	 * This is the called by the base.onEvent() class event processing.
	 * This will be the sending of the unique data for this event Listener type
	 * to the user's callback.
	 */
	async _onEvent(event) {
		const method = `_onEvent[${this.listenerCount}]`;
		logger.debug('%s - start', method);

		const {blockNumber, transactionId, status} = event;

		logger.debug('%s - event status %s for transaction %s', method, status, transactionId);

		try {
			logger.debug('%s - calling user callback', method);
			await this.eventCallback(null, blockNumber.toString(), transactionId, status);
			logger.debug('%s - completed calling user callback', method);
		} catch (err) {
			logger.error('%s - Error executing callback: %s', method, err);
		}
	}
}

module.exports = CommitEventListener;
