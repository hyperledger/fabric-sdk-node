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
var Remote = require('./Remote');

var grpc = require('grpc');
var logger = utils.getLogger('Orderer.js');

var _abProto = grpc.load(__dirname + '/protos/atomicbroadcast/ab.proto').atomicbroadcast;

/**
 * The Orderer class represents a peer in the target blockchain network to which
 * HFC sends a block of transactions of endorsed proposals requiring ordering.
 *
 * @class
 */
var Orderer = class extends Remote {

	/**
	 * Constructs an Orderer given its endpoint configuration settings.
	 *
	 * @param {string} url The orderer URL with format of 'grpcs://host:port'.
	 * @param {Object} opts The options for the connection to the orderer.
	 */
	constructor(url, opts) {
		super(url, opts);

		this._request_timeout = 30000;
		if(opts && opts['request-timeout']) {
			this._request_timeout = opts['request-timeout'];
		}
		else {
			this._request_timeout = utils.getConfigSetting('request-timeout',30000); //default 30 seconds
		}

		this._ordererClient = new _abProto.AtomicBroadcast(this._endpoint.addr, this._endpoint.creds, this._options);
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
		logger.debug('Orderer.sendBroadcast - start');

		if(!send_data || send_data == '') {
			logger.debug('Orderer.sendBroadcast ERROR - missing data');
			var err = new Error('Missing data - Nothing to order');
			return Promise.reject(err);
		}

		var self = this;
		var data = new Buffer(send_data);

		// Build up the broadcast message
		// This will be fleshed out we add more functionality and send fully
		// structured requests, with all fields filled in.
		var _broadcastMessage = {Data: data};

		// show some of what we have
		logger.debug('Orderer.sendBroadcast - _broadcastMessage = %j', data);

		// Send the endorsed proposals to the peer node (orderer) via grpc
		// The rpc specification on the peer side is:
		// rpc Broadcast(stream BroadcastMessage) returns (stream BroadcastResponse) {}
		return new Promise(function(resolve, reject) {
			var broadcast = self._ordererClient.broadcast();

			setTimeout(function(){
				logger.debug('Orderer.sendBroadcast - timed out after:%s', self._request_timeout);
				return reject(new Error('REQUEST_TIMEOUT'));
			}, self._request_timeout);

			broadcast.on('data', function (response) {
				logger.debug('Orderer.sendBroadcast - on data response: %j', response);

				if(response.Status) {
					if (response.Status === 'SUCCESS') {
						logger.debug('Orderer.sendBroadcast - resolve with %s', response.Status);
						return resolve(response);
					} else {
						logger.debug('Orderer.sendBroadcast - reject with %s', response.Status);
						return reject(new Error(response.Status));
					}
				}
				else {
					logger.debug('Orderer.sendBroadcast ERROR - reject with invalid response from the orderer');
					return reject(new Error('SYSTEM_ERROR'));
				}

			});

			broadcast.on('end', function (response) {
				logger.debug('Orderer.sendBroadcast - on end:');
				// Removing the promise reject here as on an 'error', this case
				// will hit before the 'error' event, and we loose the error
				// information coming back to the caller
				// return reject(response);
			});

			broadcast.on('error', function (err) {
				logger.debug('Orderer.sendBroadcast - on error: %j',err);
				if(err && err.code) {
					if(err.code == 14) {
						return reject(new Error('SERVICE_UNAVAILABLE'));
					}
				}
				return reject(new Error(err));
			});

			broadcast.write(_broadcastMessage);
			broadcast.end();
			logger.debug('Orderer.sendBroadcast - write/end complete');
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
