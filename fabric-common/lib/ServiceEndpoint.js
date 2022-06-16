/*
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
		this.connectAttempted = false;
		this.endpoint = null;
		this.service = null;
		this.serviceClass = null;
		this.type = TYPE; // will be overridden by subclass
		this.options = {};
	}

	/**
	 * Use this method to give this service endpoint an endpoint and
	 * options that it may connect to at a later time. Use the {@link ServiceEndpoint#connect}
	 * method without a endpoint or options to connect using the setting provided here.
	 *
	 * @param {Endpoint} endpoint - Service connection options including the url.
	 * @param {ConnectionOptions} options - Any specific options for this instance
	 *  of the connection to the peer. These will override options from the
	 *  endpoint service connection options.
	 */
	setEndpoint(endpoint = checkParameter('endpoint'), options = {}) {
		const method = `setEndpoint[${this.type}-${this.name}]`;
		logger.debug(`${method} - start `);

		if (this.endpoint && this.connected) {
			const message = `This service endpoint ${this.name}-${this.endpoint.url} is connected`;
			logger.error(message);
			throw Error(message);
		}

		this.endpoint = endpoint;
		this.connectAttempted = false;
		this.options = Object.assign({}, endpoint.options, options);
		logger.debug(`${method} - endpoint has been set for ${this.name}-${this.endpoint.url}`);
	}

	/**
	 * Check that this ServiceEndpoint could be connected, even if it has
	 * failed a previous attempt.
	 */
	isConnectable() {
		const method = `isConnectable[${this.type}-${this.name}]`;
		logger.debug(`${method} - start `);

		let result = false;
		if (this.connected) {
			logger.debug(`${method} - this servive endpoint has been connected`);
			result = true;
		} else if (this.endpoint && this.serviceClass) {
			logger.debug(`${method} - this service endpoint has been assigned an endpoint, connect may be run`);
			result = true;
		}

		return result;
	}

	/**
	 * Connects this ServiceEndpoint with the given url and opts.
	 * If a connect exist an error will be thrown. The application must
	 * disconnect the connection before re-connecting to the service.
	 *
	 * @param {Endpoint} [endpoint] - Service connection options including the url.
	 * When an endpoint is not provided, the setEndpoint() must have been called
	 * previously. If  setEndpoint was previously call and a endpoint is provided
	 * here then it will replace the existing endpoint.
	 * @param {ConnectionOptions} [options] - Any specific options for this instance
	 *  of the connection to the peer. These will override options from the
	 *  endpoint service connection options. Endpoint options and option provided
	 *  here will replace options from the setEndpoint() if previously called.
	 */
	async connect(endpoint, options = {}) {
		const method = `connect[${this.type}-${this.name}]`;
		logger.debug(`${method} - start `);

		if (this.connected) {
			const message = `This service endpoint ${this.name}-${this.endpoint.url} is connected`;
			logger.error(message);
			throw Error(message);
		}

		if (this.service) {
			const message = `This service endpoint ${this.name}-${this.endpoint.url} has an active grpc service connection`;
			logger.error(message);
			throw Error(message);
		}

		if (!endpoint && !this.endpoint) {
			checkParameter('endpoint');
		}

		if (endpoint) {
			this.endpoint = endpoint;
		}

		this.options = Object.assign({}, this.endpoint.options, options);

		this.connectAttempted = true;
		logger.debug(`${method} - create the grpc service for ${this.name}`);
		this.service = new this.serviceClass(this.endpoint.addr, this.endpoint.creds, this.options);
		await this.waitForReady(this.service);
		logger.debug(`${method} - end - completed the waitForReady for ${this.name}`);
	}

	/**
	 * disconnect the service connection.
	 */
	disconnect() {
		const method = `disconnect[${this.type}-${this.name}]`;
		logger.debug(`${method} - start on ServiceEndpoint`);

		if (this.service) {
			logger.debug(`${method} ${this.type} ${this.name} - closing grpc service connection ${this.endpoint.addr}`);
			this.service.close();
			this.service = null;
			this.connected = false;
			this.connectAttempted = false;
		}

		logger.debug(`${method} - end on ServiceEndpoint`);
	}

	/**
	 * Check the connection status
	 * @param {boolean} [reset] - Optional, attempt to reconnect if endpoint is not connected
	 */
	async checkConnection(reset = true) {
		const method = `checkConnection[${this.type}-${this.name}]`;
		logger.debug('%s - start - connected:%s', method, this.connected);

		if (reset && this.connected) {
			try {
				await this.waitForReady();
			} catch (error) {
				logger.error(`ServiceEndpoint ${this.endpoint.url} connection failed :: ${error}`);
			}
		}

		if (reset && !this.connected && this.isConnectable()) {
			try {
				await this.resetConnection();
			} catch (error) {
				logger.error(`ServiceEndpoint ${this.endpoint.url} reset connection failed :: ${error}`);
			}
		}

		logger.debug('%s - end - connected:%s', method, this.connected);
		return this.connected;
	}

	/**
	 * Reset the connection
	 */
	async resetConnection() {
		const method = `resetConnection[${this.type}-${this.name}]`;
		logger.debug('%s - start - connected:%s', method, this.connected);

		this.disconnect(); // clean up possible old service
		this.connectAttempted = true;
		logger.debug(`${method} - create the grpc service for ${this.name}`);
		if (this.endpoint && this.serviceClass) {
			this.service = new this.serviceClass(this.endpoint.addr, this.endpoint.creds, this.options);
			await this.waitForReady(this.service);
		} else {
			throw Error(`ServiceEndpoint ${this.name} is missing endpoint information`);
		}

		logger.debug('%s - end - connected:%s', method, this.connected);
	}

	waitForReady() {
		const method = 'waitForReady';
		logger.debug(`${method} - start ${this.type}-${this.name} - ${this.endpoint.url}`);

		return new Promise((resolve, reject) => {
			logger.debug(`${method} - promise running ${this.name} - ${this.endpoint.url}`);
			const wait_ready_timeout = this.options['grpc-wait-for-ready-timeout'];
			const timeout = new Date().getTime() + wait_ready_timeout;
			if (!this.service) {
				reject(new Error(`ServiceEndpoint ${this.type}-${this.name} grpc service has not been started`));
			}
			this.service.waitForReady(timeout, (err) => {
				if (err) {
					if (err.message) {
						err.message = err.message + ' on ' + this.toString();
					}
					err.connectFailed = true;
					this.connected = false;
					logger.error(err);
					logger.error(`${method} - Failed to connect to remote gRPC server ${this.name} url:${this.endpoint.url} timeout:${wait_ready_timeout}`);
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
	getCharacteristics(results) {
		results.connection = {
			type: this.type,
			name: this.name,
			url: this.endpoint && this.endpoint.url || '',
			options: this.endpoint && this.endpoint.options || {}
		};
		results.peer = this.name;

		// remove private key
		if (results.connection.options.clientKey) {
			delete results.connection.options.clientKey;
		}

		return results;
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

		return `${this.type}- name: ${this.name}, url:${url}, connected:${this.connected}, connectAttempted:${this.connectAttempted}`;
	}

}

module.exports = ServiceEndpoint;
