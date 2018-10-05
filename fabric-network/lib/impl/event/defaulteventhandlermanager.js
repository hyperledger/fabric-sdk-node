/**
* Copyright 2018 IBM All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const EventHandlerStrategies = require('./defaulteventhandlerstrategies');
const TransactionEventHandler = require('./transactioneventhandler');
const EventHubFactory = require('./eventhubfactory');
const logger = require('fabric-network/lib/logger').getLogger('DefaultEventHandlerManager');

class DefaultEventHandlerManager {
	/**
	 * @typedef {Object} EventHandlerOptions
	 * @property {Function} [strategy = EventHandlerStrategies.MSPID_SCOPE_ALLFORTX] Event strategy factory.
	 * @property {Number} [commitTimeout = 0] Number of seconds to wait for transaction completion. A value of zero
	 * indicates that the handler should wait indefinitely.
	 */

	 /**
	 * Constructor.
	 * @param {Network} network Network on which events will be processed.
	 * @param {String} mspId Member Services Provider identifier.
	 * @param {EventHandlerOptions} options Additional options for event handling behaviour.
	 */
	constructor(network, mspId, options) {
		this.network = network;
		this.eventHubFactory = new EventHubFactory(network.getChannel());
		this.mspId = mspId;

		const defaultOptions = {
			strategy: EventHandlerStrategies.MSPID_SCOPE_ALLFORTX
		};
		this.options = Object.assign(defaultOptions, options);

		logger.debug('constructor: mspId = %s, options = %O', mspId, this.options);
	}

	async initialize() {
		const strategy = this.options.strategy(this.eventHubFactory, this.network, this.mspId);
		try {
			await strategy.getConnectedEventHubs();
		} catch (error) {
			logger.debug('initialize:', error);
		}
	}

	/**
	 * create an Tx Event handler for the specific txid
	 *
	 * @param {String} txid
	 * @returns The transaction event handler
	 * @memberof DefaultEventHandlerFactory
	 */
	createTxEventHandler(txid) {
		logger.debug('createTxEventHandler: txid = %s', txid);
		const strategy = this.options.strategy(this.eventHubFactory, this.network, this.mspId);
		return new TransactionEventHandler(txid, strategy, this.options);
	}
}

module.exports = DefaultEventHandlerManager;
