/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Long = require('long');

const EventHubDisconnectError = require('fabric-client/lib/errors/EventHubDisconnectError');
const BaseCheckpointer = require('./basecheckpointer');
const logger = require('fabric-client/lib/utils').getLogger('AbstractEventListener');

/**
 * @typedef {Object} module:fabric-network.Network~ListenerOptions
 * @memberof module:fabric-network
 * @property {Object} checkpointer The checkpointer factory and options
 * @property {Gateway~CheckpointerFactory} checkpointer.factory The checkpointer factory
 * @property {Object} checkpointer.options The checkpoint configuration options
 * @property {boolean} replay event replay and checkpointing on listener
 * @extends RegistrationOpts
 */

/**
 * Event listener base class handles initializing common properties across contract, transaction
 * and block event listeners.
 *
 * Instances of the event listener are stateful and must only be used for one listener
 * @private
 * @class
 */
class AbstractEventListener {
	/**
	 * Constructor
	 * @param {module:fabric-network.Network} network The network
	 * @param {string} listenerName The name of the listener being created
	 * @param {function} eventCallback The function called when the event is triggered.
	 * It has signature (err, ...args) where args changes depending on the event type
	 * @param {module:fabric-network.Network~ListenerOptions} options Event handler options
	 */
	constructor(network, listenerName, eventCallback, options) {
		if (!options) {
			options = {};
		}
		this.channel = network.getChannel();
		this.network = network;
		this.listenerName = listenerName;
		this.eventCallback = eventCallback;
		this.options = options;

		this._registered = false;
		this._firstCheckpoint = {};
		this._registration = null;
		this._filtered = typeof options.filtered === 'boolean' ? options.filtered : true;
	}

	/**
	 * Called by the super classes register function. Saves information needed to start
	 * listening, and disconnects an event hub if it is the incorrect type
	 */
	async register(chaincodeId) {
		logger.debug(`Register event listener: ${this.listenerName}`);
		if (this.getEventHubManager().getPeers().length === 0) {
			logger.error('No peers available to register a listener');
			return;
		}

		if (!this.eventHub && this.options.fixedEventHub) {
			throw new Error('No event hub given and option fixedEventHub is set');
		}

		if (this._registered) {
			throw new Error('Listener already registered');
		}
		if (this.eventHub && this.eventHub.isconnected() && !!this.eventHub.isFiltered() !== this._filtered) {
			this.eventHub.disconnect();
			this.eventHub = null;
		}

		if (this.options.checkpointer) {
			if (typeof this.options.checkpointer.factory === 'function') {
				this.checkpointer = this.options.checkpointer.factory(
					this.channel.getName(),
					this.listenerName,
					this.options.checkpointer.options
				);
				this.checkpointer.setChaincodeId(chaincodeId);
			}
		}
		if (this.useEventReplay()) {
			if (!this.getCheckpointer()) {
				logger.error('Opted to use checkpointing without defining a checkpointer');
			}
		}

		let checkpoint;
		if (this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer) {
			this._firstCheckpoint = checkpoint = await this.checkpointer.load();
			const blockchainInfo = await this.channel.queryInfo();
			if (checkpoint && checkpoint.blockNumber && blockchainInfo.height - 1 > Number(checkpoint.blockNumber)) {
				logger.debug(`Requested Block Number: ${Number(checkpoint.blockNumber) + 1} Latest Block Number: ${blockchainInfo.height - 1}`);
				this.options.startBlock = Long.fromInt(Number(checkpoint.blockNumber) + 1);
			}
		}
	}

	/**
	 * Called by the super classes unregister function. Removes state from the listener so it
	 * can be reregistered at a later time
	 */
	unregister() {
		logger.debug(`Unregister event listener: ${this.listenerName}`);
		this._registered = false;
		delete this.options.startBlock;
		delete this.options.endBlock;
		delete this.options.disconnect;
		this._firstCheckpoint = {};
	}

	/**
	 * @param {module:fabric-client.ChannelEventHub} eventhub Event hub.
	 * @param {boolean} isFixed If true only this peers event hub will be used
	 */
	setEventHub(eventHub, isFixed) {
		this.eventHub = eventHub;
		this.options.fixedEventHub = isFixed;
	}

	/**
	 * @returns {boolean} Listeners registration status
	 */
	isregistered() {
		return this._registered;
	}

	/**
	 * Returns the checkpoint instance created by the checkpoint factory
	 * @returns {BaseCheckpointer} Checkpointer instance specific to this listener
	 */
	getCheckpointer() {
		return this.checkpointer;
	}

	/**
	 * Returns the event hub manager from the network
	 * @returns {EventHubManager} Event hub manager
	 */
	getEventHubManager() {
		const network = this.network;
		return network.getEventHubManager();
	}

	useEventReplay() {
		return this.options.replay;
	}

	/**
	 * Check if the event hub error is a disconnect message
	 * @param {Error} error The error emitted by the event hub
	 * @returns {boolean} is shutdown message
	 * @private
	 */
	_isShutdownMessage(error) {
		if (error) {
			logger.debug('Event hub shutdown.');
			return error instanceof EventHubDisconnectError;
		}
		return false;
	}
}

module.exports = AbstractEventListener;
