/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Eventer';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);
const ServiceEndpoint = require('./ServiceEndpoint.js');

const fabprotos = require('fabric-protos');

const _validation_codes = {};
let keys = Object.keys(fabprotos.protos.TxValidationCode);
for (const key of keys) {
	const new_key = fabprotos.protos.TxValidationCode[key];
	_validation_codes[new_key] = key;
}

const _header_types = {};
keys = Object.keys(fabprotos.common.HeaderType);
for (const key of keys) {
	const new_key = fabprotos.common.HeaderType[key];
	_header_types[new_key] = key;
}

const FILTERED_BLOCK = 'filtered';
const FULL_BLOCK = 'full';
const PRIVATE_BLOCK = 'private';

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

		this.serviceClass = fabprotos.protos.Deliver;
		// grpc chat streaming on the service
		this.stream = null;
		// the streams can live on, so lets be sure we are working with
		// the right one if we get restarted
		this._current_stream = 0;
		this._stream_starting = false;
	}

	/**
	 * Disconnects this Eventer from the fabric peer service and
	 * closes all services.
	 * The event listeners will be closed when EventService receives the "end"
	 * from the peer service.
	 */
	disconnect() {
		const method = `disconnect[${this.name}]`;
		logger.debug(`${method} - start - hub`);
		if (this.stream) {
			logger.debug(`${method} - shutdown existing stream`);
			this.stream.cancel();
			this.stream.end();
			this._stream_starting = false;
			this.stream = null;
		} else {
			logger.debug(`${method} - no stream to close`);
		}

		super.disconnect();
		logger.debug(`${method} - end`);
	}

	/**
	 * Check the connection status
	 */
	async checkConnection() {
		const method = `checkConnection[${this.name}]`;
		logger.debug(`${method} - start`);

		let result = false;
		if (this.service) {
			try {
				await this.waitForReady();
				result = true;
			} catch (error) {
				logger.error(`${method} Event Service ${this.endpoint.url} Connection check failed :: ${error}`);
			}
		}
		if (this.stream) {
			try {
				const is_paused = this.stream.isPaused();
				logger.debug(`${method} - stream isPaused :${is_paused}`);
				if (is_paused) {
					this.stream.resume();
					logger.debug(`${method} - stream resumed`);
				}
				result = this.isStreamReady();
			} catch (error) {
				logger.error(`${method} Event Service ${this.endpoint.url} Stream check failed :: ${error}`);
				result = false;
			}
		}

		logger.debug('%s - end', method);
		return result;
	}

	/*
	 * internal utility method to check if the stream is ready.
	 * The stream must be readable, writeable and reading to be 'ready'
	 * and not paused.
	 */
	isStreamReady() {
		const method = 'isStreamReady';
		logger.debug(`${method} - start`);

		let ready = false;
		if (this.stream) {
			if (this.stream.isPaused()) {
				logger.debug(`${method} - grpc isPaused`);
			} else {
				ready = this.stream.readable && this.stream.writable && this.stream.reading;
			}
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