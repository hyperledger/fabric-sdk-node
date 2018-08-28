/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const utils = require('./utils.js');
const Remote = require('./Remote');

const grpc = require('grpc');
const logger = utils.getLogger('Orderer.js');

const _abProto = grpc.load(__dirname + '/protos/orderer/ab.proto').orderer;
const _common = grpc.load(__dirname + '/protos/common/common.proto').common;

/**
 * @typedef {Error} SYSTEM_TIMEOUT The Error message string that indicates that
 *           the request operation has timed out due to a system issue. This will
 *           indicate that the issue is local rather than remote. If there is
 *           an issue with the remote node a 'REQUEST_TIMEOUT' error message
 *           will be returned.
 *           The operation will only use one timer for both types of timeouts.
 *           The timer will start running as the operation begins. If the timer
 *           expires before the local instance is able to make the outbound
 *           request then 'SYSTEM_TIMEOUT' error will be returned. If the local
 *           instance is able to make the outbound request and the timer expires
 *           before the remote node responds then the 'REQUEST_TIMEOUT' is
 *           returned. The timer is controlled by the 'request-timeout' setting
 *           or passed on a call that makes an outbound request
 *           @example 'client.setConfigSetting('request-timeout', 3000)'
 *           @example 'channel.sendTranaction(request, 3000)'
 */

/**
 * @typedef {Error} REQUEST_TIMEOUT The Error message string that indicates that
 *           the request operation has timed out due to a remote node issue.
 *           If there is an issue with the local system a 'SYSTEM_TIMEOUT'
 *           error message will be returned.
 *           The operation will only use one timer for both types of timeouts.
 *           The timer will start running as the operation begins. If the timer
 *           expires before the local instance is able to make the outbound
 *           request then 'SYSTEM_TIMEOUT' error will be returned. If the local
 *           instance is able to make the outbound request and the timer expires
 *           before the remote node responds then the 'REQUEST_TIMEOUT' is
 *           returned. The timer is controlled by the 'request-timeout' setting
 *           or passed on a call that makes an outbound request
 *           @example 'client.setConfigSetting('request-timeout', 3000)'
 *           @example 'channel.sendTranaction(request, 3000)'
 */

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
class Orderer extends Remote {

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
		this._sendDeliverConnect = false;
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
	 * @property {string} info - Optional. Additional information about the status
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
	 * @throws {SYSTEM_TIMEOUT | REQUEST_TIMEOUT}
	 */
	sendBroadcast(envelope, timeout) {
		logger.debug('sendBroadcast - start');

		if (!envelope || envelope === '') {
			logger.debug('sendBroadcast ERROR - missing envelope');
			const err = new Error('Missing data - Nothing to broadcast');
			return Promise.reject(err);
		}

		const self = this;
		let rto = self._request_timeout;
		if (typeof timeout === 'number')
			rto = timeout;

		return this.waitForReady(this._ordererClient).then(() => {
			// Send the envelope to the orderer via grpc
			return new Promise((resolve, reject) => {
				const broadcast = self._ordererClient.broadcast();
				let error_msg = 'SYSTEM_TIMEOUT';

				const broadcast_timeout = setTimeout(() => {
					logger.error('sendBroadcast - timed out after:%s', rto);
					broadcast.end();
					return reject(new Error(error_msg));
				}, rto);

				broadcast.on('data', (response) => {
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

				broadcast.on('error', (err) => {
					clearTimeout(broadcast_timeout);
					broadcast.end();
					if (err && err.code) {
						if (err.code === 14) {
							logger.error('sendBroadcast - on error: %j', err.stack ? err.stack : err);
							return reject(new Error('SERVICE_UNAVAILABLE'));
						}
					}
					logger.error('sendBroadcast - on error: %j', err.stack ? err.stack : err);
					return reject(err);
				});

				broadcast.write(envelope);
				error_msg = 'REQUEST_TIMEOUT';
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
	 * @throws {SYSTEM_TIMEOUT | REQUEST_TIMEOUT}
	 */
	sendDeliver(envelope) {
		logger.debug('sendDeliver - start');

		if (!envelope) {
			logger.debug('sendDeliver ERROR - missing envelope');
			const err = new Error('Missing data - Nothing to deliver');
			return Promise.reject(err);
		}

		const self = this;

		return this.waitForReady(this._ordererClient).then(() => {
			// Send the seek info to the orderer via grpc
			return new Promise((resolve, reject) => {
				try {
					const deliver = self._ordererClient.deliver();
					let return_block = null;
					self._sendDeliverConnect = false;
					let error_msg = 'SYSTEM_TIMEOUT';

					const deliver_timeout = setTimeout(() => {
						logger.debug('sendDeliver - timed out after:%s', self._request_timeout);
						deliver.end();
						return reject(new Error(error_msg));
					}, self._request_timeout);

					deliver.on('data', (response) => {
						logger.debug('sendDeliver - on data'); //response: %j', response);
						// check the type of the response
						if (response.Type === 'block') {
							const blockHeader = new _common.BlockHeader();
							blockHeader.setNumber(response.block.header.number);
							blockHeader.setPreviousHash(response.block.header.previous_hash);
							blockHeader.setDataHash(response.block.header.data_hash);
							const blockData = new _common.BlockData();
							blockData.setData(response.block.data.data);
							const blockMetadata = new _common.BlockMetadata();
							blockMetadata.setMetadata(response.block.metadata.metadata);

							const block = new _common.Block();
							block.setHeader(blockHeader);
							block.setData(blockData);
							block.setMetadata(blockMetadata);
							return_block = block;

							logger.debug('sendDeliver - wait for success, keep this block number %s', return_block.header.number);
						} else if (response.Type === 'status') {
							clearTimeout(deliver_timeout);
							self._sendDeliverConnect = false;
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
							if (self._sendDeliverConnect) {
								clearTimeout(deliver_timeout);
								deliver.end();
								self._sendDeliverConnect = false;
							}
							return reject(new Error('SYSTEM_ERROR'));
						}
					});

					deliver.on('status', (response) => {
						logger.debug('sendDeliver - on status:%j', response);
					});

					deliver.on('end', () => {
						logger.debug('sendDeliver - on end');
						if (self._sendDeliverConnect) {
							clearTimeout(deliver_timeout);
							deliver.cancel();
							self._sendDeliverConnect = false;
						}

					});

					deliver.on('error', (err) => {
						logger.debug('sendDeliver - on error');
						clearTimeout(deliver_timeout);
						if (self._sendDeliverConnect) {
							deliver.end();
							self._sendDeliverConnect = false;
							if (err && err.code) {
								if (err.code == 14) {
									logger.error('sendDeliver - on error code 14: %j', err.stack ? err.stack : err);
									return reject(new Error('SERVICE_UNAVAILABLE'));
								}
							}
						}
						return reject(err);
					});

					deliver.write(envelope);
					error_msg = 'REQUEST_TIMEOUT';
					self._sendDeliverConnect = true;
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
}

module.exports = Orderer;
