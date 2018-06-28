/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

var utils = require('./utils.js');
var Remote = require('./Remote');

var grpc = require('grpc');
var logger = utils.getLogger('Orderer.js');

var _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
var _common = grpc.load(__dirname + '/protos/common/common.proto').common;

/**
 * The Orderer class encapsulates the client capabilities to interact with
 * an Orderer node in the target blockchain network. The orderer node exposes
 * two APIs: broadcast() and deliver(). Both are streaming APIs so there's
 * a persistent grpc streaming connection between the client and the orderer
 * where messages are exchanged in both directions. The broadcast() API is
 * for sending transactions to the orderer for processing. The deliver() API
 * is for asking the orderer for information such as channel configurations.
 *
 * @class
 * @extends Remote
 */
var Orderer = class extends Remote {

	/**
	 * Constructs an Orderer object with the given url and opts. An orderer object
	 * encapsulates the properties of an orderer node and the interactions with it via
	 * the grpc stream API. Orderer objects are used by the {@link Client} objects to broadcast
	 * requests for creating and updating channels. They are also used by the {@link Channel}
	 * objects to broadcast requests for ordering transactions.
	 *
	 * @param {string} url The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts The options for the connection to the orderer.
	 * @returns {Orderer} The Orderer instance.
	 */
	constructor(url, opts) {
		super(url, opts);

		logger.debug('Orderer.const - url: %s timeout: %s', url, this._request_timeout);
		this._ordererClient = new _abProto.AtomicBroadcast(this._endpoint.addr, this._endpoint.creds, this._options);
	}

	/**
	 * Close the service connection.
	 */
	close() {
		if (this._ordererClient) {
			logger.debug('close - closing orderer connection ' + this._endpoint.addr);
			this._ordererClient.close();
		}
	}

	/**
	 * @typedef {Object} BroadcastResponse
	 * @property {string} status - Value is 'SUCCESS' or a descriptive error string
	 */

	/**
	 * Send a Broadcast message to the orderer service.
	 *
	 * @param {byte[]} envelope - Byte data to be included in the broadcast.
	 *        This must be a protobuf encoded byte array of the
	 *        [common.Envelope]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L132}
	 *        that contains either a [ConfigUpdateEnvelope]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/configtx.proto#L70}
	 *        or a [Transaction]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/transaction.proto#L70}
	 *        in the <code>payload.data</code> property of the envelope.
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link BroadcastResponse} object
	 */
	sendBroadcast(envelope, timeout) {
		logger.debug('sendBroadcast - start');

		if (!envelope || envelope == '') {
			logger.debug('sendBroadcast ERROR - missing envelope');
			var err = new Error('Missing data - Nothing to broadcast');
			return Promise.reject(err);
		}

		var self = this;
		let rto = self._request_timeout;
		if (typeof timeout === 'number')
			rto = timeout;

		return this.waitForReady(this._ordererClient).then(() => {
			// Send the envelope to the orderer via grpc
			return new Promise(function (resolve, reject) {
				var broadcast = self._ordererClient.broadcast();

				var broadcast_timeout = setTimeout(function () {
					logger.error('sendBroadcast - timed out after:%s', rto);
					broadcast.end();
					return reject(new Error('REQUEST_TIMEOUT'));
				}, rto);

				broadcast.on('data', function (response) {
					logger.debug('sendBroadcast - on data response: %j', response);
					broadcast.end();
					if (response && response.info) {
						logger.debug('sendBroadcast - response info :: %s', response.info);
					}
					if (response && response.status) {
						logger.debug('sendBroadcast - response status %s', response.status);
						return resolve(response);
					} else {
						logger.error('sendBroadcast ERROR - reject with invalid response from the orderer');
						return reject(new Error('SYSTEM_ERROR'));
					}

				});

				broadcast.on('end', () => {
					logger.debug('sendBroadcast - on end:');
					clearTimeout(broadcast_timeout);
					broadcast.cancel();
				});

				broadcast.on('error', function (err) {
					clearTimeout(broadcast_timeout);
					broadcast.end();
					if (err && err.code) {
						if (err.code == 14) {
							logger.error('sendBroadcast - on error: %j', err.stack ? err.stack : err);
							return reject(new Error('SERVICE_UNAVAILABLE'));
						}
					}
					logger.debug('sendBroadcast - on error: %j', err.stack ? err.stack : err);
					if (err instanceof Error) {
						return reject(err);
					} else {
						return reject(new Error(err));
					}
				});

				broadcast.write(envelope);
				//			broadcast.end();
				logger.debug('sendBroadcast - sent message');
			});
		},
		(error) =>{
			logger.error('Orderer %s has an error %s ', self.getUrl(), error.toString());
			return Promise.reject(error);
		});
	}

	/**
	 * Send a Deliver message to the orderer service.
	 *
	 * @param {byte[]} envelope - Byte data to be included in the broadcast. This must
	 *                            be a protobuf encoded byte array of the
	 *                            [common.Envelope]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L132}
	 *                            that contains a [SeekInfo]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/orderer/ab.proto#L54}
	 *                            in the <code>payload.data</code> property of the envelope.
	 *                            The <code>header.channelHeader.type</code> must be set to
	 *                            [common.HeaderType.DELIVER_SEEK_INFO]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L44}
	 * @returns {Promise} A Promise for a protobuf object of type common.Block. Note that this
	 *                    is <b>NOT</b> the same type of object as the {@link Block} returned by the
	 *                    [BlockDecoder.decode()]{@link BlockDecode.decode} method and various
	 *                    other methods. A {@link Block} is a pure javascript object, whereas
	 *                    the object returned by this method is a protobuf object that contains
	 *                    accessor methods, getters and setters, and toBuffer() for each property
	 *                    to be used for further manipulating the object and convert to and from
	 *                    byte arrays.
	 */
	sendDeliver(envelope) {
		logger.debug('sendDeliver - start');

		if (!envelope || envelope == '') {
			logger.debug('sendDeliver ERROR - missing envelope');
			var err = new Error('Missing data - Nothing to deliver');
			return Promise.reject(err);
		}

		var self = this;

		return this.waitForReady(this._ordererClient).then(() => {
			// Send the seek info to the orderer via grpc
			return new Promise(function (resolve, reject) {
				try {
					var deliver = self._ordererClient.deliver();
					var return_block = null;
					var connect = false;

					var deliver_timeout = setTimeout(function () {
						logger.debug('sendDeliver - timed out after:%s', self._request_timeout);
						deliver.end();
						return reject(new Error('REQUEST_TIMEOUT'));
					}, self._request_timeout);

					deliver.on('data', function (response) {
						logger.debug('sendDeliver - on data'); //response: %j', response);
						// check the type of the response
						if (response.Type === 'block') {
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
							return_block = block;

							logger.debug('sendDeliver - wait for success, keep this block number %s', return_block.header.number);
						} else if (response.Type === 'status') {
							clearTimeout(deliver_timeout);
							connect = false;
							deliver.end();
							// response type should now be 'status'
							if (response.status === 'SUCCESS') {
								logger.debug('sendDeliver - resolve - status:%s', response.status);
								return resolve(return_block);
							} else {
								logger.error('sendDeliver - rejecting - status:%s', response.status);
								return reject(new Error('Invalid results returned ::' + response.status));
							}
						} else {
							logger.error('sendDeliver ERROR - reject with invalid response from the orderer');
							if (connect) {
								clearTimeout(deliver_timeout);
								deliver.end();
								connect = false;
							}
							return reject(new Error('SYSTEM_ERROR'));
						}
					});

					deliver.on('status', function (response) {
						logger.debug('sendDeliver - on status:%j', response);
					});

					deliver.on('end', () => {
						logger.debug('sendDeliver - on end');
						if (connect) {
							clearTimeout(deliver_timeout);
							deliver.cancel();
							connect = false;
						}

					});

					deliver.on('error', function (err) {
						logger.debug('sendDeliver - on error');
						clearTimeout(deliver_timeout);
						if (connect) {
							deliver.end();
							connect = false;
							if (err && err.code) {
								if (err.code == 14) {
									logger.error('sendDeliver - on error code 14: %j', err.stack ? err.stack : err);
									return reject(new Error('SERVICE_UNAVAILABLE'));
								}
							}
						}
						if (err instanceof Error) {
							return reject(err);
						} else {
							return reject(new Error(err));
						}
					});

					deliver.write(envelope);
					connect = true;
					//				deliver.end();
					logger.debug('sendDeliver - sent envelope');
				} catch (error) {
					logger.error('sendDeliver - system error ::' + error.stack ? error.stack : error);
					if (error instanceof Error) {
						return reject(error);
					} else {
						return reject(new Error(error));
					}
				}
			});
		});
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return 'Orderer:{' +
            'url:' + this._url +
            '}';
	}
};

module.exports = Orderer;
