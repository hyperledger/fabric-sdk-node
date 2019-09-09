/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'EventService';

const Long = require('long');
const BlockDecoder = require('./BlockDecoder.js');
const {checkParameter, convertToLong, getLogger} = require('./Utils.js');
const ServiceAction = require('./ServiceAction.js');
const EventListener = require('./EventListener.js');

const logger = getLogger(TYPE);

const fabprotos = require('fabric-protos');

const _validation_codes = {};
const keys = Object.keys(fabprotos.protos.TxValidationCode);
for (const key of keys) {
	const new_key = fabprotos.protos.TxValidationCode[key];
	_validation_codes[new_key] = key;
}

// Special transaction id to indicate that the transaction listener will be
// notified of all transactions
const ALL = 'all';

// Special value for block numbers
const NEWEST = 'newest'; // what fabric peer sees as newest on the ledger at time of connect
const OLDEST = 'oldest'; // what fabric peer sees as oldest on the ledger at time of connect

const BLOCK = EventListener.BLOCK; // for block type event listeners
const TX = EventListener.TX; // for transaction type event listeners
const CHAINCODE = EventListener.CHAINCODE; // for chaincode event type event listeners

const FULL_BLOCK = 'full'; // to receive full blocks
const FILTERED_BLOCK = 'filtered'; // to receive filtered blocks
const PRIVATE_BLOCK = 'private'; // to receive full blocks and private data
/**
 * EventService is used to monitor for new blocks on a peer's ledger.
 * The class allows the user to register a listener to be notified when a
 * new block is added to the ledger, when a new block is added that has a
 * specific transaction ID, or to be notified when a transaction contains a
 * chaincode event name of interest.
 * The class also allows the monitoring to start and end at any specific location.
 *
 * @class
 * @extends ServiceAction
 */

class EventService extends ServiceAction {

	/**
	 * Constructs a EventService object
	 *
	 * @param {string} name
	 * @param {Channel} channel - An instance of the Channel class
	 * were this EventService will receive blocks
	 * @returns {EventService} An instance of this class
	 */

	constructor(name = checkParameter('name'), channel = checkParameter('channel')) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name);
		this.type = TYPE;

		// the last block number received
		this.lastBlockNumber = null;

		this.start_block = NEWEST;
		this.end_block = null;
		this.end_block_seen = false;

		this._eventRegistrations = new Map();
		this._reg_counter = 0;
		this._haveBlockListeners = false;
		this._haveTxListeners = false;
		this._haveChaincodeListeners = false;

		// peer's event service
		this.eventer = null;

		// closing state to case of multiple calls
		this._close_running = false;

		this.channel = channel;
	}

	/*
	 * The block number of the last block seen
	 *
	 * @returns {Long} The block number of the last block seen
	 */
	getLastBlockNumber() {
		return this.lastBlockNumber;
	}

	/**
	 * Disconnects the EventService from the fabric peer service and
	 * closes all services.
	 * Will close all event listeners and send an Error to all active listeners.
	 */
	close() {
		const method = `close[${this.name}]`;
		logger.debug(`${method} - start - hub`);
		this._close(new Error('EventService has been shutdown by "close()" call'));
	}

	/*
	 * Internal method
	 * Disconnects the connection to the fabric peer service.
	 * Will close all event listeners and send the provided `Error` to
	 * all listeners on the event callback.
	 */
	_close(reason_error = checkParameter('reason_error')) {
		const method = `_close[${this.name}]`;
		logger.debug(`${method} - start - called due to:: ${reason_error.message}`);

		if (this._close_running) {
			logger.debug(`${method} - close is running - exiting`);
			return;
		}
		this._close_running = true;
		this._closeAllCallbacks(reason_error);
		if (this.eventer) {
			this.eventer.disconnect();
			this.eventer = null;
		}
		this._close_running = false;

		logger.debug(`${method} - end`);
	}

	/**
	 * @typedef {Object} StartRequestOptions
	 * @property {string} [blockType] - Optional. To indicate that the event service
	 *  on the peer will be sending full blocks, filtered blocks or private data
	 *  blocks to this EventService.
	 *  The default will be 'filtered' with 'full' for full blocks and 'private'
	 *  for blocks with private data.
	 *  Filtered blocks have the required information to provided transaction
	 *  status and chaincode event names, however no chaincode event payload.
	 *  When using the non filtered blocks (full blocks or private data) the user
	 *  will be required to have access to receive full blocks and the private data.
	 *  Registering a block listener when listening for filtered blocks may not
	 *  provide sufficient information in the blocks received.
	 * @property {Number | string} [startBlock] - Optional. This will have the service
	 *  setup to start sending blocks back to the event hub at the block
	 *  with this number.
	 *  If the service should start with the last block this instance
	 *  has seen use the string 'last_seen'.
	 *  If the service should start with the oldest block on the
	 *  ledger use the string 'oldest'.
	 *  If the service should start with the latest block on the ledger,
	 *  use the string 'latest' or do not include a 'startBlock'.
	 *  Default is to start with the latest block on the ledger.
	 * @property {Number | string} [endBlock] - Optional. This will have the service
	 *  setup to end sending blocks back to the event hub at the block
	 *  with this number.
	 *  If the service should end with the last block it has seen
	 *  use the string 'last_seen'.
	 *  If the service should end with the current block on the
	 *  ledger use the string 'newest'.
	 *  Default is to continue to send.
	 */

	/**
	 * This method is used to build the protobuf objects of the start request.
	 * The start request must next be signed before being sent to the peer's event service.
	 * The {@link Proposal#buildAndSignStartRequest} method should be used if the
	 * signing will be done by the application.
	 *
	 * @param {IdentityContext} idContext - The transaction context to use for
	 *  Identity, transaction ID, and nonce values
	 * @param {StartRequestOptions} options - The build
	 * @returns {byte[]} The start request bytes that need to be
	 *  signed.
	 */
	build(idContext = checkParameter('idContext'), options = {}) {
		const method = `buildRequest[${this.name}]`;
		logger.debug(`${method} - start`);

		const {startBlock, endBlock, blockType = FILTERED_BLOCK} = options;
		this.start_block = this._checkBlockNum(startBlock);
		this.end_block = this._checkBlockNum(endBlock);
		if (this.start_block && this.end_block && this.end_block.greaterThan && this.start_block.greaterThan) {
			if (this.start_block.greaterThan(this.end_block)) {
				throw Error('"startBlock" must not be greater than "endBlock"');
			}
		}

		if (typeof blockType === 'string') {
			if (blockType === FULL_BLOCK || blockType === FILTERED_BLOCK || blockType === PRIVATE_BLOCK) {
				this.blockType = blockType;
			} else {
				throw Error(`Invalid blockType ${blockType}`);
			}
		} else {
			throw Error('"blockType must be a string');
		}

		this._payload = null;
		idContext.calculateTransactionId();

		let behavior = fabprotos.orderer.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY;

		// build start proto
		const seekStart = new fabprotos.orderer.SeekPosition();
		if (!this.start_block || this.start_block === NEWEST) {
			if (this.end_block === OLDEST) {
				throw Error('"startBlock" must not be greater than "endBlock"');
			}
			const seekNewest = new fabprotos.orderer.SeekNewest();
			seekStart.setNewest(seekNewest);
		} else if (this.start_block === OLDEST) {
			const seekOldest = new fabprotos.orderer.SeekOldest();
			seekStart.setOldest(seekOldest);
		} else if (this.start_block) {
			const seekSpecifiedStart = new fabprotos.orderer.SeekSpecified();
			seekSpecifiedStart.setNumber(this.start_block);
			seekStart.setSpecified(seekSpecifiedStart);
		}

		// build stop proto
		const seekStop = new fabprotos.orderer.SeekPosition();
		if (this.end_block === NEWEST) {
			const seekNewest = new fabprotos.orderer.SeekNewest();
			seekStop.setNewest(seekNewest);
			behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
		} else if (this.end_block === OLDEST) {
			const seekOldest = new fabprotos.orderer.SeekOldest();
			seekStop.setOldest(seekOldest);
			behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
		} else {
			const seekSpecifiedStop = new fabprotos.orderer.SeekSpecified();
			if (this.end_block) {
				seekSpecifiedStop.setNumber(this.end_block);
				// user should be told that the block does not exist
				behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			} else {
				seekSpecifiedStop.setNumber(Long.MAX_VALUE);
			}
			seekStop.setSpecified(seekSpecifiedStop);
		}

		// seek info with all parts
		const seekInfo = new fabprotos.orderer.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		// BLOCK_UNTIL_READY will mean hold the stream open and keep sending as
		//    the blocks come in
		// FAIL_IF_NOT_READY will mean if the block is not there throw an error
		seekInfo.setBehavior(behavior);

		// build the header for use with the seekInfo payload
		const channelHeader = this.channel.buildChannelHeader(
			fabprotos.common.HeaderType.DELIVER_SEEK_INFO,
			'',
			idContext.transactionId
		);

		const seekHeader = this.buildHeader(idContext, channelHeader);
		const seekPayload = new fabprotos.common.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		this._payload = seekPayload.toBuffer();

		return this._payload;
	}

	/**
	 * @typedef {Object} StartEventRequest
	 * @property {Eventers[]} targets - The Eventers to send the start stream request.
	 * @property {Number} [request_timeout] - Optional. The request timeout
	 */

	/**
	 * This method will have this events start listening for blocks from the
	 * Peer's event service. It will send a Deliver request to the peer
	 * event service and start the grpc streams. The received blocks will
	 * be checked to see if there is a match to any of the registered
	 * listeners.
	 *
	 * @param {StartEventRequest} request - The request options to start the
	 *  stream to the event service.
	 */
	async send(request = {}) {
		const method = `send[${this.name}]`;
		logger.debug(`${method} - start`);

		const {targets = checkParameter('targets'), request_timeout} = request;
		const envelope = this.getSignedEnvelope();
		this.eventer = null;
		let start_error = null;
		this.end_block_seen = false;

		for (const target of targets) {
			try {
				this.eventer = await this._startService(target, envelope, request_timeout);
			} catch (error) {
				logger.error('%s - Starting stream to %s failed', method, target.name);
				start_error = error;
			}
			if (this.eventer) {
				start_error = null;
				break;
			}
		}
		if (start_error) {
			throw start_error;
		}
	}

	/*
	 * internal method to startup a stream and bind this event hub's callbacks
	 * to a specific target's gRPC stream
	 */
	_startService(eventer, envelope, request_timeout) {
		const method = `_startService[${this.name}]`;

		return new Promise((resolve, reject) => {
			if (eventer.stream) {
				reject(Error(`Event service ${eventer.name} is currently listening`));
				return;
			}
			if (!eventer.checkConnection()) {
				reject(Error(`Event service ${eventer.name} is not connected`));
				return;
			}

			if (!request_timeout) {
				request_timeout = eventer.endpoint.options['request-timeout'];
			}

			logger.debug('%s - create stream setup timeout', method);
			const connection_setup_timeout = setTimeout(() => {
				logger.error(`EventService[${this.name}] timed out after:${request_timeout}`);
				reject(Error('Event service timed out - Unable to start listening'));
			}, request_timeout);

			logger.debug('%s - create stream based on blockType', method, this.blockType);
			eventer.setStreamByType(this.blockType);

			// the promise and streams live on and need we need
			// to check at times to be sure we are working with the
			// correct one if the target gets restarted
			const stream = eventer.stream;

			logger.debug('%s - create stream listening callbacks - onData, onEnd, onStatus, onError', method);

			eventer.stream.on('data', (deliverResponse) => {
				logger.debug(`on.data - peer:${eventer.endpoint.url}`);
				if (stream !== eventer.stream) {
					logger.debug('on.data - incoming block was from a cancelled stream');
					return;
				}

				clearTimeout(connection_setup_timeout);

				logger.debug('%s - resolve the promise', method);
				resolve(eventer);

				if (deliverResponse.Type === 'block' || deliverResponse.Type === 'filtered_block' || deliverResponse.Type === 'private_data') {
					try {
						let block = null;
						let full_block = null;
						let filtered_block = null;
						let private_data = null;
						let block_num = null;
						if (deliverResponse.Type === 'block') {
							full_block = BlockDecoder.decodeBlock(deliverResponse.block);
							block = full_block;
							block_num = convertToLong(block.header.number);
						} else if (deliverResponse.Type === 'filtered_block') {
							block = JSON.parse(JSON.stringify(deliverResponse.filtered_block));
							filtered_block = block;
							block_num = convertToLong(block.number);
						} else if (deliverResponse.Type === 'private_data') {
							full_block = JSON.parse(JSON.stringify(deliverResponse.filtered_block));
							block = full_block;
							private_data = block; // FIX ME get the private data
							block_num = convertToLong(block.number);
						} else {
							throw Error(`Unknown block type "${deliverResponse.Type}`);
						}

						this.lastBlockNumber = block_num;
						logger.debug(`on.data - incoming block number ${this.lastBlockNumber}`);
						this._processBlockEvents(full_block, filtered_block, private_data, block_num);
						this._processTxEvents(full_block, filtered_block);
						this._processChaincodeEvents(full_block, filtered_block);
						this._processEndBlock(block_num);

						// check to see if we should shut things down
						if (this.end_block) {
							if (this.end_block.lessThanOrEqual(this.lastBlockNumber)) {
								this.end_block_seen = true;
								this._close(new Error(`Shutdown due to end block number has been seen: ${this.lastBlockNumber.toNumber()}`));
							}
						}
					} catch (error) {
						logger.error(`${method} EventService - ::${error.stack ? error.stack : error}`);
						logger.error(`${method} EventService has detected an error ${error.toString()}`);
						// report error to all callbacks and shutdown this EventService
						this._close(error);
					}
				} else if (deliverResponse.Type === 'status') {
					if (deliverResponse.status === 'SUCCESS') {
						logger.debug('%s - on.data received type status of SUCCESS', method);
						if (this.end_block_seen) {
							// this is normal after the last block comes in when we set an ending block
							logger.debug('on.data - status received after last block seen: %s block_num:', deliverResponse.status, this.lastBlockNumber.toNumber());
						}
						if (this.ending_block === NEWEST) {
							// this is normal after the last block comes in when we set to newest as an ending block
							logger.debug('on.data - status received when newest block seen: %s block_num:', deliverResponse.status, this.lastBlockNumber.toNumber());
							this._close(new Error(`Newest block received:${this.lastBlockNumber.toNumber()} status:${deliverResponse.status}`));
						}
					} else {
						// tell all registered users that something is wrong and shutting down
						logger.error('on.data - unexpected deliverResponse status received - %s', deliverResponse.status);
						this._close(new Error(`Event stream has received an unexpected status message. status:${deliverResponse.status}`));
					}
				} else {
					logger.error('on.data - unknown deliverResponse type %s', deliverResponse.Type);
					this._close(new Error(`Event stream has received an unknown response type ${deliverResponse.Type}`));
				}
			});

			eventer.stream.on('status', (response) => {
				logger.debug('on status - status received: %j  peer:%s', response, eventer.endpoint.url);
			});

			eventer.stream.on('end', () => {
				logger.debug('on.end - peer:%s', eventer.endpoint.url);
				if (stream !== eventer.stream) {
					logger.debug('on.data - incoming message was from a cancelled stream');
					return;
				}
				clearTimeout(connection_setup_timeout);

				const end_error = new Error('fabric peer service has closed due to an "end" event');

				// tell all registered users that something is wrong and shutting
				// down only if this event service has been started, which means
				// that event service has an eventer endpoint assigned and this
				// service is actively listening
				if (this.eventer) {
					logger.debug('%s - close all application listeners', method);
					this._close(end_error);
				} else {
					// must be we got the end while still trying to set up the
					// listening stream, do not close the application listeners,
					// we may try another target on the list or the application
					// will try with another targets list
					logger.error('%s - reject the promise', method);
					reject(end_error);
				}
			});

			eventer.stream.on('error', (err) => {
				logger.debug('on.error - block peer:%s', eventer.endpoint.url);
				if (stream !== eventer.stream) {
					logger.debug('%s - on.error - incoming error was from a cancelled stream - %s', method, err);
					return;
				}
				clearTimeout(connection_setup_timeout);

				let out_error = err;
				if (err instanceof Error) {
					logger.debug('%s - on.error is an Error - %s', method, err);
				} else {
					logger.debug('%s - on.error is not an Error - %s', method, err);
					out_error = new Error(err);
				}

				// tell all registered users that something is wrong and shutting
				// down only if this event service has been started, which means
				// that event service has an eventer endpoint assigned and this
				// service is actively listening
				if (this.eventer) {
					logger.debug('%s - close all application listeners - %s', method, out_error);
					this._close(out_error);
				} else {
					// must be we got the end while still trying to set up the
					// listening stream, do not close the application listeners,
					// we may try another target on the list or the application
					// will try with another targets list
					logger.error('%s - reject the promise - %s', method, out_error);
					reject(out_error);
				}
			});

			try {
				eventer.stream.write(envelope);
				logger.debug('%s - stream write complete', method);
			} catch (error) {
				clearTimeout(connection_setup_timeout);
				reject(error);
				logger.error('%s - write failed %s', method, error.stack);
			}
		});

	}

	/**
	 * Use this method to indicate if this event service has an event endpoint
	 * {@link Eventer} assigned and the event endpoint has a listening stream
	 * connected and active.
	 */
	isListening() {
		const method = `isListening[${this.name}]`;
		logger.debug(`${method} - start`);

		if (this.eventer && this.eventer.isStreamReady()) {
			return true;
		} else {
			return false;
		}
	}

	/*
	 * Internal method
	 * Will close out all callbacks
	 * Sends an error to all registered event callbacks
	 */
	_closeAllCallbacks(err) {
		const method = `_closeAllCallbacks[${this.name}]`;
		logger.debug(`${method} - start`);

		logger.debug('%s - event registrations %s', method, this._eventRegistrations.size);
		for (const event_reg of this._eventRegistrations.values()) {
			logger.debug('%s - closing event registration:%s', method, event_reg);
			event_reg.onEvent(err);
		}
		this._eventRegistrations.clear();

		// all done
		logger.debug('%s - end', method);
	}

	_checkBlockNum(block_num) {
		let _block_num = null;
		if (typeof block_num === 'string') {
			if (block_num.toLowerCase() === OLDEST) {
				_block_num = OLDEST;
			} else if (block_num.toLowerCase() === NEWEST) {
				_block_num = NEWEST;
			} else {
				// maybe it is a string number
				_block_num = convertToLong(block_num);
			}
		} else {
			// only check if they give us something, these are optional parameters
			if (typeof block_num !== 'undefined' && block_num !== null) {
				_block_num = convertToLong(block_num);
			}
		}

		return _block_num;
	}

	/**
	 * @typedef {Object} RegistrationOpts
	 * @property {boolean} unregister - Optional - This options setting indicates
	 *  the registration should be removed (unregister) when the event
	 *  is seen or the endBlock seen. When the application is using a timeout
	 *  to only wait a
	 *  specified amount of time for the transaction to be seen, the timeout
	 *  processing should included the manual 'unregister' of the transaction
	 *  event listener to avoid the event callbacks being called unexpectedly.
	 *  The default for this setting is different for the different types of
	 *  event listeners. For block listeners the default is false.
	 *  For transaction listeners the default is true and the
	 *  listener will be unregistered when a transaction with the id is
	 *  seen by this listener or the endBlock is seen. For chaincode listeners
	 *  the default will be false as the match filter might be intended for
	 *  many transactions rather than a specific transaction.
	 * @property {Number | string} [startBlock] - Optional. This will have this
	 *  registered listener look for this event within the block.
	 *  Blocks that have block numbers less than the startBlock will be
	 *  ignored by this listener.
	 *  Note: This EventService must be setup to listen for blocks in this
	 *  range.
	 * @property {Number | string} [endBlock] - Optional. This will have the
	 *  registered listener stop looking at blocks when the block number is
	 *  equal to or greater than the endBlock of this listener. The registered
	 * listener will be unregistered if the unregister option is set to true.
	 *  Note: This EventService must be setup to listen for blocks in this
	 *  range.
	 */

	/**
	 * Unregister the event listener returned by
	 * the register listener methods.
	 *
	 * @param {EventListener} eventListener - The registered listener.
	 */
	unregisterEventListener(eventListener = checkParameter('eventListener')) {
		const method = `unregisterEventListener[${this.name}]`;
		logger.debug(`${method} - start - eventListener:${eventListener}`);
		if (this._eventRegistrations.has(eventListener)) {
			this._eventRegistrations.delete(eventListener);
		} else {
			throw Error('eventListener not found');
		}

		let found_block = false;
		let found_tx = false;
		let found_chaincode = false;
		for (const event_reg of this._eventRegistrations.values()) {
			if (event_reg.listenerType === BLOCK) {
				found_block = true;
			} else if (event_reg.listenerType === TX) {
				found_tx = true;
			} else if (event_reg.listenerType === CHAINCODE) {
				found_chaincode = true;
			}
		}
		this._haveBlockListeners = found_block;
		this._haveTxListeners = found_tx;
		this._haveChaincodeListeners = found_chaincode;

		logger.debug('%s - end', method);
		return this;
	}

	/**
	 * Register a listener to receive chaincode events.
	 * @param {string|RegExp} eventName - The exact name of the chaincode event or
	 *  regular expression that will be matched against the name given to
	 *  the target chaincode's call
	 *  <code>stub.SetEvent(name, payload)</code>)
	 * @param {function} callback - Callback function that takes two parameters:
	 *  <ul>
	 *  <li>{Error} error
	 *  <li>{BlockEvent} event
	 *  </ul>
	 *  The "error" will be null unless this EventService has been shutdown.
	 *  The shutdown may be caused by a network, connection error,
	 *  by a call to the "disconnect()" method or when
	 *  the fabric event service ends the connection to this EventService.
	 *  This callback will also be called with an Error when the EventService is
	 *  shutdown due to the last block being received if the service has been
	 *  setup with an endBlock to be 'newest' or a specific block number that
	 *  has been seen.
	 * <br> The "event" will be the {@link BlockEvent} object.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *  for start and end block numbers, automatically unregister.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerChaincodeListener(eventName = checkParameter('eventName'), callback = checkParameter('callback'), options) {
		const method = `registerChaincodeListener[${this.name}]`;
		logger.debug(`${method} - start`);

		const event_name = new RegExp(eventName);
		const event_reg = new EventListener(CHAINCODE, callback, options, event_name);
		this._eventRegistrations.set(event_reg, event_reg);
		this._haveChaincodeListeners = true;

		return event_reg;
	}


	/**
	 * Register a listener to receive all blocks committed to this channel.
	 * The listener's "callback" function gets called on the arrival of every
	 * block.
	 *
	 * @param {function} callback - Callback function that takes two parameters:
	 *  <ul>
	 *  <li>{Error} error
	 *  <li>{Event} Event object
	 *  </ul>
	 *  The Error will be null unless this EventService has been shutdown.
	 *  The shutdown may be caused by a network, connection error,
	 *  by a call to the "disconnect()" method or when
	 *  the fabric event service ends the connection to this EventService.
	 *  This callback will also be called with an Error when the EventService is
	 *  shutdown due to the last block being received if the service has been
	 *  setup with an endBlock to be 'newest' or a specific block number that
	 *  has been seen.
	 * <br> The Event will be the {@link Event} object.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *  for start and end block numbers, automatically unregister and
	 *  automatically disconnect.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerBlockListener(callback = checkParameter('callback'), options) {
		const method = `registerBlockListener[${this.name}]`;
		logger.debug(`${method} - start`);

		const event_reg = new EventListener(BLOCK, callback, options, null);
		this._eventRegistrations.set(event_reg, event_reg);
		this._haveBlockListeners = true;

		return event_reg;
	}

	/**
	 * Register a callback function to receive a notification when the transaction
	 * by the given id has been committed into a block. Using the special string
	 * 'all' will indicate that this listener will notify (call) the callback
	 * for every transaction written to the ledger.
	 *
	 * @param {string} txid - Transaction id string or 'all'
	 * @param {function} callback - Callback function that takes the parameters:
	 *  <ul>
	 *  <li>{Error} error
	 *  <li>{string} transaction ID
	 *  <li>{string} status
	 *  <li>{long} block number
	 *  </ul>
	 *  The Error will be null unless this EventService is shutdown.
	 *  The shutdown may be caused by a network or connection error,
	 *  by a call to the "disconnect()" method or when
	 *  the fabric service ends the connection to this EventService.
	 *  This callback will also be called with an Error when the EventService is
	 *  shutdown due to the last block being received if replaying and requesting
	 *  the endBlock to be 'newest' or a specific value.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *  for start and end block numbers, automatically unregister.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerTransactionListener(txid = checkParameter('txid'), callback = checkParameter('callback'), options) {
		const method = `registerTransactionListener[${this.name}]`;
		logger.debug(`${method} start - txid:${txid}`);

		const send_options = Object.assign({}, options);
		let _txid = txid;
		// special case with 'all' transaction match
		// need to not unregister automatically
		if (txid.toLowerCase() === ALL) {
			logger.debug('%s - listening for all transactions');
			_txid = ALL;
			if (typeof send_options.unregister === 'boolean') {
				logger.debug('%s - unregister options is %s', method, send_options.unregister);
			} else {
				send_options.unregister = false;
			}
		}

		const event_reg = new EventListener(TX, callback, send_options, _txid);
		this._eventRegistrations.set(event_reg, event_reg);
		this._haveTxListeners = true;

		return event_reg;
	}

	/*
	 * private internal method to check each registered listener
	 * to see if it has requested to stop listening on a specific
	 * blocknum
	 */
	_processEndBlock(block_num = checkParameter('block_num')) {
		const method = `_processEndBlock[${this.name}]`;
		logger.debug(`${method} - start`);

		for (const listener of this._eventRegistrations.values()) {
			if (listener.endBlock) {
				if (listener.endBlock.equals(block_num)) {
					const event = new BlockEvent(this);
					event.endBlockReceived = true;
					event.blockNumber = block_num;
					listener.onEvent(null, event);
					this.unregisterEventListener(listener);
					logger.debug('%s - automatically unregister %s, end block: %s has been seen', method, listener, block_num);
				} else {
					logger.debug('%s - %s, end block: %s not seen', method, listener, block_num);
				}
			} else {
				logger.debug('%s - %s, no end block defined', method, listener, block_num);
			}
		}

		logger.debug('%s - end', method);
	}

	/*
	 * private internal method for processing block events
	 * @param {Object} block protobuf object
	 */
	_processBlockEvents(full, filtered, private_data, block_num) {
		const method = `_processBlockEvents[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!this._haveBlockListeners) {
			logger.debug(`${method} - no block listeners`);
			return;
		}
		for (const block_reg of this._eventRegistrations.values()) {
			if (block_reg.listenerType === BLOCK) {
				logger.debug(`${method} - calling block listener callback`);
				const event = new BlockEvent(this);
				event.block = full;
				event.filteredBlock = filtered;
				event.privateData = private_data;
				event.blockNumber = block_num;

				block_reg.onEvent(null, event);

				// check to see if we should automatically unregister
				if (block_reg.unregister) {
					this.unregisterEventListener(block_reg);
					logger.debug(`${method} - automatically unregister block listener for ${block_reg}`);
				}
			}
		}
	}

	/*
	 * private internal method for processing tx events
	 * @param {Object} block protobuf object which might contain transactions
	 */
	_processTxEvents(full_block, filtered_block) {
		const method = `_processTxEvents[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!this._haveTxListeners) {
			logger.debug(`${method} - no tx listeners`);
			return;
		}

		if (filtered_block) {
			logger.debug(`${method} filtered block number=${filtered_block.number}`);
			if (filtered_block.filtered_transactions) {
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					this._callTransactionListener(filtered_transaction.txid,
						filtered_transaction.tx_validation_code,
						filtered_block.number);
				}
			}
		} else {
			logger.debug(`${method} full block number=${full_block.header.number}`);
			const txStatusCodes = full_block.metadata.metadata[fabprotos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
			for (let index = 0; index < full_block.data.data.length; index++) {
				const channel_header = full_block.data.data[index].payload.header.channel_header;
				this._callTransactionListener(channel_header.tx_id,
					txStatusCodes[index],
					full_block.header.number);
			}
		}
	}

	/* internal utility method */
	_callTransactionListener(tx_id, val_code, block_num) {
		const method = `_callTransactionListener[${this.name}]`;
		logger.debug(`${method} - start`);

		for (const trans_reg of this._eventRegistrations.values()) {
			// check each listener to see if this transaction ID matches
			if (trans_reg.listenerType === TX) {
				if (trans_reg.event === tx_id || trans_reg.event === ALL) {
					logger.debug(`${method} - about to call the transaction call back with code=${val_code} tx=${tx_id}`);
					const status = convertValidationCode(val_code);
					const event = new BlockEvent(this);
					event.blockNumber = block_num;
					event.transactionId = tx_id;
					event.status = status;

					trans_reg.onEvent(null, event);

					// check to see if we should automatically unregister
					if (trans_reg.unregister) {
						this.unregisterEventListener(trans_reg);
						logger.debug(`${method} - automatically unregister tx listener for ${tx_id}`);
					}
				} else {
					logger.debug('%s - tx listener for %s - not called', method, trans_reg.event);
				}
			}
		}
	}

	/*
	 * private internal method for processing chaincode events
	 * @param {Object} block protobuf object which might contain the chaincode event from the fabric
	 */
	_processChaincodeEvents(full_block, filtered_block) {
		const method = `_processChaincodeEvents[${this.name}]`;
		logger.debug(`${method} - start`);

		if (!this._haveChaincodeListeners) {
			logger.debug(`${method} - no registered chaincode event "listeners"`);
			return;
		}
		const all_events = new Map();
		if (filtered_block) {
			if (filtered_block.filtered_transactions) {
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					if (filtered_transaction.transaction_actions) {
						if (filtered_transaction.transaction_actions.chaincode_actions) {
							for (const chaincode_action of filtered_transaction.transaction_actions.chaincode_actions) {
								logger.debug(`${method} - filtered block chaincode_event ${chaincode_action}`);
								// need to remove the payload since with filtered blocks it
								// has an empty byte array value which is not the real value
								// we do not want the listener to think that is the value
								delete chaincode_action.chaincode_event.payload;
								this._queueChaincodeEvent(chaincode_action.chaincode_event,
									filtered_block.number,
									filtered_transaction.txid,
									filtered_transaction.tx_validation_code,
									all_events);
							}
						}
					}
				}
			}
		} else {
			for (let index = 0; index < full_block.data.data.length; index++) {
				logger.debug(`${method} - trans index=${index}`);
				try {
					const env = full_block.data.data[index];
					const channel_header = env.payload.header.channel_header;
					if (channel_header.type === 3) { // only ENDORSER_TRANSACTION have chaincode events
						const tx = env.payload.data;
						if (tx && tx.actions) {
							for (const {payload} of tx.actions) {
								const chaincode_event = payload.action.proposal_response_payload.extension.events;
								logger.debug(`${method} - full block chaincode_event ${chaincode_event}`);

								const txStatusCodes = full_block.metadata.metadata[fabprotos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
								const channelHeader = full_block.data.data[index].payload.header.channel_header;
								const val_code = txStatusCodes[index];

								this._queueChaincodeEvent(chaincode_event,
									full_block.header.number,
									channelHeader.tx_id,
									val_code,
									all_events);
							}
						} else {
							logger.debug(`${method} - no transactions or transaction actions`);
						}
					} else {
						logger.debug(`${method} - full_block is not endorser transaction type`);
					}
				} catch (err) {
					logger.error(`${method} - Error with chaincode event processing :: ${err}`);
				}
			}
		}

		// send all events for each listener
		for (const [chaincode_reg, event] of all_events.entries()) {
			logger.debug('%s - calling callback - %s', method, chaincode_reg.event);
			chaincode_reg.onEvent(null, event);

			// see if we should automatically unregister this event listener
			if (chaincode_reg.unregister) {
				this.unregisterEventListener(chaincode_reg);
				logger.debug(`${method} - automatically unregister chaincode event listener setting`);
			}
		}

		logger.debug('%s - end', method);
	}

	_queueChaincodeEvent(chaincode_event, block_num, tx_id, val_code, all_events) {
		const method = `_queueChaincodeEvent[${this.name}]`;
		logger.debug(`${method} - start - chaincode_event ${chaincode_event}`);

		const tx_status = convertValidationCode(val_code);

		logger.debug(`${method} - txid=${tx_id}  val_code=${tx_status}`);

		for (const chaincode_reg of this._eventRegistrations.values()) {
			// check each listener to see if this chaincode event matches
			if (chaincode_reg.listenerType === CHAINCODE && chaincode_reg.event.test(chaincode_event.event_name)) {
				// we have a match - save it to be sent later
				logger.debug(`${method} - queuing chaincode event: ${chaincode_event.event_name}`);
				let event = all_events.get(chaincode_reg);
				if (!event) {
					event = new BlockEvent(this);
					event.blockNumber = block_num;
					event.chaincodeEvents = [];
					all_events.set(chaincode_reg, event);
				}
				event.chaincodeEvents.push(new ChaincodeEvent(
					chaincode_event.chaincode_id,
					tx_id, tx_status,
					chaincode_event.event_name,
					chaincode_event.payload
				));
			} else {
				logger.debug(`${method} - NOT queuing chaincode event: ${chaincode_event.event_name}`);
			}
		}
	}
}

module.exports = EventService;

function convertValidationCode(code) {
	if (typeof code === 'string') {
		return code;
	}
	return _validation_codes[code];
}

/**
 * @typedef {Object} ChaincodeEvent
 * @property {string} chaincode_id - The name of chaincode that sourced this
 *  event.
 * @property {string} transactionId - The transaction ID of this event.
 * @property {string} status - The transaction status of the transaction.
 * @property {string} eventName - The string that is the eventName of this
 *  event as set by the chaincode during endorsement.
 *  <code>stub.SetEvent(eventName, payload)</code>
 * @property {byte[]} payload - Application-specific byte array that the chaincode
 *  set when it called <code>stub.SetEvent(eventName, payload)</code>
 */

class ChaincodeEvent {
	/**
	 * Constructs an object that contains all information from the chaincode event.
	 * message ChaincodeEvent {
     *   string chaincode_id = 1;
     *   string tx_id = 2;
     *   string event_name = 3;
     *   bytes payload = 4;
	 */
	constructor(chaincodeId, transactionId, status, eventName, payload) {
		this.chaincodeId = chaincodeId;
		this.transactionId = transactionId;
		this.status = status;
		this.eventName = eventName;
		this.payload = payload;
	}
}
/**
 * @typedef {Object} BlockEvent
 * @property {EventService} EventService - this EventService.
 * @property {Long} - blockNumber - The block number that contains
 *  this event.
 * @property {string} - [transactionId] - The transaction ID of this event
 * @property {string} - [transactionStatus] - The transaction status of this
 *  event.
 * @property {boolean} - endBlockReceived - Indicates if the endBlock as
 *  defined by the listener has been seen.
 * @property {ChaincodeEvent[]} [chaincodeEvents] - An array of
 *  {@link ChaincodeEvent}.
 * @property {object} [block] - The decode of the full block received
 * @property {object} [filteredBlock] - The decode of the filtered block received
 * @property {object} [privateData] -A data map of any included private data.
 */

class BlockEvent {
	/**
	 * Constructs a {@link BlockEvent} object that contains all information about an Event.
	 */
	constructor(eventHub) {
		this.eventHub = eventHub;
		this.blockNumber;
		this.transactionId;
		this.transactionStatus;
		this.endBlockReceived = false;
		this.chaincodeEvents = [];
		this.block;
		this.filteredBlock;
		this.privateData;
	}
}
