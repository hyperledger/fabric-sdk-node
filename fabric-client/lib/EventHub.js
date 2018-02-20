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

var utils = require('./utils.js');
var Remote = require('./Remote.js');
var BlockDecoder = require('./BlockDecoder.js');
var clientUtils = require('./client-utils.js');
var grpc = require('grpc');
var logger = utils.getLogger('EventHub.js');

var _events = grpc.load(__dirname + '/protos/peer/events.proto').protos;
var _common = grpc.load(__dirname + '/protos/common/common.proto').common;
var _ccTransProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/protos/peer/transaction.proto').protos;
var _responseProto = grpc.load(__dirname + '/protos/peer/proposal_response.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/protos/peer/proposal.proto').protos;
var _ccEventProto = grpc.load(__dirname + '/protos/peer/chaincode_event.proto').protos;
const five_minutes_ms = 5*60*1000;

var _validation_codes = {};
var keys = Object.keys(_transProto.TxValidationCode);
for(var i = 0;i<keys.length;i++) {
	let new_key = _transProto.TxValidationCode[keys[i]];
	_validation_codes[new_key] = keys[i];
}

var _header_types = {};
keys = Object.keys(_common.HeaderType);
for(var j in keys) {
	let new_key = _common.HeaderType[keys[j]];
	_header_types[new_key] = keys[j];
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

/**
 * Transaction processing in fabric v1.0 is a long operation spanning multiple
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
 * Fabric committing peers provides an event stream to publish events to registered
 * listeners. As of v1.0, the only events that get published are Block events. A
 * Block event gets published whenever the committing peer adds a validated block
 * to the ledger. There are three ways to register a listener to get notified:
 * <li>register a "block listener" to get called for every block event on all channels. The listener
 *     will be passed a fully decoded {@link Block} object. See [registerBlockEvent]{@link EventHub#registerBlockEvent}
 * <li>register a "transaction listener" to get called when the specific transaction
 *     by id is committed (discovered inside a block event). The listener will be
 *     passed the transaction id and the [validation code]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/transaction.proto#L125}.
 *     See [registerTxEvent]{@link EventHub#registerTxEvent}
 * <li>register a "chaincode event listener" to get called when a specific
 *     [chaincode event]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/examples/chaincode/go/eventsender/eventsender.go#L65}
 *     has arrived. The listener will be passed the {@link ChaincodeEvent}. See
 *     [registerChaincodeEvent]{@link EventHub#registerChaincodeEvent}
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
 * <ul>
 *     <li>Node.js: this class. Source code can be found [here]{@link https://github.com/hyperledger/fabric-sdk-node/blob/v1.0.0/fabric-client/lib/EventHub.js}
 *     <li>Java: part of the Java SDK for Hyperledger Fabric. Source code can be found [here]{@link https://github.com/hyperledger/fabric-sdk-java/blob/v1.0.0/src/main/java/org/hyperledger/fabric/sdk/EventHub.java}
 *     <li>Golang: an example event listener client can be found [here]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/examples/events/block-listener/block-listener.go}
 * </ul>
 *
 * @example
 * var eh = client.newEventHub();
 * eh.setPeerAddr(
 * 	 'grpcs://localhost:7053',
 * 	 {
 * 	   pem: Buffer.from(certdata).toString(),
 * 	   'ssl-target-name-override': 'peer1']
 * 	 }
 * );
 *
 * // register the listeners before calling "connect()" so that we can
 * // have the error callback ready to process an error in case the
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
var EventHub = class {

	/**
	 * Constructs an EventHub object
	 *
	 * @param {Client} clientContext - An instance of the Client class
	 * which has already been initialzed with a userContext.
	 * @returns {EventHub} An instance of this class
	 */

	constructor(clientContext) {
		logger.debug('const ');
		// hashtable of clients registered for chaincode events
		this._chaincodeRegistrants = {};
		// set of clients registered for block events
		this._block_registrant_count = 1;
		this._blockOnEvents = {};
		this._blockOnErrors = {};
		// hashtable of clients registered for transactional events
		this._transactionOnEvents = {};
		this._transactionOnErrors = {};
		// peer node to connect to
		this._ep = null;
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
		// reference to the client instance holding critical context such as signing identity
		if (typeof clientContext === 'undefined' || clientContext === null || clientContext === '')
			throw new Error('Missing required argument: clientContext');

		this._clientContext = clientContext;
	}

	/**
	 * @typedef {Object} EventRegistrationRequest
	 */

	/**
	 * Set peer event source url.
	 *
	 * @param {string} peeraddr - grpc or grpcs URL for the target peer's event source
	 * @param {ConnectionOpts} opts - The options for the connection to the peer.
	 */
	setPeerAddr(peerUrl, opts) {
		logger.debug('setPeerAddr -  %s',peerUrl);
		//clean up
		this._disconnect(new Error('EventHub has been shutdown due to new Peer address assignment'));
		this._ep = new Remote(peerUrl, opts);
	}

	/**
	 * Return the peer url of this event hub object
	 */
	getPeerAddr() {
		var addr = null;
		if(this._ep) {
			addr = this._ep._endpoint.addr;
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

		if (typeof this._clientContext.getUserContext() === 'undefined' || this._clientContext.getUserContext() === null)
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
			logger.debug('_connect - end - already conneted');
			return;
		}
		if (!this._ep) throw Error('Must set peer address before connecting.');

		this._connect_running = true;
		this._current_stream++;
		var stream_id = this._current_stream;
		logger.debug('_connect - start stream:',stream_id);
		var self = this; // for callback context

		var send_timeout = setTimeout(function(){
			logger.error('_connect - timed out after:%s', self._ep._request_timeout);
			self._connect_running = false;
			self._disconnect(new Error('Unable to connect to the peer event hub'));
		}, self._ep._request_timeout);

		// check on the keep alive options
		// the keep alive interval
		var options = utils.checkAndAddConfigSetting('grpc.http2.keepalive_time', 360, this._ep._options); //grpc 1.2.4
		options = utils.checkAndAddConfigSetting('grpc.keepalive_time_ms', 360000, options); //grpc 1.3.7
		// how long should we wait for the keep alive response
		let request_timeout_ms = utils.getConfigSetting('request-timeout', 3000);
		let request_timeout = request_timeout_ms / 1000;
		options = utils.checkAndAddConfigSetting('grpc.http2.keepalive_timeout', request_timeout, options); //grpc 1.2.4
		options = utils.checkAndAddConfigSetting('grpc.keepalive_timeout_ms', request_timeout_ms, options); //grpc 1.3.7
		options = utils.checkAndAddConfigSetting('grpc.http2.min_time_between_pings_ms', five_minutes_ms, options); //default 5

		logger.debug('_connect - options %j', options);
		this._event_client = new _events.Events(this._ep._endpoint.addr, this._ep._endpoint.creds, options);
		this._stream = this._event_client.chat();

		this._stream.on('data', function(event) {
			self._connect_running = false;
			clearTimeout(send_timeout);
			logger.debug('on.data - event stream:%s _current_stream:%s',stream_id, self._current_stream);
			if(stream_id != self._current_stream) {
				logger.debug('on.data - incoming event was from a cancel stream');
				return;
			}

			var state = -1;
			if(self._stream) state = self._stream.call.channel_.getConnectivityState();
			logger.debug('on.data - grpc stream state :%s',state);
			if (event.Event == 'block') {
				var block = BlockDecoder.decodeBlock(event.block);
				self._processBlockOnEvents(block);
				self._processTxOnEvents(block);
				self._processChainCodeOnEvents(block);
			}
			else if (event.Event == 'register'){
				logger.debug('on.data - register event received');
				self._connected = true;
			}
			else if (event.Event == 'unregister'){
				if(self._connected) self._disconnect(new Error('Peer event hub has disconnected due to an "unregister" event'));
				logger.debug('on.data - unregister event received');
			}
			else {
				logger.debug('on.data - unknown event %s',event.Event);
			}
		});

		this._stream.on('end', function() {
			self._connect_running = false;
			clearTimeout(send_timeout);
			logger.debug('on.end - event stream:%s _current_stream:%s',stream_id, self._current_stream);
			if(stream_id != self._current_stream) {
				logger.debug('on.end - incoming event was from a canceled stream');
				return;
			}

			var state = -1;
			if(self._stream) state = self._stream.call.channel_.getConnectivityState();
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

			var state = -1;
			if(self._stream) state = self._stream.call.channel_.getConnectivityState();
			logger.debug('on.error - grpc stream state :%s',state);
			if(err instanceof Error) {
				self._disconnect(err);
			}
			else {
				self._disconnect(new Error(err));
			}
		});

		this._sendRegistration(true);
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
		this._connected = false;
		this._closeAllCallbacks(err);
		if(this._stream) {
			logger.debug('_disconnect - shutdown existing stream');
			this._sendRegistration(false);
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
	_sendRegistration(register) {
		var user = this._clientContext.getUserContext();
		var signedEvent = new _events.SignedEvent();
		var event = new _events.Event();
		var reg = {events: [{event_type: 'BLOCK'}]};

		if(register) {
			event.setRegister(reg);
		}
		else {
			event.setUnregister(reg);
		}

		event.setCreator(user.getIdentity().serialize());
		event.setTimestamp(clientUtils.buildCurrentTimestamp());
		let client_cert_hash = this._ep.getClientCertHash();
		if(client_cert_hash) {
			event.setTlsCertHash(client_cert_hash);
		}
		signedEvent.setEventBytes(event.toBuffer());
		var sig = user.getSigningIdentity().sign(event.toBuffer());
		signedEvent.setSignature(Buffer.from(sig));
		this._stream.write(signedEvent);
	}

	/*
	 * Internal method
	 * Will close out all callbacks
	 * Sends an error to all registered event "onError" callbacks
	 */
	_closeAllCallbacks(err) {
		logger.debug('_closeAllCallbacks - start');

		var closer = function(list) {
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

		var self = this;
		var cc_closer = function(key) {
			var cbtable = self._chaincodeRegistrants[key];
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
	 * checks for a connection and will restart
	 */
	_checkConnection(throw_error, force_reconnect) {
		logger.debug('_checkConnection - start throw_error %s, force_reconnect %s',throw_error, force_reconnect);
		var state = 0;
		if(this._stream) {
			state = this._stream.call.channel_.getConnectivityState();
		}
		if(this._connected || this._connect_running) {
			logger.debug('_checkConnection - this hub %s is connected or trying to connect with stream channel state %s', this._ep.getUrl(), state);
		}
		else {
			logger.debug('_checkConnection - this hub %s is not connected with stream channel state %s', this._ep.getUrl(), state);
			if(throw_error && !force_reconnect) {
				throw new Error('The event hub has not been connected to the event source');
			}
		}

		//reconnect will only happen when there is error callback
		if(force_reconnect) {
			try {
				if(this._stream) {
					var is_paused = this._stream.isPaused();
					logger.debug('_checkConnection - grpc isPaused :%s',is_paused);
					if(is_paused) {
						this._stream.resume();
						logger.debug('_checkConnection - grpc resuming ');
					}
					var state = this._stream.call.channel_.getConnectivityState();
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
				var err = new Error('Event hub is not connected ');
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
	 *                             a single parameter which is a {@link ChaincodeEvent} object
	 * @param {function} onError - Optional callback function to be notified when this event hub
	 *                             is shutdown. The shutdown may be caused by a network error or by
	 *                             a call to the "disconnect()" method or a connection error.
	 * @returns {Object} An object that should be treated as an opaque handle used
	 *                   to unregister (see unregisterChaincodeEvent)
	 */
	registerChaincodeEvent(ccid, eventname, onEvent, onError) {
		logger.debug('registerChaincodeEvent - start');
		if(!ccid) {
			throw new Error('Missing "ccid" parameter');
		}
		if(!eventname) {
			throw new Error('Missing "eventname" parameter');
		}
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		var have_error_cb = onError ? true : false;
		// when there is no error callback throw an error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);

		var cbe = new ChainCodeCBE(ccid, eventname, onEvent, onError);
		var cbtable = this._chaincodeRegistrants[ccid];
		if (!cbtable) {
			cbtable = new Set();
			this._chaincodeRegistrants[ccid] = cbtable;
		}
		cbtable.add(cbe);

		// when there is an error callback try to reconnect this
		// event hub if is not connected
		if(have_error_cb) {
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
		var cbtable = this._chaincodeRegistrants[listener_handle.ccid];
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
	 * @returns {int} This is the block registration number that must be
	 *                sed to unregister (see unregisterBlockEvent)
	 *
	 * @example <caption>Find out the channel Id of the arriving block</caption>
	 * eh.registerBlockEvent(
	 *   (block) => {
	 *     var first_tx = block.data.data[0]; // get the first transaction
	 *     var header = first_tx.payload.header; // the "header" object contains metadata of the transaction
	 *     var channel_id = header.channel_header.channel_id;
	 *     if ("mychannel" !== channel_id) return;
	 *
	 *     // do useful processing of the block
	 *   },
	 *   (err) => {
	 *     console.log('Oh snap!');
	 *   }
	 * );
	 */
	registerBlockEvent(onEvent, onError) {
		logger.debug('registerBlockEvent - start');
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		var have_error_cb = onError ? true : false;
		// when there is no error callback throw and error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);

		var block_registration_number = this._block_registrant_count++;
		this._blockOnEvents[block_registration_number] = onEvent;

		// when there is an error callback try to reconnect this
		// event hub if is not connected
		if(have_error_cb) {
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
	 * @param {function} onEvent - Callback function that takes a parameter of type
	 *                             {@link Transaction}, and a string parameter which
	 *                             indicates if the transaction is valid (code = 'VALID'),
	 *                             or not (code string indicating the reason for invalid transaction)
	 * @param {function} onError - Optional callback function to be notified when this event hub
	 *                             is shutdown. The shutdown may be caused by a network error or by
	 *                             a call to the "disconnect()" method or a connection error.
	 */
	registerTxEvent(txid, onEvent, onError) {
		logger.debug('registerTxEvent txid ' + txid);
		if(!txid) {
			throw new Error('Missing "txid" parameter');
		}
		if(!onEvent) {
			throw new Error('Missing "onEvent" parameter');
		}
		var have_error_cb = onError ? true : false;
		// when there is no onError callback throw and error
		// when this hub is not connected
		this._checkConnection(!have_error_cb, false);

		this._transactionOnEvents[txid] = onEvent;

		// when there is an onError callback try to reconnect this
		// event hub if is not connected
		if(have_error_cb) {
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
			var cb = self._blockOnEvents[key];
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

		var txStatusCodes = block.metadata.metadata[_common.BlockMetadataIndex.TRANSACTIONS_FILTER];

		for (var index=0; index < block.data.data.length; index++) {
			logger.debug('_processTxOnEvents - trans index=%s',index);
			var channel_header = block.data.data[index].payload.header.channel_header;
			var val_code = convertValidationCode(txStatusCodes[index]);
			logger.debug('_processTxOnEvents - txid=%s  val_code=%s', channel_header.tx_id, val_code);
			var cb = this._transactionOnEvents[channel_header.tx_id];
			if (cb){
				logger.debug('_processTxOnEvents - about to stream the transaction call back for code=%s tx=%s', val_code, channel_header.tx_id);
				cb(channel_header.tx_id, val_code);
			}
		}
	}

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

		for (var index=0; index < block.data.data.length; index++) {
			logger.debug('_processChainCodeOnEvents - trans index=%s',index);
			try {
				var env = block.data.data[index];
				var payload = env.payload;
				var channel_header = payload.header.channel_header;
				if (channel_header.type === 3) {
					var tx = payload.data;
					var chaincodeActionPayload = tx.actions[0].payload;
					var propRespPayload = chaincodeActionPayload.action.proposal_response_payload;
					var caPayload = propRespPayload.extension;
					var ccEvent = caPayload.events;
					logger.debug('_processChainCodeOnEvents - ccEvent %s',ccEvent);
					var cbtable = this._chaincodeRegistrants[ccEvent.chaincode_id];
					if (!cbtable) {
						return;
					}
					cbtable.forEach(function(cbe) {
						if (cbe.eventNameFilter.test(ccEvent.event_name)) {
							cbe.onEvent(ccEvent);
						}
					});
				}
			} catch (err) {
				logger.error('on.data - Error unmarshalling transaction=', err);
			}
		}
	}
};

function convertValidationCode(code) {
	return _validation_codes[code];
}

module.exports = EventHub;
