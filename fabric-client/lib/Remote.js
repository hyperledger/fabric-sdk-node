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

var utils = require('./utils.js');
var logger = utils.getLogger('Remote.js');


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
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 */
	constructor(url, opts) {
		var pem = null;
		var ssl_target_name_override = '';
		var default_authority = '';

		if (opts && opts.pem) {
			pem = opts.pem;
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

		let grpc_receive_max = utils.getConfigSetting('grpc-max-receive-message-length');
		let grpc_send_max = utils.getConfigSetting('grpc-max-send-message-length');
		// if greater than 0, set to that specific limit
		// if equal to -1, set to that to have no limit
		// if 0, do not set anything to use the system default
		if (grpc_receive_max > 0 || grpc_receive_max === -1)
			this._options['grpc.max_receive_message_length'] = grpc_receive_max;

		// if greater than 0, set to that specific limit
		// if equal to -1, set to that to have no limit
		// if 0, do not set anything to use the system default
		if (grpc_send_max > 0 || grpc_send_max === -1)
			this._options['grpc.max_send_message_length'] = grpc_send_max;

		// service connection
		this._url = url;
		this._endpoint = new Endpoint(url, pem);

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
	 * Get the URL of the orderer.
	 * @returns {string} Get the URL associated with the Orderer.
	 */
	getUrl() {
		logger.debug('getUrl::'+this._url);
		return this._url;
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
	constructor(url /*string*/ , pem /*string*/ ) {
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
			this.addr = purl.host;
			this.creds = grpc.credentials.createSsl(new Buffer(pem));
		} else {
			var error = new Error();
			error.name = 'InvalidProtocol';
			error.message = 'Invalid protocol: ' + protocol + '.  URLs must begin with grpc:// or grpcs://';
			throw error;
		}
	}
};

module.exports.Endpoint = Endpoint;
