/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Eventer';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);
const ServiceEndpoint = require('./ServiceEndpoint.js');

const fabproto6 = require('fabric-protos');

const FILTERED_BLOCK = 'filtered';
const FULL_BLOCK = 'full';
const PRIVATE_BLOCK = 'private';

let eventerCount = 1;

/**
 * Eventer is used to monitor for new blocks on a peer's ledger.
 * The class supports the connection to the service to the Peer's event service.
 * @class
 * @extends ServiceEndpoint
 */

class Eventer extends ServiceEndpoint {

	/**
	 * Constructs a Eventer object
	 *
	 * @param {string} name
	 * @param {Client} client - An instance of the Client class
	 * @param mspid
	 * @returns {Eventer} An instance of this class
	 */

	constructor(name = checkParameter('name'), client = checkParameter('client'), mspid) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name, client);
		this.type = TYPE;
		this.mspid = mspid;

		this.serviceClass = fabproto6.services.protos.Deliver;
		// grpc chat streaming on the service
		this.stream = null;
		// debug check
		this.myCount = eventerCount++;
	}

	/**
	 * Disconnects this Eventer from the fabric peer service and
	 * closes all services.
	 * The event listeners will be closed when EventService receives the "end"
	 * from the peer service.
	 */
	disconnect() {
		const method = `disconnect[${this.name}:${this.myCount}]`;
		logger.debug(`${method} - start on Eventer`);

		if (this.stream) {
			logger.debug(`${method} - shutdown existing stream`);
			this.stream.cancel();
			if (this.stream) {
				this.stream.end();
				this.stream = null;
			} else {
				logger.debug('%s - no stream to end', method);
			}
		} else {
			logger.debug(`${method} - no stream to close`);
		}

		super.disconnect();
		logger.debug(`${method} - end on Eventer`);
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
				this.disconnect();
				await this.resetConnection();
			} catch (error) {
				logger.error(`ServiceEndpoint ${this.endpoint.url} reset connection failed :: ${error}`);
			}
		}

		logger.debug('%s - end - connected:%s', method, this.connected);
		return this.connected;
	}

	/*
	 * internal utility method to check if the stream is ready.
	 * The stream must be readable, writeable and reading to be 'ready'
	 * and not paused.
	 */
	isStreamReady() {
		const method = `isStreamReady[[${this.name}:${this.myCount}]`;
		logger.debug(`${method} - start`);

		let ready = false;
		if (this.stream) {
			if (this.stream.isPaused()) {
				logger.debug(`${method} - grpc stream isPaused`);
				this.stream.resume();
			}
			ready = this.stream.readable && this.stream.writable;
		} else {
			logger.debug(`${method} - no stream to check`);
		}

		logger.debug(`${method} - stream ready ${ready}`);
		return ready;
	}

	/*
	 * internal method to get a new stream based on block type
	 */
	setStreamByType(blockType = checkParameter('blockType')) {
		if (blockType === FILTERED_BLOCK) {
			this.stream = this.service.deliverFiltered();
		} else if (blockType === FULL_BLOCK) {
			this.stream = this.service.deliver();
		} else if (blockType === PRIVATE_BLOCK) {
			this.stream = this.service.deliverWithPrivateData();
		} else {
			throw Error('Unknown block type');
		}

		return this;
	}
}

module.exports = Eventer;
