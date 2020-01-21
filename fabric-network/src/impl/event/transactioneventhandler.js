/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const TimeoutError = require('fabric-network/lib/errors/timeouterror');

const logger = require('fabric-network/lib/logger').getLogger('TransactionEventHandler');

/**
 * Handles events for a given transaction. Used to wait for a submitted transaction to be successfully commited to
 * the ledger.
 * Delegates to an event strategy to decide whether events or errors received should be interpreted as success or
 * failure of a transaction.
 * @private
 */
class TransactionEventHandler {
	/**
	 * @typedef {Object} TransactionOptions
	 * @property {Number} [commitTimeout = 0] Number of seconds to wait for transaction completion. A value of zero
	 * indicates that the handler should wait indefinitely.
	 */

	/**
	 * Constructor.
	 * @private
	 * @param {Transaction} transaction - Transaction object.
	 * @param {Object} strategy - Event strategy implementation.
	 * @param {TransactionOptions} [options] Additional options.
	 */
	constructor(transaction, strategy, options) {
		const method = 'constructor';
		logger.debug('%s - start', method);

		this.transaction = transaction;
		this.transactionId = transaction.transactionId;
		this.strategy = strategy;

		const defaultOptions = {
			commitTimeout: 30
		};
		this.options = Object.assign(defaultOptions, options);

		logger.debug('%s: transactionId = %s, options = %j', method, this.transactionId, this.options);

		this.eventServices = strategy.getEventServices();
		this.activeListeners = new Set();
		this.respondedEventServices = new Set();

		this.notificationPromise = new Promise((resolve, reject) => {
			this._resolveNotificationPromise = resolve;
			this._rejectNotificationPromise = reject;
		});
	}

	/**
	 * Called to initiate listening for transaction events.
	 */
	async startListening() {
		const method = 'startListening';
		logger.debug('%s - start', method);

		if (this.eventServices && this.eventServices.length > 0) {
			logger.debug('%s - have eventService list - start monitoring', method);
			this._setListenTimeout();
			await this._startEventServices();
			this._registerTxEventListeners();
		} else {
			logger.error('%s - No event services', method);
			// shutdown the monitoring
			this._resolveNotificationPromise('No EventServices');
		}
	}

	async _startEventServices() {
		const method = '_startEventServices';
		logger.debug('%s - start', method);
		logger.debug('%s - have %s eventServices', method, this.eventServices.length);

		for (const eventService of this.eventServices) {
			try {
				logger.debug('%s - start event service for %', method, eventService.name);
				await this.transaction.getNetwork().eventServiceManager.startEventService(eventService);
			} catch (error) {
				logger.error('%s - %s', method, error);
				this._onError(eventService, error);
			}
		}

		logger.debug('%s - end', method);
	}

	_setListenTimeout() {
		const method = '_setListenTimeout';
		logger.debug('%s - start', method);

		if (this.options.commitTimeout <= 0) {
			logger.debug('%s - no commit timeout', method);
			return;
		}

		logger.debug('%s setTimeout(%s) in seconds for transaction %s', method, this.options.commitTimeout, this.transactionId);
		this.timeoutHandler = setTimeout(
			() => {
				this._timeoutFail();
				logger.error('%s - event handler timed out', method);
			},
			this.options.commitTimeout * 1000
		);
		logger.debug('%s - end', method);
	}

	_registerTxEventListeners() {
		const method = '_registerTxEventListeners';
		logger.debug('%s - start', method);

		this.eventServices.forEach(eventService => {
			logger.debug('%s - transactionId:%s for event service:%s', method, this.transactionId, eventService.name);
			const eventListener = eventService.registerTransactionListener(
				this.transactionId,
				(err, event) => {
					if (err) {
						this._onError(eventService, err);
						return;
					}
					this._onEvent(eventService, event.transactionId, event.status);
				}
			);
			this.activeListeners.add(eventListener);
		});

		logger.debug('%s - end', method);
	}

	_timeoutFail() {
		const unrespondedEventServices = this.eventServices
			.filter(eventService => !this.respondedEventServices.has(eventService))
			.map(eventService => eventService.name)
			.join(', ');
		const message = 'Event strategy not satisfied within the timeout period. No response received from event services: ' + unrespondedEventServices;
		const error = new TimeoutError({
			message,
			transactionId: this.transactionId
		});
		this._strategyFail(error);
	}

	_onEvent(eventService, txId, code) {
		logger.debug('_onEvent:', `received event for ${txId} with code ${code}`);

		this._receivedEventServiceResponse(eventService);
		if (code !== 'VALID') {
			const message = `EventService ${eventService.name} has received transaction ${txId} with code ${code}`;
			this._strategyFail(new Error(message));
		} else {
			this.strategy.eventReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
		}
	}

	_onError(eventService, err) {
		logger.debug('_onError: received error from EventService %s: %s', eventService.name, err);

		this._receivedEventServiceResponse(eventService);
		this.strategy.errorReceived(this._strategySuccess.bind(this), this._strategyFail.bind(this));
	}

	_receivedEventServiceResponse(eventService) {
		this.respondedEventServices.add(eventService);
	}

	/**
	 * Callback for the strategy to indicate successful commit of the transaction.
	 * @private
	 */
	_strategySuccess() {
		logger.debug('_strategySuccess: strategy success for transaction %j', this.transactionId);

		this.cancelListening();
		this._resolveNotificationPromise();
	}

	/**
	 * Callback for the strategy to indicate failure of the transaction commit.
	 * @private
	 * @param {Error} error Reason for failure.
	 */
	_strategyFail(error) {
		logger.warn('_strategyFail: strategy fail for transaction %j: %s', this.transactionId, error);

		this.cancelListening();
		this._rejectNotificationPromise(error);
	}

	/**
     * Wait until enough events have been received from the event services to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
     */
	async waitForEvents() {
		logger.debug('waitForEvents start');
		await this.notificationPromise;
		logger.debug('waitForEvents end');
	}

	/**
     * Cancel listening for events.
     */
	cancelListening() {
		logger.debug('cancelListening called');

		clearTimeout(this.timeoutHandler);
		this.activeListeners.forEach(eventListener => eventListener.eventService.unregisterEventListener(eventListener, true));
	}
}

module.exports = TransactionEventHandler;
