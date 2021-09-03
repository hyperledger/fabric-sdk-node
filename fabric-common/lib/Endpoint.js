/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Endpoint';

const grpc = require('fabric-protos/grpc');
const urlParser = require('url');

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

/**
 * The Endpoint class represents a remote grpc or grpcs target
 * @class
 */
class Endpoint {
	/**
	 *
	 * @param {object} options - All the necessary connection options.
	 *  Must include the url of the endpoint. If the protocol is grpcs
	 *  then it must also include the pem certificate for the TLS
	 *  connection.
	 */
	constructor(options = checkParameter('options')) {
		logger.debug(`${TYPE}.constructor - start `);
		this.type = TYPE;

		if (!options.url) {
			checkParameter('url');
		}
		this.options = options;
		const {url, pem, clientCert, clientKey} = options;
		this.url = url;
		const purl = urlParser.parse(url, true);
		if (purl.protocol) {
			this.protocol = purl.protocol.toLowerCase().slice(0, -1);
		}
		if (this.protocol === 'grpc') {
			this.addr = purl.host;
			this.creds = grpc.credentials.createInsecure();
		} else if (this.protocol === 'grpcs') {
			if (!(typeof pem === 'string')) {
				throw new Error('PEM encoded certificate is required.');
			}
			const pembuf = Buffer.concat([Buffer.from(pem), Buffer.from('\0')]);
			if (clientKey || clientCert) {
				// must have both clientKey and clientCert if either is defined
				if (clientKey && clientCert) {
					if ((typeof clientKey === 'string') && (typeof clientCert === 'string')) {
						const clientKeyBuf = Buffer.from(clientKey);
						const clientCertBuf = Buffer.concat([Buffer.from(clientCert), Buffer.from('\0')]);
						this.creds = grpc.credentials.createSsl(pembuf, clientKeyBuf, clientCertBuf);
					} else {
						throw new Error('PEM encoded clientKey and clientCert are required.');
					}
				} else {
					throw new Error('clientKey and clientCert are both required.');
				}
			} else {
				this.creds = grpc.credentials.createSsl(pembuf);
			}
			this.addr = purl.host;
		} else {
			throw Error('Invalid protocol: Protocol must be grpc or grpcs');
		}
	}

	/**
	 * Determine whether or not this endpoint uses TLS.
	 * @returns {boolean} True if this endpoint uses TLS, false otherwise.
	 */
	isTLS() {
		return this.protocol === 'grpcs';
	}

	toString() {
		return `Endpoint: {url: ${this.url}}`;
	}

}

module.exports = Endpoint;
