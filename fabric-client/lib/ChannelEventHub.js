/*
 Copyright 2016, 2017 London Stock Exchange All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

                http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';
var Long = require('long');
var utils = require('./utils.js');
var clientUtils = require('./client-utils.js');
var logger = utils.getLogger('ChannelEventHub.js');

var Remote = require('./Remote.js');
var BlockDecoder = require('./BlockDecoder.js');

var grpc = require('grpc');
var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _commonProto = grpc.load(__dirname + '/protos/common/common.proto').common;
var _ccTransProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _ccEventProto = grpc.load(__dirname + '/protos/peer/chaincode_event.proto').protos;

var _validation_codes = {};
var keys = Object.keys(_transProto.TxValidationCode);
for(let i = 0;i<keys.length;i++) {
	let new_key = _transProto.TxValidationCode[keys[i]];
	_validation_codes[new_key] = keys[i];
}

var _header_types = {};
keys = Object.keys(_commonProto.HeaderType);
for(let j in keys) {
	let new_key = _commonProto.HeaderType[keys[j]];
	_header_types[new_key] = keys[j];
}

// GRPC connection states
// as seen in grpc/include/grpc/impl/codegen/connectivity_state.h
const CONNECTION_STATE = {
	0: 'IDLE',
	1: 'CONNECTING',
	2: 'READY',
	3: 'TRANSIENT_FAILURE',
	4: 'FATAL_FAILURE',
	5: 'SHUTDOWN'
};

/**
 * Transaction processing in fabric v1.1 is a long operation spanning multiple
 * components (application, endorsing peer, orderer, committing peer) and takes
 * a relatively lengthy period of time (think seconds instead of milliseconds)
 * to complete. As a result the applications must design their handling of the
 * transaction lifecyle in an asynchrous fashion. After the transaction proposal
 * has been successfully [endorsed]{@link Channel#sendTransactionProposal}, and before
 * the transaction message has been successfully [broadcast]{@link Channel#sendTransaction}
 * to the orderer, the application should register a listener to be notified of
 * the event when the transaction achieves finality, which is when the block
 * containing the transaction gets added to the peer's ledger/blockchain.
 * <br><br>
 * Fabric committing peers provides an event stream to publish blocks to registered
 * listeners.  A Block gets published whenever the committing peer adds a validated block
 * to the ledger. There are three ways to register a listener to get notified:
 * <li>register a "block listener" to get called for every block event on all channels. The listener
 *     will be passed a fully decoded {@link Block} object.
 *     See [registerBlockEvent]{@link ChannelEventHub#registerBlockEvent}
 * <li>register a "transaction listener" to get called when the specific transaction
 *     by id is committed (discovered inside a published block).
 *     See [registerTxEvent]{@link ChannelEventHub#registerTxEvent}
 * <li>register a "chaincode event listener" to get called when a specific
 *     [chaincode event]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/examples/chaincode/go/eventsender/eventsender.go#L65}
 *     has arrived. The listener will be passed the {@link ChaincodeEvent}.
	* see     [registerChaincodeEvent]{@link EventHub#registerChaincodeEvent}
 * <br><br>
 * The events are ephemeral, such that if a registered listener
 * crashed when the event is published, the listener will miss the event.
 * There are several techniques to compensate for missed events due to client crashes:
 * <li>register block event listeners and record the block numbers received, such that
 *     when the next block arrives and its number is not the next in sequence, then
 *     the application knows exactly which block events have been missed. It can then use
 *     [queryBlock]{@link Channel#queryBlock} to get those missed blocks from the target peer.
 * <li>use a message queue to catch all the block events. With many robust message queue
 *     implementations available today, you will be guaranteed to not miss an event. A
 *     fabric event listener can be written in any programming language. The following
 *     implementations can be used as reference to write the necessary glue code between
 *     the fabric event stream and a message queue:
 *
 * @example
 * var eh = channel.newEventHub(peer);
 *
 * // register the listeners before calling "connect()" so there
 * // is an error callback ready to process an error in case the
 * // connect() call fails
 * eh.registerTxEvent(
 *   transactionId,
 * 	 (tx, code) => {
 * 	   eh.unregisterTxEvent(transactionId);
 * 	   console.log(util.format('Transaction %s has completed', transactionId));
 * 	 },
 * 	 (err) => {
 * 	   eh.unregisterTxEvent(transactionId);
 * 	   console.log(util.format('Error %s! Transaction listener for %s has been ' +
 *                 'deregistered with %s', transactionId, err, eh.getPeerAddr()));
 * 	 }
 * );
 *
 * eh.connect();
 *
 * @class
 */
var ChannelEventHub = class {

	/**
	 * Constructs an EventHub object
	 *
	 * @param {Channel} channel - An instance of the Channel class
	 * were this event hub will receive blocks from
	 * @returns {ChannelEventHub} An instance of this class
	 */

	constructor(channel, peer) {
		logger.debug('const ');
		// this will hold the last block number received
		this._block_height = 0; //till we find out what it really is
		// this will hold the block number to be used when this
		// event hub is connected to the remote peer's channel event sevice
		this._starting_block_number = null; //default is not using
		// hashtable of clients registered for chaincode events
		this._chaincodeRegistrants = {};
		// set of clients registered for block events
		this._block_registrant_count = 1;
		this._blockOnEvents = {};
		this._blockOnErrors = {};
		// hashtable of clients registered for transactional events
		this._transactionOnEvents = {};
		this._transactionOnErrors = {};
		// grpc event client interface
		this._event_client = null;
		// grpc chat streaming interface
		this._stream = null;
		// fabric connection state of this eventhub
		this._connected = false;
		this._connect_running = false;
		// should this event hub reconnect on registrations
		this._force_reconnect = true;
		// connect count for this instance
		this._current_stream = 0;
		// reference to the channel instance holding critical context such as signing identity
		if (typeof channel === 'undefined' || channel === null || channel === '')
			throw new Error('Missing required argument: channel');

		this._clientContext = channel._clientContext;
		this._channel = channel;
		// peer node to connect
		// reference to the peer instance holding end point information
		if (typeof peer === 'undefined' || peer === null || peer === '')
			throw new Error('Missing required argument: peer');
		this._peer = peer;
	}

	/**
	 * @typedef {Object} EventRegistrationRequest
	 */

	/**
	 * Return the peer url of this event hub object
	 */
	getPeerAddr() {
		let addr = null;
		if(this._peer) {
			addr = this._peer._endpoint.addr;
		}

		return addr;
	}

	/**
	 * Is the event hub connected to the event source?
	 * @returns {boolean} True if connected to the event source, false otherwise
	 */
	isconnected() {
		return this._connected;
	}

	/**
	 * Establishes a connection with the peer event source.
	 * The peer address must be set by calling the [setPeerAddr()]{@link EventHub#setPeerAddr}
	 * method before calling this method.
	 *
	 * The connection will be established asynchronously. If the connection fails to
	 * get established, the application will be notified via the error callbacks
	 * from the registerXXXEvent() methods. It is recommended that an application always
	 * registers at least one event listener with an error callback, by calling any one of the
	 * [registerBlockEvent]{@link EventHub#registerBlockEvent},
	 * [registerTxEvent]{@link EventHub#registerTxEvent} or
	 * [registerChaincodeEvent]{@link EventHub#registerChaincodeEvent}
	 * methods, before calling connect().
	 */
	connect(){
		logger.debug('connect - start');
		this._connect_running = false; //override a running connect

		if (typeof this._clientContext.getUserContext !== 'function')
			throw new Error('Invalid clientContext argument: missing required function "getUserContext"');

		if (!this._clientContext._userContext)
			throw new Error('The clientContext has not been properly initialized, missing userContext');

		this._connect();
	}

	/*
	 * Internal use only
	 * Establishes a connection with the peer event source
	 * @param {boolean} force - internal use only, will reestablish the
	 *                  the connection to the peer event hub
	 */
	_connect(force) {
		logger.debug('_connect - start - %s', new Date());
		if(this._connect_running) {
			logger.debug('_connect - connect is running');
			return;
		}
		if (!force && this._connected) {
			logger.debug('_connect - end - already connected');
			return;
		}
		if (!this._peer) throw Error('Must set peer address before connecting.');

		this._connect_running = true;
		this._current_stream++;
		let stream_id = this._current_stream;
		logger.debug('_connect - start stream:',stream_id);
		let self = this; // for callback context

		let send_timeout = setTimeout(function(){
			logger.error('_connect - timed out after:%s', self._peer._request_timeout);
			self._connect_running = false;
			self._disconnect(new Error('Unable to connect to the peer event hub'));
		}, self._peer._request_timeout);

		// check on the keep alive options
		// the keep alive interval
		let options = utils.checkAndAddConfigSetting('grpc.keepalive_time_ms', 360000, this._peer._options);
		// how long should we wait for the keep alive response
		let request_timeout_ms = utils.getConfigSetting('request-timeout', 3000);
		let request_timeout = request_timeout_ms / 1000;
		options = utils.checkAndAddConfigSetting('grpc.keepalive_timeout_ms', request_timeout_ms, options);

		logger.info('_connect - options %j',this._peer._options);
		this._event_client = new _abProto.AtomicBroadcast(this._peer._endpoint.addr, this._peer._endpoint.creds, this._peer._options);
		this._stream = this._event_client.deliver();

		this._stream.on('data', function(event) {
			if(self._connect_running) {
				self._connect_running = false;
				clearTimeout(send_timeout);
			}

			logger.debug('on.data - event stream:%s _current_stream:%s',stream_id, self._current_stream);
			if(stream_id != self._current_stream) {
				logger.debug('on.data - incoming event was from a canceled stream');
				return;
			}

			let state = getStreamState(self);
			logger.debug('on.data - grpc stream state :%s',state);
			if (event.Type === 'block') {
				try {
					let block = BlockDecoder.decodeBlock(event.block);
					this._block_height = block.header.number;
					logger.debug('on.data - incoming block number %s',this._block_height);
					if(self._connected == true) {
						logger.debug('on.data - new block received - check event registrations');
					} else {
						logger.debug('on.data - first block received , event hub now registered');
						self._connected = true;
					}
					// somebody may have registered to receive this block
					self._processBlockOnEvents(block);
					self._processTxOnEvents(block);
					self._processChainCodeOnEvents(block);
				} catch(error) {
					logger.error('ChannelEventHub - ::' + error.stack ? error.stack : error);
					logger.error('ChannelEventHub has detected an error '+error.toString());
					//report error to all callbacks and shutdown this eventhub
					self._disconnect(error);
				}
			}
			else if(event.Type === 'status') {
				logger.debug('on.data - status received');
				// only blocks should be received .... get status means we need to tell
				// all registered users that something is wrong and the stream is will be close or
				// has been closed
				self._disconnect(new Error('Received status message on a event stream that should have stayed open status:%s',event.status));
			}
			else {
				logger.debug('on.data - unknown event %s',event.Event);
				// only blocks should be received .... get an unknown... means we need to tell
				// all registered users that something is wrong
				self._disconnect(new Error('Received unknown message on a event stream that should be open'));
			}
		});

		this._stream.on('status', function (response) {
			logger.debug('on status - status received: %j',response);
		});

		this._stream.on('end', function() {
			self._connect_running = false;
			clearTimeout(send_timeout);
			logger.debug('on.end - event stream:%s _current_stream:%s',stream_id, self._current_stream);
			if(stream_id != self._current_stream) {
				logger.debug('on.end - incoming event was from a canceled stream');
				return;
			}

			let state = getStreamState(self);
			logger.debug('on.end - grpc stream state :%s',state);
			self._disconnect(new Error('Peer event hub has disconnected due to an "end" event'));
		});

		this._stream.on('error', function(err) {
			self._connect_running = false;
			clearTimeout(send_timeout);
			logger.debug('on.error - event stream:%s _current_stream:%s',stream_id, self._current_stream);
			if(stream_id != self._current_stream) {
				logger.debug('on.error - incoming event was from a canceled stream');
				logger.debug('on.error - %s %s',new Date(),err);
				return;
			}

			let state = getStreamState(self);
			logger.debug('on.error - grpc stream state :%s',state);
			if(err instanceof Error) {
				self._disconnect(err);
			}
			else {
				self._disconnect(new Error(err));
			}
		});

		this._sendRegistration();
		logger.debug('_connect - end stream:',stream_id);
	}

	/**
	 * Disconnects the event hub from the peer event source.
	 * Will close all event listeners and send an Error object
	 * with the message "EventHub has been shutdown" to
	 * all listeners that provided an "onError" callback.
	 */
	disconnect() {
		this._disconnect(new Error('EventHub has been shutdown'));
	}

	/* Internal method
	 * Disconnects the connection to the peer event source.
	 * Will close all event listeners and send an `Error` to
	 * all listeners that provided an "onError" callback.
	 */
	_disconnect(err) {
		logger.debug('_disconnect - start -- called due to:: %s',err.message);
		this._closeAllCallbacks(err);
		this._shutdown();
	}

	_shutdown() {
		this._connected = false;
		this._connect_running = false;
		if(this._stream) {
			logger.debug('_disconnect - shutdown existing stream');
			this._stream.cancel();
			this._stream.end();
			this._stream = null;
		}
		if(this._event_client) {
			this._event_client.close();
		}
	}

	/*
	 * Internal method
	 * Builds a signed event registration
	 * and sends it to the peer's event hub.
	 */
	_sendRegistration() {
		// build start
		let seekStart = new _abProto.SeekPosition();
		if(this._starting_block_number) {
			let seekSpecifiedStart = new _abProto.SeekSpecified();
			seekSpecifiedStart.setNumber(this._starting_block_number);
			seekStart.setSpecified(seekSpecifiedStart);
		} else {
			let seekNewest = new _abProto.SeekNewest();
			seekStart.setNewest(seekNewest);
		}

		//   build stop
		let seekSpecifiedStop = new _abProto.SeekSpecified();
		seekSpecifiedStop.setNumber(Long.MAX_VALUE);
		let seekStop = new _abProto.SeekPosition();
		seekStop.setSpecified(seekSpecifiedStop);

		// seek info with all parts
		let seekInfo = new _abProto.SeekInfo();
		seekInfo.setStart(seekStart);
		seekInfo.setStop(seekStop);
		// BLOCK_UNTIL_READY will mean hold the stream open and keep sending as
		//     the blocks come in
		// FAIL_IF_NOT_READY will mean if the block is not there throw an error
		seekInfo.setBehavior(_abProto.SeekInfo.SeekBehavior.BLOCK_UNTIL_READY);
		let tx_id = this._clientContext.newTransactionID();
		let signer = this._clientContext._getSigningIdentity();

		// build the header for use with the seekInfo payload
		let seekInfoHeader = clientUtils.buildChannelHeader(
			_commonProto.HeaderType.DELIVER_SEEK_INFO,
			this._channel._name,
			tx_id.getTransactionID(),
			this._initial_epoch
		);

		let seekHeader = clientUtils.buildHeader(signer, seekInfoHeader, tx_id.getNonce());
		let seekPayload = new _commonProto.Payload();
		seekPayload.setHeader(seekHeader);
		seekPayload.setData(seekInfo.toBuffer());
		let seekPayloadBytes = seekPayload.toBuffer();

		let sig = signer.sign(seekPayloadBytes);
		let signature = Buffer.from(sig);

		// building manually or will get protobuf errors on send
		let envelope = {
			signature: signature,
			payload : seekPayloadBytes
		};

		this._stream.write(envelope);
	}

	/*
	 * Internal method
	 * Will close out all callbacks
	 * Sends an error to all registered event "onError" callbacks
	 */
	_closeAllCallbacks(err) {
		logger.debug('_closeAllCallbacks - start');

		let closer = function(list) {
			for (let key in list) {
				let cb = list[key];
				logger.debug('_closeAllCallbacks - closing this callback %s',key);
				cb(err);
			}
		};

		logger.debug('_closeAllCallbacks - blockOnErrors %s', Object.keys(this._blockOnErrors).length);
		closer(this._blockOnErrors);
		this._blockOnEvents = {};
		this._blockOnErrors = {};

		logger.debug('_closeAllCallbacks - transactionOnErrors %s', Object.keys(this._transactionOnErrors).length);
		closer(this._transactionOnErrors);
		this._transactionOnEvents = {};
		this._transactionOnErrors = {};

		let self = this;
		let cc_closer = function(key) {
			let cbtable = self._chaincodeRegistrants[key];
			cbtable.forEach(function(cbe) {
				logger.debug('_closeAllCallbacks - closing this chaincode event ccid:%s eventNameFilter:%s',cbe.ccid, cbe.eventNameFilter);
				if(cbe.onError) {
					cbe.onError(err);
				}
			});
		};

		logger.debug('_closeAllCallbacks - chaincodeRegistrants %s', Object.keys(this._chaincodeRegistrants).length);
		Object.keys(this._chaincodeRegistrants).forEach(cc_closer);
		this._chaincodeRegistrants = {};
	}

	/*
	 * Internal method
	 * checks that only one registration for resume and replay
	 * Will reconnect if the connect has already run
	 */
	 _checkStartBlock(start_block) {
		let have_start_block = false;
		let converted_start_block = null;
		if(typeof start_block !== 'undefined' && start_block != null) {
			if(Number.isInteger(start_block)) {
				have_start_block = true;
				converted_start_block = Long.fromValue(start_block);
			} else {
				throw new Error('start_block parameter must be valid integer ::' + start_block);
			}
		}
		if(have_start_block && this._haveRegistrations()) {
			logger.error('This eventhub is already registered with active listeners. Not able to resume events with start_block:',start_block);
			throw new Error('Only one event registration is allowed when replaying events');
		}
		return converted_start_block;
	}

	_checkReplayStart(start_block) {
		this._starting_block_number = start_block;
		if(this._connect_running || this._connected) {
			logger.debug('This eventhub is connecting or has already connected to the peer eventhub');
			// need to close down the current connection and reset
			this._shutdown();
			// now restart
			this._checkConnection(false, true);
		}
	}

	 _haveRegistrations() {
		 let count = 0;
		 count = count + Object.keys(this._chaincodeRegistrants).length;
		 count = count + Object.keys(this._blockOnEvents).length;
		 count = count + Object.keys(this._transactionOnEvents).length;
		 if( count > 0) {
			 return true;
		 }
		 return false;
	 }
	/*
	 * Internal method
	 * checks for a connection and will restart
	 */
	_checkConnection(throw_error, force_reconnect) {
		logger.debug('_checkConnection - start throw_error %s, force_reconnect %s',throw_error, force_reconnect);
		let state = getStreamState(this);
		logger.debug('_checkConnection -  connected:this hub %s is connected or trying to connect with stream channel state %s', this._peer.getUrl(), getStateText(state));

		if(this._connected || this._connect_running) {
		}
		else {
			logger.debug('_checkConnection - this hub %s is not connected with stream channel state %s', this._peer.getUrl(), state);
			if(throw_error && !force_reconnect) {
				throw new Error('The event hub has not been connected to the event source');
			}
		}

		//reconnect will only happen when there is error callback
		if(force_reconnect) {
			try {
				if(this._stream) {
					let is_paused = this._stream.isPaused();
					logger.debug('_checkConnection - grpc isPaused :%s',is_paused);
					if(is_paused) {
						this._stream.resume();
						logger.debug('_checkConnection - grpc resuming ');
					}
					let state = getStreamState(this);
					logger.debug('_checkConnection - grpc stream state :%s',state);
					if(state != 2) {
						// try to reconnect
						this._connect(true);
					}
				}
				else {
					logger.debug('_checkConnection - stream was shutdown - will reconnected');
					// try to reconnect
					this._connect(true);
				}
			}
			catch(error) {
				logger.error('_checkConnection - error ::' + error.stack ? error.stack : error);
				let err = new Error('Problem during reconnect and the event hub is not connected ::%s',error);
				this._disconnect(err);
			}
		}
	}

	/**
	 * @typedef {Object} ChaincodeEvent
	 * @property {string} chaincode_id
     * @property {string} tx_id
     * @property {string} event_name
     * @property {byte[]} payload - Application-specific byte array that the chaincode set
     *                              when it called <code>stub.SetEvent(event_name, payload)</code>
	 */

	/**
	 * Register a listener to receive chaincode events.
	 * <br><br>
	 * An error may be thrown by this call if no "onError" callback
	 * is provided and this EventHub has noticed that the connection has not been
	 * established. However since the connection establishment is running
	 * asynchronously, a register call could be made before this EventHub has been
	 * notified of the network issue. The best practice would be to provide an
	 * "onError" callback to be notified when this EventHub has an issue.
	 *
	 * @param {string} ccid - Id of the chaincode of interest
	 * @param {string} eventname - The exact name of the chaincode event (must match
	 *                             the name given to the target chaincode's call to
	 *                             <code>stub.SetEvent(name, payload)</code>), or a
	 *                             regex string to match more than one event by this
	 *                             chaincode
	 * @param {function} onEvent - callback function for matched events. It gets passed
	 *                             a two parameters, a {@link ChaincodeEvent} object and
	 *                             the block number this transaction was committed to the ledger
	 * @param {function} onError - Optional callback function to be notified when this event hub
	 *                             is shutdown. The shutdown may be caused by a network error or by
	 *                             a call to the "disconnect()" method or a connection error.
	 * @param {Long} start_block - Optional - The starting block number for event checking.
	 *                             When included the event service will be ask to start sending
	 *                             blocks from this block. This would be how to resume and replay
	 *                             missed blocks that were added to the ledger. Since replaying
	 *                             events may confuse other event listeners, only one listener
	 *                             will be allowed on a ChannelEventHub when resume and replay
	 *                             is being used.
	 * @returns {Object} An object that should be treated as an opaque handle used
	 *                   to unregister (see unregisterChaincodeEvent)
	 */
	registerChaincodeEvent(ccid, eventname, onEvent, onError, start_block) {
		logger.debug('registerChaincodeEvent - start %s', start_block);
		if(!ccid) {
			throw new Error('Missing "ccid" parameter');
		}
		if(!eventname) {
			throw new Error('Missing "eventname" parameter');
		}
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		let have_error_cb = onError ? true : false;
		// when there is no error callback throw an error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);

		start_block = this._checkStartBlock(start_block);
		let cbe = new ChainCodeCBE(ccid, eventname, onEvent, onError);
		let cbtable = this._chaincodeRegistrants[ccid];
		if (!cbtable) {
			cbtable = new Set();
			this._chaincodeRegistrants[ccid] = cbtable;
		}
		cbtable.add(cbe);

		if(start_block){
			this._checkReplayStart(start_block);
			logger.debug('registerChaincode - Chaincode Event replay will start at block %s', start_block);
		}
		// when there is an error callback try to reconnect this
		// event hub if is not connected
		else if(have_error_cb) {
			this._checkConnection(false, this._force_reconnect);
		}

		return cbe;
	}

	/**
	 * Unregister the chaincode event listener represented by
	 * the <code>listener_handle</code> object returned by
	 * the registerChaincodeEvent() method
	 *
	 * @param {Object} listener_handle - The handle object returned from the call to
	 *                                   registerChaincodeEvent.
	 */
	unregisterChaincodeEvent(listener_handle) {
		logger.debug('unregisterChaincodeEvent - start');
		if(!listener_handle) {
			throw new Error('Missing "listener_handle" parameter');
		}
		let cbtable = this._chaincodeRegistrants[listener_handle.ccid];
		if (!cbtable) {
			logger.debug('No event registration for ccid %s ', listener_handle.ccid);
			return;
		}
		cbtable.delete(listener_handle);
		if (cbtable.size <= 0) {
			delete this._chaincodeRegistrants[listener_handle.ccid];
		}
	}

	/**
	 * Register a listener to receive all block events <b>from all the channels</b> that
	 * the target peer is part of. The listener's "onEvent" callback gets called
	 * on the arrival of every block. If the target peer is expected to participate
	 * in more than one channel, then care must be taken in the listener's implementation
	 * to differentiate blocks from different channels. See the example below on
	 * how to accomplish that.
	 * <br><br>
	 * An error may be thrown by this call if no "onError" callback
	 * is provided and this EventHub has noticed that the connection has not been
	 * established. However since the connection establishment is running
	 * asynchronously, a register call could be made before this EventHub has been
	 * notified of the network issue. The best practice would be to provide an
	 * "onError" callback to be notified when this EventHub has an issue.
	 *
	 * @param {function} onEvent - Callback function that takes a single parameter
	 *                             of a {@link Block} object
	 * @param {function} onError - Optional callback function to be notified when this event hub
	 *                             is shutdown. The shutdown may be caused by a network error or by
	 *                             a call to the "disconnect()" method or a connection error.
	 * @param {Long} start_block - Optional - The starting block number for event checking.
	 *                             When included the event service will be ask to start sending
	 *                             blocks from this block. This would be how to resume and replay
	 *                             missed blocks that were added to the ledger. Since replaying
	 *                             events may confuse other event listeners, only one listener
	 *                             will be allowed on a ChannelEventHub when resume and replay
	 *                             is being used.
	 * @returns {int} This is the block registration number that must be
	 *                sed to unregister (see unregisterBlockEvent)
	 *
	 * @example <caption>Find out the channel Id of the arriving block</caption>
	 * eh.registerBlockEvent(
	 *   (block) => {
	 *     let first_tx = block.data.data[0]; // get the first transaction
	 *     let header = first_tx.payload.header; // the "header" object contains metadata of the transaction
	 *     let channel_id = header.channel_header.channel_id;
	 *     if ("mychannel" !== channel_id) return;
	 *
	 *     // do useful processing of the block
	 *   },
	 *   (err) => {
	 *     console.log('Oh snap!');
	 *   }
	 * );
	 */
	registerBlockEvent(onEvent, onError, start_block) {
		logger.debug('registerBlockEvent - start %s', start_block);
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		let have_error_cb = onError ? true : false;
		// when there is no error callback throw and error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);
		start_block = this._checkStartBlock(start_block);

		let block_registration_number = this._block_registrant_count++;
		this._blockOnEvents[block_registration_number] = onEvent;

		if(start_block){
			if(have_error_cb) {
				this._blockOnErrors[block_registration_number] = onError;
			}
			this._checkReplayStart(start_block)
			logger.debug('registerBlockEvent - Block Event replay will start at block %s', start_block);
		}
		// when there is an error callback try to reconnect this
		// event hub if is not connected
		else if(have_error_cb) {
			this._blockOnErrors[block_registration_number] = onError;
			this._checkConnection(false, this._force_reconnect);
		}

		return block_registration_number;
	}

	/**
	 * Unregister the block event listener using the block
	 * registration number that is returned by the call to
	 * the registerBlockEvent() method.
	 *
	 * @param {int} The block registration number that was returned
	 *              during registration.
	 */
	unregisterBlockEvent(block_registration_number) {
		logger.debug('unregisterBlockEvent - start  %s',block_registration_number);
		if(!block_registration_number) {
			throw new Error('Missing "block_registration_number" parameter');
		}
		delete this._blockOnEvents[block_registration_number];
		delete this._blockOnErrors[block_registration_number];
	}

	/**
	 * Register a callback function to receive a notification when the transaction
	 * by the given id has been committed into a block.
	 * <br><br>
	 * An error may be thrown by this call if no "onError" callback
	 * is provided and this EventHub has noticed that the connection has not been
	 * established. However since the connection establishment is running
	 * asynchronously, a register call could be made before this EventHub has been
	 * notified of the network issue. The best practice would be to provide an
	 * "onError" callback to be notified when this EventHub has an issue.
	 *
	 * @param {string} txid - Transaction id string
	 * @param {function} onEvent - Callback function that takes a parameter of transaction ID,
	 *                             a string parameter indicating the transaction status,
	 *                             and the block number this transaction was committed to the ledger
	 * @param {function} onError - Optional callback function to be notified when this event hub
	 *                             is shutdown. The shutdown may be caused by a network error or by
	 *                             a call to the "disconnect()" method or a connection error.
	 * @param {Long} start_block - Optional - The starting block number for event checking.
	 *                             When included the event service will be ask to start sending
	 *                             blocks from this block. This would be how to resume and replay
	 *                             missed blocks that were added to the ledger. Since replaying
	 *                             events may confuse other event listeners, only one listener
	 *                             will be allowed on a ChannelEventHub when resume and replay
	 *                             is being used.
	 */
	registerTxEvent(txid, onEvent, onError, start_block) {
		logger.debug('registerTxEvent start - txid:%s - start_block:%s', txid, start_block);
		if(!txid) {
			throw new Error('Missing "txid" parameter');
		}
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		let have_error_cb = onError ? true : false;
		// when there is no onError callback throw and error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);
		start_block = this._checkStartBlock(start_block);

		this._transactionOnEvents[txid] = onEvent;

		if(start_block){
			if(have_error_cb) {
				this._transactionOnErrors[txid] = onError;
			}
			this._checkReplayStart(start_block);
			logger.debug('registerTxEvent - Transaction Event replay will start at block %s', start_block);
		}
		// when there is an onError callback try to reconnect this
		// event hub if is not connected
		else if(have_error_cb) {
			this._transactionOnErrors[txid] = onError;
			this._checkConnection(false, this._force_reconnect);
		}
	}

	/**
	 * Unregister transaction event listener for the transaction id.
	 * @param {string} txid - The transaction id
	 */
	unregisterTxEvent(txid) {
		logger.debug('unregisterTxEvent txid ' + txid);
		if(!txid) {
			throw new Error('Missing "txid" parameter');
		}
		delete this._transactionOnEvents[txid];
		delete this._transactionOnErrors[txid];
	}

	/*
	 * private internal method for processing block events
	 * @param {Object} block protobuf object
	 */
	_processBlockOnEvents(block) {
		logger.debug('_processBlockOnEvents block=%s', block.header.number);
		if(Object.keys(this._blockOnEvents).length == 0) {
			logger.debug('_processBlockOnEvents - no registered block event "listeners"');
			return;
		}

		// send to all registered block listeners
		let self = this;
		Object.keys(this._blockOnEvents).forEach(function(key) {
			let cb = self._blockOnEvents[key];
			logger.debug('_processBlockOnEvents - calling block listener callback');
			cb(block);
		});
	}

	/*
	 * private internal method for processing tx events
	 * @param {Object} block protobuf object which might contain the tx from the fabric
	 */
	_processTxOnEvents(block) {
		logger.debug('_processTxOnEvents block=%s', block.header.number);
		if(Object.keys(this._transactionOnEvents).length == 0) {
			logger.debug('_processTxOnEvents - no registered transaction event "listeners"');
			return;
		}

		let txStatusCodes = block.metadata.metadata[_commonProto.BlockMetadataIndex.TRANSACTIONS_FILTER];

		for (let index=0; index < block.data.data.length; index++) {
			logger.debug('_processTxOnEvents - trans index=%s',index);
			let channel_header = block.data.data[index].payload.header.channel_header;
			let val_code = convertValidationCode(txStatusCodes[index]);
			logger.debug('_processTxOnEvents - txid=%s  val_code=%s', channel_header.tx_id, val_code);
			let cb = this._transactionOnEvents[channel_header.tx_id];
			if (cb){
				logger.debug('_processTxOnEvents - about to call the transaction call back for code=%s tx=%s', val_code, channel_header.tx_id);
				cb(channel_header.tx_id, val_code, block.header.number);
			} else {
				logger.debug('_processTxOnEvents - no call backs found for this transaction %s', channel_header.tx_id);
			}
		}
	};

	/*
	 * private internal method for processing chaincode events
	 * @param {Object} block protobuf object which might contain the chaincode event from the fabric
	 */
	_processChainCodeOnEvents(block) {
		logger.debug('_processChainCodeOnEvents block=%s', block.header.number);
		if(Object.keys(this._chaincodeRegistrants).length == 0) {
			logger.debug('_processChainCodeOnEvents - no registered chaincode event "listeners"');
			return;
		}

		for (let index=0; index < block.data.data.length; index++) {
			logger.debug('_processChainCodeOnEvents - trans index=%s',index);
			try {
				let env = block.data.data[index];
				let payload = env.payload;
				let channel_header = payload.header.channel_header;
				if (channel_header.type === 3) { //only ENDORSER_TRANSACTION have chaincode events
					let tx = payload.data;
					let chaincodeActionPayload = tx.actions[0].payload;
					let propRespPayload = chaincodeActionPayload.action.proposal_response_payload;
					let caPayload = propRespPayload.extension;
					let ccEvent = caPayload.events;
					logger.debug('_processChainCodeOnEvents - ccEvent %s',ccEvent);
					let cbtable = this._chaincodeRegistrants[ccEvent.chaincode_id];
					if (!cbtable) {
						logger.debug('_processChainCodeOnEvents - no chaincode listeners found');
						return;
					}
					cbtable.forEach(function(cbe) {
						if (cbe.eventNameFilter.test(ccEvent.event_name)) {
							logger.debug('_processChainCodeOnEvents - calling chaincode listener callback');
							cbe.onEvent(ccEvent, block.header.number);
						} else {
							logger.debug('_processChainCodeOnEvents - NOT calling chaincode listener callback');
						}
					});
				} else {
					logger.debug('_processChainCodeOnEvents - block is not endorser transaction type')
				}
			} catch (err) {
				logger.error('on.data - Error unmarshalling transaction=', err);
			}
		}
	};
};
module.exports = ChannelEventHub;

function convertValidationCode(code) {
	return _validation_codes[code];
}

/*
 * Utility method to get the state of the GRPC stream
 */
function getStreamState(self) {
	let state = -1;
	if(self._stream && self._stream.call && self._stream.call.channel_) {
		state = self._stream.call.channel_.getConnectivityState();
	}

	return state;
}

/*
 * Utility method to get the string state from an integer
 */
 function getStateText(state) {
	 let result = null;
	 try {
		 result = CONNECTION_STATE[state];
	 } catch(error) {
		 logger.error('Connection state conversion - unknown state - %s',state);
	 }
	 if(!result) {
		 result = 'UNKNOWN_STATE';
	 }
	 return result;
 }
/*
 * The ChainCodeCBE is used internal to the EventHub to hold chaincode
 * event registration callbacks.
 */
var ChainCodeCBE = class {
	/*
	 * Constructs a chaincode callback entry
	 *
	 * @param {string} ccid - chaincode id
	 * @param {string} eventNameFilter - The regex used to filter events
	 * @param {function} onEvent - Callback for filter matches
	 * @param {function} onError - Callback for connection errors
	 */
	constructor(ccid, eventNameFilter, onEvent, onError) {
		// chaincode id
		this.ccid = ccid;
		// event name regex filter
		this.eventNameFilter = new RegExp(eventNameFilter);
		// callback function to invoke on successful filter match
		this.onEvent = onEvent;
		// callback function to invoke on a connection failure
		this.onError = onError;
	}
};
