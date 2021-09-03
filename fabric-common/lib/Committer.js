/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Committer';

const {checkParameter, getLogger} = require('./Utils.js');
const ServiceEndpoint = require('./ServiceEndpoint');

const fabproto6 = require('fabric-protos');
const logger = getLogger(TYPE);

/**
 * @typedef {Error} SYSTEM TIMEOUT The Error message string that indicates that
 *  the request operation has timed out due to a system issue. This will
 *  indicate that the issue is local rather than remote. If there is
 *  an issue with the remote node a 'REQUEST TIMEOUT' error message
 *  will be returned.
 *  The operation will only use one timer for both types of timeouts.
 *  The timer will start running as the operation begins. If the timer
 *  expires before the local instance is able to make the outbound
 *  request then 'SYSTEM TIMEOUT' error will be returned. If the local
 *  instance is able to make the outbound request and the timer expires
 *  before the remote node responds then the 'REQUEST TIMEOUT' is
 *  returned. The timer is controlled by the 'requestTimeout' setting
 *  or passed on a call that makes an outbound request
 *  @example 'client.setConfigSetting('requestTimeout', 3000)'
 *  @example 'channel.sendTranaction(request, 3000)'
 */

/**
 * @typedef {Error} REQUEST TIMEOUT The Error message string that indicates that
 *  the request operation has timed out due to a remote node issue.
 *  If there is an issue with the local system a 'SYSTEM TIMEOUT'
 *  error message will be returned.
 *  The operation will only use one timer for both types of timeouts.
 *  The timer will start running as the operation begins. If the timer
 *  expires before the local instance is able to make the outbound
 *  request then 'SYSTEM TIMEOUT' error will be returned. If the local
 *  instance is able to make the outbound request and the timer expires
 *  before the remote node responds then the 'REQUEST TIMEOUT' is
 *  returned. The timer is controlled by the 'requestTimeout' setting
 *  or passed on a call that makes an outbound request
 *  @example 'client.setConfigSetting('requestTimeout', 3000)'
 *  @example 'channel.sendTranaction(request, 3000)'
 */

/**
 * The Committer class encapsulates the client capabilities to interact with
 * an Committer node in the target blockchain network. The committer node exposes
 * two APIs: broadcast() and deliver(). Both are streaming APIs so there's
 * a persistent grpc streaming connection between the client and the committer
 * where messages are exchanged in both directions. The broadcast() API is
 * for sending transactions to the committer for processing. The deliver() API
 * is for asking the committer for information such as channel configurations.
 *
 * @class
 * @extends ServiceEndpoint
 */
class Committer extends ServiceEndpoint {

	/**
	 * Constructs an Committer object with the given name. An committer object
	 * encapsulates the properties of an committer node and the interactions with it via
	 * the grpc stream API. Committer objects are used by the {@link Client} objects to broadcast
	 * requests for creating and updating channels. They are also used by the {@link Channel}
	 * objects to broadcast requests for ordering transactions.
	 *
	 * @param {string} name - The name of this peer
	 * @param {Client} client - The client instance
	 * @param {string} mspid - The mspid (organization) of this peer
	 * @returns {Committer} The Committer instance.
	 */
	constructor(name = checkParameter('name'), client = checkParameter('client'), mspid) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name, client);
		this.mspid = mspid;
		this.type = TYPE;

		this.serviceClass = fabproto6.services.orderer.AtomicBroadcast;
	}

	/**
	 * @typedef {Object} BroadcastResponse
	 * @property {string} status - Value is 'SUCCESS' or a descriptive error string
	 * @property {string} info - Optional. Additional information about the status
	 */

	/**
	 * Send a Broadcast message to the committer service.
	 *
	 * @param {byte[]} envelope - Byte data to be included in the broadcast.
	 *  This must be a protobuf encoded byte array of the
	 *  [common.Envelope]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/common.proto#L132}
	 *  that contains either a [ConfigUpdateEnvelope]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/common/configtx.proto#L70}
	 *  or a [Transaction]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/transaction.proto#L70}
	 *  in the <code>payload.data</code> property of the envelope.
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *  response before rejecting the promise with a timeout error. This
	 *  overrides the request-timeout config connection setting of this instance.
	 * @returns {Promise} A Promise for a {@link BroadcastResponse} object
	 * @throws {Error}
	 */
	sendBroadcast(envelope, timeout) {
		const method = 'sendBroadcast';
		logger.debug(`${method} - start`);

		// Send the envelope to the committer via grpc
		return new Promise((resolve, reject) => {
			if (!envelope) {
				checkParameter('envelope');
			}
			if (this.connected === false) {
				throw Error(`Broadcast Client ${this.name} ${this.endpoint.url} is not connected`);
			}
			let rto = this.options.requestTimeout;
			if (typeof timeout === 'number') {
				rto = timeout;
			}

			const broadcast = this.service.broadcast();
			// if it timeouts before the send of the envelope completes
			// we will get a SYSTEM TIMEOUT
			let error_msg = 'SYSTEM TIMEOUT';

			const broadcast_timeout = setTimeout(() => {
				logger.error(`${this.name} - ${method} timed out after:${rto}`);
				return reject(new Error(error_msg));
			}, rto);

			broadcast.on('data', (response) => {
				logger.debug('%s - on data response: %j', method, response);
				clearTimeout(broadcast_timeout);
				if (response && response.info) {
					logger.debug(`${method} - response info :: ${response.info}`);
				}
				if (response && response.status) {
					logger.debug(`${method} - response status ${response.status}`);
					// convert to string enum (depending on how the protobuf code has been gennerated)
					if (typeof response.status === 'number') {
						response.status = fabproto6.common.Status[response.status];
					}
					logger.debug('%s - on data response: %j', method, response);

					return resolve(response);
				} else {
					logger.error(`${this.name} ERROR - ${method} reject with invalid response from the committer`);
					return reject(new Error('SYSTEM ERROR'));
				}
			});

			broadcast.on('end', () => {
				logger.debug(`${method} - on end:`);
				clearTimeout(broadcast_timeout);
				broadcast.cancel();
			});

			broadcast.on('error', (err) => {
				clearTimeout(broadcast_timeout);
				if (err && err.code) {
					if (err.code === 14) {
						logger.error(`${method} - ${this.name} SERVICE UNAVAILABLE on error code: ${err.code}`);
						return reject(new Error('SERVICE UNAVAILABLE'));
					}
				}
				logger.error(`${method} - ${this.name} on error: ${JSON.stringify(err.stack ? err.stack : err)}`);
				return reject(err);
			});

			broadcast.write(envelope);
			broadcast.end();
			// the send of envelope has completed
			// if it timeouts after this point we will get a REQUEST TIMEOUT
			error_msg = 'REQUEST TIMEOUT';
			logger.debug(`${method} - sent message`);
		});
	}
}

module.exports = Committer;
