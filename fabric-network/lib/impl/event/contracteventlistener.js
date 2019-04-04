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
 * @private
 * @class
 */
class ContractEventListener extends AbstractEventListener {
	/**
	 * Constructor.
	 * @param {Contract} contract The contract instance
	 * @param {string} listenerName The name of the listener
	 * @param {string} eventName The name of the contract event being listened for
	 * @param {function} eventCallback The event callback called when an event is recieved.
	 * It has signature (err, BlockEvent, blockNumber, transactionId)
	 * @param {*} options
	 */
	constructor(contract, listenerName, eventName, eventCallback, options) {
		super(contract.getNetwork(), listenerName, eventCallback, options);
		this.contract = contract;
		this.eventName = eventName;
	}

	/**
	 * Finds and connects to an event hub then creates the listener registration
	 */
	async register() {
		await super.register(this.contract.getChaincodeId());
		if (!this.eventHub) {
			return await this._registerWithNewEventHub();
		}
		this._registration = this.eventHub.registerChaincodeEvent(
			this.contract.getChaincodeId(),
			this.eventName,
			this._onEvent.bind(this),
			this._onError.bind(this),
			this.options
		);
		this._registered = true;
		this.eventHub.connect(!this._filtered);
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
	 * @param {number} blockNumber the block number this transaction was commited inside
	 * @param {string} transactionId the transaction ID of the transaction this event was emitted by
	 * @param {string} status the status of the the transaction
	 */
	async _onEvent(event, blockNumber, transactionId, status) {
		logger.debug(`_onEvent[${this.listenerName}]:`, util.format('success for transaction %s', transactionId));
		blockNumber = Number(blockNumber);
		let useCheckpoint = false;
		if (this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer) {
			const checkpoint = await this.checkpointer.load();
			useCheckpoint = Number(checkpoint.blockNumber || 0) <= Number(blockNumber);
			if (checkpoint && checkpoint.transactionIds && checkpoint.transactionIds.includes(transactionId)) {
				logger.debug(util.format('_onEvent skipped transaction: %s', transactionId));
				return;
			}
		}

		try {
			await this.eventCallback(null, event, blockNumber, transactionId, status);
			if (useCheckpoint) {
				await this.checkpointer.save(transactionId, blockNumber);
			}
		} catch (err) {
			logger.debug(util.format('_onEvent error from callback: %s', err));
		}
		if (this._registration.unregister) {
			this.unregister();
		}
	}

	/**
	 * This callback is triggerend when the event was unsuccessful. If the error indicates
	 * that the event hub shutdown and the listener is still registered, it updates the
	 * {@link EventHubSelectionStrategy} status of event hubs (if implemented) and finds a
	 * new event hub to connect to
	 * @param {Error} error The error emitted
	 */
	async _onError(error) {
		logger.debug('_onError:', util.format('received error from peer %s: %j', this.eventHub.getPeerAddr(), error));
		if (error) {
			if (this._isShutdownMessage(error) && this.isregistered()) {
				this.getEventHubManager().updateEventHubAvailability(this.eventHub._peer);
				await this._registerWithNewEventHub();
			}
		}
		this.eventCallback(error);
	}

	/**
	 *
	 * Finds a new event hub for the listener in the event of one shutting down. Will
	 * create a new instance if checkpointer is being used, or reuse one if not
	 * @private
	 */
	async _registerWithNewEventHub() {
		this.unregister();
		if (this.options.fixedEventHub && !this.eventHub) {
			throw new Error('No event hub given and option fixedEventHub is set');
		}
		const useCheckpointing = this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer;
		if (useCheckpointing && !this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getReplayEventHub();
		} else if (useCheckpointing && this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getReplayEventHub(this.eventHub._peer);
		} else if (!useCheckpointing && this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getEventHub(this.eventHub._peer);
		} else {
			this.eventHub = this.getEventHubManager().getEventHub();
		}
		await this.register();
	}

}

module.exports = ContractEventListener;
