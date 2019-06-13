/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BaseCheckpointer = require('./basecheckpointer');
const AbstractEventListener = require('./abstracteventlistener');

const logger = require('fabric-network/lib/logger').getLogger('BlockEventListener');
const util = require('util');

/**
 * The Block Event listener class handles block events from the channel.
 *
 *
 * @private
 * @memberof module:fabric-network
 * @class
 */
class BlockEventListener extends AbstractEventListener {
	/**
	 *
	 * @param {module:fabric-network.Network} network The fabric network
	 * @param {string} listenerName a unique name identifying the listener
	 * @param {Function} eventCallback The event callback called when a transaction is committed.
	 * It has signature (err, block)
	 * @param {module:fabric-network.Network~ListenerOptions} options
	 */
	constructor(network, listenerName, eventCallback, options) {
		super(network, listenerName, eventCallback, options);
	}

	/**
	 * Finds and connects to an event hub then creates the listener registration
	 */
	async register() {
		await super.register();
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
		this._registration = this.eventHub.registerBlockEvent(
			this._onEvent.bind(this),
			this._onError.bind(this),
			this.clientOptions
		);
		if (!this.eventHub.isconnected()) {
			this.eventHub.connect(!this._filtered);
		}
		this._registered = true;
	}

	/**
	 * Unregisters the registration from the event hub
	 */
	unregister() {
		super.unregister();
		if (this.eventHub) {
			this.eventHub.unregisterBlockEvent(this._registration);
		}
	}

	/**
	 * The callback triggered when the event was successful. Checkpoints the last
	 * block and transaction seen once the callback has run and unregisters the
	 * listener if the unregister flag was provided
	 * @param {Block} block Either a full or filtered block
	 * @private
	 */
	async _onEvent(block) {
		let blockNumber;
		if (!this._filtered) {
			blockNumber = Number(block.header.number);
		} else {
			blockNumber = Number(block.number);
		}

		try {
			await this.eventCallback(null, block);
			if (this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer) {
				const checkpoint = await this.checkpointer.load();
				if (!checkpoint.blockNumber || Number(checkpoint.blockNumber) <= Number(blockNumber)) {
					await this.checkpointer.save(null, blockNumber);
				}
			}
		} catch (err) {
			logger.error(util.format('Error executing callback: %s', err));
		}
		if (this._registration.unregister) {
			this.unregister();
		}
	}

	/**
	 * This callback is triggered when the event was unsuccessful. If the error indicates
	 * that the event hub shutdown and the listener is still registered, it updates the
	 * {@link EventHubSelectionStrategy} status of event hubs (if implemented) and finds a
	 * new event hub to connect to
	 * @param {Error} error The error emitted
	 * @private
	 */
	async _onError(error) {
		logger.debug('_onError:', util.format('received error from peer %s: %j', this.eventHub.getPeerAddr(), error));
		if (error) {
			if (this._isShutdownMessage(error) && this.isregistered()) {
				this._firstRegistrationAttempt = true;
				this._unsetEventHubConnectTimeout();
				this.getEventHubManager().updateEventHubAvailability(this.eventHub._peer);
				await this._registerWithNewEventHub();
			}
		}
		this.eventCallback(error);
	}
}

module.exports = BlockEventListener;
