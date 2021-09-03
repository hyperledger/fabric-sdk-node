/*
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

const fabproto6 = require('fabric-protos');
const {common: {Status: {SUCCESS, NOT_FOUND}}} = fabproto6;

// Special transaction id to indicate that the transaction listener will be
// notified of all transactions
const ALL = 'all';

// Special values for block numbers
const NEWEST = 'newest'; // what fabric peer sees as newest on the ledger at time of connect
const OLDEST = 'oldest'; // what fabric peer sees as oldest on the ledger at time of connect

const BLOCK = EventListener.BLOCK; // for block type event listeners
const TX = EventListener.TX; // for transaction type event listeners
const CHAINCODE = EventListener.CHAINCODE; // for chaincode event type event listeners

// block type is a NodeSDK concept to understand what type of gRPC message data we
// need to work with, both in how we set up the stream and the data returned
const FULL_BLOCK = 'full'; // to receive full blocks
const FILTERED_BLOCK = 'filtered'; // to receive filtered blocks
const PRIVATE_BLOCK = 'private'; // to receive full blocks and private data

// some info to help with debug when there are multiple eventservices running
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
		this._endBlockSeen = false;

		this._eventListenerRegistrations = new Map();
		this._haveBlockListeners = false;
		this._haveTxListeners = false;
		this._haveChaincodeListeners = false;

		// peer's event service
		this.targets = null;
		this._currentEventer = null;
		// closing state to case of multiple calls
		this._closeRunning = false;

		// remember the blockType this EventService is listening
		// will be set during the .build call
		this.blockType = FILTERED_BLOCK;
		this.replay = false;
		this.startSpecified = false;

		this.myNumber = count++;

		this.inUse = false;
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
			if (eventer.isConnectable()) {
				logger.debug('%s - target is connectable %s', method, eventer.name);
			} else {
				throw Error(`Eventer ${eventer.name} is not connectable`);
			}
		}
		// must be all targets are connectable
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
	_close(reasonError = checkParameter('reasonError')) {
		const method = `_close[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - called due to %s', method, reasonError.message);

		if (this._closeRunning) {
			logger.debug('%s - close is running - exiting', method);
			return;
		}
		this._closeRunning = true;
		this._closeAllCallbacks(reasonError);
		if (this._currentEventer) {
			logger.debug('%s - have currentEventer close stream %s', method, this.currentStreamNumber);
			this._currentEventer.disconnect();
			this._currentEventer = null;
		} else {
			logger.debug('%s - no current eventer - not shutting down stream', method);
		}

		this._closeRunning = false;
		this.inUse = false;

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
		const method = `build[${this.name}] - #${this.myNumber}`;
		logger.debug(`${method} - start`);

		this.inUse = true;
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

		// BLOCK_UNTIL_READY will mean hold the stream open and keep sending as
		//    the blocks come in
		// FAIL_IF_NOT_READY will mean if the block is not there throw an error
		let behavior = fabproto6.orderer.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY;

		// build start proto
		const seekStart = fabproto6.orderer.SeekPosition.create();
		if (!this.startBlock || this.startBlock === NEWEST) {
			if (this.endBlock === OLDEST) {
				throw Error('"startBlock" must not be greater than "endBlock"');
			}
			seekStart.newest = fabproto6.orderer.SeekNewest.create();
		} else if (this.startBlock === OLDEST) {
			seekStart.oldest = fabproto6.orderer.SeekOldest.create();
			this.replay = true;
		} else if (this.startBlock) {
			seekStart.specified = fabproto6.orderer.SeekSpecified.create({
				number: this.startBlock
			});
			this.replay = true;
			this.startSpecified = true;
		}

		// build stop proto
		const seekStop = fabproto6.orderer.SeekPosition.create();
		if (this.endBlock === NEWEST) {
			seekStop.newest = fabproto6.orderer.SeekNewest.create();
			behavior = fabproto6.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			this.replay = true;
		} else if (this.endBlock === OLDEST) {
			seekStop.oldest = fabproto6.orderer.SeekOldest.create();
			behavior = fabproto6.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			this.replay = true;
		} else {
			const seekSpecifiedStop = fabproto6.orderer.SeekSpecified.create();
			if (this.endBlock) {
				seekSpecifiedStop.number = this.endBlock;
				// user should be told that the block does not exist
				behavior = fabproto6.orderer.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
				this.replay = true;
			} else {
				seekSpecifiedStop.number = Long.MAX_VALUE;
			}
			seekStop.specified = seekSpecifiedStop;
		}

		// seek info with all parts
		const seekInfo = fabproto6.orderer.SeekInfo.create({
			start: seekStart,
			stop: seekStop,
			behavior: behavior
		});
		const seekInfoBuf = fabproto6.orderer.SeekInfo.encode(seekInfo).finish();

		// build the header for use with the seekInfo payload
		const channelHeaderBuf = this.channel.buildChannelHeader(
			fabproto6.common.HeaderType.DELIVER_SEEK_INFO,
			'',
			idContext.transactionId
		);

		const seekPayload = fabproto6.common.Payload.create({
			header: this.buildHeader(idContext, channelHeaderBuf),
			data: seekInfoBuf
		});
		this._payload = fabproto6.common.Payload.encode(seekPayload).finish();

		logger.debug(`${method} - end`);
		return this._payload;
	}

	/**
	 * @typedef {Object} StartEventRequest
	 * @property {Eventer[]} targets - The Eventers to send the start stream request.
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
		this._currentEventer = null;
		let startError = null;
		this._endBlockSeen = false;

		for (const target of this.targets) {
			try {
				if (target.stream) {
					logger.debug('%s - target has a stream, is already listening %s', method, target.toString());
					startError = Error(`Event service ${target.name} is currently listening`);
				} else {
					const isConnected = await target.checkConnection();
					if (!isConnected) {
						startError = Error(`Event service ${target.name} is not connected`);
						logger.debug('%s - target is not connected %s', method, target.toString());
					} else {
						this._currentEventer = await this._startService(target, envelope, requestTimeout);
						logger.debug('%s - set current eventer %s', method, this._currentEventer.toString());
					}
				}
			} catch (error) {
				logger.error('%s - Starting stream to %s failed', method, target.name);
				startError = error;
			}

			// let see how we did with this target
			if (this._currentEventer) {
				// great, it will be the one we use, stop looking
				startError = null;
				break;
			}
		}

		// if we ran through the all targets and have startError then we
		// have not found a working target endpoint, so tell user error
		if (startError) {
			logger.error('%s - no targets started - %s', method, startError);
			throw startError;
		}

		logger.debug('%s - end', method);
	}

	/*
	 * internal method to startup a stream and bind this event hub's callbacks
	 * to a specific target's gRPC stream
	 */
	_startService(eventer, envelope, requestTimeout) {
		const me = `[${this.name}] - #${this.myNumber}`;
		const method = `_startService${me}`;
		logger.debug('%s - start', method);

		return new Promise((resolve, reject) => {
			if (!requestTimeout) {
				requestTimeout = eventer.endpoint.options.requestTimeout;
			}
			logger.debug('%s - setup timer %s', method, requestTimeout);

			logger.debug('%s - create stream setup timeout', method);
			const connectionSetupTimeout = setTimeout(() => {
				// this service may be waiting for a start block that has not happened
				if (this.startSpecified) {
					logger.debug(`EventService[${this.name}] timed out after:${requestTimeout}`);
					logger.debug(`EventService[${this.name}] not stopping service, wait indefinitely`);
					// resolve the promise as if we did get a good response from the peer, since we did
					// not get an "end" or "error" back indicating that the request was invalid
					// application should have a timer just in case this peer never gets this block
					resolve(eventer);
				} else {
					logger.error(`EventService[${this.name}] timed out after:${requestTimeout}`);
					reject(Error('Event service timed out - Unable to start listening'));
				}

			}, requestTimeout);

			eventer.setStreamByType(this.blockType);

			// the promise and streams live on and we need
			// to check at times to be sure we are working with the
			// correct one if the target gets restarted
			const stream = eventer.stream;
			const mystreamCount = streamCount++;
			this.currentStreamNumber = mystreamCount;

			logger.debug('%s - created stream % based on blockType %s', method, this.currentStreamNumber, this.blockType);

			eventer.stream.on('data', (deliverResponse) => {
				logger.debug('on.data %s- peer:%s - stream:%s', me, eventer.endpoint.url, mystreamCount);
				if (stream !== eventer.stream) {
					logger.debug('on.data %s- incoming block was from a cancelled stream', me);
					return;
				}

				clearTimeout(connectionSetupTimeout);

				logger.debug('on.data %s- resolve the promise', me);
				resolve(eventer);

				if (deliverResponse.Type === 'block' || deliverResponse.Type === 'filtered_block' || deliverResponse.Type === 'block_and_private_data') {
					try {
						let full_block = null;
						let filtered_block = null;
						let private_data_map = null;
						let blockNumber = null;
						if (deliverResponse.Type === 'block') {
							full_block = BlockDecoder.decodeBlock(deliverResponse.block);
							logger.debug('on.data %s- have full block data', me);
							blockNumber = convertToLong(full_block.header.number);
						} else if (deliverResponse.Type === 'filtered_block') {
							filtered_block = BlockDecoder.decodeFilteredBlock(deliverResponse.filtered_block);
							logger.debug('on.data %s- have filtered block data', me);
							blockNumber = convertToLong(filtered_block.number);
						} else if (deliverResponse.Type === 'block_and_private_data') {
							const privateBlock = BlockDecoder.decodeBlockWithPrivateData(deliverResponse.block_and_private_data);
							private_data_map = privateBlock.private_data_map;
							full_block = privateBlock.block;
							logger.debug('on.data %s- have full block data with private data', me);
							blockNumber = convertToLong(full_block.header.number);
						} else {
							throw Error(`Unknown block type "${deliverResponse.Type}`);
						}

						this.lastBlockNumber = blockNumber;
						logger.debug('on.data %s- incoming block number %s', me, this.lastBlockNumber);
						this._processBlockEvents(full_block, filtered_block, private_data_map, blockNumber);
						this._processTxEvents(full_block, filtered_block);
						this._processChaincodeEvents(full_block, filtered_block);
						this._processEndBlock(blockNumber);

						// check to see if we should shut things down
						if (this.endBlock && this.endBlock.lessThanOrEqual && this.endBlock.lessThanOrEqual(this.lastBlockNumber)) {
							this._endBlockSeen = true;
							this._close(new Error(`Shutdown due to end block number has been seen: ${this.lastBlockNumber.toNumber()}`));
						}
					} catch (error) {
						logger.error('on.data %s- EventService - ::%s', me, error.stack);
						logger.error('on.data %s- EventService has detected an error %s', me, error);
						// report error to all callbacks and shutdown this EventService
						this._close(error);
					}
				} else if (deliverResponse.Type === 'status') {
					if (deliverResponse.status === SUCCESS) {
						logger.debug('on.data %s- received type status of SUCCESS', me);
						if (this._endBlockSeen) {
							// this is normal after the last block comes in when we set an ending block
							logger.debug('on.data %s- status received after last block seen: %s blockNumber: %s',
								me, deliverResponse.status, this.lastBlockNumber.toNumber());
						} else if (this.endBlock === NEWEST) {
							// this is normal after the last block comes in when we set to newest as an ending block
							logger.debug('on.data %s- status received when newest block seen: %s blockNumber: %s',
								me, deliverResponse.status, this.lastBlockNumber.toNumber());
							this._close(new Error(`Newest block received:${this.lastBlockNumber.toNumber()} status:${deliverResponse.status}`));
						} else if (this.endBlock && this.endBlock.greaterThan(this.lastBlockNumber)) {
							logger.error('on.data %s- status SUCCESS received before the configured endblock has been seen', me);
							this._close(new Error(`Connection Shutdown. End block of ${this.endBlock.toNumber()}` +
								`not received. Last block received ${this.lastBlockNumber.toNumber()}`));
						} else {
							logger.error('on.data %s- status SUCCESS received while blocks are required', me);
							this._close(new Error('Event Service connection has been shutdown. ' +
								`Last block received ${this.lastBlockNumber.toNumber()}`));
						}
					} else if (deliverResponse.status === NOT_FOUND) {
						logger.debug('on.data %s- received type status of NOT_FOUND', me);
						if (this.endBlock) {
							logger.error('on.data %s- Configured endblock does not exist', me);
							this._close(new Error(`End block of ${this.endBlock.toNumber()}` +
								` does not exist. Last block received ${this.lastBlockNumber.toNumber()}`));
						} else {
							logger.error('on.data %s- NOT_FOUND status received - last block received %s', me, this.lastBlockNumber.toNumber());
							this._close(new Error(`Event stream has received an unexpected status message. status:${deliverResponse.status}`));
						}
					} else {
						// tell all registered users that something is wrong and shutting down
						logger.error('on.data %s- unexpected deliverResponse status received - %s', me, deliverResponse.status);
						this._close(new Error(`Event stream has received an unexpected status message. status:${deliverResponse.status}`));
					}
				} else {
					logger.error('on.data %s- unknown deliverResponse type %s', me, deliverResponse.Type);
					this._close(new Error(`Event stream has received an unknown response type ${deliverResponse.Type}`));
				}
			});

			eventer.stream.on('status', (response) => {
				logger.debug('on status %s- status received: %j  peer:%s - stream:%s', me, response, eventer.endpoint.url, mystreamCount);
			});

			eventer.stream.on('end', () => {
				logger.debug('on.end %s- peer:%s - stream:%s', me, eventer.endpoint.url, mystreamCount);
				if (stream !== eventer.stream) {
					logger.debug('on.end %s- incoming message was from a cancelled stream', me);
					return;
				}
				clearTimeout(connectionSetupTimeout);

				const end_error = new Error('fabric peer service has closed due to an "end" event');

				// tell all registered users that something is wrong and shutting
				// down only if this event service has been started, which means
				// that event service has an eventer endpoint assigned and this
				// service is actively listening
				if (this._currentEventer) {
					logger.debug('on.end %s- close all application listeners', me);
					this._close(end_error);
				} else {
					// must be we got the end while still trying to set up the
					// listening stream, do not close the application listeners,
					// we may try another target on the list or the application
					// will try with another targets list
					logger.error('on.end %s- reject the promise', me);
					reject(end_error);
				}
			});

			eventer.stream.on('error', (err) => {
				logger.debug('on.error %s- block peer:%s - stream:%s', me, eventer.endpoint.url, mystreamCount);
				if (stream !== eventer.stream) {
					logger.debug('on.error %s- incoming error was from a cancelled stream - %s', me, err);
					return;
				}
				clearTimeout(connectionSetupTimeout);

				let out_error = err;
				if (err instanceof Error) {
					logger.debug('on.error %s- is an Error - %s', me, err);
				} else {
					logger.debug('on.error %s- is not an Error - %s', me, err);
					out_error = new Error(err);
				}

				// tell all registered users that something is wrong and shutting
				// down only if this event service has been started, which means
				// that event service has an eventer endpoint assigned and this
				// service is actively listening
				if (this._currentEventer) {
					logger.debug('on.error %s- close all application listeners - %s', me, out_error);
					this._close(out_error);
				} else {
					// must be we got the end while still trying to set up the
					// listening stream, do not close the application listeners,
					// we may try another target on the list or the application
					// will try with another targets list
					logger.error('on.error %s- reject the promise - %s', me, out_error);
				}
				reject(out_error);
			});

			try {
				eventer.stream.write(envelope);
				logger.debug('%s - stream write complete', method);
			} catch (error) {
				clearTimeout(connectionSetupTimeout);
				reject(error);
				logger.error('%s - write failed %s', method, error.stack);
			}
		});

	}

	/**
	 * Use this method to indicate if application has already started using this
	 * service. The service will have been asked to build the service request
	 * and will not have commpleted the service startup.
	 */
	isInUse() {
		const method = `isInUse[${this.name}]  - #${this.myNumber}`;
		logger.debug('%s inUse - %s', method, this.inUse);

		return this.inUse;
	}

	/**
	 * Use this method to indicate if this event service has an event endpoint
	 * {@link Eventer} assigned and the event endpoint has a listening stream
	 * connected and active.
	 */
	isStarted() {
		const method = `isStarted[${this.name}]  - #${this.myNumber}`;

		if (this._currentEventer && this._currentEventer.isStreamReady()) {
			logger.debug('%s - true', method);
			return true;
		} else {
			logger.debug('%s - false', method);
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

	_checkBlockNum(blockNumber) {
		let _blockNumber = null;
		if (typeof blockNumber === 'string') {
			if (blockNumber.toLowerCase() === OLDEST) {
				_blockNumber = OLDEST;
			} else if (blockNumber.toLowerCase() === NEWEST) {
				_blockNumber = NEWEST;
			} else {
				// maybe it is a string number
				_blockNumber = convertToLong(blockNumber);
			}
		} else {
			// only check if they give us something, these are optional parameters
			if (typeof blockNumber !== 'undefined' && blockNumber !== null) {
				_blockNumber = convertToLong(blockNumber);
			}
		}

		return _blockNumber;
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

		let foundBlock = false;
		let foundTx = false;
		let foundChaincode = false;
		for (const event_reg of this._eventListenerRegistrations.values()) {
			if (event_reg.listenerType === BLOCK) {
				foundBlock = true;
			} else if (event_reg.listenerType === TX) {
				foundTx = true;
			} else if (event_reg.listenerType === CHAINCODE) {
				foundChaincode = true;
			}
		}
		this._haveBlockListeners = foundBlock;
		this._haveTxListeners = foundTx;
		this._haveChaincodeListeners = foundChaincode;

		logger.debug('%s - end', method);
		return this;
	}

	/**
	 * Callback function that takes two parameters
	 * @callback EventCallback
	 * @param {Error} error - The "error" will be null unless this EventService has been shutdown.
	 *  The shutdown may be caused by a network, connection error,
	 *  by a call to the "disconnect()" method
	 *  or when the fabric event service ends the connection to this EventService.
	 *  This callback will also be called with an Error when the EventService is shutdown
	 *  due to the last block being received if the service has been setup with an endBlock to be 'newest'
	 *  or a specific block number that has been seen.
	 * @param {EventInfo} event - The "event" will be the {@link EventInfo} object.
	 */


	/**
	 * Register a listener to receive chaincode events.
	 * @param {string|RegExp} eventName - The exact name of the chaincode event or
	 *  regular expression that will be matched against the name given to
	 *  the target chaincode's call
	 *  <code>stub.SetEvent(name, payload)</code>)
	 * @param {EventCallback} callback
	 * @param {EventRegistrationOptions} options - Options on the registrations to allow
	 *  for start and end block numbers, automatically unregister.
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerChaincodeListener(chaincodeId = checkParameter('chaincodeId'), eventName = checkParameter('eventName'), callback = checkParameter('callback'), options) {
		const method = `registerChaincodeListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - %s - %s', method, chaincodeId, eventName);

		const eventListener = new EventListener(this, CHAINCODE, callback, options, new RegExp(eventName), chaincodeId);
		this._eventListenerRegistrations.set(eventListener, eventListener);
		this._haveChaincodeListeners = true;

		return eventListener;
	}


	/**
	 * Register a listener to receive all blocks committed to this channel.
	 * The listener's "callback" function gets called on the arrival of every
	 * block.
	 *
	 * @param {EventCallback} callback
	 * @param {EventRegistrationOptions} options - Options on the registrations to allow
	 *  for start and end block numbers or to automatically unregister
	 * @returns {EventListener} The EventListener instance to be used to
	 *  remove this registration using {@link EventService#unregisterEvent})
	 */
	registerBlockListener(callback = checkParameter('callback'), options) {
		const method = `registerBlockListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		const eventListener = new EventListener(this, BLOCK, callback, options, null);
		this._eventListenerRegistrations.set(eventListener, eventListener);
		this._haveBlockListeners = true;

		return eventListener;
	}

	/**
	 * Register a callback function to receive a notification when the transaction
	 * by the given id has been committed into a block. Using the special string
	 * 'all' will indicate that this listener will notify (call) the callback
	 * for every transaction written to the ledger.
	 *
	 * @param {string} txid - Transaction id string or 'all'
	 * @param {EventCallback} callback
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

		const eventListener = new EventListener(this, TX, callback, send_options, _txid);
		this._eventListenerRegistrations.set(eventListener, eventListener);
		this._haveTxListeners = true;

		return eventListener;
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

		for (const eventListener of this._eventListenerRegistrations.values()) {
			// check each listener to see if this transaction ID matches
			if (eventListener.listenerType === TX) {
				if (eventListener.event === txid) {
					logger.debug(`${method} - found the listener for ${txid}`);
					result = eventListener;
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
	_processEndBlock(blockNumber = checkParameter('blockNumber')) {
		const method = `_processEndBlock[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		for (const listener of this._eventListenerRegistrations.values()) {
			if (listener.endBlock) {
				if (listener.endBlock.equals(blockNumber)) {
					logger.debug('%s - listener endblock seen %s', method, blockNumber.toString());
					const event = new EventInfo(this);
					event.endBlockReceived = true;
					event.blockNumber = blockNumber;

					try {
						listener.onEvent(null, event);
					} catch (error) {
						logger.error('%s - %s', method, error);
					}

					this.unregisterEventListener(listener, true);
					logger.debug('%s - automatically unregister %s, end block: %s has been seen', method, listener, blockNumber);
				} else {
					logger.debug('%s - %s, end block: %s not seen', method, listener, blockNumber);
				}
			} else {
				logger.debug('%s - %s, no end block defined', method, listener, blockNumber);
			}
		}

		logger.debug('%s - end', method);
	}

	/*
	 * private internal method for processing block events
	 * @param {Object} block protobuf object
	 */
	_processBlockEvents(full_block, filtered_block, private_data_map, blockNumber) {
		const method = `_processBlockEvents[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - %s', method, this.blockType);

		if (!this._haveBlockListeners) {
			logger.debug('%s - no block listeners', method);
			return;
		}

		if (full_block) {
			logger.debug('%s - have full block', method);
		} else if (filtered_block) {
			logger.debug('%s - have filtered block', method);
		} else {
			logger.debug('%s - missing block data', method);
		}

		if (private_data_map) {
			logger.debug('%s - have private data', method);
		}

		for (const blockReg of this._eventListenerRegistrations.values()) {
			if (blockReg.listenerType === BLOCK) {
				logger.debug('%s - calling block listener callback', method);
				const event = new EventInfo(this);
				event.block = full_block;
				event.filteredBlock = filtered_block;
				event.privateData = private_data_map;
				event.blockNumber = blockNumber;

				try {
					blockReg.onEvent(null, event);
				} catch (error) {
					logger.error('%s - %s', method, error);
				}

				// check to see if we should automatically unregister
				if (blockReg.unregister) {
					logger.debug('%s - automatically unregister block listener for %s', method, blockReg);
					this.unregisterEventListener(blockReg, true);
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
				logger.debug('%s filtered filtered_transactions=%j', method, filtered_block.filtered_transactions);
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					if (filtered_transaction.type === fabproto6.common.HeaderType.ENDORSER_TRANSACTION) {
						this._callTransactionListener(
							filtered_transaction.txid,
							filtered_transaction.tx_validation_code,
							filtered_block.number,
							undefined,
							filtered_block
						);
					}
				}
			}
		} else {
			logger.debug('%s full block number=%s', method, full_block.header.number);
			const txStatusCodes = full_block.metadata.metadata[fabproto6.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
			for (let index = 0; index < full_block.data.data.length; index++) {
				const channel_header = full_block.data.data[index].payload.header.channel_header;
				if (channel_header.type === fabproto6.common.HeaderType.ENDORSER_TRANSACTION) {
					this._callTransactionListener(
						channel_header.tx_id,
						txStatusCodes[index],
						full_block.header.number,
						full_block
					);
				}
			}
		}
	}

	/* internal utility method */
	_callTransactionListener(txId, validationCode, blockNumber, full_block, filtered_block) {
		const method = `_callTransactionListener[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start', method);

		for (const transReg of this._eventListenerRegistrations.values()) {
			// check each listener to see if this transaction ID matches
			if (transReg.listenerType === TX) {
				if (transReg.event === txId || transReg.event === ALL) {
					logger.debug('%s - about to call the transaction call back with code=%s tx=%s', method, validationCode, txId);
					const event = new EventInfo(this);
					event.blockNumber = blockNumber;
					event.transactionId = txId;
					event.status = convertValidationCode(validationCode);
					event.block = full_block;
					event.filteredBlock = filtered_block;

					try {
						transReg.onEvent(null, event);
					} catch (error) {
						logger.error('%s - %s', method, error);
					}

					// check to see if we should automatically unregister
					if (transReg.unregister) {
						logger.debug('%s - automatically unregister tx listener for %s', method, txId);
						this.unregisterEventListener(transReg, true);
					}
				} else {
					logger.debug('%s - tx listener for %s - not called', method, transReg.event);
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
		const allEvents = new Map();
		if (filtered_block) {
			if (filtered_block.filtered_transactions) {
				for (const filtered_transaction of filtered_block.filtered_transactions) {
					if (filtered_transaction.transaction_actions) {
						if (filtered_transaction.transaction_actions.chaincode_actions) {
							for (const chaincode_action of filtered_transaction.transaction_actions.chaincode_actions) {
								logger.debug('%s - filtered block chaincode_event %j', method, chaincode_action);
								this._queueChaincodeEvent(
									chaincode_action.chaincode_event,
									filtered_block.number,
									filtered_transaction.txid,
									filtered_transaction.tx_validation_code,
									allEvents
								);
							}
						}
					}
				}
			}
		} else {
			logger.debug('%s - have full block %j', method, full_block);

			for (let index = 0; index < full_block.data.data.length; index++) {
				logger.debug('%s - trans index=%s', method, index);
				try {
					const env = full_block.data.data[index];
					const channel_header = env.payload.header.channel_header;
					// only ENDORSER_TRANSACTION have chaincode events
					if (channel_header.type === fabproto6.common.HeaderType.ENDORSER_TRANSACTION) {
						const tx = env.payload.data;
						if (tx && tx.actions) {
							for (const {payload} of tx.actions) {
								const chaincode_event = payload.action.proposal_response_payload.extension.events;
								logger.debug('%s - full block chaincode_event %j', method, chaincode_event);

								const txStatusCodes = full_block.metadata.metadata[fabproto6.common.BlockMetadataIndex.TRANSACTIONS_FILTER];
								const val_code = txStatusCodes[index];

								this._queueChaincodeEvent(
									chaincode_event,
									full_block.header.number,
									channel_header.tx_id,
									val_code,
									allEvents);
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
		for (const [chaincodeListener, event] of allEvents.entries()) {
			logger.debug('%s - calling callback - %s', method, chaincodeListener.event);

			try {
				chaincodeListener.onEvent(null, event);
			} catch (error) {
				logger.error('%s - %s', method, error);
			}

			// see if we should automatically unregister this event listener
			if (chaincodeListener.unregister) {
				logger.debug('%s - automatically unregister chaincode event listener setting', method);
				this.unregisterEventListener(chaincodeListener, true);
			}
		}

		logger.debug('%s - end', method);
	}

	_queueChaincodeEvent(chaincode_event, blockNumber, txId, val_code, allEvents) {
		const method = `_queueChaincodeEvent[${this.name}] - #${this.myNumber}`;
		logger.debug('%s - start - chaincode_event %j', method, chaincode_event);

		const status = convertValidationCode(val_code);

		logger.debug('%s - txid=%s  val_code=%s', method, txId, status);

		for (const chaincodeListener of this._eventListenerRegistrations.values()) {
			logger.debug('%s - checking regisistered chaincode event %s %s', method, chaincodeListener.event, chaincodeListener.chaincodeId);
			// check each listener to see if this chaincode event matches
			if (chaincodeListener.listenerType === CHAINCODE &&
				chaincodeListener.chaincodeId === chaincode_event.chaincode_id &&
				chaincodeListener.event.test(chaincode_event.event_name)) {
				// we have a match - save it to be sent later
				logger.debug('%s - queuing chaincode event: %s', method, chaincode_event.event_name);
				let event = allEvents.get(chaincodeListener);
				if (!event) {
					event = new EventInfo(this);
					event.blockNumber = blockNumber;
					event.chaincodeEvents = [];
					allEvents.set(chaincodeListener, event);
				}
				event.chaincodeEvents.push(new ChaincodeEvent(
					chaincode_event.chaincode_id,
					txId,
					status,
					chaincode_event.event_name,
					chaincode_event.payload
				));
			} else {
				logger.debug('%s - NOT queuing chaincode event: %s', method, chaincode_event.event_name);
			}
		}
	}
}

module.exports = EventService;

// convert to a string of the enum
function convertValidationCode(code) {
	if (typeof code === 'string') {
		logger.debug('convertValidationCode - code %s', code);

		return code;
	}
	const status = fabproto6.protos.TxValidationCode[code];
	logger.debug('convertValidationCode - status %s', status);

	return status;
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
 * @property {EventService} eventService - This EventService.
 * @property {Long} blockNumber - The block number that contains this event.
 * @property {string} [transactionId] - The transaction ID of this event
 * @property {string} [transactionStatus] - The transaction status of this
 *  event.
 * @property {boolean} endBlockReceived - Indicates if the endBlock as
 *  defined by the listener has been seen.
 * @property {ChaincodeEvent[]} chaincodeEvents - An array of {@link ChaincodeEvent}.
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
