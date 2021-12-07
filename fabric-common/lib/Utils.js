/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Long = require('long');
const util = require('util');
const winston = require('winston');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const Config = require('./Config');
const InMemoryKeyValueStore = require('./impl/InMemoryKeyValueStore');
const CryptoKeyStore = require('./impl/CryptoKeyStore');
const sjcl = require('sjcl');
const yn = require('yn');

const fabricCommonConfigProperty = 'fabric-common-config';
//
// The following methods are for loading the proper implementation of an extensible APIs.
//

function isOldPropertyValue(value) {
	return typeof value === 'string' && value.startsWith('fabric-client/');
}

function isOldCryptoSuiteImpl(csImpl) {
	for (const key of Object.getOwnPropertyNames(csImpl)) {
		if (isOldPropertyValue(csImpl[key])) {
			return true;
		}
	}

	return false;
}

function getSoftwareCryptoSuiteImpl() {
	let result = exports.getConfigSetting('crypto-suite-software');
	if (!result || isOldCryptoSuiteImpl(result)) {
		result = {
			EC: 'fabric-common/lib/impl/CryptoSuite_ECDSA_AES'
		};
	}
	return result;
}

function getHsmCryptoSuiteImpl() {
	let result = exports.getConfigSetting('crypto-suite-hsm');
	if (!result || isOldCryptoSuiteImpl(result)) {
		result = {
			EC: 'fabric-common/lib/impl/bccsp_pkcs11'
		};
	}
	return result;
}

/**
 * @typedef {Object} CryptoSetting
 * @property {boolean} software - Whether to load a software-based implementation (true) or HSM implementation (false)
 * @property {number} keysize - The key size to use for the crypto suite instance.
 * @property {string} algorithm - Digital signature algorithm
 * @property {string} hash 'SHA2' or 'SHA3'
 */


/**
 * Returns a new instance of the CryptoSuite API implementation. Supports the following:
 * - newCryptoSuite({software: true, keysize: 256, algorithm: EC})
 * - newCryptoSuite({software: false, lib: '/usr/local/bin/pkcs11.so', slot: 0, pin: '1234'})
 * - newCryptoSuite({software: false, lib: '/usr/local/bin/pkcs11.so', label: 'ForFabric', pin: '1234'})
 * - newCryptoSuite({keysize: 384})
 * - newCryptoSuite()
 * @param {CryptoSetting} [setting]
 *  - property `software` default is true (for software based implementation),
 *          specific implementation module is specified in the setting 'crypto-suite-software'
 *  - property `algorithm` currently supporting ECDSA only with value "EC"
 *  - property `keysize` default is value of the setting 'crypto-keysize'
 */
module.exports.newCryptoSuite = (setting) => {
	let csImpl, keysize, algorithm, hashAlgo, opts = null;

	let useHSM = false;
	if (setting && typeof setting.software === 'boolean') {
		useHSM = !setting.software;
	} else {
		useHSM = yn(exports.getConfigSetting('crypto-hsm'));
	}

	csImpl = useHSM ? getHsmCryptoSuiteImpl() : getSoftwareCryptoSuiteImpl();

	// step 1: what's the cryptosuite impl to use, key size and algo
	if (setting && setting.keysize && typeof setting === 'object' && typeof setting.keysize === 'number') {
		keysize = setting.keysize;
	} else {
		keysize = exports.getConfigSetting('crypto-keysize');
	}

	if (setting && setting.algorithm && typeof setting === 'object' && typeof setting.algorithm === 'string') {
		algorithm = setting.algorithm.toUpperCase();
	} else {
		algorithm = 'EC';
	}

	if (setting && setting.hash && typeof setting === 'object' && typeof setting.hash === 'string') {
		hashAlgo = setting.hash.toUpperCase();
	} else {
		hashAlgo = null;
	}

	// csImpl at this point should be a map (see config/default.json) with keys being the algorithm
	csImpl = csImpl[algorithm];

	if (!csImpl) {
		throw new Error(util.format('Desired CryptoSuite module not found supporting algorithm "%s"', algorithm));
	}

	const cryptoSuite = require(csImpl);

	// the 'opts' argument to be passed or none at all
	opts = (typeof setting === 'undefined') ? null : setting;

	// opts Option is the form { lib: string, slot: number, pin: string }
	return new cryptoSuite(keysize, hashAlgo, opts);
};

// Provide an in-memory keyValueStore
module.exports.newKeyValueStore = () => {
	return new InMemoryKeyValueStore();
};

//
// Internal API.
// Notice this API is only used at the SDK scope. For the client application, do not use
// this api.
//
// Get the standard logger to use throughout the SDK code. If the client application has
// configured a logger, then that'll be returned.
//
// The user can also make use of the built-in "winston" based logger and use the environment
// variable HFC_LOGGING to pass in configurations in the following format:
//
// {
//   'error': 'error.log',				// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
//   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
//   'info': 'console'					// 'console' is a keyword for logging to console
// }
//

const LOGGING_LEVELS = ['debug', 'info', 'warn', 'error'];

module.exports.getLogger = function (name) {
	let logger;
	const saveLogger = function (loggerToSave) {
		if (global.hfc) {
			global.hfc.logger = loggerToSave;
		} else {
			global.hfc = {
				logger: loggerToSave
			};
		}
	};

	const newDefaultLogger = () => {
		return new winston.Logger({
			transports: [
				new (winston.transports.Console)({colorize: true, timestamp: true})
			]
		});
	};

	const insertLoggerName = (originalLogger, lname) => {
		logger = Object.assign({}, originalLogger);

		LOGGING_LEVELS.forEach((method) => {
			const func = originalLogger[method];

			logger[method] = (function (context, loggerName, f) {
				return function () {
					if (arguments.length > 0) {
						arguments[0] = '[' + loggerName + ']: ' + arguments[0];
					}

					f.apply(context, arguments);
				};
			})(originalLogger, lname, func);
		});

		return logger;
	};

	if (global.hfc && global.hfc.logger) {
		return insertLoggerName(global.hfc.logger, name);
	}

	// see if the config has it set
	const config_log_setting = exports.getConfigSetting('hfc-logging', undefined); // environment setting will be HFC_LOGGING

	const options = {};
	if (config_log_setting) {
		try {
			const config = typeof config_log_setting === 'string' ? JSON.parse(config_log_setting) : config_log_setting;
			if (typeof config !== 'object') {
				throw new Error('Environment variable "HFC_LOGGING" must be an object conforming to the format documented.');
			}
			for (const level in config) {
				if (!config[level]) {
					continue;
				}

				if (LOGGING_LEVELS.includes(level)) {
					if (!options.transports) {
						options.transports = [];
					}

					if (config[level] === 'console') {
						options.transports.push(new (winston.transports.Console)({
							name: level + 'console',
							level: level,
							timestamp: true,
							colorize: true
						}));
					} else {
						options.transports.push(new (winston.transports.File)({
							name: level + 'file',
							level: level,
							filename: config[level],
							timestamp: true,
							colorize: false,
							json: false
						}));
					}
				}
			}

			logger = new winston.Logger(options);
			logger.debug('Successfully constructed a winston logger with configurations', config);
			saveLogger(logger);
			return insertLoggerName(logger, name);
		} catch (err) {
			// the user's configuration from environment variable failed to parse.
			// construct the default logger, log a warning and return it
			logger = newDefaultLogger();
			saveLogger(logger);
			logger.log('warn', 'Failed to parse environment variable "HFC_LOGGING". Returned a winston logger with default configurations. Error: %s', err.stack ? err.stack : err);
			return insertLoggerName(logger, name);
		}
	}

	logger = newDefaultLogger();
	saveLogger(logger);
	logger.debug('Returning a new winston logger with default configurations');
	return insertLoggerName(logger, name);
};

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
module.exports.setLogger = (logger) => {
	let err = '';

	if (typeof logger.debug !== 'function') {
		err += 'debug() ';
	}

	if (typeof logger.info !== 'function') {
		err += 'info() ';
	}

	if (typeof logger.warn !== 'function') {
		err += 'warn() ';
	}

	if (typeof logger.error !== 'function') {
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
};

//
// Internal method to add additional configuration file to override default file configuration settings
//
module.exports.addConfigFile = (filePath) => {
	const config = exports.getConfig();
	config.file(filePath);
};

//
// Internal method to set an override setting to the configuration settings
//
module.exports.setConfigSetting = (name, value) => {
	const config = exports.getConfig();
	config.set(name, value);
};

//
// Internal method to get an override setting to the configuration settings
//
exports.getConfigSetting = (name, default_value) => {
	const config = exports.getConfig();
	return config.get(name, default_value);
};

function ensureFabricCommonConfigLoaded(config) {
	if (!config.get(fabricCommonConfigProperty)) {
		const default_config = path.resolve(__dirname, '../config/default.json');
		config.reorderFileStores(default_config);
		config.set(fabricCommonConfigProperty, true);
	}
}

//
// Internal method to get the configuration settings singleton
//
exports.getConfig = () => {
	if (!global.hfc) {
		global.hfc = {};
	}
	if (!global.hfc.config) {
		global.hfc.config = new Config();
	}

	ensureFabricCommonConfigLoaded(global.hfc.config);

	return global.hfc.config;
};

//
// Other miscellaneous methods
//

/**
 * Convert from a bitArray to bytes (refer to SJCL's codec)
 * @param {number[]} arr a bitArray to convert from
 * @returns the bytes converted from the bitArray
 */
module.exports.bitsToBytes = (arr) => {
	const out = [];
	const bl = sjcl.bitArray.bitLength(arr);
	let tmp;
	for (let i = 0; i < bl / 8; i++) {
		if ((i & 3) === 0) {
			tmp = arr[i / 4];
		}
		out.push(tmp >>> 24);
		tmp <<= 8;
	}
	return out;
};

/**
 * Convert from bytes to a bitArray (refer to SJCL's codec)
 * @param {number[]} bytes a bytes to convert from
 * @returns the bitArray converted from bytes
 */
module.exports.bytesToBits = (bytes) => {
	const out = [];
	let i;
	let tmp = 0;
	for (i = 0; i < bytes.length; i++) {
		tmp = tmp << 8 | bytes[i];
		if ((i & 3) === 3) {
			out.push(tmp);
			tmp = 0;
		}
	}
	if (i & 3) {
		out.push(sjcl.bitArray.partial(8 * (i & 3), tmp));
	}
	return out;
};

module.exports.zeroBuffer = (length) => {
	return Buffer.alloc(length);
};

// utility function to convert Node buffers to Javascript arraybuffer
module.exports.toArrayBuffer = (buffer) => {
	const ab = new ArrayBuffer(buffer.length);
	const view = new Uint8Array(ab);
	for (let i = 0; i < buffer.length; ++i) {
		view[i] = buffer[i];
	}
	return ab;
};

// utility function to create a random number of
// the specified length.
module.exports.getNonce = (length) => {
	if (length) {
		if (Number.isInteger(length)) {
			// good, it is a number
		} else {
			throw new Error('Parameter must be an integer');
		}
	} else {
		length = exports.getConfigSetting('nonce-size', 24);
	}

	const value = crypto.randomBytes(length);
	return value;
};

module.exports.getClassMethods = (clazz) => {
	const i = new clazz();
	const proto = Object.getPrototypeOf(i);
	return Object.getOwnPropertyNames(proto).filter(
		(e) => {
			if (e !== 'constructor' && typeof i[e] === 'function') {
				return true;
			}
		});
};

module.exports.getBufferBit = (buf, idx) => {
	// return error=true if bit to mask exceeds buffer length
	if ((parseInt(idx / 8) + 1) > buf.length) {
		return {error: true, invalid: 0};
	}
	if ((buf[parseInt(idx / 8)] & (1 << (idx % 8))) !== 0) {
		return {error: false, invalid: 1};
	} else {
		return {error: false, invalid: 0};
	}
};

module.exports.getDefaultKeyStorePath = () => {
	return path.join(os.homedir(), '.hfc-key-store');
};

/**
 *
 * @param {KeyValueStore} [keyValueStore] Optional. The built-in key store saves private keys.
 *    The key store must be instance of any {@link KeyValueStore} implementations.
 * @return {CryptoKeyStore}
 */
module.exports.newCryptoKeyStore = (keyValueStore = new InMemoryKeyValueStore()) => {
	return new CryptoKeyStore(keyValueStore);
};

/*
 * This function will create a new key value pair type options list based
 * on the one passed in. The option setting will be added to the options if it
 * does not exist in the options already. The value of the setting being checked
 * will be the default value passed in unless there is a value in the config
 * settings or already on the options list.
 */
module.exports.checkAndAddConfigSetting = (option_name, default_value, options) => {
	const return_options = {};
	return_options[option_name] = module.exports.getConfigSetting(option_name, default_value);
	if (options) {
		const keys = Object.keys(options);
		for (const i in keys) {
			const key = keys[i];
			const value = options[key];
			return_options[key] = value;
		}
	}
	return return_options;
};

/*
 * Make sure there's a start line with '-----BEGIN CERTIFICATE-----'
 * and end line with '-----END CERTIFICATE-----', so as to be compliant
 * with x509 parsers
 */
module.exports.normalizeX509 = (raw) => {
	const regex = /(-----\s*BEGIN ?[^-]+?-----)([\s\S]*)(-----\s*END ?[^-]+?-----)/;
	let matches = raw.match(regex);
	if (!matches || matches.length !== 4) {
		throw new Error('Failed to find start line or end line of the certificate.');
	}

	// remove the first element that is the whole match
	matches.shift();
	// remove LF or CR
	matches = matches.map((element) => {
		return element.trim();
	});

	// make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
	// and that it ends in a new line
	let result = matches.join('\n') + '\n';

	// could be this has multiple certs within
	const regex2 = /----------/;
	result = result.replace(new RegExp(regex2, 'g'), '-----\n-----');

	return result;
};

/*
 * Convert a PEM encoded certificate to DER format
 * @param {string) pem PEM encoded public or private key
 * @returns {string} hex Hex-encoded DER bytes
 * @throws Will throw an error if the conversation fails
 */
module.exports.pemToDER = (pem) => {

	// PEM format is essentially a nicely formatted base64 representation of DER encoding
	// So we need to strip "BEGIN" / "END" header/footer and string line breaks
	// Then we simply base64 decode it and convert to hex string
	const contents = pem.toString().trim().split(/\r?\n/);
	// check for BEGIN and END tags
	if (!(contents[0].match(/-----\s*BEGIN ?([^-]+)?-----/) &&
		contents[contents.length - 1].match(/-----\s*END ?([^-]+)?-----/))) {
		throw new Error('Input parameter does not appear to be PEM-encoded.');
	}
	contents.shift(); // remove BEGIN
	contents.pop(); // remove END
	// base64 decode and encode as hex string
	// var hex = Buffer.from(contents.join(''), 'base64').toString('hex');
	const hex = Buffer.from(contents.join(''), 'base64');
	return hex;
};

module.exports.checkIntegerConfig = (opts, configName) => {
	let result = false;
	if (opts && opts[configName]) {
		if (!Number.isInteger(opts[configName])) {
			throw new Error(`Expect an integer value of ${configName}, found ${typeof configName}`);
		}
		result = true;
	}
	return result;
};

module.exports.convertBytetoString = (buffer_array, encoding) => {
	const decode_as = encoding || 'utf8';

	if (!Array.isArray(buffer_array)) {
		return buffer_array.toString(decode_as);
	}

	return buffer_array
		.map(buffer => buffer.toString(decode_as))
		.join('');
};

module.exports.byteToNormalizedPEM = (buffer_array, encoding) => {
	let result = module.exports.convertBytetoString(buffer_array, encoding);
	if (result) {
		result = module.exports.normalizeX509(result);
	}

	return result;
};

/*
 * Converts to a Long number
 * Returns a null if the incoming value is not a string that represents a
 * number or an actual javascript number. Also allows for a Long object to be
 * passed in as the value to convert
 */
module.exports.convertToLong = (value, throwError = true) => {
	let result = null;
	if (Long.isLong(value)) {
		result = value; // already a long
	} else if (typeof value !== 'undefined' && value !== null) {
		result = Long.fromValue(value);
		// Long will return a zero for invalid strings so make sure we did
		// not get a real zero as the incoming value
		if (result.equals(Long.ZERO)) {
			if (Number.isInteger(value) || value === '0') {
				// all good
			} else {
				// anything else must be a string that is not a valid number
				throw new Error(`value:${value} is not a valid number`);
			}
		}
	} else {
		if (throwError) {
			module.exports.checkParameter('value');
		}
	}

	return result;
};

/*
 * randomizes the input array
 */
module.exports.randomize = (items) => {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
};

/*
 * Used on a method's parameter to throw an error when
 * the value is missing.
 */
module.exports.checkParameter = (name) => {
	throw Error(`Missing ${name} parameter`);
};

/**
 * Map CSRUtil.newCSRPEM style extensions:
 * ```
 * {
 *     subjectAltName: {
 *         array: [...],
 *     },
 * }
 * ```
 *
 * to CertificationRequest style extensions:
 * ```
 * {
 *     extname: 'subjectAltName',
 *     array: [...],
 * }
 * ```
 * @private
 */
module.exports.mapCSRExtensions = (extensions) => {
	if (!Array.isArray(extensions)) {
		return extensions;
	}

	const results = [];
	extensions.forEach(extension => {
		const isCertificationRequestExtension = typeof extension.extname === 'string';
		if (isCertificationRequestExtension) {
			results.push(extension);
		} else {
			Object.entries(extension).forEach(([extname, props]) => {
				const extensionRequest = Object.assign({}, props, {extname});
				results.push(extensionRequest);
			});
		}
	});

	return results;
};
