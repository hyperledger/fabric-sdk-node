/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

var sdkUtils = require('./utils.js');

/**
 * Base class for a client that can use a {@link CryptoSuite} to sign and hash.
 * It also contains utility methods for constructing new instances of {@link CryptoKeyStore},
 * [CryptoSuite]{@link module:api.CryptoSuite} and [KeyValueStore]{@link module:api.KeyValueStore}
 *
 * @class
 */
var BaseClient = class {
	constructor() {
		this._cryptoSuite = null;
	}

	/**
	 * @typedef {Object} CryptoSetting
	 * @property {boolean} software Whether to load a software-based implementation (true) or HSM implementation (false)
   	 *    default is true (for software based implementation), specific implementation module is specified
	 *    in the setting 'crypto-suite-software'
	 * @property {number} keysize The key size to use for the crypto suite instance. default is value of the setting 'crypto-keysize'
	 * @property {string} algorithm Digital signature algorithm, currently supporting ECDSA only with value 'EC'
	 * @property {string} hash 'SHA2' or 'SHA3'
	 */

	/**
	 * This is a factory method. It returns a new instance of the CryptoSuite API implementation, based on the "setting"
	 * that is passed in, or if skipped, based on default values of the {@link CryptoSetting} properties.
	 *
	 * @param {CryptoSetting} setting Optional
	 * @returns {module:api.CryptoSuite} a new instance of the CryptoSuite API implementation
	 */
	static newCryptoSuite(setting) {
		return sdkUtils.newCryptoSuite(setting);
	}

	/**
	 * This is a factory method. It returns a new instance of the {@link CryptoKeyStore}.
	 *
	 * When the application needs to use a key store other than the default,
	 * it should create a new CryptoKeyStore and set it on the CryptoSuite.
	 *
	 * <br><br><code>cryptosuite.setCryptoKeyStore(Client.newCryptoKeyStore(KVSImplClass, opts))</code>
	 *
	 * @param {api.KeyValueStore} KVSImplClass Optional. The built-in key store saves private keys. The key store may be backed by different
	 * {@link KeyValueStore} implementations. If specified, the value of the argument must point to a module implementing the
	 * KeyValueStore interface.
	 * @param {Object} opts Implementation-specific option object used in the constructor
	 * @returns {CryptoKeyStore} a new instance of the CryptoKeystore
	 */
	static newCryptoKeyStore(KVSImplClass, opts) {
		return sdkUtils.newCryptoKeyStore(KVSImplClass, opts);
	}

	/**
	 * Obtains an instance of the [KeyValueStore]{@link module:api.KeyValueStore} class. By default
	 * it returns the built-in implementation, which is based on files ([FileKeyValueStore]{@link module:api.FileKeyValueStore}).
	 * This can be overriden with a configuration setting <code>key-value-store</code>, the value of which is the
	 * full path of a CommonJS module for the alternative implementation.
	 *
	 * @param {Object} options Specific to the implementation, for initializing the instance. For the built-in
	 * file-based implementation, this requires a single property <code>path</code> to the top-level folder for the store
	 * @returns {Promise} A Promise for a {@link module:api.KeyValueStore} instance of the KeyValueStore implementation
	 */
	static newDefaultKeyValueStore(options) {
		return sdkUtils.newKeyValueStore(options);
	}

	/**
	 * Configures a logger for the entire SDK to use and override the default logger. Unless this method is called,
	 * the SDK uses a default logger based on [winston]{@link https://www.npmjs.com/package/winston}.
	 * When using the built-in winston based logger, use the configuration setting <code>hfc-logging</code> to pass
	 * in configurations in the following format:
	 * <br><br>
	 * <pre>
	 * {
	 *   'error': 'error.log',			// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
	 *   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
	 *   'info': 'console'			// 'console' is a keyword for logging to console
	 * }
	 * </pre>
	 * <br>
	 * @param {Object} logger a logger instance that defines the following methods: debug(), info(), warn(), error() with
	 * string interpolation methods like [util.format]{@link https://nodejs.org/api/util.html#util_util_format_format}.
	 */
	static setLogger(logger) {
		var err = '';

		if (typeof logger.debug !== 'function') {
			err += 'debug() ';
		}

		if (typeof logger.info !== 'function') {
			err += 'info() ';
		}

		if (typeof logger.warn !== 'function') {
			err += 'warn() ';
		}

		if (typeof logger.error !== 'function' ) {
			err += 'error()';
		}

		if (err !== '') {
			throw new Error('The "logger" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		if (global.hfc) {
			global.hfc.logger = logger;
		} else {
			global.hfc = {
				logger: logger
			};
		}
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

		return sdkUtils.getConfigSetting(name, default_value);
	}
	// make available from the client instance
	getConfigSetting(name, default_value) {

		return BaseClient.getConfigSetting(name, default_value);
	}

	/**
	 * Adds a file to the top of the list of configuration setting files that are
	 * part of the hierarchical configuration.
	 * These files will override the default settings and be overriden by environment,
	 * command line arguments, and settings programmatically set into configuration settings.
	 *
	 * <br><p>
	 * The hierarchical configuration settings search order: see {@link BaseClient.getConfigSetting}
	 * @param {String} path - The path to the file to be added to the top of list of configuration files
	 */
	static addConfigFile(path) {
		sdkUtils.addConfigFile(path);
	}

	/**
	 * Adds a setting to override all settings that are
	 * part of the hierarchical configuration.
	 *
	 * <br><p>
	 * The hierarchical configuration settings search order: see {@link BaseClient.getConfigSetting}
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} value - The value of a setting
	 */
	static setConfigSetting(name, value) {
		sdkUtils.setConfigSetting(name, value);
	}
	// make available from the client instance
	setConfigSetting(name, value) {
		BaseClient.setConfigSetting(name, value);
	}


	/**
	 * Use this method to get a logger that will add entries to the same location
	 * being used by the Hyperledger Fabric client.
	 *
	 * @param {string} name - The name of the label to be added to the log entries.
	 *        To help identify the source of the log entry.
	 * @returns {Logger} The logger that may be used to log entires with
	 *         'info()', 'warn()', 'error()' and 'debug()' methods to mark the
	 *         the type of the log entries.
	 */
	static getLogger(name) {
		return sdkUtils.getLogger(name);
	}

	/**
	 * Sets the client instance to use the CryptoSuite object for signing and hashing
	 *
	 * Creating and setting a CryptoSuite is optional because the client will construct
	 * an instance based on default configuration settings:
	 * <li> crypto-hsm: use an implementation for Hardware Security Module (if set to true) or software-based key management (if set to false)
	 * <li> crypto-keysize: security level, or key size, to use with the digital signature public key algorithm. Currently ECDSA
	 *  is supported and the valid key sizes are 256 and 384
	 * <li> crypto-hash-algo: hashing algorithm
	 * <li> key-value-store: some CryptoSuite implementation requires a key store to persist private keys. A {@link CryptoKeyStore}
	 *  is provided for this purpose, which can be used on top of any implementation of the {@link KeyValueStore} interface,
	 *  such as a file-based store or a database-based one. The specific implementation is determined by the value of this configuration setting.
	 *
	 * @param {module:api.CryptoSuite} cryptoSuite the CryptoSuite object
	 */
	setCryptoSuite(cryptoSuite) {
		this._cryptoSuite = cryptoSuite;
	}

	/**
	 * Returns the {@link CryptoSuite} object used by this client instance
	 * @returns {module:api.CryptoSuite}
	 */
	getCryptoSuite() {
		return this._cryptoSuite;
	}

	/**
	 * Fixes a certificate string that may not be in the correct format.
	 * Make sure there's a start line with '-----BEGIN CERTIFICATE-----'
	 * and end line with '-----END CERTIFICATE-----', so as to be compliant
	 * with x509 parsers.
	 * Will remove or add required linefeeds and carriage returns.
	 *
	 * @param {string} raw - a string that contains a X509 certiicate
	 * @throws {Error} An error indicating that the begining and end parts are
	 *         not correct.
	 */
	static normalizeX509(raw) {
		return sdkUtils.normalizeX509(raw);
	}
};

module.exports = BaseClient;
