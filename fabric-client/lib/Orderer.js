/*
 Copyright 2016, 2017 IBM All Rights Reserved.

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

var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _common = grpc.load(__dirname + '/protos/common/common.proto').common;

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
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 *   note: other options will be passed to the grpc connection
	 */
	constructor(url, opts) {
		super(url, opts);

		logger.debug('Orderer.const - url: %s timeout: %s', url, this._request_timeout);
		this._ordererClient = new _abProto.AtomicBroadcast(this._endpoint.addr, this._endpoint.creds, this._options);
	}

	/**
	 * Send a Broadcast message to the orderer service.
	 *
	 * @param {byte} envelope - Byte data to be included in the Broadcast
	 *        @see the ./proto/orderer/ab.proto
	 * @returns {Promise} A Promise for a BroadcastResponse
	 *        @see the ./proto/orderer/ab.proto
	 */
	sendBroadcast(envelope) {
		logger.debug('sendBroadcast - start');

		if(!envelope || envelope == '') {
			logger.debug('sendBroadcast ERROR - missing envelope');
			var err = new Error('Missing data - Nothing to broadcast');
			return Promise.reject(err);
		}

		var self = this;

		// Send the envelope to the orderer via grpc
		return new Promise(function(resolve, reject) {
			var broadcast = self._ordererClient.broadcast();

			var broadcast_timeout = setTimeout(function(){
				logger.error('sendBroadcast - timed out after:%s', self._request_timeout);
				broadcast.end();
				return reject(new Error('REQUEST_TIMEOUT'));
			}, self._request_timeout);

			broadcast.on('data', function (response) {
				logger.debug('sendBroadcast - on data response: %j', response);
				broadcast.end();
				if(response.status) {
					if (response.status === 'SUCCESS') {
						logger.debug('sendBroadcast - resolve with %s', response.status);
						return resolve(response);
					} else {
						logger.error('sendBroadcast - reject with %s', response.status);
						return reject(new Error(response.status));
					}
				}
				else {
					logger.error('sendBroadcast ERROR - reject with invalid response from the orderer');
					return reject(new Error('SYSTEM_ERROR'));
				}

			});

			broadcast.on('end', function (response) {
				logger.debug('sendBroadcast - on end:');
				clearTimeout(broadcast_timeout);
				broadcast.cancel();
			});

			broadcast.on('error', function (err) {
				broadcast.end();
				if(err && err.code) {
					if(err.code == 14) {
						clearTimeout(broadcast_timeout);
						logger.error('sendBroadcast - on error: %j',err.stack ? err.stack : err);
						return reject(new Error('SERVICE_UNAVAILABLE'));
					}
				}
				logger.debug('sendBroadcast - on error: %j',err.stack ? err.stack : err);
				if(err instanceof Error) {
					return reject(err);
				}
				else {
					return reject(new Error(err));
				}
			});

			broadcast.write(envelope);
//			broadcast.end();
			logger.debug('sendBroadcast - sent message');
		});
	}

	/**
	 * Send a Deliver message to the orderer service.
	 *
	 * @param {byte} envelope - Byte data to be included in the Deliver
	 *        @see the ./proto/orderer/ab.proto
	 * @returns {Promise} A Promise for a Block
	 *        @see the ./proto/orderer/common.proto
	 */
	sendDeliver(envelope) {
		logger.debug('sendDeliver - start');

		if(!envelope || envelope == '') {
			logger.debug('sendDeliver ERROR - missing envelope');
			var err = new Error('Missing data - Nothing to deliver');
			return Promise.reject(err);
		}

		var self = this;

		// Send the seek info to the orderer via grpc
		return new Promise(function(resolve, reject) {
			try {
				var deliver = self._ordererClient.deliver();
				var return_block = null;
				var connect = false;

				var deliver_timeout = setTimeout(function(){
					logger.debug('sendDeliver - timed out after:%s', self._request_timeout);
					deliver.end();
					return reject(new Error('REQUEST_TIMEOUT'));
				}, self._request_timeout);

				deliver.on('data', function (response) {
					logger.debug('sendDeliver - on data'); //response: %j', response);
					// check the type of the response
					if(response.Type === 'block') {
						var blockHeader = new _common.BlockHeader();
						blockHeader.setNumber(response.block.header.number);
						blockHeader.setPreviousHash(response.block.header.previous_hash);
						blockHeader.setDataHash(response.block.header.data_hash);
						var blockData = new _common.BlockData();
						blockData.setData(response.block.data.data);
						var blockMetadata = new _common.BlockMetadata();
						blockMetadata.setMetadata(response.block.metadata.metadata);

						var block = new _common.Block();
						block.setHeader(blockHeader);
						block.setData(blockData);
						block.setMetadata(blockMetadata);
						return_block  = block;

						logger.debug('sendDeliver - wait for success, keep this block number %s',return_block.header.number);
					}
					else if(response.Type === 'status') {
						clearTimeout(deliver_timeout);
						connect = false;
						deliver.end();
						// response type should now be 'status'
						if (response.status === 'SUCCESS') {
							logger.debug('sendDeliver - resolve - status:%s', response.status);
							return resolve(return_block);
						}
						else {
							logger.error('sendDeliver - rejecting - status:%s', response.status);
							return reject(new Error('Invalid results returned ::' +response.status));
						}
					}
					else {
						logger.error('sendDeliver ERROR - reject with invalid response from the orderer');
						if(connect) {
							clearTimeout(deliver_timeout);
							deliver.end();
							connect = false;
						}
						return reject(new Error('SYSTEM_ERROR'));
					}
				});

				deliver.on('status', function (response) {
					logger.debug('sendDeliver - on status:%j',response);
				});

				deliver.on('end', function (response) {
					logger.debug('sendDeliver - on end');
					if(connect) {
						clearTimeout(deliver_timeout);
						deliver.cancel();
						connect = false;
					}

				});

				deliver.on('error', function (err) {
					logger.debug('sendDeliver - on error');
					if(connect) {
						clearTimeout(deliver_timeout);
						deliver.end();
						connect = false;
						if(err && err.code) {
							if(err.code == 14) {
								logger.error('sendDeliver - on error code 14: %j',err.stack ? err.stack : err);
								return reject(new Error('SERVICE_UNAVAILABLE'));
							}
						}
					}
					if(err instanceof Error) {
						return reject(err);
					}
					else {
						return reject(new Error(err));
					}
				});

				deliver.write(envelope);
				connect = true;
//				deliver.end();
				logger.debug('sendDeliver - sent envelope');
			}
			catch(error) {
				logger.error('sendDeliver - system error ::' + error.stack ? error.stack : error);
				if(error instanceof Error) {
					return reject(error);
				}
				else {
					return reject(new Error(error));
				}
			}
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
