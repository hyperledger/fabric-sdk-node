/*
 * Copyright 2019, 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Client';

const crypto = require('crypto');

const {checkParameter, getLogger, pemToDER, setConfigSetting, getConfigSetting, newCryptoSuite} = require('./Utils.js');
const Channel = require('./Channel');
const Endpoint = require('./Endpoint');
const Committer = require('./Committer');
const Endorser = require('./Endorser');
const Eventer = require('./Eventer');
const Discoverer = require('./Discoverer');
const IdentityContext = require('./IdentityContext');
const logger = getLogger(TYPE);

/**
 * @classdesc
 * This class represents a Client, the central place
 * for connection and config information.
 *
 * @class
 */
const Client = class {

	/**
	 * Construct a Client object.
	 *
	 * @param {string} name - The name of the client.
	 *
	 * @returns {Client} The Client instance.
	 */
	constructor(name = checkParameter('name')) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		this.type = TYPE;

		this.name = name;
		this.mspid = null;

		this._tls_mutual = {};
		this._tls_mutual.selfGenerated = false;

		this.endorsers = new Map();
		this.committers = new Map();
		this.channels = new Map();

		// options for centralized management
		this.centralizedOptions = null;
	}

	/**
	 * Construct a Client object.
	 *
	 * @param {string} name - The name of the client.
	 */
	static newClient(name) {
		return new Client(name);
	}

	/**
	 * Builds an {@link IdentityContext} instance with the given user.
	 * Will be used when building proposals, commits, and queries.
	 * @param {User} [user] instance
	 */
	newIdentityContext(user = checkParameter('user')) {
		return new IdentityContext(user, this);
	}

	/**
	 * @typedef {Object} ConnectOptions
	 * @property {string} url The committer URL with format of 'grpc(s)://host:port'.
	 * @property {string} pem - The Endorser's TLS certificate, in PEM format,
	 *  to use with the grpcs protocol.
	 * @property {string} [clientKey] - Optional. The client private key, in PEM format,
	 *  to use with the grpcs protocol and mutual TLS. When not provided, the key
	 *  assigned to this client instance will be used.
	 * @property {string} clientCert - The public certificate, in PEM format,
	 *  to use with the grpcs protocol and mutual TLS. When not provided the cert
	 *  assigned to this client instance will be used.
	 * @property {Number} requestTimeout - The timeout to use for request on this
	 *  connection.
	 * @property {string} ssl-target-name-override - Used in test environment only,
	 *  when the server certificate's hostname (in the 'CN' field) does not match
	 *  the actual host endpoint that the server process runs at, the application
	 *  can work around the client TLS verify failure by setting this property to
	 *  the value of the server certificate's hostname
	 * @property {string} * - include any grpc options. These will be passed to
	 *  the grpc service. A grpc option must have a string key and integer or
	 *  string value.
	 */

	/**
	 * Utility method to merge connection options. The tls mutual and
	 * default connection options from the config will not override any passed
	 * in settings of the same name.
	 *
	 * @param {ConnectOptions} options - The object holding the application options
	 * that will be merged on top of this client's options.
	 * @returns {object} - The object holding both the application's options
	 *  and this client's options.
	 */
	getConnectionOptions(options) {
		const method = `getConnectionOptions: ${this.name}`;
		logger.debug('%s - start', method);

		// start with options from the config system (mainly config/default.json)
		let return_options = Object.assign({}, getConfigSetting('connection-options'));

		// override with any centralized options
		if (this.centralizedOptions) {
			logger.debug('%s - adding centralized options:%s', method, this.centralizedOptions);
			return_options = Object.assign(return_options, this.centralizedOptions);
		} else {
			logger.debug('%s - no centralized options', method);
		}

		// apply the tls info
		if (this._tls_mutual.clientCert && this._tls_mutual.clientKey) {
			return_options.clientCert = this._tls_mutual.clientCert;
			return_options.clientKey = this._tls_mutual.clientKey;
		}

		// now finally override with any specific options for this
		// connection
		return_options = Object.assign(return_options, options);

		return return_options;
	}

	/**
	 * Utility method to set the connection options required by this Client (application).
	 * These will be merged into new endpoints as this client creates new endpoints.
	 * Options provided here will override the default 'conection-options' from the
	 * config file ./config/default.json.
	 * @example {
		"grpc.max_receive_message_length": -1,
		"grpc.max_send_message_length": -1,
		"grpc.keepalive_time_ms": 120000,
 		"grpc.http2.min_time_between_pings_ms": 120000,
		"grpc.keepalive_timeout_ms": 20000,
		"grpc.http2.max_pings_without_data": 0,
		"grpc.keepalive_permit_without_calls": 1,
		"grpc-wait-for-ready-timeout": 3000,
		"request-timeout" : 45000
	 }
	 * @param {object} options - The options to be used by gRPC connections.
	 * @returns {Client} The Client instance.
	 */
	setCentralizedConnectionOptions(options) {
		const method = `setCentralizedConnectionOptions: ${this.name} `;
		logger.debug('%s - start %s', method, JSON.stringify(options));
		this.centralizedOptions = options;

		return this;
	}

	/**
	 * Use this method to build an endpoint options object. This may be reused
	 * when connecting to endorsers, committers, discovers and eventers. The input
	 * opts must have an "url" for connecting to a fabric service.
	 * @param {ConnectOptions} options
	 */
	newEndpoint(options = {}) {
		const method = `newEndpoint: ${this.name}`;
		logger.debug('%s - start', method);

		const _options = this.getConnectionOptions(options);
		const ssl_target_name_override = _options['ssl-target-name-override'];

		// make sure we have wait for ready timeout
		const timeout = _options['grpc-wait-for-ready-timeout'];
		if (!timeout) {
			_options['grpc-wait-for-ready-timeout'] = 3000; // default 3 seconds
		} else {
			if (Number.isInteger(timeout)) {
				logger.debug('%s grpc-wait-for-ready-timeout set to %s', method, timeout);
			} else {
				throw Error(`invalid grpc-wait-for-ready-timeout :: ${timeout}`);
			}
		}

		// make sure we have wait for request timeout
		const requestTimeout = _options.requestTimeout;
		if (!requestTimeout) {
			_options.requestTimeout = 3000; // default 3 seconds
		} else {
			if (Number.isInteger(requestTimeout)) {
				logger.debug('%s requestTimeout set to %s', method, requestTimeout);
			} else {
				throw Error(`invalid requestTimeout :: ${requestTimeout}`);
			}
		}

		if (typeof ssl_target_name_override === 'string') {
			_options['grpc.ssl_target_name_override'] = ssl_target_name_override;
			_options['grpc.default_authority'] = ssl_target_name_override;
			logger.debug('%s - ssl_target_name_override: %s', method, ssl_target_name_override);
		}
		const endpoint = new Endpoint(_options);
		logger.debug('new endpoint url: %s', _options.url);

		return endpoint;
	}

	/**
	 * Returns a {@link Endorser} instance with the given name.
	 * Will return a new instance. Does not check for existing instances
	 * and does not keep a reference to this instance.
	 *
	 * @param {string} name - The name of the endorser.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Endorser} The endorser instance.
	 */
	newEndorser(name = checkParameter('name'), mspid) {
		const method = `newEndorser: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		const endorser = new Endorser(name, this, mspid);

		logger.debug('%s return new endorser name:%s', method, name);
		return endorser;
	}

	/**
	 * Returns a {@link Endorser} instance with the given name.
	 * Will return an existing instance if one exist or it will
	 * create a new instance and save a reference.
	 *
	 * @param {string} name - The name of the endorser.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Endorser} The endorser instance.
	 */
	getEndorser(name = checkParameter('name'), mspid) {
		const method = `getEndorser: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		let endorser = this.endorsers.get(name);
		if (!endorser) {
			logger.debug('%s create endorser name:%s', method, name);
			endorser = new Endorser(name, this, mspid);
			this.endorsers.set(name, endorser);
		} else {
			logger.debug('%s existing endorser name:%s', method, name);
		}

		logger.debug('%s return endorser name:%s', method, name);
		return endorser;
	}

	/**
	 * Will return an array of {@link Endorser} instances that have been
	 * created by this client instance. Include a MSPID to only return endorsers
	 * in a specific organization.
	 *
	 * @param {string} [mspid] - Optional. The mspid of the endorsers to return
	 * @return {Endorser[]} the list of {@link Endorser}s.
	 */
	getEndorsers(mspid) {
		const method = `getEndorsers[${this.name}]`;
		logger.debug(`${method} - start`);

		return Channel._getServiceEndpoints(this.endorsers.values(), 'Endorser', mspid);
	}

	/**
	 * Returns a {@link Committer} instance with the given name.
	 * Will return a new instance. Does not check for existing instances
	 * and does not keep a reference to this instance.
	 *
	 * @param {string} name - The name of the Committer.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Committer} The committer instance.
	 */
	newCommitter(name = checkParameter('name'), mspid) {
		const method = `newCommitter: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		const committer = new Committer(name, this, mspid);

		logger.debug('%s return new committer name:%s', method, name);
		return committer;
	}

	/**
	 * Returns a {@link Committer} instance with the given name.
	 * Will return an existing instance if one exist or it will
	 * create a new instance and save a reference.
	 *
	 * @param {string} name - The name of the committer.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Committer} The committer instance.
	 */
	getCommitter(name = checkParameter('name'), mspid) {
		const method = `getCommitter: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		let committer = this.committers.get(name);
		if (!committer) {
			logger.debug('%s create committer name:%s', method, name);
			committer = new Committer(name, this, mspid);
			this.committers.set(name, committer);
		} else {
			logger.debug('%s existing committer name:%s', method, name);
		}

		logger.debug('%s return committer name:%s', method, name);
		return committer;
	}

	/**
	 * Will return an array of {@link Committer} instances that have been
	 * assigned to this channel instance. Include a MSPID to only return committers
	 * in a specific organization.
	 *
	 * @param {string} [mspid] - Optional. The mspid of the endorsers to return
	 * @return {Committer[]} the list of {@link Committer}s.
	 */
	getCommitters(mspid) {
		const method = `getCommitters[${this.name}]`;
		logger.debug(`${method} - start`);

		return Channel._getServiceEndpoints(this.committers.values(), 'Committer', mspid);
	}

	/**
	 * Returns a {@link Eventer} instance with the given name.
	 * Will return a new instance. Does not check for existing instances
	 * and does not keep a reference to this instance.
	 *
	 * @param {string} name - The name of the Eventer.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Eventer} The Eventer instance.
	 */
	newEventer(name = checkParameter('name'), mspid) {
		const method = `newEventer: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		const eventer = new Eventer(name, this, mspid);

		logger.debug('%s return new Eventer name:%s', method, name);
		return eventer;
	}

	/**
	 * Returns a {@link Discoverer} instance with the given name.
	 * Will return a new instance. Does not check for existing instances
	 * and does not keep a reference to this instance.
	 *
	 * @param {string} name - The name of the Discoverer.
	 * @param {string} [mspid] - Optional. The MSP id
	 * @returns {Discoverer} The Discoverer instance.
	 */
	newDiscoverer(name = checkParameter('name'), mspid) {
		const method = `newDiscoverer: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		const discoverer = new Discoverer(name, this, mspid);

		logger.debug('%s return new Discoverer name:%s', method, name);
		return discoverer;
	}

	/**
	 * Returns a {@link Channel} instance with the given name.
	 * Will return a new instance. Does not check for existing instances
	 * and does not keep a reference to this instance.
	 *
	 * @param {string} name The name of the channel.
	 * @returns {Channel} The channel instance.
	 */
	newChannel(name = checkParameter('name')) {
		const method = `newChannel: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		const channel = new Channel(name, this);

		logger.debug('%s return new channel name:%s', method, name);
		return channel;
	}

	/**
	 * Returns a {@link Channel} instance with the given name.
	 * Will return an existing instance or create a new one and store
	 * a reference to this instance.
	 *
	 * @param {string} name The name of the channel.
	 * @returns {Channel} The channel instance.
	 */
	getChannel(name = checkParameter('name')) {
		const method = `getChannel: ${this.name}`;
		logger.debug('%s start name:%s', method, name);

		let channel = this.channels.get(name);
		if (!channel) {
			logger.debug('%s create channel name:%s', method, name);
			channel = new Channel(name, this);
			this.channels.set(name, channel);
		} else {
			logger.debug('%s existing channel name:%s', method, name);
		}

		logger.debug('%s return channel name:%s', method, name);
		return channel;
	}

	/**
	 * Sets the mutual TLS client side certificate and key necessary to build
	 * network endpoints when working with a common connection profile (connection profile).
	 * This must be called before a endorser, committer, or channel eventhub is needed.
	 *
	 * If the tls client material has not been provided for the client, it will be
	 * generated if the user has been assigned to this client. Note that it will
	 * always use the default software cryptosuite, not the one assigned to the
	 * client.
	 *
	 * @param {string} clientCert - The pem encoded client certificate.
	 * @param {byte[]} clientKey - The client key.
	 */
	setTlsClientCertAndKey(clientCert, clientKey) {
		const method = `setTlsClientCertAndKey: ${this.name}`;
		logger.debug('%s - start', method);
		if (clientCert && clientKey) {
			this._tls_mutual.clientCert = clientCert;
			this._tls_mutual.clientKey = clientKey;
			this._tls_mutual.selfGenerated = false;
		} else {
			logger.debug('%s - generating self-signed TLS client certificate', method);
			// generate X509 cert pair
			// use the default software cryptosuite, not the client assigned cryptosuite, which may be
			// HSM, or the default has been set to HSM. FABN-830
			const key = newCryptoSuite({software: true}).generateEphemeralKey();
			this._tls_mutual.clientKey = key.toBytes();
			this._tls_mutual.clientCert = key.generateX509Certificate('fabric-common');
			this._tls_mutual.selfGenerated = true;
		}

		return this;
	}

	/**
	 * Utility method to add the mutual tls client material to a set of options.
	 * @param {ConnectOptions} options - The options object holding the connection settings
	 *  that will be updated with the mutual TLS clientCert and clientKey.
	 * @throws Will throw an error if generating the tls client material fails
	 */
	addTlsClientCertAndKey(options) {
		// use client cert pair if it exists and is not a self cert generated by this class
		if (!this._tls_mutual.selfGenerated && this._tls_mutual.clientCert && this._tls_mutual.clientKey) {
			options.clientCert = this._tls_mutual.clientCert;
			options.clientKey = this._tls_mutual.clientKey;
		}

		return this;
	}

	/*
	 * Get the client certificate hash
	 * @returns {byte[]} The hash of the client certificate
	 */
	getClientCertHash() {
		const method = `getClientCertHash: ${this.name}`;
		logger.debug('%s - start', method);
		if (this._tls_mutual.clientCertHash) {
			return this._tls_mutual.clientCertHash;
		}

		if (this._tls_mutual.clientCert) {
			logger.debug('%s - using clientCert %s', method, this._tls_mutual.clientCert);
			const der_cert = pemToDER(this._tls_mutual.clientCert);
			this._tls_mutual.clientCertHash = computeHash(der_cert);
		} else {
			logger.debug('%s - no tls client cert', method);
		}

		return this._tls_mutual.clientCertHash;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return `Client: {name:${this.name}}`;
	}

	/**
	 * Adds a setting to override all settings that are part of the hierarchical configuration.
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} value - The value of a setting
	 */
	static setConfigSetting(name, value) {
		setConfigSetting(name, value);
	}

	// make available from the client instance
	setConfigSetting(name, value) {
		setConfigSetting(name, value);
	}

	/**
	 * Retrieves a setting from the hierarchical configuration and if not found
	 * will return the provided default value.
	 *
	 * <br><br>
	 * The hierarchical configuration settings search order for a setting <code>aa-bb</code>:
	 * <ol>
	 * <li> memory: if the setting has been added with <pre>Client.setConfigSetting('aa-bb', 'value')</pre>
	 * <li> Command-line arguments: like <pre>node app.js --aa-bb value</pre>
	 * <li> Environment variables: <pre>AA_BB=value node app.js</pre>
	 * <li> Custom Files: all files added with <code>addConfigFile(path)</code>
	 *     will be ordered by when added, where same settings in the files added later will override those added earlier
	 * <li> The file located at <code>lib/config/default.json</code> with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} default_value - The value of a setting if not found in the hierarchical configuration
	 */
	static getConfigSetting(name, default_value) {

		return getConfigSetting(name, default_value);
	}

	// make available from the client instance
	getConfigSetting(name, default_value) {

		return getConfigSetting(name, default_value);
	}
};

function computeHash(data) {
	const sha256 = crypto.createHash('sha256');
	return sha256.update(data).digest();
}

module.exports = Client;
