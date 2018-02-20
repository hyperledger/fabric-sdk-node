/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var grpc = require('grpc');
var urlParser = require('url');
var crypto = require('crypto');
var util = require('util');

var utils = require('./utils.js');
var logger = utils.getLogger('Remote.js');
var Hash = require('./hash.js');


/**
 * The Remote class represents a the base class for all remote nodes, Peer, Orderer , and MemberServicespeer.
 *
 * @class
 */
var Remote = class {

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
	 */
	constructor(url, opts) {
		var _name = null;
		var pem = null;
		var clientKey = null;
		this.clientCert = null;
		var ssl_target_name_override = '';
		var default_authority = '';

		if (opts && opts.pem) {
			pem = opts.pem;
		}

		if (opts && opts.clientKey) {
			clientKey = opts.clientKey;
		}

		if (opts && opts.clientCert) {
			this.clientCert = opts.clientCert;
		}

		if (opts && opts['ssl-target-name-override']) {
			ssl_target_name_override = opts['ssl-target-name-override'];
			default_authority = opts['ssl-target-name-override'];
		}

		// connection options
		this._options = {};
		if (ssl_target_name_override !== '') {
			this._options['grpc.ssl_target_name_override'] = ssl_target_name_override;
		}

		if (default_authority !== '') {
			this._options['grpc.default_authority'] = default_authority;
		}

		for (let key in opts ? opts : {}) {
			if (opts.hasOwnProperty(key)) {
				if (key !== 'pem' && key !== 'ssl-target-name-override') {
					this._options[key] = opts[key];
				}
			}
		}

		if(!this._options['grpc.max_receive_message_length']) {
			let grpc_receive_max = utils.getConfigSetting('grpc.max_receive_message_length');
			if(!grpc_receive_max) {
				grpc_receive_max = utils.getConfigSetting('grpc-max-receive-message-length');
			}
			// if greater than 0, set to that specific limit
			// if equal to -1, set to that to have no limit
			// if 0, do not set anything to use the system default
			if (grpc_receive_max > 0 || grpc_receive_max === -1)
				this._options['grpc.max_receive_message_length'] = grpc_receive_max;
		}

		if(!this._options['grpc.max_send_message_length']) {
			let grpc_send_max = utils.getConfigSetting('grpc.max_send_message_length');
			if(!grpc_send_max) {
				grpc_send_max = utils.getConfigSetting('grpc-max-send-message-length');
			}
			// if greater than 0, set to that specific limit
			// if equal to -1, set to that to have no limit
			// if 0, do not set anything to use the system default
			if (grpc_send_max > 0 || grpc_send_max === -1)
				this._options['grpc.max_send_message_length'] = grpc_send_max;
		}

		// service connection
		this._url = url;
		this._endpoint = new Endpoint(url, pem, clientKey, this.clientCert);

		// node.js based timeout
		this._request_timeout = 30000;
		if(opts && opts['request-timeout']) {
			this._request_timeout = opts['request-timeout'];
		}
		else {
			this._request_timeout = utils.getConfigSetting('request-timeout',30000); //default 30 seconds
		}
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
		logger.debug('getUrl::'+this._url);
		return this._url;
	}

	/**
	 * Get the client certificate hash
	 * @returns {byte[]} The hash of the client certificate
	 */
	getClientCertHash() {
		let hash = null;
		if(this.clientCert) {
			let der_cert = utils.pemToDER(this.clientCert);
			hash = computeHash(der_cert);
		}
		return hash;
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		return ' Remote : {' +
			'url:' + this._url +
		'}';
	}
};

module.exports = Remote;

//
// The Endpoint class represents a remote grpc or grpcs target
//
var Endpoint = class {
	constructor(url /*string*/ , pem /*string*/ , clientKey /*string*/ , clientCert /*string*/) {
		var fs = require('fs'),
			path = require('path');

		var purl = urlParser.parse(url, true);
		var protocol;
		if (purl.protocol) {
			protocol = purl.protocol.toLowerCase().slice(0, -1);
		}
		if (protocol === 'grpc') {
			this.addr = purl.host;
			this.creds = grpc.credentials.createInsecure();
		} else if (protocol === 'grpcs') {
			if(!(typeof pem === 'string')) {
				throw new Error('PEM encoded certificate is required.');
			}
			if (clientKey || clientCert){
				// must have both clientKey and clientCert if either is defined
				if (clientKey && clientCert){
					if ((typeof clientKey === 'string') && (typeof clientCert === 'string')) {
						this.creds = grpc.credentials.createSsl(Buffer.from(pem),
						Buffer.from(clientKey), Buffer.from(clientCert));
					} else {
						throw new Error('PEM encoded clientKey and clientCert are required.');
					}
				} else {
					throw new Error('clientKey and clientCert are both required.');
				}
			} else {
				var pembuf = Buffer.concat([Buffer.from(pem), Buffer.from('\0')]);
				this.creds = grpc.credentials.createSsl(pembuf);
			}
			this.addr = purl.host;
		} else {
			var error = new Error();
			error.name = 'InvalidProtocol';
			error.message = 'Invalid protocol: ' + protocol + '.  URLs must begin with grpc:// or grpcs://';
			throw error;
		}
	}
};

// Compute hash for replay protection
function computeHash(data) {
	var sha256 = crypto.createHash('sha256');
	return sha256.update(data).digest();
}

module.exports.Endpoint = Endpoint;
