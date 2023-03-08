/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Discoverer';

const {checkParameter, getLogger} = require('./Utils.js');
const ServiceEndpoint = require('./ServiceEndpoint');
const fabproto6 = require('fabric-protos').services;

const logger = getLogger(TYPE);

/**
 * The Discoverer class represents a peer's discovery service in the blockchain network
 *
 * @class
 * @extends ServiceEndpoint
 */
class Discoverer extends ServiceEndpoint {

	/**
	 * Construct a Discoverer object with the name.
	 *
	 * @param {string} name - The name of this peer
	 * @param {Client} client - The client instance
	 * @param {string} [mspid] - The mspid (organization) of this peer
	 * @returns {Discoverer} The Discoverer instance.
	 */
	constructor(name = checkParameter('name'), client = checkParameter('client'), mspid) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name, client, mspid);

		this.type = TYPE;
		this.serviceClass = fabproto6.discovery.Discovery;
	}

	/**
	 * Send an discovery request to this peer.
	 *
	 *  [Proposal]{@link https://github.com/hyperledger/fabric/blob/release-1.2/protos/discovery/protocol.proto}
	 * @param signedEnvelope
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *  response before rejecting the promise with a timeout error. This
	 *  overrides the default timeout of the Peer instance and the global
	 *  timeout in the config settings.
	 * @returns {Promise<discovery.Response>}
	 */
	sendDiscovery(signedEnvelope, timeout) {
		const method = `sendDiscovery[${this.name}]`;
		logger.debug(`${method} - start ----${this.name} ${this.endpoint.url}`);

		return new Promise((resolve, reject) => {
			if (!signedEnvelope) {
				checkParameter('signedEnvelope');
			}
			if (this.connected === false) {
				throw Error(`Discovery Client ${this.name} ${this.endpoint.url} is not connected`);
			}
			let rto = this.options.requestTimeout;
			if (typeof timeout === 'number') {
				rto = timeout;
			}

			const send_timeout = setTimeout(() => {
				logger.error(`${method} - timed out after:${rto}`);
				const return_error = new Error('REQUEST TIMEOUT');
				this.getCharacteristics(return_error);
				return reject(return_error);
			}, rto);

			this.service.discover(signedEnvelope, (err, response) => {
				clearTimeout(send_timeout);
				if (err) {
					logger.debug(`${method} - Received discovery response from: ${this.endpoint.url} status: ${err}`);
					if (err instanceof Error) {
						this.getCharacteristics(err);
						reject(err);
					} else {
						const return_error = new Error(err);
						this.getCharacteristics(return_error);
						reject(return_error);
					}
				} else {
					if (response) {
						logger.debug(`${method} - Received discovery response from peer "${this.endpoint.url}"`);
						this.getCharacteristics(response);
						resolve(response);
					} else {
						const return_error = new Error(`GRPC service failed to get a proper response from the peer ${this.endpoint.url}.`);
						this.getCharacteristics(return_error);
						logger.error(`${method} - rejecting with:${return_error}`);
						reject(return_error);
					}
				}
			});
		});
	}

}

module.exports = Discoverer;
