/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
const Long = require('long');
const utils = require('./utils.js');
const clientUtils = require('./client-utils.js');
const Constants = require('./Constants.js');
const logger = utils.getLogger('ChannelEventHub.js');
const {Identity} = require('./msp/identity');
const TransactionID = require('./TransactionID');
const util = require('util');
const EventHubDisconnectError = require('./errors/EventHubDisconnectError');

const BlockDecoder = require('./BlockDecoder.js');

const ProtoLoader = require('./ProtoLoader');
const _abProto = ProtoLoader.load(__dirname + '/protos/orderer/ab.proto').orderer;
const _eventsProto = ProtoLoader.load(__dirname + '/protos/peer/events.proto').protos;
const _commonProto = ProtoLoader.load(__dirname + '/protos/common/common.proto').common;
const _transProto = ProtoLoader.load(__dirname + '/protos/peer/transaction.proto').protos;

const _validation_codes = {};
let keys = Object.keys(_transProto.TxValidationCode);
for (const key of keys) {
	const new_key = _transProto.TxValidationCode[key];
	_validation_codes[new_key] = key;
}

const _header_types = {};
keys = Object.keys(_commonProto.HeaderType);
for (const key of keys) {
	const new_key = _commonProto.HeaderType[key];
	_header_types[new_key] = key;
}

// internal use only
const NO_START_STOP = 0;
const START_ONLY = 1;
const END_ONLY = 2;
// const START_AND_END = 3;

const five_minutes_ms = 5 * 60 * 1000;

// Special transaction id to indicate that the transaction listener will be
// notified of all transactions
const ALL = 'all';

// Special value for block numbers
const NEWEST = 'newest'; // what fabric peer sees as newest on the ledger at time of connect
const OLDEST = 'oldest'; // what fabric peer sees as oldest on the ledger at time of connect
const LAST_SEEN = 'last_seen'; // what this event hub sees as the last block received

/**
 * Transaction processing in fabric v1.1 is a long operation spanning multiple
 * components (application, endorsing peer, orderer, committing peer) and takes
 * a relatively lengthy period of time (think seconds instead of milliseconds)
 * to complete. As a result the applications must design their handling of the
 * transaction lifecycle in an asynchronous fashion. After the transaction proposal
 * has been successfully [endorsed]{@link Channel#sendTransactionProposal}, and before
 * the transaction message has been successfully [sent]{@link Channel#sendTransaction}
 * to the orderer, the application should register a listener to be notified
 * when the transaction achieves finality, which is when the block
 * containing the transaction gets added to the peer's ledger/blockchain.
 * <br><br>
 * Fabric committing peers provide a block delivery service to publish blocks or
 * filtered blocks to connected fabric-clients. See [connect]{@link ChannelEventHub#connect}
 * on connection options and how this ChannelEventHub may connect to the fabric
 * service. For more information on the service see [deliver]{@link https://hyperledger-fabric.readthedocs.io/en/release-1.2/peer_event_services.html}.
 * A block gets published whenever the committing peer adds a validated block
 * to the ledger.
 * When a fabric-client receives a block it will investigate the block and notify
 * interested listeners with the related contents of the block (e.g. transactionId, status).
 * There are three types of listeners that will get notified by
 * the fabric-client after it receives a published block from the fabric deliver service.
 * <li> A "block listener" gets called for every block received. The listener
 *     will be passed a fully decoded {@link Block} object unless the connection
 *     to the fabric service is using filtered blocks.
 *     See [registerBlockEvent]{@link ChannelEventHub#registerBlockEvent}
 * <li>A "transaction listener" gets called when the specific transaction
 *     is committed (discovered inside a published block). The listener
 *     may also be registered to listen to "all" transactions.
 *     The listener will be passed the transaction id, transaction status and block number.
 *     See [registerTxEvent]{@link ChannelEventHub#registerTxEvent}
 * <li>A "chaincode event listener" gets called when a specific
 *     chaincode event is discovered within a block.
 *     The listener will be passed the block number, transaction id, and
 *     transaction status. The {@link ChaincodeEvent} will be also be passed,
 *     however the payload of the event will not be passed if
 *     the connection to the fabric service is publishing filtered blocks.
 *     See [registerChaincodeEvent]{@link ChannelEventHub#registerChaincodeEvent}
 * <br><br><br>
 * When the fabric-client connects to the peer, it tells the peer which block
 * to begin delivering from. If no start block is provided, then the client will
 * only receive events for the most recently committed block onwards.
 * To avoid missing events in blocks that are published while the client is
 * crashed/offline, the client should record the most recently processed block,
 * and resume event delivery from this block number on startup. In this way,
 * there is no custom recovery path for missed events, and the normal processing
 * code may execute instead. You may also include an endBlock number if you
 * wish to stop listening after receiving a range of events.
 *
 * @example
 * const eh = channel.newChannelEventHub(peer);
 *
 * // register the listener before calling "connect()" so there
 * // is an error callback ready to process an error in case the
 * // connect() call fails
 * eh.registerTxEvent(
 *   'all', // this listener will be notified of all transactions
 *     (tx, status, block_num) => {
 *        record(tx, status, block_num);
 *        console.log(util.format('Transaction %s has completed', tx));
 *     },
 *     (err) => {
 *        eh.unregisterTxEvent('all');
 *        reportError(err);
 *        console.log(util.format('Error %s! Transaction listener has been ' +
 *                 'deregistered for %s', err, eh.getPeerAddr()));
 *     }
 * );
 *
 * eh.connect();
 *
 * @class
 */

let event_hub_number = 1;
class ChannelEventHub {

	/**
	 * Constructs a ChannelEventHub object
	 *
	 * @param {Channel} channel - An instance of the Channel class
	 * were this ChannelEventHub will receive blocks
	 * @param {Peer} peer Optional. An instance of the Peer class this ChannelEventHub connects.
	 * @returns {ChannelEventHub} An instance of this class
	 */

	constructor(channel, peer) {
		logger.debug('const ');

		this._event_hub_number = event_hub_number++;
		// this will hold the last block number received
		this._last_block_seen = null;

		this._setReplayDefaults();

		// hashtable of clients registered for chaincode events
		this._chaincodeRegistrants = new Map();
		// set of clients registered for block events
		this._block_registrant_count = 0;
		this._blockRegistrations = {};

		this.connectCallback = null;

		// registered transactional events
		this._transactionRegistrations = {};
		// grpc event client interface
		this._event_client = null;
		// grpc chat streaming interface
		this._stream = null;

		// fabric connection state of this ChannelEventHub
		this._connected = false;
		this._connect_running = false;
		this._disconnect_running = false;

		// using filtered blocks
		this._filtered_stream = true; // the default

		// connect count for this instance
		this._current_stream = 0;
		// reference to the channel instance holding critical context such as signing identity
		if (!channel) {
			throw new Error('Missing required argument: channel');
		}

		this._clientContext = channel._clientContext;
		this._channel = channel;
		// peer node to connect
		// reference to the peer instance holding end point information
		this._peer = peer;
	}

	/**
	 * Return the name of this ChannelEventHub, will be the name of the
	 * associated peer.
	 */
	getName() {
		return this._peer.getName();
	}

	/**
	 * Return the peer url
	 */
	getPeerAddr() {
		if (typeof this._peer === 'object') {
			return this._peer._endpoint.addr;
		}

		return null;
	}

	/*
	 * The block number of the last block seen
	 *
	 * @returns {Long} The block number of the last block seen
	 */
	lastBlockNumber() {
		if (this._last_block_seen === null) {
			throw new Error('This ChannelEventHub has not seen a block from the peer');
		}

		return this._last_block_seen;
	}

	/*
	 * internal method to check if this ChannelEventHub is allowing new event listeners
	 * If this ChannelEventHub has been configured for a startBlock/endBlock of events then
	 * only one event listener is allowed.
	 */
	_checkAllowRegistrations() {
		if (this._start_stop_action) {
			throw new Error('This ChannelEventHub is not open to event listener registrations');
		}
	}

	/**
	 * Is this ChannelEventHub connected to the fabric service?
	 * @returns {boolean} True if connected to the event source, false otherwise
	 */
	isconnected() {
		return this._connected;
	}

	/**
	 * @typedef {Object} SignedEvent
	 * @property {Buffer} signature the signature over this payload
	 * @property {Buffer} payload the payload byte array to be sent to the peer
	 */

	/**
	 * @typedef {Object} ConnectOptions
	 * @property {boolean} full_block - Optional. To indicate that the connection
	 *        with the peer will be sending full blocks or filtered blocks to this
	 *        ChannelEventHub.
	 *        The default will be to establish a connection using filtered blocks.
	 *        Filtered blocks have the required information to provided transaction
	 *        status and chaincode events (no payload).
	 *        When using the non filtered blocks (full blocks) the user
	 *        will be required to have access to establish the connection to
	 *        receive full blocks.
	 *        Registering a block listener on a filtered block connection may not
	 *        provide sufficient information.
	 * @property {Number | string} startBlock - Optional. This will have the connection
	 *        setup to start sending blocks back to the event hub at the block
	 *        with this number. If connecting with a
	 *        a startBlock then event listeners may not be registered with a
	 *        startBlock or endBlock.
	 *        If the event hub should start with the last block it has seen
	 *        use the string 'last_seen'.
	 *        If the event hub should start with the oldest block on the
	 *        ledger use the string 'oldest'.
	 *        If the event hub should start with the latest block on the ledger,
	 *        use the string 'latest' or do use a startBlock.
	 *        Default is to start with the latest block on the ledger.
	 * @property {Number | string} endBlock - Optional. This will have the connection
	 *        setup to end sending blocks back to the event hub at the block
	 *        with this number. If connecting with a
	 *        a endBlock then event listeners may not be registered with a
	 *        startBlock or endBlock.
	 *        If the event hub should end with the last block it has seen
	 *        use the string 'last_seen'.
	 *        If the event hub should end with the current block on the
	 *        ledger use the string 'newest'.
	 *        Default is to not stop sending.
	 * @property {SignedEvent} signedEvent - Optional. The signed event to be sent
	 *        to the peer. This option is useful when the fabric-client application
	 *        does not have the user's privateKey and can not sign requests to the
	 *        fabric network.
	 * @property {Peer | string} target - Optional. The peer that provides the
	 *        fabric event service. When using a string, the {@link Channel}
	 *        must have a peer assigned with that name. This peer will replace
	 *        the current peer endpoint of this channel event hub.
	 * @property {boolean} as_array - Optional. Only used with chaincode code
	 *        events to indicate that all chaincode events found in a block
	 *        should be sent as an array to the callback rather than the default
	 *        one at a time.
	 */

	/**
	 * Establishes a connection with the fabric peer service.
	 *
	 * The connection will be established asynchronously. If the connection fails to
	 * get established, the application will be notified via the 'connectCallback'
	 * provided. Additionally the error callbacks from the registerXXXEvent() methods
	 * will be notified if provided.
	 * It is recommended that an application relay on 'connectCallback' to determine
	 * connect status and relay on the 'errCallback' of the event listeners for
	 * runtime connection issues.
	 * Register event listeners and the error callbacks by calling any one of the
	 * [registerBlockEvent]{@link ChannelEventHub#registerBlockEvent},
	 * [registerTxEvent]{@link ChannelEventHub#registerTxEvent} or
	 * [registerChaincodeEvent]{@link ChannelEventHub#registerChaincodeEvent}
	 * methods, after calling connect().
	 *
	 * @param {ConnectOptions | boolean} options - Optional. If of type boolean
	 *        then it will be assumed to how to connect to receive full (true)
	 *        or filtered (false) blocks.
	 * @param {function} connectCallback - Optional. This callback will report
	 *        completion of the connection to the peer or  will report
	 *        any errors encountered during connection to the peer. When there
	 *        is an error, this ChannelEventHub will be shutdown (disconnected).
	 *        Callback function should take two parameters as (error, value).
	 */
	connect(options, connectCallback) {
		const method = 'connect';
		logger.debug('%s - start - hub:%s', method, this._event_hub_number);
		let signedEvent = null;
		let full_block = null;
		const connect_request = {};

		// the following supports the users using the boolean parameter to control
		// how to connect to the fabric service for full or filtered blocks
		if (typeof options === 'boolean') {
			full_block = options;
		}
		if (typeof options === 'object' && options !== null) {
			signedEvent = options.signedEvent || null;
			full_block = options.full_block || null;

			if (typeof options.force === 'boolean') {
				connect_request.force = options.force;
			}
			if (typeof options.startBlock === 'undefined' || options.startBlock === null) {
				logger.debug('%s - options do not include startBlock', method);
			} else {
				connect_request.startBlock = options.startBlock;
				logger.debug('%s - options include startBlock of %s', method, options.startBlock);
			}
			if (typeof options.endBlock === 'undefined' || options.endBlock === null) {
				logger.debug('%s - options do not include endBlock', method);
			} else {
				connect_request.endBlock = options.endBlock;
				logger.debug('%s - options include endBlock of %s', method, options.endBlock);
			}
			if (!options.target) {
				logger.debug('%s - options do not include a target', method);
			} else {
				this._assignPeer(options.target);
				logger.debug('%s - options include a target', method);
			}
		}
		if (signedEvent) {
			connect_request.signedEvent = this._validateSignedEvent(signedEvent);
		}
		if (connectCallback) {
			logger.debug('%s - using a connect callback', method);
			this.connectCallback = connectCallback;
		}

		logger.debug('%s - start peerAddr:%s', method, this.getPeerAddr());
		if (!this._clientContext._userContext && !this._clientContext._adminSigningIdentity && !signedEvent) {
			throw new Error('Error connect the ChannelEventhub to peer, either the clientContext has not been properly initialized, missing userContext or admin identity or missing signedEvent');
		}

		if (typeof full_block === 'boolean') {
			this._filtered_stream = !full_block;
			logger.debug('%s - filtered block stream set to:%s', method, !full_block);
		} else {
			logger.debug('%s - using a filtered block stream by default',  method);
		}

		logger.debug('%s - signed event:%s', method, !!signedEvent);
		this._connect(connect_request);
		logger.debug('%s - end %s', method, this.getPeerAddr());
	}

	/**
	 * Reestablishes a connection with the fabric peer service.

	 *
	 * @param {ConnectOptions} options - Optional.
	 * @param {function} connectCallback - Optional. This callback will report
	 *        completion of the connection to the peer or  will report
	 *        any errors encountered during connection to the peer. When there
	 *        is an error, this ChannelEventHub will be shutdown (disconnected).
	 *        Callback function should take two parameters as (error, value).
	 */
	reconnect(options, connectCallback) {
		const method = 'reconnect';
		logger.debug('%s - start', method);
		const re_options = Object.assign({force: true}, options);

		this.connect(re_options, connectCallback);
	}

	/*
	 * @typedef {InternalConnectOptions}
	 * @property {boolean} force - Optional. internal use only, will reestablish
	 *           the connection to the peer event hub
	 * @property {SignedEvent} signedEvent - Optional. the signed event to be send to peer
	 */

	/*
	 * Internal use only
	 * Establishes a connection with the fabric peer service
	 * @param {InternalConnectOptions} request - internal use only, the options to be passed
	 *                                           to the internal method _connect()
	 */
	_connect(request) {
		let force = false;
		let signedEvent = null;
		if (request) {
			force = request.force;
			signedEvent = request.signedEvent;
		}
		logger.debug('_connect - start - %s', new Date());
		if (this._connect_running) {
			logger.debug('_connect - connect is running');
			return;
		}
		if (!force && this._connected) {
			logger.debug('_connect - end - already connected');
			return;
		}
		if (!this._peer) {
			throw Error('Must set peer address before connecting.');
		}

		// clean up
		this._shutdown();
		if (this._start_stop_connect) {
			logger.debug('_connect - reset the start stop settings');
			this._start_stop_connect = false;
			this._starting_block_number = null;
			this._ending_block_number = null;
			this._ending_block_newest = false;
			this._ending_block_seen = false;
		}

		this._checkReplay(request, true);

		this._connect_running = true;
		this._current_stream++;
		const stream_id = this._current_stream;
		logger.debug('_connect - start stream:', stream_id);
		const self = this; // for callback context
		const connection_setup_timeout = setTimeout(() => {
			logger.error('_connect - timed out after:%s', self._peer._request_timeout);
			self._connect_running = false;
			self._disconnect(new Error('Unable to connect to the fabric peer service'));
		}, self._peer._request_timeout);

		// check on the keep alive options
		// the keep alive interval
		let options = utils.checkAndAddConfigSetting('grpc.keepalive_time_ms', 360000, this._peer._options);
		// how long should we wait for the keep alive response
		const request_timeout_ms = utils.getConfigSetting('request-timeout', 3000);
		options = utils.checkAndAddConfigSetting('grpc.keepalive_timeout_ms', request_timeout_ms, options);
		options = utils.checkAndAddConfigSetting('grpc.http2.min_time_between_pings_ms', five_minutes_ms, options);

		logger.debug('_connect - options %j', options);
		this._event_client = new _eventsProto.Deliver(this._peer._endpoint.addr, this._peer._endpoint.creds, options);
		if (this._filtered_stream) {
			this._stream = this._event_client.deliverFiltered();
		} else {
			this._stream = this._event_client.deliver();
		}

		this._stream.on('data', (deliverResponse) => {
			if (self._connect_running) {
				self._connect_running = false;
				clearTimeout(connection_setup_timeout);
			}

			logger.debug('on.data - block stream:%s _current_stream:%s  peer:%s', stream_id, self._current_stream, self.getPeerAddr());
			if (stream_id !== self._current_stream) {
				logger.debug('on.data - incoming block was from a cancelled stream');
				return;
			}

			logger.debug('on.data - grpc stream is ready :%s', isStreamReady(self));
			if (deliverResponse.Type === 'block' || deliverResponse.Type === 'filtered_block') {
				if (self._connected === true) {
					logger.debug('on.data - new block received - check event registrations');
				} else {
					logger.debug('on.data - first block received , this ChannelEventHub now registered');
					self._connected = true;
					if (this.connectCallback) {
						logger.debug('_connect - call the connection callback');
						this.connectCallback(null, this); // return this instance, user will be able check with isconnected()
						this.connectCallback = null; // clean up so not called again
					}
				}
				try {
					let block = null;
					if (deliverResponse.Type === 'block') {
						block = BlockDecoder.decodeBlock(deliverResponse.block);
						self._last_block_seen = utils.convertToLong(block.header.number);
					} else {
						block = JSON.parse(JSON.stringify(deliverResponse.filtered_block));
						self._last_block_seen = utils.convertToLong(block.number);
					}
					logger.debug('on.data - incoming block number %s', self._last_block_seen);

					// somebody may have registered to receive this block
					self._processBlockEvents(block);
					self._processTxEvents(block);
					self._processChaincodeEvents(block);

					// check to see if we should shut things down
					self._checkReplayEnd();
				} catch (error) {
					logger.error('ChannelEventHub - ::' + (error.stack ? error.stack : error));
					logger.error('ChannelEventHub has detected an error ' + error.toString());
					// report error to all callbacks and shutdown this ChannelEventHub
					self._disconnect(error);
				}
			} else if (deliverResponse.Type === 'status') {
				if (deliverResponse.status === 'SUCCESS') {
					if (self._ending_block_seen) {
						// this is normal after the last block comes in when we set an ending block
						logger.debug('on.data - status received after last block seen: %s block_num:', deliverResponse.status, self._last_block_seen);
					}
					if (self._ending_block_newest) {
						// this is normal after the last block comes in when we set to newest as an ending block
						logger.debug('on.data - status received when newest block seen: %s block_num:', deliverResponse.status, self._last_block_seen);
						self._disconnect(new Error(`Newest block received:${self._last_block_seen} status:${deliverResponse.status}`));
					}
				} else {
					// tell all registered users that something is wrong and shutting down
					logger.debug('on.data - status received - %s', deliverResponse.status);
					self._disconnect(new Error(`Received status message on the block stream. status:${deliverResponse.status}`));
				}
			} else {
				logger.debug('on.data - unknown deliverResponse');
				logger.error('ChannelEventHub has received and unknown message type %s', deliverResponse.Type);
			}
		});

		this._stream.on('status', (response) => {
			logger.debug('on status - status received: %j  peer:%s', response, self.getPeerAddr());
		});

		this._stream.on('end', () => {
			logger.debug('on.end - event stream:%s _current_stream:%s peer:%s', stream_id, self._current_stream, self.getPeerAddr());
			if (stream_id !== self._current_stream) {
				logger.debug('on.end - incoming message was from a canceled stream');
				return;
			}
			self._connect_running = false;
			clearTimeout(connection_setup_timeout);

			logger.debug('on.end - grpc stream is ready :%s', isStreamReady(self));
			self._disconnect(new Error('fabric peer service has disconnected due to an "end" event'));
		});

		this._stream.on('error', (err) => {
			logger.debug('on.error - block stream:%s _current_stream:%s  peer:%s', stream_id, self._current_stream, self.getPeerAddr());
			if (stream_id !== self._current_stream) {
				logger.debug('on.error - incoming message was from a cancelled stream');
				logger.debug('on.error - %s %s', new Date(), err);
				return;
			}
			self._connect_running = false;
			clearTimeout(connection_setup_timeout);

			logger.debug('on.error - grpc stream is ready :%s', isStreamReady(self));
			if (err instanceof Error) {
				self._disconnect(err);
			} else {
				self._disconnect(new Error(err));
			}
		});

		if (signedEvent) {
			this._sendSignedRegistration(signedEvent);
		} else {
			this._sendRegistration();
		}
		logger.debug('_connect - end stream:', stream_id);
	}

	/**
	 * Disconnects the ChannelEventHub from the peer event source.
	 * Will close all event listeners and send an EventHubDisconnectError object
	 * with the message "ChannelEventHub has been shutdown" to
	 * all listeners that provided an "onError" callback.
	 */
	disconnect() {
		const method = 'disconnect';
		logger.debug('%s - start - hub:%s', method, this._event_hub_number);
		if (this._disconnect_running) {
			logger.debug('%s - disconnect is running', method);
		} else {
			this._disconnect_running = true;
			this._disconnect(new EventHubDisconnectError('ChannelEventHub has been shutdown'));
			this._disconnect_running = false;
		}
	}

	/**
	 * Disconnects the ChannelEventHub from the fabric peer service.
	 * Will close all event listeners and send an EventHubDisconnectError object
	 * with the message "ChannelEventHub has been shutdown" to
	 * all listeners that provided an "onError" callback.
	 */
	close() {
		this.disconnect();
	}

	/*
	 * Internal method
	 * Disconnects the connection to the fabric peer service.
	 * Will close all event listeners and send an `Error` to
	 * all listeners that provided an "onError" callback.
	 */
	_disconnect(err) {
		const method = '_disconnect';
		logger.debug('%s - start - hub:%s', method, this._event_hub_number);
		logger.debug('%s - called due to:: %s, peer:%s', method, err.message, this.getPeerAddr());
		this._connect_running = false;
		this._closeAllCallbacks(err);
		this._shutdown();
		this._setReplayDefaults();

		// one last thing, report to the connect callback
		if (this.connectCallback) {
			this.connectCallback(err, this); // report and ourselves so user will know the source
			this.connectCallback = null; // clean up
		}

		logger.debug('%s - end -- called due to:: %s, peer:%s', method, err.message, this.getPeerAddr());
	}

	/*
	 * Internal method
	 * Closes the grpc stream and service client
	 */
	_shutdown() {
		if (this._stream) {
			logger.debug('_shutdown - shutdown existing stream');
			this._stream.cancel();
			this._stream.end();
			this._stream = null;
		}
		if (this._event_client) {
			this._event_client.close();
		}
		this._connected = false;
	}

	/*
	 * Internal method
	 * Builds a signed event registration
	 * and sends it to the peer's event hub.
	 */
	_sendRegistration() {
		// use the admin if available
		const txId = this._clientContext.newTransactionID(true);
		const signer = this._clientContext._getSigningIdentity(true);

		const opt = {
			identity: signer,
			txId,
		};
		const seekPayloadBytes = this.generateUnsignedRegistration(opt);

		const sig = signer.sign(seekPayloadBytes);
		const signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		const envelope = {
			signature: signature,
			payload: seekPayloadBytes
		};

		this._stream.write(envelope);
	}

	/*
	 * Internal method
	 * validate the signedEvent has signature and payload
	 * and return the signedEvent
	 *
	 * @param {SignedEvent} signedEvent the signed event to be send to peer
	 */
	_validateSignedEvent(signedEvent) {
		const method = '_validateSignedEvent';
		logger.debug('%s - enter', method);
		if (!signedEvent.signature) {
			throw new Error('Empty signature in signed event');
		}
		if (!signedEvent.payload) {
			throw new Error('Empty payload for signed event');
		}
		logger.debug('%s - exit', method);
		return {
			signature: signedEvent.signature,
			payload: signedEvent.payload,
		};
	}

	/*
	 * Internal method
	 * Send a signed event registration to the peer's eventhub
	 */
	_sendSignedRegistration(signedEvent) {
		const method = '_sendSignedRegistration';
		logger.debug('%s - enter', method);
		this._stream.write(signedEvent);
	}

	/**
	 * @typedef {Object} EventHubRegistrationRequest
	 *
	 * @property {Identity} identity the identity who is doing this registration
	 * @property {TransactionID} txId a transaction id for this registration
	 * @property {string} certificate The certificate file, in PEM format
	 * @property {string} mspId The member service provider Id used to process the identity
	 */

	/**
	 * Generate the unsigned fabric service registration, this should be
	 * signed by the identity's private key.
	 *
	 * @param {EventHubRegistrationRequest} options the options for register this
	 *        ChannelEventHub with the fabric peer service.
	 *        Notice the options should contain either both identity and txId
	 *        or both certificate and mspId
	 *
	 * @returns {Buffer} the byte array contains the registration payload to be
	 *        signed.
	 */
	generateUnsignedRegistration(options) {
		const method = 'generateUnsignedRegistration';
		logger.debug('%s - enter', method);
		if (!options) {
			throw new Error(util.format('%s - Missing Required Argument "options"', method));
		}
		let {identity, txId, certificate, mspId} = options;
		// either we have both identity and txId, or we have both certificate or mspId
		if (identity || txId) {
			if (!txId) {
				throw new Error('"options.txId" is required to generate unsigned fabric service registration');
			}
			if (!identity) {
				throw new Error('"options.identity" is required to generate unsigned fabric service registration');
			}
			if (certificate || mspId) {
				certificate = null;
				mspId = null;
			}
		}
		if (certificate || mspId) {
			if (!certificate) {
				throw new Error('"options.certificate" is required to generate unsigned fabric service registration');
			}
			if (!mspId) {
				throw new Error('"options.mspId" is required to generate unsigned fabric service registration');
			}
		}

		if (!identity) {
			identity = new Identity(certificate, null, mspId);
			txId = new TransactionID(identity, options.admin === true);
		}

		// The behavior when a missing block is encountered
		let behavior = _abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY;

		// build start
		const seekStart = new _abProto.SeekPosition();
		if (!this._starting_block_number || this._starting_block_number === NEWEST) {
			const seekNewest = new _abProto.SeekNewest();
			seekStart.setNewest(seekNewest);
		} else if (this._starting_block_number === OLDEST) {
			const seekOldest = new _abProto.SeekOldest();
			seekStart.setOldest(seekOldest);
		} else if (this._starting_block_number) {
			const seekSpecifiedStart = new _abProto.SeekSpecified();
			seekSpecifiedStart.setNumber(this._starting_block_number);
			seekStart.setSpecified(seekSpecifiedStart);
		}

		// build stop
		const seekStop = new _abProto.SeekPosition();
		if (this._ending_block_number === NEWEST) {
			this._ending_block_newest = true;
			const seekNewest = new _abProto.SeekNewest();
			seekStop.setNewest(seekNewest);
			behavior = _abProto.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
		} else if (this._ending_block_number === OLDEST) {
			const seekOldest = new _abProto.SeekOldest();
			seekStop.setOldest(seekOldest);
			behavior = _abProto.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
		} else {
			const seekSpecifiedStop = new _abProto.SeekSpecified();
			if (this._ending_block_number) {
				seekSpecifiedStop.setNumber(this._ending_block_number);
				// user should know the block does not exist
				behavior = _abProto.SeekInfo.SeekBehavior.FAIL_IF_NOT_READY;
			} else {
				seekSpecifiedStop.setNumber(Long.MAX_VALUE);
			}
			seekStop.setSpecified(seekSpecifiedStop);
		}

		// seek info with all parts
		const seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		// BLOCK_UNTIL_READY will mean hold the stream open and keep sending as
		//     the blocks come in
		// FAIL_IF_NOT_READY will mean if the block is not there throw an error
		seekInfo.setBehavior(behavior);


		// build the header for use with the seekInfo payload
		const seekInfoHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			this._channel._name,
			txId.getTransactionID(),
			this._initial_epoch,
			null,
			clientUtils.buildCurrentTimestamp(),
			this._clientContext.getClientCertHash()
		);

		const seekHeader = clientUtils.buildHeader(identity, seekInfoHeader, txId.getNonce());
		const seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		const seekPayloadBytes = seekPayload.toBuffer();

		return seekPayloadBytes;
	}

	/*
	 * Internal method
	 * Will close out all callbacks
	 * Sends an error to all registered event "onError" callbacks
	 */
	_closeAllCallbacks(err) {
		const method = '_closeAllCallbacks - ' + this.getPeerAddr();
		logger.debug('%s - start', method);

		logger.debug('%s - blockOnErrors %s', method, Object.keys(this._blockRegistrations).length);
		for (const key in this._blockRegistrations) {
			const block_registration = this._blockRegistrations[key];
			if (block_registration.onError) {
				logger.debug('%s - calling block error callback for %s', method, key);
				block_registration.onError(err);
			} else {
				logger.debug('%s - no block error callback to call for %s', method, key);
			}
		}
		this._blockRegistrations = {};

		logger.debug('%s - transactionOnErrors %s', method, Object.keys(this._transactionRegistrations).length);
		for (const key in this._transactionRegistrations) {
			const trans_reg = this._transactionRegistrations[key];
			if (trans_reg.onError) {
				logger.debug('%s - calling transaction error callback for %s', method, key);
				trans_reg.onError(err);
			} else {
				logger.debug('%s - no transaction error callback to call for %s', method, key);
			}
		}
		this._transactionRegistrations = {};

		logger.debug('%s - chaincodeRegistrants %s', method, this._chaincodeRegistrants.size);
		for (const chaincode_reg of this._chaincodeRegistrants.keys()) {
			if (chaincode_reg.event_reg.onError) {
				logger.debug('%s - closing this chaincode event chaincode_id:%s event_name:%s', method, chaincode_reg.chaincode_id, chaincode_reg.event_name);
				chaincode_reg.event_reg.onError(err);
			}
		}
		this._chaincodeRegistrants.clear();

		// all done
		logger.debug('%s - end', method);
	}

	_assignPeer(peer) {
		const method = 'assignPeer';
		logger.debug('%s - start', method);

		const peers = this._channel._getTargets(peer, Constants.NetworkConfig.EVENT_SOURCE_ROLE, true);
		this._peer = peers[0];

		logger.debug('%s - reassigning new peer for this channel event hub %s,', method, this.getPeerAddr());
	}

	_checkBlockNum(block_num) {
		let _block_num = null;
		if (typeof block_num === 'string') {
			if (block_num.toLowerCase() === LAST_SEEN) {
				// set to last seen even if last seen is null
				_block_num = this._last_block_seen;
			} else if (block_num.toLowerCase() === OLDEST) {
				_block_num = OLDEST;
			} else if (block_num.toLowerCase() === NEWEST) {
				_block_num = NEWEST;
			} else {
				// maybe it is a string number
				_block_num = utils.convertToLong(block_num);
			}
		} else {
			if (typeof block_num !== 'undefined' && block_num !== null) {
				_block_num = utils.convertToLong(block_num);
			}
		}

		return _block_num;
	}

	_checkEndBlock(endBlock, startBlock) {
		const _endBlock = this._checkBlockNum(endBlock);

		if (_endBlock instanceof Long && startBlock instanceof Long) {
			if (startBlock.greaterThan(_endBlock)) {
				throw new Error(util.format('"startBlock" (%s) must not be greater than "endBlock" (%s)', startBlock.toInt(), _endBlock.toInt()));
			}
		}

		return _endBlock;
	}
	/*
	 * Internal method
	 * checks the startBlock/endBlock options
	 * checks that only one registration when using startBlock/endBlock
	 * checks that startBlock has been set during connect, then not allow
	 *    registration with startBlock/endBlock
	 * @returns enum of how the endBlock and startBlock have been set
	 */
	_checkReplay(options, fromConnect) {
		const method = '_checkReplay';
		logger.debug('%s - start', method);

		let result = NO_START_STOP;
		let _start_block = null;
		let _end_block = null;

		if (options) {
			_start_block = this._checkBlockNum(options.startBlock);
			_end_block = this._checkEndBlock(options.endBlock, _start_block);
		}

		if (_start_block || _end_block) {
			if (fromConnect) {
				if (this._start_stop_action) {
					logger.error('This ChannelEventHub has a registered listener that has options of startBlock or endBlock');
					throw new Error('Not able to connect with startBlock or endBlock when a registered listener has those options.');
				}
			} else {
				if (this._haveRegistrations()) {
					logger.error('This ChannelEventHub is already registered with active listeners.');
					throw new Error('Only one event registration is allowed when startBlock or endBlock are used');
				}
				if (this._start_stop_connect) {
					logger.error('This ChannelEventHub has been connected with a startBlock or endBlock');
					throw new Error('Registrations with startBlock or endBlock are not allowed if this ChannelEventHub is connected with a startBlock or endBlock');
				}
				if (this._connected || this._connect_running) {
					logger.error('This ChannelEventHub has already been connected to start receiving blocks.');
					throw new Error('Event listeners that use startBlock or endBlock must be registered before connecting to the peer channel-based service');
				}
			}
		}

		if (_end_block) {
			this._ending_block_number = _end_block;
			if (fromConnect) {
				logger.debug('%s - connect will end receiving blocks from %s', method, this._ending_block_number);
				this._start_stop_connect = true;
			}
			result = END_ONLY;
			logger.debug('%s - Event listening will end at block %s', method, this._ending_block_number);
		}
		if (_start_block) {
			this._starting_block_number = _start_block;
			if (fromConnect) {
				logger.debug('%s - connect will start receiving blocks from %s', method, this._starting_block_number);
				this._start_stop_connect = true;
			}
			result++; // will move result to START_ONLY or START_AND_END
			logger.debug('%s - Event listening will start at block %s', method, this._starting_block_number);
		}

		logger.debug('%s - end', method);
		return result;
	}

	_haveRegistrations() {
		let count = 0;
		count = count + Object.keys(this._chaincodeRegistrants).length;
		count = count + Object.keys(this._blockRegistrations).length;
		count = count + Object.keys(this._transactionRegistrations).length;
		return count > 0;
	}

	/*
	  * internal method to check if the connection is ready and if
	  * not in the ready state disconnect (post an error to all registered)
	  * and throw and error to enform the caller
	  */
	_checkConnection() {
		logger.debug('_checkConnection - start');
		if (this._connected || this._connect_running) {
			const ready = isStreamReady(this);
			logger.debug('_checkConnection - %s with stream channel ready %s', this._peer.getUrl(), ready);

			if (!ready && !this._connect_running) { // Not READY, but trying
				logger.error('_checkConnection - connection is not ready');
				const error = new Error('Connection is not READY');
				this._disconnect(error);
				throw error;
			}
		} else {
			logger.debug('_checkConnection - connection has not been started');
		}

		logger.debug('_checkConnection - end');
	}

	/**
	 * Returns if the stream is ready. and will attempt a restart when forced
	 *
	 * @param {boolean} force_reconnect - attempt to reconnect if the stream
	 *        is not in the 'READY' state
	 */
	checkConnection(force_reconnect) {
		logger.debug('checkConnection - start force_reconnect:%s', force_reconnect);
		const ready = isStreamReady(this);
		logger.debug('checkConnection -  %s with stream channel ready %s', this._peer.getUrl(), ready);

		if (force_reconnect) {
			try {
				if (this._stream) {
					const is_paused = this._stream.isPaused();
					logger.debug('checkConnection - grpc isPaused :%s', is_paused);
					if (is_paused) {
						this._stream.resume();
						logger.debug('checkConnection - grpc resuming');
					} else if (!ready) {
						// try to reconnect
						this._connect_running = false;
						this._connect({force: true});
					}
				} else {
					logger.debug('checkConnection - stream was shutdown - will reconnected');
					// try to reconnect
					this._connect_running = false;
					this._connect({force: true});
				}
			} catch (error) {
				logger.error('checkConnection - error ::' + (error.stack ? error.stack : error));
				const err = new Error('Problem during reconnect and the event hub is not connected ::%s', error);
				this._disconnect(err);
			}
		}

		return isStreamReady(this);
	}

	/**
	 * @typedef {Object} ChaincodeEvent
	 * @property {string} chaincode_id - The name of chaincode that sourced this
	 *           event.
	 * @property {string} tx_id - The transaction ID of this event.
	 * @property {string} event_name - The string that is the event_name of this
	 *           event as set by the chaincode during endorsement.
	 *           <code>stub.SetEvent(event_name, payload)</code>
	 * @property {byte[]} payload - Application-specific byte array that the chaincode
	 *           set when it called <code>stub.SetEvent(event_name, payload)</code>
	 */

	/**
	 * @typedef {Object} RegistrationOpts
	 * @property {integer} startBlock - Optional - The starting block number
	 *           for event checking. When included, the peer's fabric service
	 *           will be asked to start sending blocks from this block number.
	 *           This is how to resume or replay missed blocks that were added
	 *           to the ledger.
	 *           Default is the latest block on the ledger.
	 *           Setting a startBlock may confuse other event listeners,
	 *           therefore only one listener will be allowed on a ChannelEventHub
	 *           when a startBlock is being used.
	 *           Setting a startBlock also requires
	 *           this ChannelEventHub to connect to the fabric service using
	 *           different options. The registration with a startBlock must be
	 *           done before calling [connect()]{@link ChannelEventhub#connect}.
	 * @property {integer | 'newest'} endBlock - Optional - The ending block number
	 *           for event checking. The value 'newest' indicates that the endBlock
	 *           will be calculated by the peer as the newest block on the ledger
	 *           at the time of registration.
	 *           This allows the application to replay up to the latest block on
	 *           the ledger and then the listener will stop and be notified by the
	 *           'onError' callback.
	 *           When included, the peer's fabric service
	 *           will be asked to stop sending blocks once this block is delivered.
	 *           This is how to replay missed blocks that were added
	 *           to the ledger. When a startBlock is not included, the endBlock
	 *           must be equal to or larger the current channel block height.
	 *           Setting an endBlock may confuse other event listeners,
	 *           therefore only one listener will be allowed on a ChannelEventHub
	 *           when an endBlock is being used.
	 *           Setting a endBlock also requires
	 *           this ChannelEventHub to connect to the fabric service using
	 *           different options. The a registration with an endBlock must be
	 *           done before calling [connect()]{@link ChannelEventhub#connect}.
	 * @property {boolean} unregister - Optional - This options setting indicates
	 *           the registration should be removed (unregister) when the event
	 *           is seen. When the application is using a timeout to only wait a
	 *           specified amount of time for the transaction to be seen, the timeout
	 *           processing should included the manual 'unregister' of the transaction
	 *           event listener to avoid the event callbacks being called unexpectedly.
	 *           The default for this setting is different for the different type of
	 *           event listeners. For block listeners the default is true, however
	 *           the event listener is assumed to have seen the final event only if
	 *           the end_block was set as a option and that end_block was seen by the
	 *           the listener. For transaction listeners the default is true and the
	 *           listener will be unregistered when a transaction with the id is
	 *           seen by this listener. For chaincode listeners the default will be
	 *           false as the match filter might be intended for many transactions
	 *           rather than a specific transaction or block as in the other listeners.
	 *           If not set and the endBlock has been set, the listener will be
	 *           automatically unregistered.
	 * @property {boolean} disconnect - Optional - This option setting Indicates
	 *           to the ChannelEventHub instance to automatically disconnect itself
	 *           from the peer's fabric service once the event has been seen.
	 *           The default is false. If not set and the endBlock has been set, the
	 *           the ChannelEventHub instance will automatically disconnect itself.
	 */

	/**
	 * Register a listener to receive chaincode events.
	 * <br><br>
	 * An error may occur in the connection establishment which runs
	 * asynchronously. The best practice would be to provide an
	 * "onError" callback to be notified when this ChannelEventHub has an issue.
	 *
	 * @param {string} chaincode_id - Id of the chaincode of interest
	 * @param {string|RegExp} event_name - The exact name of the chaincode event or
	 *        regular expression that will be matched against the name given to
	 *        the target chaincode's call
	 *        <code>stub.SetEvent(name, payload)</code>)
	 * @param {function} onEvent - callback function for matched events. It will
	 *        be called with four parameters when not using "as_array".
	 *        <ul><li>{@link ChaincodeEvent} - The chaincode event as produced by the chaincode,
	 *        <li>{Long} - the block number that contains this chaincode event
	 *        <li>{string} - the transaction ID that contains this chaincode event
	 *        <li>{string} - the transaction status of the transaction that contains this chaincode event
	 *        </ul>When using "as_array: true" option, there will be one
	 *        parameter of an array of an event objects with the above values which may be used
	 *        as in the example below.
	 * @example <caption>Chaincode callback to process events when as_array:true </caption>
	 *        function myCallback(...events) {
	 *           for ({chaincode_event, block_num, tx_id, tx_status} of events) {
	 *               // process the chaincode event
	 *           }
	 *        }
	 * @param {function} onError - Optional callback function to be notified when
	 *        this ChannelEventHub is shutdown. The shutdown may be caused by a network
	 *        or connection error, by a call to the "disconnect()" method or when
	 *        the fabric service ends the connection this ChannelEventHub.
	 *        This callback will also be called when the ChannelEventHub is shutdown
	 *        due to the last block being received if replaying and requesting
	 *        the endBlock to be 'newest'.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *        for start and end block numbers, automatically unregister and
	 *        automatically disconnect.
	 * 	      Chaincode event listeners may also use the "as_array" option to
	 *        indicate that all the chaincode events found that match this
	 *        definition be sent to the callback as an array or call the callback for
	 *        each one individually.
	 * @returns {Object} An object that should be treated as an opaque handle used
	 *        to unregister (see [unregisterChaincodeEvent()]{@link ChannelEventHub#unregisterChaincodeEvent})
	 */
	registerChaincodeEvent(chaincode_id, event_name, onEvent, onError, options) {
		logger.debug('registerChaincodeEvent - start');
		if (!chaincode_id) {
			throw new Error('Missing "chaincode_id" parameter');
		}
		if (!event_name) {
			throw new Error('Missing "event_name" parameter');
		}
		if (!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}

		this._checkAllowRegistrations();
		const startstop_mode = this._checkReplay(options);

		const event_reg = new EventRegistration(onEvent, onError, options, false, false);

		let as_array = false; // default is send one at a time
		if (options && typeof options.as_array === 'boolean') {
			as_array = options.as_array;
		}
		const chaincode_reg = new ChaincodeRegistration(chaincode_id, event_name, event_reg, as_array);

		const unregister_action = () => {
			this.unregisterChaincodeEvent(chaincode_reg);
		};
		this._on_end_actions(chaincode_reg, unregister_action, startstop_mode, options);

		this._chaincodeRegistrants.set(chaincode_reg, chaincode_reg);

		this._checkConnection();

		return chaincode_reg;
	}

	/**
	 * Unregister the chaincode event listener represented by
	 * the <code>listener_handle</code> object returned by
	 * the registerChaincodeEvent() method
	 *
	 * @param {Object} listener_handle - The handle object returned from the
	 *        call to registerChaincodeEvent.
	 * @param {boolean} throwError - Optional - throw an error if the chaincode event
	 *        registration does not exist, default is to not throw an error
	 */
	unregisterChaincodeEvent(listener_handle, throwError) {
		logger.debug('unregisterChaincodeEvent - start');
		if (!listener_handle) {
			throw new Error('Missing "listener_handle" parameter');
		}
		if (!this._chaincodeRegistrants.has(listener_handle) && throwError) {
			throw new Error(`No event registration for chaincode id ${listener_handle.chaincode_id}`);
		} else {
			this._chaincodeRegistrants.delete(listener_handle);
		}
	}

	/**
	 * Register a listener to receive all block committed to this channel.
	 * The listener's "onEvent" callback gets called on the arrival of every block.
	 * <br><br>
	 * An error may occur in the connection establishment which runs
	 * asynchronously. The best practice would be to provide an
	 * "onError" callback to be notified when this ChannelEventHub has an issue.
	 *
	 * @param {function} onEvent - Callback function that takes a single parameter
	 *        of a {@link Block} object
	 * @param {function} onError - Optional callback function to be notified when
	 *        this ChannelEventHub is shutdown. The shutdown may be caused by a network
	 *        or connection error, by a call to the "disconnect()" method or when
	 *        the fabric service ends the connection this ChannelEventHub.
	 *        This callback will also be called when the ChannelEventHub is shutdown
	 *        due to the last block being received if replaying and requesting
	 *        the endBlock to be 'newest'.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *        for start and end block numbers, automatically unregister and
	 *        automatically disconnect.
	 * @returns {int} This is the block registration number that must be
	 *        used to unregister this block listener. see [unregisterBlockEvent()]{@link ChannelEventHub#unregisterBlockEvent}
	 */
	registerBlockEvent(onEvent, onError, options) {
		logger.debug('registerBlockEvent - start');
		if (!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}

		this._checkAllowRegistrations();
		const startstop_mode = this._checkReplay(options);
		const block_registration_number = ++this._block_registrant_count;
		const block_registration = new EventRegistration(onEvent, onError, options, false, false);
		this._blockRegistrations[block_registration_number] = block_registration;
		const unregister_action = () => {
			this.unregisterBlockEvent(block_registration_number);
		};
		this._on_end_actions(block_registration, unregister_action, startstop_mode, options);

		this._checkConnection();

		return block_registration_number;
	}

	/**
	 * Unregister the block event listener using the block
	 * registration number that is returned by the call to
	 * the registerBlockEvent() method.
	 *
	 * @param {int} block_registration_number - The block registration number
	 *        that was returned during registration.
	 * @param {boolean} throwError - Optional - throw an error if the block
	 *        registration does not exist, default is to not throw an error
	 */
	unregisterBlockEvent(block_registration_number, throwError) {
		logger.debug('unregisterBlockEvent - start  %s', block_registration_number);
		const block_reg = this._blockRegistrations[block_registration_number];
		if (!block_reg && throwError) {
			throw new Error(`Block listener for block registration number "${block_registration_number}" does not exist`);
		} else {
			delete this._blockRegistrations[block_registration_number];
		}
	}

	/**
	 * Register a callback function to receive a notification when the transaction
	 * by the given id has been committed into a block. Using the special string
	 * 'all' will indicate that this listener will notify (call) the callback
	 * for every transaction received from the fabric service.
	 * <br><br>
	 * An error may occur in the connection establishment which runs
	 * asynchronously. The best practice would be to provide an
	 * "onError" callback to be notified when this ChannelEventHub has an issue.
	 *
	 * @param {string} txid - Transaction id string or 'all'
	 * @param {function} onEvent - Callback function that takes a parameter of
	 *        transaction ID, a string parameter indicating the transaction status,
	 *        and the block number of this transaction committed to the ledger
	 * @param {function} onError - Optional callback function to be notified when
	 *        this ChannelEventHub is shutdown. The shutdown may be caused by a network
	 *        or connection error, by a call to the "disconnect()" method or when
	 *        the fabric event service ends the connection this ChannelEventHub.
	 *        This callback will also be called when the ChannelEventHub is shutdown
	 *        due to the last block being received if replaying and requesting
	 *        the endBlock to be 'newest'.
	 * @param {RegistrationOpts} options - Options on the registrations to allow
	 *        for start and end block numbers, automatically unregister and
	 *        automatically disconnect.
	 * @returns {string} The transaction ID that was used to register this event listener.
	 *        May be used to unregister this event listener.
	 */
	registerTxEvent(txid, onEvent, onError, options) {
		logger.debug('registerTxEvent start - txid:%s', txid);

		if (!txid) {
			throw new Error('Missing "txid" parameter');
		}
		if (typeof txid !== 'string') {
			throw new Error('"txid" parameter is not a string');
		}
		if (!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}

		this._checkAllowRegistrations();
		const startstop_mode = this._checkReplay(options);

		let default_unregister = true;
		let _txid = txid;
		if (txid.toLowerCase() === ALL) {
			_txid = txid.toLowerCase();
			default_unregister = false;
		}
		const temp = this._transactionRegistrations[_txid];
		if (temp) {
			throw new Error(`TransactionId (${txid}) has already been registered`);
		}

		const trans_registration = new EventRegistration(onEvent, onError, options, default_unregister, false);
		this._transactionRegistrations[_txid] = trans_registration;
		const unregister_action = () => {
			this.unregisterTxEvent(_txid);
		};
		this._on_end_actions(trans_registration, unregister_action, startstop_mode, options);

		this._checkConnection();

		return _txid;
	}

	/**
	 * Unregister transaction event listener for the transaction id.
	 * @param {string} txid - The transaction id
	 * @param {boolean} throwError - Optional - throw an error if the transaction
	 *        registration does not exist, default is to not throw an error
	 */
	unregisterTxEvent(txid, throwError) {
		logger.debug('unregisterTxEvent txid ' + txid);
		const tx_reg = this._transactionRegistrations[txid];
		if (!tx_reg && throwError) {
			throw new Error(`Transaction listener for transaction id "${txid}" does not exist`);
		} else {
			delete this._transactionRegistrations[txid];
		}
	}

	isFiltered() {
		return !!this._filtered_stream;
	}

	/*
	 * private internal method for processing block events
	 * @param {Object} block protobuf object
	 */
	_processBlockEvents(block) {
		if (Object.keys(this._blockRegistrations).length === 0) {
			logger.debug('_processBlockEvents - no registered block event "listeners"');
			return;
		}

		// send to all registered block listeners
		Object.keys(this._blockRegistrations).forEach((key) => {
			const block_reg = this._blockRegistrations[key];
			logger.debug('_processBlockEvents - calling block listener callback');
			block_reg.onEvent(block);

			// check to see if we should automatically unregister or/and disconnect this hub
			if (block_reg.unregister) {
				this.unregisterBlockEvent(key);
				logger.debug('_processBlockEvents - automatically unregister block listener for %s', key);
			}
			if (block_reg.disconnect) {
				logger.debug('_processBlockEvents - automatically disconnect');
				this._disconnect(new EventHubDisconnectError('Shutdown due to disconnect on block registration'));
			}
		});
	}

	/*
	 * private internal method for processing tx events
	 * @param {Object} block protobuf object which might contain transactions
	 */
	_processTxEvents(block) {
		if (Object.keys(this._transactionRegistrations).length === 0) {
			logger.debug('_processTxEvents - no registered transaction event "listeners"');
			return;
		}

		if (block.number) {
			logger.debug(`_processTxEvents filtered block num=${block.number}`);
			if (block.filtered_transactions) {
				for (const filtered_transaction of block.filtered_transactions) {
					this._checkTransactionId(filtered_transaction.txid,
						filtered_transaction.tx_validation_code,
						block.number);
				}
			}
		} else {
			logger.debug(`_processTxEvents block num=${block.header.number}`);
			const txStatusCodes = block.metadata.metadata[_commonProto.BlockMetadataIndex.TRANSACTIONS_FILTER];
			for (let index = 0; index < block.data.data.length; index++) {
				const channel_header = block.data.data[index].payload.header.channel_header;
				this._checkTransactionId(channel_header.tx_id,
					txStatusCodes[index],
					block.header.number);
			}
		}
	}

	/* internal utility method */
	_checkTransactionId(tx_id, val_code, block_num) {
		const trans_reg = this._transactionRegistrations[tx_id];
		if (trans_reg) {
			this._callTransactionListener(tx_id, val_code, block_num, trans_reg);
		}
		const all_trans_reg = this._transactionRegistrations[ALL];
		if (all_trans_reg) {
			this._callTransactionListener(tx_id, val_code, block_num, all_trans_reg);
		}
		if (trans_reg || all_trans_reg) {
			logger.debug('_callTransactionListener - no call backs found for this transaction %s', tx_id);
		}
	}

	/* internal utility method */
	_callTransactionListener(tx_id, val_code, block_num, trans_reg) {
		logger.debug('_callTransactionListener - about to call the transaction call back for code=%s tx=%s', val_code, tx_id);
		const status = convertValidationCode(val_code);

		trans_reg.onEvent(tx_id, status, block_num);

		// check to see if we should automatically unregister or/and disconnect this hub
		if (trans_reg.unregister) {
			this.unregisterTxEvent(tx_id);
			logger.debug('_callTransactionListener - automatically unregister tx listener for %s', tx_id);
		}
		if (trans_reg.disconnect) {
			logger.debug('_callTransactionListener - automatically disconnect');
			this._disconnect(new Error('Shutdown due to disconnect on transaction id registration'));
		}
	}

	/*
	 * private internal method for processing chaincode events
	 * @param {Object} block protobuf object which might contain the chaincode event from the fabric
	 */
	_processChaincodeEvents(block) {
		const method = '_processChaincodeEvents';
		if (this._chaincodeRegistrants.size === 0) {
			logger.debug('%s - no registered chaincode event "listeners"', method);
			return;
		}
		const all_events = new Map();
		if (block.number) {
			if (block.filtered_transactions) {
				for (const filtered_transaction of block.filtered_transactions) {
					if (filtered_transaction.transaction_actions) {
						if (filtered_transaction.transaction_actions.chaincode_actions) {
							for (const chaincode_action of filtered_transaction.transaction_actions.chaincode_actions) {
								// need to remove the payload since with filtered blocks it
								// has an empty byte array value which is not the real value
								// we do not want the listener to think that is the value
								delete chaincode_action.chaincode_event.payload;
								this._queueChaincodeEvent(chaincode_action.chaincode_event,
									block.number,
									filtered_transaction.txid,
									filtered_transaction.tx_validation_code,
									all_events);
							}
						}
					}
				}
			}
		} else {
			for (let index = 0; index < block.data.data.length; index++) {
				logger.debug(`%s - trans index=${index}`, method);
				try {
					const env = block.data.data[index];
					const channel_header = env.payload.header.channel_header;
					if (channel_header.type === 3) { // only ENDORSER_TRANSACTION have chaincode events
						const tx = env.payload.data;
						if (tx && tx.actions) {
							for (const {payload} of tx.actions) {
								const chaincode_event = payload.action.proposal_response_payload.extension.events;
								logger.debug('%s - chaincode_event %s', method, chaincode_event);

								const txStatusCodes = block.metadata.metadata[_commonProto.BlockMetadataIndex.TRANSACTIONS_FILTER];
								const channelHeader = block.data.data[index].payload.header.channel_header;
								const val_code = txStatusCodes[index];

								this._queueChaincodeEvent(chaincode_event,
									block.header.number,
									channelHeader.tx_id,
									val_code,
									all_events);
							}
						} else {
							logger.debug('%s - no transactions or transaction actions', method);
						}
					} else {
						logger.debug('%s - block is not endorser transaction type', method);
					}
				} catch (err) {
					logger.error('on.data - Error unmarshalling transaction=', err);
				}
			}
		}

		// send all events for each listener
		for (const [chaincode_reg, events] of all_events.entries()) {
			if (chaincode_reg.as_array) {
				// call as an array ... all at once
				chaincode_reg.event_reg.onEvent(events);
			} else {
				for (const event of events) {
					// call one at a time
					chaincode_reg.event_reg.onEvent(event.chaincode_event, event.block_num, event.tx_id, event.tx_status);
				}
			}
			// see if we should automatically unregister this event listener or disconnect this hub
			if (chaincode_reg.event_reg.unregister) {
				this.unregisterChaincodeEvent(chaincode_reg);
				logger.debug('%s - automatically unregister chaincode event listener %s', method, chaincode_reg);
			}
			if (chaincode_reg.event_reg.disconnect) {
				logger.debug('%s - automatically disconnect event hub with chaincode event listener disconnect=true %s', method, chaincode_reg);
				this._disconnect(new EventHubDisconnectError('Shutdown due to disconnect on chaincode event registration'));
			}
		}
	}

	_queueChaincodeEvent(chaincode_event, block_num, tx_id, val_code, all_events) {
		const method = '_queueChaincodeEvent';
		logger.debug('%s - chaincode_event %s', method, chaincode_event);

		const tx_status = convertValidationCode(val_code);

		logger.debug('%s - txid=%s  val_code=%s', method, tx_id, tx_status);

		for (const chaincode_reg of this._chaincodeRegistrants.keys()) {
			// check each listener to see if this chaincode event matches
			if (chaincode_reg.chaincode_id.test(chaincode_event.chaincode_id) &&
				chaincode_reg.event_name.test(chaincode_event.event_name)) {
				// we have a match - save it to be sent later
				logger.debug('%s - queuing chaincode event: %s', method, chaincode_event.event_name);
				let events = all_events.get(chaincode_reg);
				if (!events) {
					events = [];
					all_events.set(chaincode_reg, events);
				}
				events.push({chaincode_event, block_num, tx_id, tx_status});
			} else {
				logger.debug('%s - NOT queuing chaincode event: %s', method, chaincode_event.event_name);
			}
		}
	}

	/*
	 * utility method to mark if this ChannelEventHub has seen the last
	 * in the range when this event hub is using startBlock/endBlock
	 */
	_checkReplayEnd() {
		if (this._ending_block_number) {
			if (this._ending_block_number.lessThanOrEqual(this._last_block_seen)) {
				this._ending_block_seen = true;
				if (this._start_stop_action) {
					if (this._start_stop_action.unregister) {
						this._start_stop_action.unregister();
					}
					if (this._start_stop_action.disconnect) {
						this._disconnect(new EventHubDisconnectError('Shutdown due to end block number has been seen'));
					}
				}
			}
		}
	}

	/*
	 * utility method to reset the replay state
	 */
	_setReplayDefaults() {
		// these will hold the block numbers to be used when this
		// event hub connects to the remote peer's channel event service
		this._starting_block_number = null;
		this._ending_block_number = null;
		this._ending_block_seen = false;
		this._ending_block_newest = false;
		this._start_stop_action = null;
		this._start_stop_connect = false;
	}


	/*
	 * utility method to calculate if this listener should be removed
	 * and if the event hub should be disconnected
	 * if the end block has been seen
	 */
	_on_end_actions(event_reg, unregister_action, startstop_mode, options) {
		if (startstop_mode > NO_START_STOP) {
			this._start_stop_action = {};
			this._start_stop_action.event_reg = event_reg; // might be useful
		} else {
			logger.debug('_on_end_actions - no end block action required');
			return; // all done checking
		}

		let _end_register = true; // default if end block is seen
		if (options && typeof options.unregister === 'boolean') {
			_end_register = options.unregister;
		}
		if (_end_register && startstop_mode > START_ONLY) {
			logger.debug('listener will be unregistered when end block is seen');
			this._start_stop_action.unregister = unregister_action;
		} else {
			logger.debug('listener will not be unregistered when end block is seen');
		}

		let _end_disconnect = true; // default if end block is seen
		if (options && typeof options.disconnect === 'boolean') {
			_end_disconnect = options.disconnect;
		}
		if (_end_disconnect && startstop_mode > START_ONLY) {
			logger.debug('event hub will be disconnected when end block is seen');
			this._start_stop_action.disconnect = true;
		} else {
			logger.debug('event hub will not be disconnected when end block is seen');
		}
	}
}

module.exports = ChannelEventHub;

function convertValidationCode(code) {
	if (typeof code === 'string') {
		return code;
	}
	return _validation_codes[code];
}

/*
 * Utility method to check if the stream is ready.
 * The stream must be readable, writeable and reading to be 'ready'
 */
function isStreamReady(self) {
	const method = 'isStreamReady';
	let ready = false;
	if (self._stream) {
		const stream = self._stream;
		ready = stream.readable && stream.writable && stream.reading;
		logger.debug('%s - stream.readable %s :: %s', method, stream.readable, self.getPeerAddr());
		logger.debug('%s - stream.writable %s :: %s', method, stream.writable, self.getPeerAddr());
		logger.debug('%s - stream.reading %s :: %s', method, stream.reading, self.getPeerAddr());
		logger.debug('%s - stream.read_status %s :: %s', method, stream.read_status, self.getPeerAddr());
		logger.debug('%s - stream.received_status %s :: %s', method, stream.received_status, self.getPeerAddr());
	}

	return ready;
}

/*
 * The ChaincodeRegistration is used internal to the ChannelEventHub to hold chaincode
 * event registration callbacks.
 */
class ChaincodeRegistration {
	/**
	 * Constructs a chaincode callback entry
	 *
	 * @param {string} chaincode_id - chaincode id
	 * @param {string|RegExp} event_name - The regex used to filter events
	 * @param {EventRegistration} event_reg - event registrations callbacks
	 * @param {as_array} as_array - should all the chaincode events found that match this
	 *  definition be sent to the callback as an array or call the callback for
	 *  each one individually.
	 */
	constructor(chaincode_id, event_name, event_reg, as_array) {
		// chaincode id (regex filter)
		this.chaincode_id = new RegExp(chaincode_id);
		// event name regex filter
		this.event_name = new RegExp(event_name);

		this.event_reg = event_reg;

		this.events = [];

		this.as_array = as_array;
	}

	toString() {
		return 'ChaincodeRegistration:' + this.chaincode_id +
			' event_name:' + this.event_name;
	}
}

/*
 * The EventRegistration is used internally to the ChannelEventHub to hold
 * event registration callback and settings.
 */
class EventRegistration {
	/*
	 * Constructs a block callback entry
	 *
	 * @param {function} onEvent - Callback for event matches
	 * @param {function} onError - Callback for errors
	 * @param {RegistrationOpts} options - event registration options
	 * @param {boolean} default_unregister - the default value for the unregister
	 *        setting if not option setting is set by the user
	 * @param {boolean} default_disconnect - the default value for the disconnect
	 *        setting if not option setting is set by the user
	 */
	constructor(onEvent, onError, options, default_unregister, default_disconnect) {
		this._onEventFn = onEvent;
		this._onErrorFn = onError;
		this.unregister = default_unregister;
		this.disconnect = default_disconnect;

		if (options) {
			if (typeof options.unregister === 'undefined' || options.unregister === null) {
				logger.debug('const-EventRegistration - unregister was not defined, using default of %s', default_unregister);
			} else if (typeof options.unregister === 'boolean') {
				this.unregister = options.unregister;
				logger.debug('const-EventRegistration - unregister was defined, %s', this.unregister);
			} else {
				throw new Error('Event registration has invalid value for "unregister" option');
			}
			if (typeof options.disconnect === 'undefined' || options.disconnect === null) {
				logger.debug('const-EventRegistration - disconnect was not defined, using default of %s', default_disconnect);
			} else if (typeof options.disconnect === 'boolean') {
				this.disconnect = options.disconnect;
				logger.debug('const-EventRegistration - disconnect was defined, %s', this.disconnect);
			} else {
				throw new Error('Event registration has invalid value for "disconnect" option');
			}
		}
	}

	onEvent(...args) {
		try {
			this._onEventFn(...args);
		} catch (error) {
			logger.warn('Event notification callback failed', error);
		}
	}

	onError(...args) {
		try {
			this._onErrorFn(...args);
		} catch (error) {
			logger.warn('Error notification callback failed', error);
		}
	}
}
