/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AbstractEventListener = require('./abstracteventlistener');
const BaseCheckpointer = require('./basecheckpointer');
const logger = require('fabric-network/lib/logger').getLogger('ContractEventListener');
const util = require('util');

/**
 * The Contract Event Listener handles contract events from the chaincode.
 *
 * @memberof module:fabric-network
 * @class
 */
class ContractEventListener extends AbstractEventListener {
	/**
	 * Constructor.
	 * @param {Contract} contract The contract instance
	 * @param {string} listenerName a unique name identifying the listener
	 * @param {string} eventName The name of the contract event being listened for
	 * @param {function} eventCallback The event callback called when an event is received.
	 * It has signature (err, BlockEvent, blockNumber, transactionId)
	 * @param {module:fabric-network.Network~ListenerOptions} options
	 */
	constructor(contract, listenerName, eventName, eventCallback, options) {
		super(contract.getNetwork(), listenerName, eventCallback, options);
		this.contract = contract;
		this.eventName = eventName;

		if (this.useEventReplay()) {
			Object.assign(this.clientOptions, {
				as_array: true
			});
		} else {
			Object.assign(this.clientOptions, {
				as_array: this.options.asArray ? this.options.asArray : false
			});
		}
	}

	/**
	 * Finds and connects to an event hub then creates the listener registration
	 */
	async register() {
		await super.register(this.contract.getChaincodeId());
		if (!this.eventHub) {
			if (!this._eventHubConnectTimeout) {
				this._setEventHubConnectTimeout();
			}
			if (this._abandonEventHubConnect) {
				this._unsetEventHubConnectTimeout();
				return;
			}
			return await this._registerWithNewEventHub();
		}
		this._unsetEventHubConnectTimeout();
		if (!this._usingCheckpointer && !this.eventHub.isconnected()) {
			await this.connectEventHub();
		}
		this._registration = this.eventHub.registerChaincodeEvent(
			this.contract.getChaincodeId(),
			this.eventName,
			this._onEvent.bind(this),
			this._onError.bind(this),
			this.clientOptions
		);

		this._registered = true;
		if (this._usingCheckpointer && !this.eventHub.isconnected()) {
			await this.connectEventHub();
		}
	}

	/**
	 * Unregisters the registration from the event hub
	 */
	unregister() {
		super.unregister();
		if (this.eventHub) {
			this.eventHub.unregisterChaincodeEvent(this._registration);
		}
	}

	/**
	 * The callback triggered when the event was successful. Checkpoints the last
	 * block and transaction seen once the callback has run and unregisters the
	 * listener if the unregister flag was provided
	 * @param {ChaincodeEvent} event the event emitted
	 * @param {number} blockNumber the block number this transaction was committed inside
	 * @param {string} transactionId the transaction ID of the transaction this event was emitted by
	 * @param {string} status the status of the the transaction
	 * @param {string} [expectedNumber] the expected number of events from the block
	 */
	async _onEvent(event, blockNumber, transactionId, status, expectedNumber) {
		if (Array.isArray(event)) {
			return this._onEvents(event, blockNumber, transactionId, status, event.length);
		}
		logger.debug(`_onEvent[${this.listenerName}]:`, util.format('success for transaction %s', transactionId));
		blockNumber = Number(blockNumber);
		let useCheckpoint = false;
		if (this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer) {
			const checkpoint = await this.checkpointer.loadLatestCheckpoint();

			useCheckpoint = Number(checkpoint.blockNumber || 0) <= Number(blockNumber);
			if (checkpoint && checkpoint.transactionIds && checkpoint.transactionIds.includes(transactionId)) {
				logger.debug(util.format('_onEvent skipped transaction: %s', transactionId));
				return;
			}
		}

		try {
			await this.eventCallback(null, event, blockNumber, transactionId, status);
			if (useCheckpoint) {
				await this.checkpointer.save(transactionId, blockNumber, expectedNumber);
			}
		} catch (err) {
			logger.debug(util.format('_onEvent error from callback: %s', err));
		}
		if (this._registration.unregister) {
			this.unregister();
		}
	}

	async _onEvents(events) {
		console.log('_onEvents');
		logger.debug(`[${this.listenerName}]: Received contract events as array`);
		if (!this.options.asArray) {
			logger.debug(`[${this.listenerName}]: Splitting events`);
			await Promise.all(
				events.map((event) => this._onEvent(event.chaincode_event, event.block_num, event.tx_id, event.tx_status, events.length))
			);
		} else {
			logger.debug(`[${this.listenerName}]: Sending events to callback as array`);
			await this.eventCallback(events);
		}
	}

	/**
	 * This callback is triggered when the event was unsuccessful. If the error indicates
	 * that the event hub shutdown and the listener is still registered, it updates the
	 * {@link EventHubSelectionStrategy} status of event hubs (if implemented) and finds a
	 * new event hub to connect to
	 * @param {Error} error The error emitted
	 */
	async _onError(error) {
		logger.debug('_onError:', util.format('received error from peer %s: %j', this.eventHub.getPeerAddr(), error));
		if (error) {
			if (this._isShutdownMessage(error) && this.isregistered()) {
				this._firstRegistrationAttempt = true;
				this.getEventHubManager().updateEventHubAvailability(this.eventHub._peer);
				await this._registerWithNewEventHub(true);
			}
		}
		await this.eventCallback(error);
	}
}

module.exports = ContractEventListener;
