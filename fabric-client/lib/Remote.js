/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


'use strict';

const grpc = require('grpc');
const urlParser = require('url');

const utils = require('./utils.js');
const logger = utils.getLogger('Remote.js');
const {hash_sha2_256} = require('./hash');
const MAX_SEND = 'grpc.max_send_message_length';
const MAX_RECEIVE = 'grpc.max_receive_message_length';
const MAX_SEND_V10 = 'grpc-max-send-message-length';
const MAX_RECEIVE_V10 = 'grpc-max-receive-message-length';

// the logger available during construction of instances
const super_logger = utils.getLogger('Remote.js');

/**
 * The Remote class represents a the base class for all remote nodes, Peer, Orderer , and MemberServicespeer.
 *
 * @class
 */
class Remote {

	/**
	 * Constructs an object with the endpoint configuration settings.
	 *
	 * @param {string} url The orderer URL with format of 'grpc(s)://host:port'.
	 * @param {Object} opts An Object that may contain options to pass to grpcs calls
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- clientKey {string} The private key file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol with client certificates.
	 * <br>- clientCert {string} The public certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol with client certificates.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 *        grpc options must be an object with string keys and integer or string values
	 */
	constructor(url, opts = {}) {
		this._options = {};
		for (const key in opts) {
			const value = opts[key];
			if (value && typeof value !== 'string' && !Number.isInteger(value)) {
				throw new Error(`invalid grpc option value:${key}-> ${value} expected string|integer`);
			}
			if (key !== 'pem' && key !== 'ssl-target-name-override') {
				this._options[key] = value;
			}
		}

		const {pem, clientKey, clientCert, ['ssl-target-name-override']: ssl_target_name_override} = opts;

		this.clientCert = clientCert;

		// connection options

		if (ssl_target_name_override && typeof ssl_target_name_override === 'string') {
			this._options['grpc.ssl_target_name_override'] = ssl_target_name_override;
			this._options['grpc.default_authority'] = ssl_target_name_override;
		}

		let grpc_receive_max;
		if (opts[MAX_RECEIVE_V10]) {
			grpc_receive_max = opts[MAX_RECEIVE_V10];
		} else if (opts[MAX_RECEIVE]) {
			grpc_receive_max = opts[MAX_RECEIVE];
		} else {
			grpc_receive_max = utils.getConfigSetting(MAX_RECEIVE_V10);
			if (typeof grpc_receive_max === 'undefined') {
				grpc_receive_max = utils.getConfigSetting(MAX_RECEIVE);
			}
		}
		if (typeof grpc_receive_max === 'undefined') {
			grpc_receive_max = -1; // default is unlimited
		}
		// keep this for backward compatibility until remove probably deprecated code (lines 83-115)
		this._options[MAX_RECEIVE] = (this._options[MAX_RECEIVE] && (this._options[MAX_RECEIVE] !== -1))
			? this._options[MAX_RECEIVE] : grpc_receive_max;

		let grpc_send_max;
		if (opts[MAX_SEND_V10]) {
			grpc_send_max = opts[MAX_SEND_V10];
		} else if (opts[MAX_SEND]) {
			grpc_send_max = opts[MAX_SEND];
		} else {
			grpc_send_max = utils.getConfigSetting(MAX_SEND_V10);
			if (typeof grpc_send_max === 'undefined') {
				grpc_send_max = utils.getConfigSetting(MAX_SEND);
			}
		}
		if (typeof grpc_send_max === 'undefined') {
			grpc_send_max = -1; // default is unlimited
		}
		this._options[MAX_SEND] = (this._options[MAX_SEND] && (this._options[MAX_SEND] !== -1)) ? this._options[MAX_SEND] : grpc_send_max;

		// service connection
		this._url = url;
		this._endpoint = new Endpoint(url, pem, clientKey, this.clientCert);

		// what shall we call this remote object
		if (opts && opts.name) {
			this._name = opts.name;
		} else {
			const split = url.split('//');
			this._name = split[1];
		}

		// node.js based timeout
		if (utils.checkIntegerConfig(opts, 'request-timeout')) {
			this._request_timeout = opts['request-timeout'];
		} else {
			this._request_timeout = utils.getConfigSetting('request-timeout', 30000); // default 30 seconds
		}

		if (utils.checkIntegerConfig(opts, 'grpc-wait-for-ready-timeout')) {
			this._grpc_wait_for_ready_timeout = opts['grpc-wait-for-ready-timeout'];
		} else {
			this._grpc_wait_for_ready_timeout = utils.getConfigSetting('grpc-wait-for-ready-timeout', 3000); // default 3 seconds
		}

		super_logger.debug(' ** Remote instance url: %s, name: %s, options loaded are:: %j', this._url, this._name, this._options);
	}

	waitForReady(client) {
		const self = this;
		if (!client) {
			throw new Error('Missing required gRPC client');
		}
		const timeout = new Date().getTime() + this._grpc_wait_for_ready_timeout;

		return new Promise((resolve, reject) => {
			client.waitForReady(timeout, (err) => {
				if (err) {
					if (err.message) {
						err.message = err.message + ' URL:' + self.getUrl();
					}
					err.connectFailed = true;
					logger.error(err);

					return reject(err);
				}
				logger.debug('Successfully connected to remote gRPC server');
				resolve();
			});
		});
	}

	/**
	 * Get the name. This is a client-side only identifier for this
	 * object.
	 * @returns {string} The name of the object
	 */
	getName() {
		return this._name;
	}

	/**
	 * Set the name as a client-side only identifier of this object.
	 * @param {string} name
	 */
	setName(name) {
		this._name = name;
	}

	/**
	 * Get the URL of this object.
	 * @returns {string} Get the URL associated with the object.
	 */
	getUrl() {
		logger.debug('getUrl::' + this._url);
		return this._url;
	}

	/**
	 * Get the client certificate hash
	 * @returns {byte[]} The hash of the client certificate
	 */
	getClientCertHash() {
		if (this.clientCert) {
			const der_cert = utils.pemToDER(this.clientCert);
			const hash = new hash_sha2_256();
			return hash.reset().update(der_cert).finalize();
		} else {
			return null;
		}
	}

	/**
	 * Get this remote endpoints characteristics
	 *   It's name, url, and connection options are
	 *   the items that make this instance unique.
	 *   These items may be useful when debugging issues
	 *   or validating responses.
	 */
	getCharacteristics() {
		const characteristics = {};
		characteristics.url = this._url;
		characteristics.name = this._name;
		characteristics.options = this._options;
		// remove a private key
		if (characteristics.options.clientKey) {
			delete characteristics.options.clientKey;
		}

		return characteristics;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return ' Remote : {' +
			'url:' + this._url +
			'}';
	}

	/**
	 * Determine whether or not this remote endpoint uses TLS.
	 * @returns {boolean} True if this endpoint uses TLS, false otherwise.
	 */
	isTLS() {
		return this._endpoint.isTLS();
	}

}

module.exports = Remote;

/**
 * The Endpoint class represents a remote grpc or grpcs target
 * @class
 */
class Endpoint {
	/**
	 *
	 * @param {string} url
	 * @param {string} pem
	 * @param {string} clientKey
	 * @param {string} clientCert
	 */
	constructor(url, pem, clientKey, clientCert) {

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
			const error = new Error();
			error.name = 'InvalidProtocol';
			error.message = 'Invalid protocol: ' + this.protocol + '.  URLs must begin with grpc:// or grpcs://';
			throw error;
		}
	}

	/**
	 * Determine whether or not this endpoint uses TLS.
	 * @returns {boolean} True if this endpoint uses TLS, false otherwise.
	 */
	isTLS() {
		return this.protocol === 'grpcs';
	}

}

module.exports.Endpoint = Endpoint;
