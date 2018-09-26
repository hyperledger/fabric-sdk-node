/**
* Copyright 2018 IBM All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const EventHandlerStrategies = require('./defaulteventhandlerstrategies');
const TransactionEventHandler = require('./transactioneventhandler');
const EventHubFactory = require('./eventhubfactory');
const logger = require('../../logger').getLogger('DefaultEventHandlerManager');

class DefaultEventHandlerManager {
	/**
	 * @typedef {Object} EventHandlerOptions
	 * @property {Number} [timeout = 0] Number of seconds to wait for transaction completion. A value of zero indicates
	 * that the handler should wait indefinitely.
	 */

	/**
	 * Constructor.
	 * @param {Network} network Network on which events will be processed.
	 * @param {String} mspId Member Services Provider identifier.
	 * @param {EventHandlerOptions} options Additional options for event handling behaviour.
	 */
	constructor(network, mspId, options) {
		this.network = network;
		this.channel = network.channel;
		this.peerMap = network.peerMap;
		this.options = options;
		this.mspId = mspId;

		if (!this.options.strategy) {
			this.options.strategy = EventHandlerStrategies.MSPID_SCOPE_ALLFORTX;
		}

		logger.debug('constructor: mspId = %s, options = %O', mspId, this.options);
	}

	async initialize() {
		this.availableEventHubs = [];
		if (!this.initialized) {
			this.useFullBlocks = this.options.useFullBlocks || this.options.chaincodeEventsEnabled;
			if (this.useFullBlocks === null || this.useFullBlocks === undefined) {
				this.useFullBlocks = false;
			}

			logger.debug('initialize: useFullBlocks = %s', this.useFullBlocks);

			const eventHubFactory = new EventHubFactory(this.channel);
			this.eventStrategy = this.options.strategy(eventHubFactory, this.network, this.mspId);
			this.availableEventHubs = await this.eventStrategy.getConnectedEventHubs();

			this.initialized = true;

			logger.debug('initialize: useFullBlocks = %j, availableEventHubs = %O', this.useFullBlocks, this.availableEventHubs);
		}
	}

	dispose() {
		logger.debug('dispose');
		this.disconnectEventHubs();
		this.availableEventHubs = [];
		this.initialized = false;
	}

	getEventHubs() {
		return this.availableEventHubs;
	}

	disconnectEventHubs() {
		for (const hub of this.availableEventHubs) {
			try {
				hub.disconnect();
			} catch (error) {
				//
			}
		}
	}

	/**
	 * create an Tx Event handler for the specific txid
	 *
	 * @param {*} txid
	 * @returns
	 * @memberof DefaultEventHandlerFactory
	 */
	createTxEventHandler(txid) {
		logger.debug('createTxEventHandler: txid = %s', txid);
		// pass in all available eventHubs to listen on, the handler decides when to resolve based on strategy
		// a TxEventHandler should check that the available ones are usable when appropriate.
		this.eventStrategy.reset();
		return new TransactionEventHandler(this, txid);
	}

}

module.exports = DefaultEventHandlerManager;
