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

let count = 1;
let streamCount = 1;
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
		this.channel = channel;

		// the last block number received
		this.lastBlockNumber = null;

		this.startBlock = NEWEST;
		this.endBlock = undefined;
		this._end_block_seen = false;

		this._eventListenerRegistrations = new Map();
		this._reg_counter = 0;
		this._haveBlockListeners = false;
		this._haveTxListeners = false;
		this._haveChaincodeListeners = false;

		// peer's event service
		this.targets = null;
		this._current_eventer = null;
		// closing state to case of multiple calls
		this._close_running = false;

		// remember the blockType this EventService is listening
		// will be set during the .build call
		this.blockType = FILTERED_BLOCK;
		this.replay = false;

		this.myNumber = count++;
	}

	/**
	 * Use this method to set the ServiceEndpoint for this ServiceAction class
	 * The {@link Eventer} a ServiceEndpoint must be connected before making
	 * this assignment.
	 * @property {Eventer[]} targets - The connected Eventer instances to
	 *  be used when no targets are provided on the send.
	 */
	setTargets(targets = checkParameter('targets')) {
		const method = `setTargets[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		if (!Array.isArray(targets)) {
			throw Error('targets parameter is not an array');
		}

		if (targets.length < 1) {
			throw Error('No targets provided');
		}

		for (const eventer of targets) {
			if (eventer.connected || eventer.isConnectable()) {
				logger.debug('%s - target is or could be connected %s', method, eventer.name);
			} else {
				throw Error(`Eventer ${eventer.name} is not connectable`);
			}
		}
		// must be all targets are connected
		this.targets = targets;

		return this;
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
		const method = `close[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - hub', method);
		this._close(new Error('EventService has been shutdown by "close()" call'));
	}

	/*
	 * Internal method
	 * Disconnects the connection to the fabric peer service.
	 * Will close all event listeners and send the provided `Error` to
	 * all listeners on the event callback.
	 */
	_close(reason_error = checkParameter('reason_error')) {
		const method = `_close[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - called due to:: %s', method, reason_error.message);

		if (this._close_running) {
			logger.debug('%s - close is running - exiting', method);
			return;
		}
		this._close_running = true;
		this._closeAllCallbacks(reason_error);
		if (this._current_eventer) {
			this._current_eventer.disconnect();
			logger.debug('%s - closing stream %s', method, this.currentStreamNumber);
			this._current_eventer = null;
		}
		this._close_running = false;

		logger.debug('%s - end', method);
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
		const method = `buildRequest[${this.name}] - #${this.myNumber}`;
		logger.debug(`${method} - start`);

		const {startBlock, endBlock, blockType = FILTERED_BLOCK} = options;
		this.startBlock = this._checkBlockNum(startBlock);
		this.endBlock = this._checkBlockNum(endBlock);

		// when they are both Longs
		if (this.startBlock && this.endBlock && this.endBlock.greaterThan && this.startBlock.greaterThan) {
			if (this.startBlock.greaterThan(this.endBlock)) {
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
		if (!this.startBlock || this.startBlock === NEWEST) {
			if (this.endBlock === OLDEST) {
				throw Error('"startBlock" must not be greater than "endBlock"');
			}
			const seekNewest = new fabprotos.orderer.SeekNewest();
			seekStart.setNewest(seekNewest);
		} else if (this.startBlock === OLDEST) {
			const seekOldest = new fabprotos.orderer.SeekOldest();
			seekStart.setOldest(seekOldest);
			this.replay = true;
		} else if (this.startBlock) {
			const seekSpecifiedStart = new fabprotos.orderer.SeekSpecified();
			seekSpecifiedStart.setNumber(this.startBlock);
			seekStart.setSpecified(seekSpecifiedStart);
			this.replay = true;
		}

		// build stop proto
		const seekStop = new fabprotos.orderer.SeekPosition();
		if (this.endBlock === NEWEST) {
			const seekNewest = new fabprotos.orderer.SeekNewest();
			seekStop.setNewest(seekNewest);
			behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			this.replay = true;
		} else if (this.endBlock === OLDEST) {
			const seekOldest = new fabprotos.orderer.SeekOldest();
			seekStop.setOldest(seekOldest);
			behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			this.replay = true;
		} else {
			const seekSpecifiedStop = new fabprotos.orderer.SeekSpecified();
			if (this.endBlock) {
				seekSpecifiedStop.setNumber(this.endBlock);
				// user should be told that the block does not exist
				behavior = fabprotos.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
				this.replay = true;
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
	 * @property {Number} [requestTimeout] - Optional. The request timeout
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
		const method = `send[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		const {targets, requestTimeout} = request;
		if (targets && Array.isArray(targets) && targets.length > 0) {
			this.targets = targets;
			logger.debug('%s - using user assigned targets', method);
		} else if (this.targets) {
			logger.debug('%s - using preassigned targets', method);
		} else {
			checkParameter('targets');
		}
		const envelope = this.getSignedEnvelope();
		this._current_eventer = null;
		let start_error = null;
		this._end_block_seen = false;

		for (const target of this.targets) {
			try {
				if (target.stream) {
					start_error = Error(`Event service ${target.name} is currently listening`);
				} else {
					if (target.isConnectable()) {
						await target.connect(); // target endpoint has been previously assigned, but not connected yet
					}
					const isConnected = await target.checkConnection();
					if (!isConnected) {
						start_error = Error(`Event service ${target.name} is not connected`);
					} else {
						this._current_eventer = await this._startService(target, envelope, requestTimeout);
					}
				}
			} catch (error) {
				logger.error('%s - Starting stream to %s failed', method, target.name);
				start_error = error;
			}

			// let see how we did with this target
			if (this._current_eventer) {
				// great, it will be the one we use, stop looking
				start_error = null;
				break;
			}
		}

		// if we ran through the all targets and have start_error then we
		// have not found a working target endpoint, so tell user error
		if (start_error) {
			throw start_error;
		}
	}

	/*
	 * internal method to startup a stream and bind this event hub's callbacks
	 * to a specific target's gRPC stream
	 */
	_startService(eventer, envelope, requestTimeout) {
		const method = `_startService[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		return new Promise((resolve, reject) => {
			if (!requestTimeout) {
				requestTimeout = eventer.endpoint.options.requestTimeout;
			}
			logger.debug('%s - setup timer %s', method, requestTimeout);

			logger.debug('%s - create stream setup timeout', method);
			const connection_setup_timeout = setTimeout(() => {
				logger.error(`EventService[${this.name}] timed out after:${requestTimeout}`);
				reject(Error('Event service timed out - Unable to start listening'));
			}, requestTimeout);

			logger.debug('%s - create stream based on blockType', method, this.blockType);
			eventer.setStreamByType(this.blockType);

			// the promise and streams live on and need we need
			// to check at times to be sure we are working with the
			// correct one if the target gets restarted
			const stream = eventer.stream;
			const mystreamCount = streamCount++;
			this.currentStreamNumber = mystreamCount;

			logger.debug('%s - create stream listening callbacks - onData, onEnd, onStatus, onError', method);

			eventer.stream.on('data', (deliverResponse) => {
				logger.debug(`on.data - peer:${eventer.endpoint.url} - ${mystreamCount}`);
				if (stream !== eventer.stream) {
					logger.debug('on.data - incoming block was from a cancelled stream');
					return;
				}

				clearTimeout(connection_setup_timeout);

				logger.debug('on.data - resolve the promise');
				resolve(eventer);

				if (deliverResponse.Type === 'block' || deliverResponse.Type === 'filtered_block' || deliverResponse.Type === 'block_and_private_data') {
					try {
						let block = null;
						let filtered_block = null;
						let private_data = null;
						let block_num = null;
						if (deliverResponse.Type === 'block') {
							logger.debug('on.data - have full block data');
							block = BlockDecoder.decodeBlock(deliverResponse.block);
							block_num = convertToLong(block.header.number);
						} else if (deliverResponse.Type === 'filtered_block') {
							logger.debug('on.data - have filtered block data');
							filtered_block = JSON.parse(JSON.stringify(deliverResponse.filtered_block));
							block_num = convertToLong(filtered_block.number);
						} else if (deliverResponse.Type === 'block_and_private_data') {
							logger.debug('on.data - have full block data with private data');
							const private_block = BlockDecoder.decodeBlockWithPrivateData(deliverResponse.block_and_private_data);
							private_data = private_block.private_data_map;
							block = private_block.block;
							block_num = convertToLong(block.header.number);
						} else {
							throw Error(`Unknown block type "${deliverResponse.Type}`);
						}

						this.lastBlockNumber = block_num;
						logger.debug(`on.data - incoming block number ${this.lastBlockNumber}`);
						this._processBlockEvents(block, filtered_block, private_data, block_num);
						this._processTxEvents(block, filtered_block);
						this._processChaincodeEvents(block, filtered_block);
						this._processEndBlock(block_num);

						// check to see if we should shut things down
						if (this.endBlock) {
							if (this.endBlock.lessThanOrEqual(this.lastBlockNumber)) {
								this._end_block_seen = true;
								this._close(new Error(`Shutdown due to end block number has been seen: ${this.lastBlockNumber.toNumber()}`));
							}
						}
					} catch (error) {
						logger.error('%s EventService - ::%s', method, error.stack);
						logger.error('%s EventService has detected an error %s', method, error);
						// report error to all callbacks and shutdown this EventService
						this._close(error);
					}
				} else if (deliverResponse.Type === 'status') {
					if (deliverResponse.status === 'SUCCESS') {
						logger.debug('%s - on.data received type status of SUCCESS', method);
						if (this._end_block_seen) {
							// this is normal after the last block comes in when we set an ending block
							logger.debug('on.data - status received after last block seen: %s block_num: %s',
								deliverResponse.status, this.lastBlockNumber.toNumber());
						} else if (this.endBlock === NEWEST) {
							// this is normal after the last block comes in when we set to newest as an ending block
							logger.debug('on.data - status received when newest block seen: %s block_num: %s',
								deliverResponse.status, this.lastBlockNumber.toNumber());
							this._close(new Error(`Newest block received:${this.lastBlockNumber.toNumber()} status:${deliverResponse.status}`));
						} else if (this.endBlock) {
							logger.debug('on.data - status received before the endblock has been seen');
							this._close(new Error(`End block of ${this.endBlock.toNumber()}` +
								`not received. Last block received ${this.lastBlockNumber.toNumber()}`));
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
				logger.debug('on status - status received: %j  peer:%s - %s', response, eventer.endpoint.url, mystreamCount);
			});

			eventer.stream.on('end', () => {
				logger.debug('on.end - peer:%s - %', eventer.endpoint.url, mystreamCount);
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
				if (this._current_eventer) {
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
				logger.debug('on.error - block peer:%s - %s', eventer.endpoint.url, mystreamCount);
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
				if (this._current_eventer) {
					logger.debug('%s - close all application listeners - %s', method, out_error);
					this._close(out_error);
				} else {
					// must be we got the end while still trying to set up the
					// listening stream, do not close the application listeners,
					// we may try another target on the list or the application
					// will try with another targets list
					logger.error('%s - reject the promise - %s', method, out_error);
				}
				reject(out_error);
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
	isStarted() {
		const method = `isStarted[${this.name}]  - #${this.myNumber}`;
		logger.debug('%s - start', method);

		if (this._current_eventer && this._current_eventer.isStreamReady()) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Use this method to indicate if this event service has event listeners
	 * {@link EventListener} assigned and waiting for an event.
	 */
	hasListeners() {
		const method = `hasListeners[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		if (this._eventListenerRegistrations.size > 0) {
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
		const method = `_closeAllCallbacks[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		logger.debug('%s - event registrations %s', method, this._eventListenerRegistrations.size);
		for (const event_reg of this._eventListenerRegistrations.values()) {
			logger.debug('%s - tell listener of the error:%s', method, event_reg);
			try {
				event_reg.onEvent(err);
			} catch (error) {
				logger.error('%s - %s', method, error);
			}
		}

		logger.debug('%s - clear out the listener list', method);
		this._eventListenerRegistrations.clear();

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
	 * @typedef {Object} EventRegistrationOptions
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
	 * @param {boolean} [notThrow] - When the listener is not found an error
	 *  will be thrown when not included or false
	 */
	unregisterEventListener(eventListener = checkParameter('eventListener'), notThrow) {
		const method = `unregisterEventListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - eventListener:%s', method, eventListener);
		if (this._eventListenerRegistrations.has(eventListener)) {
			this._eventListenerRegistrations.delete(eventListener);
		} else {
			if (!notThrow) {
				logger.error('%s - event listener was not found', method);
				throw Error('eventListener not found');
			} else {
				logger.debug('%s - event listener was not found', method);
				return; // nothing to do
			}
		}

		let found_block = false;
		let found_tx = false;
		let found_chaincode = false;
		for (const event_reg of this._eventListenerRegistrations.values()) {
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
	 *  <li>{EventInfo} event
	 *  </ul>
	 *  The "error" will be null unless this EventService has been shutdown.
	 *  The shutdown may be caused by a network, connection error,
	 *  by a call to the "disconnect()" method or when
	 *  the fabric event service ends the connection to this EventService.
	 *  This callback will also be called with an Error when the EventService is
	 *  shutdown due to the last block being received if the service has been
	 *  setup with an endBlock to be 'newest' or a specific block number that
	 *  has been seen.
	 * <br> The "event" will be the {@link EventInfo} object.
	 * @param {EventRegistrationOptions} options - Options on the registrations to allow
	 *  for start and end block numbers, automatically unregister.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerChaincodeListener(chaincodeId = checkParameter('chaincodeId'), eventName = checkParameter('eventName'), callback = checkParameter('callback'), options) {
		const method = `registerChaincodeListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		const event_name = new RegExp(eventName);
		const event_reg = new EventListener(this, CHAINCODE, callback, options, event_name, chaincodeId);
		this._eventListenerRegistrations.set(event_reg, event_reg);
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
	 * @param {EventRegistrationOptions} options - Options on the registrations to allow
	 *  for start and end block numbers or to automatically unregister
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerBlockListener(callback = checkParameter('callback'), options) {
		const method = `registerBlockListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		const event_reg = new EventListener(this, BLOCK, callback, options, null);
		this._eventListenerRegistrations.set(event_reg, event_reg);
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
	 * @param {EventRegistrationOptions} options - Options on the registrations to allow
	 *  for start and end block numbers or to automatically unregister.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerTransactionListener(txid = checkParameter('txid'), callback = checkParameter('callback'), options) {
		const method = `registerTransactionListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s start - txid:%s', method, txid);

		const send_options = Object.assign({}, options);
		let _txid = txid;
		// special case with 'all' transaction match
		// need to not unregister automatically
		if (txid.toLowerCase() === ALL) {
			logger.debug('%s - listening for all transactions', method);
			_txid = ALL;
			if (typeof send_options.unregister === 'boolean') {
				logger.debug('%s - unregister options is %s', method, send_options.unregister);
			} else {
				send_options.unregister = false;
			}
		}

		const event_reg = new EventListener(this, TX, callback, send_options, _txid);
		this._eventListenerRegistrations.set(event_reg, event_reg);
		this._haveTxListeners = true;

		return event_reg;
	}

	/**
	 * Utility method to find an event listener for a specific transaction ID
	 *
	 * @param {string} txid - the transaction ID of the event listener
	 *  being searched.
	 * @return {EventListener} The EventListener for the transaction ID provided
	 */
	getTransactionListener(txid = checkParameter('txid')) {
		const method = `getTransactionListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);
		let result = null;

		for (const trans_reg of this._eventListenerRegistrations.values()) {
			// check each listener to see if this transaction ID matches
			if (trans_reg.listenerType === TX) {
				if (trans_reg.event === txid) {
					logger.debug(`${method} - found the listener for ${txid}`);
					result = trans_reg;
					break;
				}
			}
		}

		return result;
	}

	/*
	 * private internal method to check each registered listener
	 * to see if it has requested to stop listening on a specific
	 * blocknum
	 */
	_processEndBlock(block_num = checkParameter('block_num')) {
		const method = `_processEndBlock[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		for (const listener of this._eventListenerRegistrations.values()) {
			if (listener.endBlock) {
				if (listener.endBlock.equals(block_num)) {
					logger.debug('%s - listener endblock seen %s', method, block_num.toString());
					const event = new EventInfo(this);
					event.endBlockReceived = true;
					event.blockNumber = block_num;

					try {
						listener.onEvent(null, event);
					} catch (error) {
						logger.error('%s - %s', method, error);
					}

					this.unregisterEventListener(listener, true);
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
		const method = `_processBlockEvents[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - %s', method, this.blockType);

		if (full) {
			logger.debug('%s - have full block', method);
		} else if (filtered) {
			logger.debug('%s - have filtered block', method);
		} else {
			logger.debug('%s - missing block data', method);
		}

		if (private_data) {
			logger.debug('%s - have private data', method);
		}

		if (!this._haveBlockListeners) {
			logger.debug('%s - no block listeners', method);
			return;
		}
		for (const block_reg of this._eventListenerRegistrations.values()) {
			if (block_reg.listenerType === BLOCK) {
				logger.debug('%s - calling block listener callback', method);
				const event = new EventInfo(this);
				event.block = full;
				event.filteredBlock = filtered;
				event.privateData = private_data;
				event.blockNumber = block_num;

				try {
					block_reg.onEvent(null, event);
				} catch (error) {
					logger.error('%s - %s', method, error);
				}

				// check to see if we should automatically unregister
				if (block_reg.unregister) {
					logger.debug('%s - automatically unregister block listener for %s', method, block_reg);
					this.unregisterEventListener(block_reg, true);
				}
			}
		}
	}

	/*
	 * private internal method for processing tx events
	 * @param {Object} block protobuf object which might contain transactions
	 */
	_processTxEvents(full_block, filtered_block) {
		const method = `_processTxEvents[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		if (!this._haveTxListeners) {
			logger.debug('%s - no tx listeners', method);
			return;
		}

		if (filtered_block) {
			logger.debug('%s filtered block number=%s', method, filtered_block.number);
			if (filtered_block.filtered_transactions) {
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					this._callTransactionListener(filtered_transaction.txid,
						filtered_transaction.tx_validation_code,
						filtered_block.number);
				}
			}
		} else {
			logger.debug('%s full block number=%s', method, full_block.header.number);
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
		const method = `_callTransactionListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		for (const trans_reg of this._eventListenerRegistrations.values()) {
			// check each listener to see if this transaction ID matches
			if (trans_reg.listenerType === TX) {
				if (trans_reg.event === tx_id || trans_reg.event === ALL) {
					logger.debug('%s - about to call the transaction call back with code=%s tx=%s', method, val_code, tx_id);
					const status = convertValidationCode(val_code);
					const event = new EventInfo(this);
					event.blockNumber = block_num;
					event.transactionId = tx_id;
					event.status = status;

					try {
						trans_reg.onEvent(null, event);
					} catch (error) {
						logger.error('%s - %s', method, error);
					}

					// check to see if we should automatically unregister
					if (trans_reg.unregister) {
						logger.debug('%s - automatically unregister tx listener for %s', method, tx_id);
						this.unregisterEventListener(trans_reg, true);
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
		const method = `_processChaincodeEvents[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		if (!this._haveChaincodeListeners) {
			logger.debug('%s - no registered chaincode event "listeners"', method);
			return;
		}
		const all_events = new Map();
		if (filtered_block) {
			if (filtered_block.filtered_transactions) {
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					if (filtered_transaction.transaction_actions) {
						if (filtered_transaction.transaction_actions.chaincode_actions) {
							for (const chaincode_action of filtered_transaction.transaction_actions.chaincode_actions) {
								logger.debug('%s - filtered block chaincode_event %s', method, chaincode_action);
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
				logger.debug('%s - trans index=%s', method, index);
				try {
					const env = full_block.data.data[index];
					const channel_header = env.payload.header.channel_header;
					if (channel_header.type === 3) { // only ENDORSER_TRANSACTION have chaincode events
						const tx = env.payload.data;
						if (tx && tx.actions) {
							for (const {payload} of tx.actions) {
								const chaincode_event = payload.action.proposal_response_payload.extension.events;
								logger.debug('%s - full block chaincode_event %s', method, chaincode_event);

								const txStatusCodes = full_block.metadata.metadata[fabprotos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
								const val_code = txStatusCodes[index];

								this._queueChaincodeEvent(
									chaincode_event,
									full_block.header.number,
									channel_header.tx_id,
									val_code,
									all_events);
							}
						} else {
							logger.debug('%s - no transactions or transaction actions', method);
						}
					} else {
						logger.debug('%s - full_block is not endorser transaction type', method);
					}
				} catch (err) {
					logger.error('%s - Error with chaincode event processing :: %s', method, err);
				}
			}
		}

		// send all events for each listener
		for (const [chaincode_reg, event] of all_events.entries()) {
			logger.debug('%s - calling callback - %s', method, chaincode_reg.event);

			try {
				chaincode_reg.onEvent(null, event);
			} catch (error) {
				logger.error('%s - %s', method, error);
			}

			// see if we should automatically unregister this event listener
			if (chaincode_reg.unregister) {
				logger.debug('%s - automatically unregister chaincode event listener setting', method);
				this.unregisterEventListener(chaincode_reg, true);
			}
		}

		logger.debug('%s - end', method);
	}

	_queueChaincodeEvent(chaincode_event, block_num, tx_id, val_code, all_events) {
		const method = `_queueChaincodeEvent[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - chaincode_event %s', method, chaincode_event);

		const tx_status = convertValidationCode(val_code);

		logger.debug('%s - txid=%s  val_code=%s', method, tx_id, tx_status);

		for (const chaincode_reg of this._eventListenerRegistrations.values()) {
			// check each listener to see if this chaincode event matches
			if (chaincode_reg.listenerType === CHAINCODE &&
				chaincode_reg.chaincodeId === chaincode_event.chaincode_id &&
				chaincode_reg.event.test(chaincode_event.event_name)) {
				// we have a match - save it to be sent later
				logger.debug('%s - queuing chaincode event: %s', method, chaincode_event.event_name);
				let event = all_events.get(chaincode_reg);
				if (!event) {
					event = new EventInfo(this);
					event.blockNumber = block_num;
					event.chaincodeEvents = [];
					all_events.set(chaincode_reg, event);
				}
				event.chaincodeEvents.push(new ChaincodeEvent(
					chaincode_event.chaincode_id,
					tx_id,
					tx_status,
					chaincode_event.event_name,
					chaincode_event.payload
				));
			} else {
				logger.debug('%s - NOT queuing chaincode event: %s', method, chaincode_event. event_name);
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
 * @typedef {Object} EventInfo
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

class EventInfo {
	/**
	 * Constructs a {@link EventInfo} object that contains all information about an Event.
	 */
	constructor(eventService) {
		this.eventService = eventService;
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
