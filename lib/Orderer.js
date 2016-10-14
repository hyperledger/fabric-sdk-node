/*
 Copyright 2016 IBM All Rights Reserved.

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

var api = require('./api.js');
var utils = require('./utils.js');

var grpc = require('grpc');
var debugModule = require('debug');
var debug = debugModule('hfc');
var isDebug = debugModule.enabled('hfc');

var _abProto = grpc.load(__dirname + '/protos/atomicbroadcast/ab.proto').atomicbroadcast;

/**
 * The Orderer class represents a peer in the target blockchain network to which
 * HFC sends a block of transactions of endorsed proposals requiring ordering.
 *
 * @class
 */
var Orderer = class {

	/**
	 * Constructs an Orderer given its endpoint configuration settings.
	 *
	 * @param {string} url The orderer URL with format of 'grpcs://host:port'.
	 * @param {Chain} chain The chain of which this orderer is a member.
	 * @param {string} pem The certificate file, in PEM format,
	 * to use with the gRPC protocol (that is, with TransportCredentials).
	 * Required when using the grpcs protocol.
	 */
	constructor(url, chain, pem) {
		if(isDebug) debug('Orderer.constructor');

		this._url = url;
		this._chain = chain;

		// Orderer service connection
		this._epOrderer = new utils.Endpoint(url, pem);
		this._ordererClient = new _abProto.AtomicBroadcast(this._epOrderer.addr, this._epOrderer.creds);
	}

	/**
	 * Get the Chain of the orderer.
	 * @returns {Chain} Get the Chain associated with the Orderer.
	 */
	getChain() {
		if(isDebug) debug('Orderer.getChain::'+this._chain);
		return this._chain;
	}


	/**
	 * Get the URL of the orderer.
	 * @returns {string} Get the URL associated with the Orderer.
	 */
	getUrl() {
		if(isDebug) debug('Orderer.getUrl::'+this._url);
		return this._url;
	}

	/**
	 * Send a BroadcastMessage to the orderer service.
	 *
	 * @param {Object} data to be included in the BroadcastMessage
	 *        see the ./proto/atomicbroadcast/ab.proto
	 * @returns Promise for a BroadcastResponse
	 *        see the ./proto/atomicbroadcast/ab.proto
	 */
	sendBroadcast(send_data) {
		if(isDebug) debug('Orderer.sendBroadcast - start');

		if(!send_data || send_data == '') {
			if(isDebug) debug('Orderer.sendBroadcast ERROR - missing data');
			var err = new Error('Missing data - Nothing to order');
			return Promise.reject(err);
		}

		var self = this;
		var data = new Buffer(send_data);

		// Build up the broadcast message
		// This will be fleshed out we add more functionality and send fully
		// structured requests, with all fields filled in.
		var _broadcastMessage = {Data: data};

		if(isDebug) debug('Orderer.sendBroadcast - _broadcastMessage = ' + JSON.stringify(_broadcastMessage));

		// Send the endorsed proposals to the peer node (orderer) via grpc
		// The rpc specification on the peer side is:
		// rpc Broadcast(stream BroadcastMessage) returns (stream BroadcastResponse) {}
		return new Promise(function(resolve, reject) {
			var broadcast = self._ordererClient.broadcast();

			broadcast.on('data', function (response) {
				if(isDebug) debug('Orderer.sendBroadcast - on data response: ' + JSON.stringify(response));

				if(response.Status) {
					if (response.Status === 'SUCCESS') {
						if(isDebug) debug('Orderer.sendBroadcast - resolve with %s', response.Status);
						return resolve(response);
					} else {
						if(isDebug) debug('Orderer.sendBroadcast - reject with %s', response.Status);
						return reject(new Error(response.Status));
					}
				}
				else {
					if(isDebug) debug('Orderer.sendBroadcast ERROR - reject with invalid response from the orderer');
					return reject(new Error('SYSTEM_ERROR'));
				}

			});

			broadcast.on('end', function (response) {
				if(isDebug) debug('Orderer.sendBroadcast - on end:');
				// Removing the promise reject here as on an 'error', this case
				// will hit before the 'error' event, and we loose the error
				// information coming back to the caller
				// return reject(response);
			});

			broadcast.on('error', function (err) {
				if(isDebug) debug('Orderer.sendBroadcast - on error: ' + JSON.stringify(err));
				if(err && err.code) {
					if(err.code == 14) {
						return reject(new Error('SERVICE_UNAVAILABLE'));
					}
				}
				return reject(new Error(err));
			});

			broadcast.write(_broadcastMessage);
			broadcast.end();
			if(isDebug) debug('Orderer.sendBroadcast - write/end complete');
		});
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		return ' Orderer : {' +
			'url:' + this._url +
		'}';
	}
};

module.exports = Orderer;
