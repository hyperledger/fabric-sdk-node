/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('../../logger').getLogger('TransactionEventHandler');
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
	 * @property {Number} [timeout = 0] Number of seconds to wait for transaction completion. A value of zero indicates
	 * that the handler should wait indefinitely.
	 */

	/**
	 * Constructor.
	 * @private
	 * @param {String} transactionId Transaction ID.
	 * @param {Object} strategy Event strategy implementation.
	 * @param {TransactionEventHandlerOptions} [options] Additional options.
	 */
	constructor(transactionId, strategy, options) {
		this.transactionId = transactionId;
		this.strategy = strategy;

		const defaultOptions = {
			timeout: 0 // No timeout by default
		};
		this.options = Object.assign(defaultOptions, options);

		logger.debug('constructor:', util.format('transactionId = %s, options = %O', this.transactionId, this.options));

		this.eventHubs = [];
		// Kick off the async connection of event hubs as early as possible
		this.eventHubsConnectionPromise = strategy.getConnectedEventHubs().then((eventHubs) => {
			this.eventHubs = eventHubs;
		});

		this.notificationPromise = new Promise((resolve, reject) => {
			this._txResolve = resolve;
			this._txReject = reject;
		});
	}

	/**
	 * Called to initiate listening for transaction events.
	 * @async
	 */
	async startListening() {
		await this.eventHubsConnectionPromise;
		this._setListenTimeout();

		for (const eventHub of this.eventHubs) {
			logger.debug('startListening:', `registerTxEvent(${this.transactionId}) for event hub:`, eventHub.getName());

			eventHub.registerTxEvent(this.transactionId,
				(txId, code) => this._onEvent(eventHub, txId, code),
				(err) => this._onError(eventHub, err));
		}
	}

	_setListenTimeout() {
		if (this.options.timeout <= 0) {
			return;
		}

		logger.debug('_setListenTimeout:', `setTimeout(${this.options.timeout}) for transaction ${this.transactionId}`);

		this.timeoutHandler = setTimeout(() => {
			this._strategyFail(new Error('Event strategy not satisified within the timeout period'));
		}, this.options.timeout * 1000);
	}

	_onEvent(eventHub, txId, code) {
		logger.debug('_onEvent:', util.format('received event for %j with code %j', txId, code));

		eventHub.unregisterTxEvent(this.transactionId);
		if (code !== 'VALID') {
			const message = util.format('Peer %s has rejected transaction %j with code %j', eventHub.getPeerAddr(), txId, code);
			this._strategyFail(new Error(message));
		} else {
			this.strategy.eventReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
		}
	}

	_onError(eventHub, err) {
		logger.info('_onError:', util.format('received error from peer %s: %s', eventHub.getPeerAddr(), err));

		eventHub.unregisterTxEvent(this.transactionId);
		this.strategy.errorReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
	}

	/**
	 * Callback for the strategy to indicate successful commit of the transaction.
	 * @private
	 */
	_strategySuccess() {
		logger.info('_strategySuccess:', util.format('strategy success for transaction %j', this.transactionId));

		this.cancelListening();
		this._txResolve();
	}

	/**
	 * Callback for the strategy to indicate failure of the transaction commit.
	 * @private
	 * @param {Error} error Reason for failure.
	 */
	_strategyFail(error) {
		logger.warn('_strategyFail:', util.format('strategy fail for transaction %j: %s', this.transactionId, error));

		this.cancelListening();
		this._txReject(error);
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
		for (const eventHub of this.eventHubs) {
			eventHub.unregisterTxEvent(this.transactionId);
		}
	}

}

module.exports = TransactionEventHandler;
