/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const {Utils} = require('fabric-common');
const logger = Utils.getLogger('BaseEventListener');

let counter = 1;

/**
 * Event listener base class handles initializing common properties across contract, transaction
 * and block event listeners.
 *
 * Instances of the event listeners are stateful and must only be used for one low level listener
 * @memberof module:fabric-network
 * @class
 * @private
 */
class BaseEventListener {
	/**
	 * Constructor
	 * @param {module:fabric-network.Network} network The network
	 * @param {function} eventCallback The function called when the event is triggered.
	 * It has signature (err, ...args) where args changes depending on the event type
	 * @param {module:fabric-network.Network~EventListenerOptions} options Event handler options
	 */
	constructor(network, eventCallback, options = {}) {
		const method = 'constructor';
		logger.debug('%s - start', method);

		this.network = network;
		this.eventServiceManager = network.eventServiceManager;
		this.eventCallback = eventCallback;
		this.registration = null;
		this.eventServiceOptions = {};
		this.replay = false;
		this.checkpointer = null;

		if (options.startBlock || options.startBlock === 0) {
			this.eventServiceOptions.startBlock = Utils.convertToLong(options.startBlock);
		}
		if (options.endBlock || options.endBlock === 0) {
			this.eventServiceOptions.endBlock = Utils.convertToLong(options.endBlock);
		}
		// only set replay on if we have start or endblock
		if (options.startBlock || options.endBlock) {
			this.replay = true;
		}
		if (options.checkpointer) {
			this.checkpointer = options.checkpointer;
			// If using a checkpointer then they could be doing
			// a replay where the checkpointer will determine the startBlock
			if (options.replay) {
				this.replay = true;
			}
		}

		// make sure these are set to something
		this.eventServiceOptions.unregister = typeof options.unregister === 'boolean' ? options.unregister : false;
		const filtered = typeof options.filtered === 'boolean' ? options.filtered : true;
		const privateData = typeof options.privateData === 'boolean' ? options.privateData : false;
		if (filtered && privateData) {
			throw Error('Private data only available when receiving full blocks');
		}

		if (filtered) {
			this.eventServiceOptions.blockType = 'filtered';
		} else {
			if (privateData) {
				this.eventServiceOptions.blockType = 'private';
			} else {
				this.eventServiceOptions.blockType = 'full';
			}
		}
		logger.debug('%s - listener will receive %s blocks', method, this.eventServiceOptions.blockType);
		this.listenerCount = counter++;
	}

	/**
	 * Called by the super classes register function. Saves information needed to start
	 * listening, and disconnects an event service if it is the incorrect type
	 */
	async register() {
		const method = `register[${this.listenerCount}]`;
		logger.debug('%s - start - %s', method, this.eventServiceOptions.blockType);

		if (this.registration) {
			throw new Error('Listener already registered');
		}

		if (!this.eventService) {
			if (this.replay) {
				this.eventService = this.eventServiceManager.getReplayEventService();
				// TODO should we check to see if running and then reset ???
			} else {
				this.eventService = this.eventServiceManager.getEventService(this.eventServiceOptions.blockType);
			}
		}

		// need to have an eventService at this point
		if (!this.eventService) {
			throw new Error('No event service available');
		}

		// if the user using this listener to recover (replay) events and has
		// provided the checkpointer with where they were, then we need to get
		// the starting block of where to start the replay
		if (this.replay && this.checkpointer && !this.eventServiceOptions.startBlock) {
			this.eventServiceOptions.startBlock = await this.checkpointer.getStartBlock();
		}

		// have the parent class register itself with the low level
		this._registerListener();

		// now make sure this event service is running and receiving events
		try {
			await this.eventServiceManager.startEventService(this.eventService, this.eventServiceOptions);
		} catch (error) {
			logger.error('%s - unable to start the event service %s', method, error);
			this.eventService = null;
			throw error;
		}

		logger.debug('%s - end', method);
	}

	/**
	 * Called by the super classes unregister function.
	 */
	unregister() {
		const method = `unregister[${this.listenerCount}]`;
		logger.debug('%s - start', method);

		if (this.registration) {
			this.registration.eventService.unregisterEventListener(this.registration, true);
			this.registration = null;
		}

		if (this.network.listeners.has(this)) {
			this.network.listeners.delete(this);
		}
	}

	/**
	 * This is the callback used by the EventService for this registered listener
	 * @param {Error} error - An error causing this regisistered listener to be shutdown
	 * @param {EventInfo} event - The block information of the triggered event
	 */
	async onEvent(error, event) {
		const method = `onEvent[${this.listenerCount}]`;
		logger.debug('%s - start', method);

		if (error) {
			await this.eventCallback(error);
			return;
		}

		if (!event) {
			await this.eventCallback(Error('Missing event information'));
			return;
		}

		const {endBlockReceived, blockNumber, transactionId} = event;

		if (endBlockReceived) {
			logger.debug('%s - endblock %s received', method, blockNumber.toString());

			if (this.eventServiceOptions.endBlock && this.eventServiceOptions.endBlock.equals(blockNumber)) {
				// this was expected
				return;
			} else {
				logger.error('%s - endblock not expected %s received', method, blockNumber.toString());
				await this.eventCallback(new Error('Endblock received'));
				return;
			}
		}

		let seen = false;
		if (this.checkpointer) {
			if (await this.checkpointer.check(blockNumber.toString(), transactionId)) {
				logger.debug('%s blockNumber:%s transactiolnId:%s has been seen by the checkpointer', method, blockNumber.toString(), transactionId);
				seen = true;
			} else {
				logger.debug('%s blockNumber:%s transactiolnId:%s has not been seen by the checkpointer', method, blockNumber.toString(), transactionId);
			}
		} else {
			logger.debug('%s - not checking block %s', method, blockNumber.toString());
		}

		if (!seen) {
			await this._onEvent(event);
		}

		if (this.checkpointer) {
			await this.checkpointer.save(blockNumber.toString(), transactionId);
			logger.debug('%s blockNumber: %s transactiolnId:%s has been added to the checkpointer', method, blockNumber.toString(), transactionId);
		} else {
			logger.debug('%s - not checkpoint saving block %s', method, blockNumber.toString());
		}
	}
}

module.exports = BaseEventListener;
