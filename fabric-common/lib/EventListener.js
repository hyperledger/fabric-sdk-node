/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'EventListener';

const {checkParameter, getLogger, convertToLong} = require('./Utils.js');
const logger = getLogger(TYPE);

const default_unregister = {
	block: false,
	tx: true,
	chaincode: false
};

/**
 * The EventListener is used internally to the EventService to hold
 * an event registration callback and settings.
 * @private
 */
class EventListener {
	/**
	 * @typedef {Object} RegistrationOpts
	 * @property {number|string|Long} [startBlock] - Optional. The starting block number
	 * for event checking. When included, the peer's event service
	 * will be asked to start sending blocks from this block number.
	 * This is how to resume or replay missed blocks that were added
	 * to the ledger.
	 * Default is the latest block on the ledger.
	 * @property {number|string|Long} [endBlock] - Optional. The ending block number
	 * for event checking.
	 * When included, the peer's event service will be asked to stop sending blocks once this block is delivered.
	 * This is how to replay missed blocks that were added to the ledger.
	 * When a startBlock is not included, the endBlock must be equal to or larger than the current channel block height.
	 * @property {boolean} unregister - Optional - This options setting indicates
	 * the registration should be removed (unregister) when the event
	 * is seen. When the application is using a timeout to wait a
	 * specified amount of time for the transaction to be seen, the timeout
	 * processing should included the manual 'unregister' of the transaction
	 * event listener to avoid the event callbacks being called unexpectedly.
	 * The default for this setting is different for the different types of
	 * event listeners. For block listeners the default is true, however
	 * the event listener is assumed to have seen the final event only if
	 * the end_block was set as a option and that end_block was seen by the
	 * the listener. For transaction listeners the default is true and the
	 * listener will be unregistered when a transaction with the id is
	 * seen by this listener. For chaincode listeners the default will be
	 * false as the match filter might be intended for many transactions
	 * rather than a specific transaction or block as in the other listeners.
	 * For all listeners if not set and the endBlock has been set, the listener
	 * will be automatically unregistered.
	 */

	/**
	 * Constructs a Event Listener
	 * @param {EventService} eventService - The EventService where this listener is registered
	 * @param {string} listenerType - a string to indicate the type of event registration
	 *  "block", "tx", or "chaincode".
	 * @param {function} callback - Callback for event matches
	 * @param {RegistrationOpts} options - event registration options
	 * @param {RegExp|string} [event]
	 *  <br>- When this listener is of type "block" then this field is not used.
	 *  <br>- When this listener is of type "chaincode" then this
	 *  field will be the chaincode event name, used as a regular
	 *  expression match on the chaincode event name within the transactions.
	 *  <br>- When this listener is of type "tx" then this field will be the
	 *  transaction id string.
	 *  In both cases this field will be compared with data in the transaction.
	 *  And when there is a match the event will have taken place and the listener's callback will be called (notified).
	 * @param {string} [chaincodeId] - optional. Used to isolate chaincode events
	 *  to a specific chaincode.
	 * @private
	 */
	constructor(eventService = checkParameter('eventService'), listenerType = checkParameter('listenerType'), callback = checkParameter('callback'), options, event, chaincodeId) {
		this.eventService = eventService;
		this.type = TYPE;
		this.listenerType = listenerType;
		if (listenerType === EventListener.TX && !event) {
			checkParameter('event');
		} else if (listenerType === EventListener.CHAINCODE && !event) {
			checkParameter('event');
		}
		this.callback = callback;
		if (!options) {
			options = {};
		}
		this.unregister = typeof options.unregister === 'boolean' ? options.unregister : default_unregister[listenerType];
		this.endBlock = convertToLong(options.endBlock, false);
		this.startBlock = convertToLong(options.startBlock, false);
		this.event = event;
		this.chaincodeId = chaincodeId;
	}

	/**
	 * This method will be called by the {@link EventService} when it finds a
	 * block that matches this event listener.
	 * This method will also be called by the {@link EventService} when the
	 * connection to the Peer's event service has received an error or
	 * shutdown. This method will call the defined callback with the
	 * event information or error instance.
	 * @param {Error} error - An Error object that was created as a result
	 *  of an error on the {@link EventService} connection to the Peer.
	 * @param {EventInfo} event - A {@link EventInfo} that contains event information.
	 * @private
	 */
	onEvent(error, event) {
		const method = 'onEvent';
		try {
			let notify = true;
			if (event) {
				if (this.endBlock && event.blockNumber.greaterThan(this.endBlock)) {
					logger.debug(`${method} - skipping calling callback, event block num ${event.blockNumber} greater than listener's endBlock`);
					notify = false;
				}
				if (this.startBlock && event.blockNumber.lessThan(this.startBlock)) {
					logger.debug(`${method} - skipping calling callback, event block num ${event.blockNumber} less than listener's startBlock`);
					notify = false;
				}
			}
			// notify should be true unless the start and end have prevented
			if (notify) {
				this.callback(error, event);
			}
		} catch (err) {
			logger.error('Event notification callback failed', err);
		}
	}

	/**
	 * Convenience method to for users to unregister this listener
	 */
	unregisterEventListener() {
		this.eventService.unregisterEventListener(this);
	}

	toString() {
		return `EventListener: { listenerType: ${this.listenerType}, startBlock: ${
			this.startBlock}, endBlock: ${this.endBlock}, unregister: ${
			this.unregister}, event: ${this.event}}`;
	}
}

module.exports = EventListener;
EventListener.BLOCK = 'block'; // for block type event listeners
EventListener.TX = 'tx'; // for transaction type event listeners
EventListener.CHAINCODE = 'chaincode'; // for chaincode event type event listeners
