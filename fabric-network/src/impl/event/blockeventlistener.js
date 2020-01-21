/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BaseEventListener = require('./baseeventlistener');

const logger = require('fabric-network/lib/logger').getLogger('BlockEventListener');

/**
 * The Block Event listener class handles block events from the channel.
 *
 *
 * @private
 * @memberof module:fabric-network
 * @class
 */
class BlockEventListener extends BaseEventListener {
	/**
	 *
	 * @param {module:fabric-network.Network} network The fabric network
	 * @param {Function} eventCallback The event callback called when a transaction is committed.
	 * It has signature (err, block)
	 * @param {module:fabric-network.Network~EventListenerOptions} options
	 */
	constructor(network, eventCallback, options) {

		super(network, eventCallback, options);
	}

	_registerListener() {
		const method = '_registerListener';
		logger.debug('%s - start', method);
		this.registration = this.eventService.registerBlockListener(
			this.onEvent.bind(this),
			this.eventServiceOptions
		);
		logger.debug('%s - end', method);
	}

	/*
	 * This is the called by the base.onEvent() class event processing.
	 * This will be the sending of the unique data for this event Listener type
	 * to the user's callback.
	 */
	async _onEvent(event) {
		const method = `_onEvent[${this.listenerCount}]`;
		logger.debug('%s - start', method);

		const {block, filteredBlock, privateData, blockNumber} = event;

		let _block;

		if (filteredBlock) {
			logger.debug('%s - have filtered block data', method);
			_block = filteredBlock;
		} else if (block) {
			logger.debug('%s - have full block data', method);
			_block = block;
			if (privateData) {
				logger.debug('%s - have private data', method);
				_block.privateData = privateData;
			}
		} else {
			logger.error('%s - missing block data in event %s', method, blockNumber.toString());
			this.eventCallback(new Error('Event is missing block data'));
			return;
		}

		try {
			logger.debug('%s - calling user callback', method);
			await this.eventCallback(null, blockNumber.toString(), _block);
			logger.debug('%s - completed calling user callback', method);
		} catch (err) {
			logger.error('%s - Error executing callback: %s', method, err);
		}

	}
}

module.exports = BlockEventListener;
