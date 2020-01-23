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
 * Event listener base class handles initializing common properties across contract, transaction
 * and block event listeners.
 *
 * Instances of the event listeners are stateful and must only be used for one listener
 * @memberof module:fabric-network
 * @class
 */
class AbstractEventListener {
	/**
	 * Constructor
	 * @param {module:fabric-network.Network} network The network
	 * @param {string} listenerName a unique name identifying the listener.
	 * @param {function} eventCallback The function called when the event is triggered.
	 * It has signature (err, ...args) where args changes depending on the event type
	 * @param {module:fabric-network.Network~ListenerOptions} options Event handler options
	 */
	constructor(network, listenerName, eventCallback, options) {
		if (!options) {
			options = {};
		}
		options = Object.assign({
			eventHubConnectWait: 1000,
			eventHubConnectTimeout: 30000
		}, options);

		this.channel = network.getChannel();
		this.network = network;
		this.listenerName = listenerName;
		this.eventCallback = eventCallback;
		this.options = options;
		this.clientOptions = {}; // fabric-client ChannelEventHub options

		if (Object.prototype.hasOwnProperty.call(this.options, 'unregister')) {
			this.clientOptions.unregister = this.options.unregister;
		}

		if (this.options.startBlock !== undefined && this.options.startBlock !== null) {
			this.clientOptions.startBlock = Number(this.options.startBlock);
			delete this.options.startBlock;
		}

		if (this.options.endBlock !== undefined && this.options.endBlock !== null) {
			this.clientOptions.endBlock = Number(this.options.endBlock);
			delete this.options.endBlock;
		}

		this._registered = false;
		this._firstCheckpoint = {};
		this._registration = null;
		this._filtered = typeof options.filtered === 'boolean' ? options.filtered : false;
		this._usingCheckpointer = false;
		this._firstRegistrationAttempt = true;
		this._abandonEventHubConnect = false;
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

		if (!this.network.listeners.has(this.listenerName)) {
			this.network.saveListener(this.listenerName, this);
		}
		if (this.eventHub && this.eventHub.isconnected()) {
			if (this.eventHub.isFiltered() !== this._filtered) {
				this.eventHub._filtered_stream = this._filtered;
				this.eventHub.disconnect();
				if (!this.options.fixedEventHub) {
					this.eventHub = null;
				}
			}
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
			if ((this.clientOptions.startBlock !== null) && (this.clientOptions.startBlock !== undefined) &&
				(this.clientOptions.endBlock !== null) && (this.clientOptions.endBlock !== undefined)) {
				logger.debug('startBlock and endBlock were given. Disabling event replay');
				this.options.replay = false;
			}
		}

		let checkpoint;
		if (this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer) {
			this._firstCheckpoint = checkpoint = await this.checkpointer.loadLatestCheckpoint();
			const blockchainInfo = await this.channel.queryInfo();
			if (checkpoint && checkpoint.hasOwnProperty('blockNumber') && !isNaN(checkpoint.blockNumber) && blockchainInfo.height - 1 > Number(checkpoint.blockNumber)) {
				logger.debug(`Requested Block Number: ${Number(checkpoint.blockNumber) + 1} Latest Block Number: ${blockchainInfo.height - 1}`);
				this.clientOptions.startBlock = Long.fromInt(Number(checkpoint.blockNumber) + 1);
				this._usingCheckpointer = true;
			} else {
				this._usingCheckpointer = false;
			}
		}
	}

	/**
	 * Called by the super classes unregister function.
	 */
	unregister() {
		logger.debug(`Unregister event listener: ${this.listenerName}`);
		this._registered = false;
		this._abandonEventHubConnect = true;
		this._firstCheckpoint = {};
		if (this.network.listeners.has(this.listenerName)) {
			this.network.listeners.delete(this.listenerName);
		}
	}

	/**
	 * @param {ChannelEventHub} eventHub Event hub.
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

	async _setEventHubConnectWait() {
		logger.debug(`[${this.listenerName}]: The event hub connect failed. Waiting ${this.options.eventHubConnectWait}ms then trying again`);
		await new Promise(resolve => setTimeout(resolve, this.options.eventHubConnectWait));
	}

	_setEventHubConnectTimeout() {
		this._abandonEventHubConnect = false;
		this._eventHubConnectTimeout = setTimeout(() => {
			logger.error(`[${this.listenerName}]: The event hub failed to connect after ${this.options.eventHubConnectTimeout}ms`);
		}, this.options.eventHubConnectTimeout);
	}

	_unsetEventHubConnectTimeout() {
		clearTimeout(this._eventHubConnectTimeout);
		this._eventHubConnectTimeout = null;
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
		if (!this._firstRegistrationAttempt) {
			await this._setEventHubConnectWait();
		}

		const useCheckpointing = this.useEventReplay() && this.checkpointer instanceof BaseCheckpointer ||
			(this.clientOptions.startBlock || this.clientOptions.endBlock);

		if (useCheckpointing && !this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getReplayEventHub();
		} else if (useCheckpointing && this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getReplayEventHub(this.eventHub._peer);
		} else if (!useCheckpointing && this.options.fixedEventHub) {
			this.eventHub = this.getEventHubManager().getEventHub(this.eventHub._peer);
		} else {
			this.eventHub = this.getEventHubManager().getEventHub();
		}
		this._firstRegistrationAttempt = false;
		await this.register();
	}

	async connectEventHub() {
		return new Promise((resolve, reject) => {
			const connectTimeout = setTimeout(() => {
				if (!this.eventHub.isconnected()) {
					logger.error('Failed to connect to event hub');
					this.eventHub = null;
					reject();
				}
				resolve();
			}, this.options.eventHubConnectTimeout);
			this.eventHub.connect(!this._filtered, () => {
				clearTimeout(connectTimeout);
				resolve();
			});
		});
	}
}

module.exports = AbstractEventListener;
