/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BaseEventListener = require('./baseeventlistener');
const logger = require('fabric-network/lib/logger').getLogger('ContractEventListener');

/**
 * The Contract Event Listener handles contract events from the chaincode.
 *
 * @memberof module:fabric-network
 * @class
 * @private
 */
class ContractEventListener extends BaseEventListener {
	/**
	 * Constructor.
	 * @param {Contract} contract The contract instance
	 * @param {string} eventName The name of the contract event being listened for
	 * @param {function} eventCallback The event callback called when an event is received.
	 * It has signature (err, BlockEvent, blockNumber, transactionId)
	 * @param {module:fabric-network.Network~EventListenerOptions} options
	 */
	constructor(contract, eventName, eventCallback, options) {
		super(contract.network, eventCallback, options);
		this.contract = contract;
		this.eventName = eventName;
	}

	_registerListener() {
		this.registration = this.eventService.registerChaincodeListener(
			this.contract.chaincodeId,
			this.eventName,
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
		const method = '_onEvent';
		logger.debug('%s - start', method);

		try {

			const {blockNumber, chaincodeEvents} = event;

			logger.debug('%s - calling user callback', method);
			await this.eventCallback(null, blockNumber.toString(), chaincodeEvents);
			logger.debug('%s - completed calling user callback', method);
		} catch (err) {
			logger.error('%s - Error executing callback: %s', method, err);
		}

	}
}

module.exports = ContractEventListener;
