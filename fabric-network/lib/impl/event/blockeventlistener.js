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
 * @class
 */
class BlockEventListener extends AbstractEventListener {
	constructor(network, listenerName, eventCallback, options) {
		super(network, listenerName, eventCallback, options);
	}

	/**
	 * Finds and connects to an event hub then creates the listener registration
	 */
	async register() {
		await super.register();
		if (!this.eventHub) {
			return this._registerWithNewEventHub();
		}
		this._registration = this.eventHub.registerBlockEvent(
			this._onEvent.bind(this),
			this._onError.bind(this),
			this.options
		);
		this.eventHub.connect(!this._filtered);
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
	 * @param {*} block Either a full or filtered block
	 * @private
	 */
	async _onEvent(block) {
		const blockNumber = Number(block.number);

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
				this.getEventHubManager().updateEventHubAvailability(this.eventHub._peer);
				await this._registerWithNewEventHub();
			}
		}
		this.eventCallback(error);
	}

	/**
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

module.exports = BlockEventListener;
