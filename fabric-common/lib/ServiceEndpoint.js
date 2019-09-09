/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'ServiceEndpoint';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

/**
 * The ServiceEndpoint class represents a the base class for all Service nodes (Endorser, Committer, Discoverer, and Eventer).
 *
 * @class
 */
class ServiceEndpoint {

	constructor(name = checkParameter('name'), client = checkParameter('client'), mspid) {
		this.name = name;
		this.mspid = mspid;
		this.client = client;
		this.connected = false;
		this.endpoint = null;
		this.service = null;
		this.serviceClass = null;
		this.type = TYPE; // will be overridden by subclass
	}

	/**
	 * Connects to a ServiceEndpoint with the given url and opts.
	 * If a connect exist an error will be thrown. The application must
	 * disconnect the connection before re-connecting to the service.
	 *
	 * @param {Endpoint} endpoint - Service connection options including the url.
	 * @param {ConnectionOpts} options - Any specific options for this instance
	 *  of the connection to the peer. These will override options from the
	 *  endpoint service connection options.
	 */
	async connect(endpoint = checkParameter('endpoint'), options = {}) {
		const method = `connect[${this.type}-${this.name}]`;
		logger.debug(`${method} - start `);

		if (this.connected) {
			const message = `This service endpoint ${this.name}-${this.endpoint.url} is connected`;
			logger.error(message);
			throw Error(message);
		}

		if (this.service) {
			const message = `This service endpoint ${this.name}-${this.endpoint.url} has an active service connection`;
			logger.error(message);
			throw Error(message);
		}

		this.endpoint = endpoint;
		this.options = Object.assign({}, endpoint.options, options);

		logger.debug(`${method} - endorser service does not exist, will create service for this peer ${this.name}`);
		this.service = new this.serviceClass(this.endpoint.addr, this.endpoint.creds, this.options);
		await this.waitForReady(this.service);
		logger.debug(`${method} - completed the waitForReady for this peer ${this.name}`);
	}

	/**
	 * disconnect the service connection.
	 */
	disconnect() {
		const method = `disconnect[${this.type}-${this.name}]`;
		logger.debug(`${method} - start `);

		if (this.service) {
			logger.debug(`${method} ${this.type} ${this.name} - closing service connection ${this.endpoint.addr}`);
			this.service.close();
			this.service = null;
			this.connected = false;
		}
	}

	/**
	 * Check the connection status
	 */
	async checkConnection() {
		logger.debug(`checkConnection[${this.name}] - start `);

		if (this.connected) {
			try {
				await this.waitForReady();
			} catch (error) {
				logger.error(`Peer ${this.endpoint.url} Connection failed :: ${error}`);
				return false;
			}
		}

		return this.connected;
	}

	waitForReady() {
		const method = 'waitForReady';
		logger.debug(`${method} - start ${this.type}-${this.name} - ${this.endpoint.url}`);

		return new Promise((resolve, reject) => {
			logger.debug(`${method} - promise running ${this.name} - ${this.endpoint.url}`);
			this.connected = false;
			const timeout = new Date().getTime() + this.options['grpc-wait-for-ready-timeout'];
			if (!this.service) {
				reject(new Error(`ServiceEndpoint ${this.type}-${this.name} grpc service has not been started`));
			}
			this.service.waitForReady(timeout, (err) => {
				if (err) {
					if (err.message) {
						err.message = err.message + ' on ' + this.toString();
					}
					err.connectFailed = true;
					logger.error(err);
					logger.error(`${method} - Failed to connect to remote gRPC server ${this.name} url:${this.endpoint.url}`);
					reject(err);
				} else {
					this.connected = true;
					logger.debug(`${method} - Successfully connected to remote gRPC server ${this.name} url:${this.endpoint.url}`);
					resolve();
				}
			});
		});
	}

	/*
	 * Get this remote endpoints characteristics
	 */
	getCharacteristics() {
		const characteristics = {
			type: this.type,
			name: this.name,
			url: this.endpoint ? this.endpoint.url : '',
			options: this.endpoint ? this.endpoint.options : {}
		};
		// remove private key
		if (characteristics.options.clientKey) {
			delete characteristics.options.clientKey;
		}

		return characteristics;
	}

	/**
	 * Determine whether or not this remote endpoint uses TLS.
	 * @returns {boolean} True if this endpoint uses TLS, false otherwise.
	 * @throws {Error} if the Service Endpoint has not been connected to an
	 *  endpoint.
	 */
	isTLS() {
		if (this.endpoint) {

			return this.endpoint.isTLS();
		} else {
			throw Error(`${this.type} is not connected`);
		}
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		let url = '<not connected>';
		if (this.endpoint) {
			url = this.endpoint.url;
		}

		return `${this.type}- name: ${this.name}, url:${url}`;
	}

}

module.exports = ServiceEndpoint;