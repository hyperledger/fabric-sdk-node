/**
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

/*
 * The EventListener is used internally to the EventService to hold
 * an event registration callback and settings.
 */
class EventListener {
	/*
	 * Constructs a Event Listener
	 *
	 * @param {EventService} eventService - The EventService where this listener is registered
	 * @param {string} listenerType - a string to indicate the type of event registration
	 *  "block", "tx", or "chaincode".
	 * @param {function} callback - Callback for event matches
	 * @param {RegistrationOpts} options - event registration options
	 * @param {boolean} default_unregister - the default value for the unregister
	 *  setting if not option setting is set by the user
	 * @param {any} event
	 *  <br>- When this listener is of type "block" then this field is not used.
	 *  <br>- When this listener is of type "chaincode" then this
	 *  field will be the chaincode event name, used as a regular
	 *  expression match on the chaincode event name within the transactions.
	 *  <br>- When this listener is of type "tx" then this field will be the
	 *  transaction id string.
	 *  In both cases this field will be compared with data in the transaction
	 *  and when there is a match
	 *  the event will have taken place and the listener's callback will be
	 *  called (notified).
	 * @param {string} [chaincodeId] - optional - used to isolate chaincode events
	 *  to a specific chaincode.
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
	 * @param {BlockEvent} event - A {@link BlockEvent} that contains
	 *  event information.
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