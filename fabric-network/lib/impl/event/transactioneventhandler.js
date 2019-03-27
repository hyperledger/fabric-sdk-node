/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const TimeoutError = require('fabric-network/lib/errors/timeouterror');

const logger = require('fabric-network/lib/logger').getLogger('TransactionEventHandler');
const util = require('util');

/**
 * Handles events for a given transaction. Used to wait for a submitted transaction to be successfully commited to
 * the ledger.
 * Delegates to an event strategy to decide whether events or errors received should be interpreted as success or
 * failure of a transaction.
 * @private
 * @class
 */
class TransactionEventHandler {
	/**
	 * @typedef {Object} TransactionEventHandlerOptions
	 * @property {Number} [commitTimeout = 0] Number of seconds to wait for transaction completion. A value of zero
	 * indicates that the handler should wait indefinitely.
	 */

	/**
	 * Constructor.
	 * @private
	 * @param {Transaction} transaction Traneaction object.
	 * @param {Object} strategy Event strategy implementation.
	 * @param {TransactionEventHandlerOptions} [options] Additional options.
	 */
	constructor(transaction, strategy, options) {
		this.transaction = transaction;
		this.transactionId = transaction.getTransactionID().getTransactionID();
		this.strategy = strategy;

		const defaultOptions = {
			commitTimeout: 0 // No timeout by default
		};
		this.options = Object.assign(defaultOptions, options);

		logger.debug('constructor:', util.format('transactionId = %s, options = %j', this.transactionId, this.options));

		this.eventHubs = strategy.getEventHubs();
		this.respondedEventHubs = new Set();

		this.notificationPromise = new Promise((resolve, reject) => {
			this._resolveNotificationPromise = resolve;
			this._rejectNotificationPromise = reject;
		});
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @async
	 */
	async startListening() {
		if (this.eventHubs.length > 0) {
			this._setListenTimeout();
			await this._registerTxEventListeners();
		} else {
			logger.debug('startListening: No event hubs');
			this._resolveNotificationPromise();
		}
	}

	_setListenTimeout() {
		if (this.options.commitTimeout <= 0) {
			return;
		}

		logger.debug('_setListenTimeout:', `setTimeout(${this.options.commitTimeout}) for transaction ${this.transactionId}`);

		this.timeoutHandler = setTimeout(() => {
			this._timeoutFail();
		}, this.options.commitTimeout * 1000);
	}

	async _registerTxEventListeners() {
		const registrationOptions = {unregister: true, fixedEventHub: true};

		const promises = this.eventHubs.map((eventHub) => {
			return new Promise(async (resolve) => {
				logger.debug('_registerTxEventListeners:', `registerTxEvent(${this.transactionId}) for event hub:`, eventHub.getName());
				await this.transaction.addCommitListener((err, txId, code) => {
					if (err) {
						return this._onError(eventHub, err);
					}
					return this._onEvent(eventHub, txId, code);
				}, registrationOptions, eventHub);
				resolve();
			});
		});

		await Promise.all(promises);
	}

	_timeoutFail() {
		const unrespondedEventHubs = this.eventHubs
			.filter((eventHub) => !this.respondedEventHubs.has(eventHub))
			.map((eventHub) => eventHub.getName())
			.join(', ');
		const message = 'Event strategy not satisfied within the timeout period. No response received from event hubs: ' + unrespondedEventHubs;
		const error = new TimeoutError({
			message,
			transactionId: this.transactionId
		});
		this._strategyFail(error);
	}

	_onEvent(eventHub, txId, code) {
		logger.debug('_onEvent:', util.format('received event for %j with code %j', txId, code));

		this._receivedEventHubResponse(eventHub);
		if (code !== 'VALID') {
			const message = util.format('Peer %s has rejected transaction %j with code %j', eventHub.getPeerAddr(), txId, code);
			this._strategyFail(new Error(message));
		} else {
			this.strategy.eventReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
		}
	}

	_onError(eventHub, err) {
		logger.debug('_onError:', util.format('received error from peer %s: %s', eventHub.getPeerAddr(), err));

		this._receivedEventHubResponse(eventHub);
		this.strategy.errorReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
	}

	_receivedEventHubResponse(eventHub) {
		this.respondedEventHubs.add(eventHub);
	}

	/**
	 * Callback for the strategy to indicate successful commit of the transaction.
	 * @private
	 */
	_strategySuccess() {
		logger.debug('_strategySuccess:', util.format('strategy success for transaction %j', this.transactionId));

		this.cancelListening();
		this._resolveNotificationPromise();
	}

	/**
	 * Callback for the strategy to indicate failure of the transaction commit.
	 * @private
	 * @param {Error} error Reason for failure.
	 */
	_strategyFail(error) {
		logger.warn('_strategyFail:', util.format('strategy fail for transaction %j: %s', this.transactionId, error));

		this.cancelListening();
		this._rejectNotificationPromise(error);
	}

	/**
     * Wait until enough events have been received from the event hubs to satisfy the event handling strategy.
     * @async
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
     */
	async waitForEvents() {
		logger.debug('waitForEvents called');
		await this.notificationPromise;
	}

	/**
     * Cancel listening for events.
     */
	cancelListening() {
		logger.debug('cancelListening called');

		clearTimeout(this.timeoutHandler);
		this.eventHubs.forEach((eventHub) => eventHub.unregisterTxEvent(this.transactionId));
	}

}

module.exports = TransactionEventHandler;
