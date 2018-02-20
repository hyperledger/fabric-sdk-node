 /**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var util = require('util');
var winston = require('winston');
var fs = require('fs-extra');
var crypto = require('crypto');
var path = require('path');
var os = require('os');
var Long = require('long');

var Config = require('./Config.js');

//
// Load required crypto stuff.
//

var sha3_256 = require('js-sha3').sha3_256;

//
// The following methods are for loading the proper implementation of an extensible APIs.
//

// returns a new instance of the CryptoSuite API implementation
//
// @param {Object} setting This optional parameter is an object with the following optional properties:
// 	- software {boolean}: Whether to load a software-based implementation (true) or HSM implementation (false)
//		default is true (for software based implementation), specific implementation module is specified
//		in the setting 'crypto-suite-software'
//  - keysize {number}: The key size to use for the crypto suite instance. default is value of the setting 'crypto-keysize'
//  - algorithm {string}: Digital signature algorithm, currently supporting ECDSA only with value "EC"
//  - hash {string}: 'SHA2' or 'SHA3'
//
//
module.exports.newCryptoSuite = function(setting) {
	var csImpl, keysize, algorithm, hashAlgo, opts = null;

	var useHSM = false;
	if (setting && typeof setting.software === 'boolean') {
		useHSM = !setting.software;
	} else {
		useHSM = this.getConfigSetting('crypto-hsm');
	}

	csImpl = useHSM ? this.getConfigSetting('crypto-suite-hsm') : this.getConfigSetting('crypto-suite-software');

	// this function supports the following:
	// - newCryptoSuite({software: true, keysize: 256, algorithm: EC})
	// - newCryptoSuite({software: false, lib: '/usr/local/bin/pkcs11.so', slot: 0, pin: '1234'})
	// - newCryptoSuite({keysize: 384})
	// - newCryptoSuite()

	// step 1: what's the cryptosuite impl to use, key size and algo
	if (setting && setting.keysize && typeof setting === 'object' && typeof setting.keysize === 'number') {
		keysize = setting.keysize;
	} else
		keysize = this.getConfigSetting('crypto-keysize');

	if (setting && setting.algorithm && typeof setting === 'object' && typeof setting.algorithm === 'string') {
		algorithm = setting.algorithm.toUpperCase();
	} else
		algorithm = 'EC';

	if (setting && setting.hash && typeof setting === 'object' && typeof setting.hash === 'string') {
		hashAlgo = setting.hash.toUpperCase();
	} else
		hashAlgo = null;

	// csImpl at this point should be a map (see config/default.json) with keys being the algorithm
	csImpl = csImpl[algorithm];

	if (!csImpl)
		throw new Error(util.format('Desired CryptoSuite module not found supporting algorithm "%s"', algorithm));

	var cryptoSuite = require(csImpl);

	// the 'opts' argument to be passed or none at all
	opts = (typeof setting === 'undefined') ? null : setting;

	//opts Option is the form { lib: string, slot: number, pin: string }
	return new cryptoSuite(keysize, hashAlgo, opts);
};

// Provide a Promise-based keyValueStore for couchdb, etc.
module.exports.newKeyValueStore = function(options) {
	// initialize the correct KeyValueStore
	var self = this;
	return new Promise(function(resolve, reject) {
		var kvsEnv = self.getConfigSetting('key-value-store');
		var store = require(kvsEnv);
		return resolve(new store(options));
	});
};

const LOGGING_LEVELS = ['debug', 'info', 'warn', 'error'];

//
// Internal API.
// Notice this API is only used at the SDK scope. For the client application, do not use
// this api.
//
// Get the standard logger to use throughout the SDK code. If the client application has
// configured a logger, then that'll be returned.
//
// The user can also make user of the built-in "winston" based logger and use the environment
// variable HFC_LOGGING to pass in configurations in the following format:
//
// {
//   'error': 'error.log',				// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
//   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
//   'info': 'console'					// 'console' is a keyword for logging to console
// }
//
module.exports.getLogger = function(name) {
	var saveLogger = function(logger) {
		if (global.hfc) {
			global.hfc.logger = logger;
		} else {
			global.hfc = {
				logger: logger
			};
		}
	};

	var newDefaultLogger = function() {
		return new winston.Logger({
			transports: [
				new (winston.transports.Console)({ colorize: true })
			]
		});
	};

	var insertLoggerName = function(originalLogger, lname) {
		var logger = Object.assign({}, originalLogger);

		['debug', 'info', 'warn', 'error'].forEach(function(method) {
			var func = originalLogger[method];

			logger[method] = (function(context, loggerName, f) {
				return function() {
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

	//see if the config has it set
	var config_log_setting = this.getConfigSetting('hfc-logging', undefined); //environment setting will be HFC_LOGGING

	var options = {};
	if (config_log_setting) {
		try {
			var config = null;
			if( typeof config_log_setting === 'string') {
				config = JSON.parse(config_log_setting);
			}
			else {
				config = config_log_setting;
			}
			if (typeof config !== 'object') {
				throw new Error('Environment variable "HFC_LOGGING" must be an object conforming to the format documented.');
			} else {
				for (var level in config) {
					if (!config.hasOwnProperty(level)) {
						continue;
					}

					if (LOGGING_LEVELS.indexOf(level) >= 0) {
						if (!options.transports) {
							options.transports = [];
						}

						if (config[level] === 'console') {
							options.transports.push(new (winston.transports.Console)({
								name: level + 'console',
								level: level,
								colorize: true
							}));
						} else {
							options.transports.push(new (winston.transports.File)({
								name: level + 'file',
								level: level,
								filename: config[level],
								colorize: true
							}));
						}
					}
				}
			}

			var logger = new winston.Logger(options);
			logger.debug('Successfully constructed a winston logger with configurations', config);
			saveLogger(logger);
			return insertLoggerName(logger, name);
		} catch(err) {
			// the user's configuration from environment variable failed to parse.
			// construct the default logger, log a warning and return it
			var logger = newDefaultLogger();
			saveLogger(logger);
			logger.log('warn', 'Failed to parse environment variable "HFC_LOGGING". Returned a winston logger with default configurations. Error: %s', err.stack ? err.stack : err);
			return insertLoggerName(logger, name);
		}
	}

	var logger = newDefaultLogger();
	saveLogger(logger);
	logger.debug('Returning a new winston logger with default configurations');
	return insertLoggerName(logger, name);
};

//
//Internal method to add additional configuration file to override default file configuration settings
//
module.exports.addConfigFile = function(path) {
	var config = this.getConfig();
	config.file(path);
};

//
//Internal method to set an override setting to the configuration settings
//
module.exports.setConfigSetting = function(name, value) {
	var config = this.getConfig();
	config.set(name, value);
};

//
//Internal method to get an override setting to the configuration settings
//
module.exports.getConfigSetting = function(name, default_value) {
	var config = this.getConfig();
	return config.get(name, default_value);
};

//
// Internal method to get the configuration settings singleton
//
module.exports.getConfig = function() {
	if(global.hfc && global.hfc.config) {
		return global.hfc.config;
	}
	var config = new Config();
	if (global.hfc) {
		global.hfc.config = config;
	} else {
		global.hfc = { config: config };
	}

	return config;
};

// this is a per-application map of msp managers for each channel
var mspManagers = {};

//
// returns the MSP manager responsible for the given channel
//
module.exports.getMSPManager = function(channelId) {
	var mspm = mspManagers[channelId];
	if (mspm === null) {
		// this is a rather catastrophic error, without an MSP manager not much can continue
		throw new Error(util.format('Can not find an MSP Manager for the given channel ID: %s', channelId));
	}

	return mspm;
};

//
// registers an MSP manager using the channelId as the key
//
module.exports.addMSPManager = function(channelId, mspm) {
	mspManagers[channelId] = mspm;
};

//
// unregisters the MSP manager for the given channelId
//
module.exports.removeMSPManager = function(channelId) {
	delete mspManagers[channelId];
};

//
// Other miscellaneous methods
//

module.exports.bitsToBytes = function(arr) {
	var out = [],
		bl = sjcl.bitArray.bitLength(arr),
		i, tmp;
	for (i = 0; i < bl / 8; i++) {
		if ((i & 3) === 0) {
			tmp = arr[i / 4];
		}
		out.push(tmp >>> 24);
		tmp <<= 8;
	}
	return out;
};

module.exports.bytesToBits = function(bytes) {
	var out = [],
		i, tmp = 0;
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

module.exports.zeroBuffer = function(length) {
	return Buffer.alloc(length);
};

// utility function to convert Node buffers to Javascript arraybuffer
module.exports.toArrayBuffer = function(buffer) {
	var ab = new ArrayBuffer(buffer.length);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buffer.length; ++i) {
		view[i] = buffer[i];
	}
	return ab;
};

// utility function to create a random number of
// the specified length.
module.exports.getNonce = function(length) {
	if(length) {
		if(Number.isInteger(length)) {
			// good, it is a number
		} else {
			throw new Error('Parameter must be an integer');
		}
	} else {
		length = this.getConfigSetting('nonce-size', 24);
	}

	var value = crypto.randomBytes(length);
	return value;
};

module.exports.getClassMethods = function(clazz) {
	var i = new clazz();
	var proto = Object.getPrototypeOf(i);
	return Object.getOwnPropertyNames(proto).filter(
		function(e) {
			if (e !== 'constructor' && typeof i[e] === 'function')
				return true;
		});
};

module.exports.getBufferBit = function(buf, idx, val) {
	// return error=true if bit to mask exceeds buffer length
	if ((parseInt(idx/8) + 1) > buf.length) {
		return { error: true, invalid: 0} ;
	}
	if ((buf[parseInt(idx/8)] & (1<<(idx%8))) != 0) {
		return { error: false, invalid: 1};
	} else {
		return { error: false, invalid: 0};
	}
};

module.exports.readFile = function(path) {
	return new Promise(function(resolve, reject) {
		fs.readFile(path, function(err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
};

module.exports.getDefaultKeyStorePath = function() {
	return path.join(os.homedir(), '.hfc-key-store');
};

var CryptoKeyStore = function(KVSImplClass, opts) {
	this.logger = module.exports.getLogger('utils.CryptoKeyStore');
	this.logger.debug('CryptoKeyStore, constructor - start');
	if (KVSImplClass && typeof opts === 'undefined') {
		if (typeof KVSImplClass === 'function') {
			// the super class module was passed in, but not the 'opts'
			opts = null;
		} else {
			// called with only one argument for the 'opts' but KVSImplClass was skipped
			opts = KVSImplClass;
			KVSImplClass = null;
		}
	}

	if (typeof opts === 'undefined' || opts === null) {
		opts = {
			path: module.exports.getDefaultKeyStorePath()
		};
	}
	var superClass;
	if (typeof KVSImplClass !== 'undefined' && KVSImplClass !== null) {
		superClass = KVSImplClass;
	} else {
		// no super class specified, use the default key value store implementation
		superClass = require(module.exports.getConfigSetting('key-value-store'));
		this.logger.debug('constructor, no super class specified, using config: '+module.exports.getConfigSetting('key-value-store'));
	}

	this._store = null;
	this._storeConfig = {
		superClass: superClass,
		opts: opts

	};

	this._getKeyStore = function() {
		var CKS = require('./impl/CryptoKeyStore.js');

		var self = this;
		return new Promise((resolve, reject) => {
			if (self._store === null) {
				self.logger.debug(util.format('This class requires a CryptoKeyStore to save keys, using the store: %j', self._storeConfig));

				CKS(self._storeConfig.superClass, self._storeConfig.opts)
				.then((ks) => {
					self.logger.debug('_getKeyStore returning ks');
					self._store = ks;
					return resolve(self._store);
				}).catch((err) => {
					reject(err);
				});
			} else {
				self.logger.debug('_getKeyStore resolving store');
				return resolve(self._store);
			}
		});
	};

};

module.exports.newCryptoKeyStore = function(KVSImplClass, opts) {
	// this function supports skipping any of the arguments such that it can be called in any of the following fashions:
	// - newCryptoKeyStore(CouchDBKeyValueStore, {name: 'member_db', url: 'http://localhost:5984'})
	// - newCryptoKeyStore({path: '/tmp/app-state-store'})
	// - newCryptoKeyStore()
	return new CryptoKeyStore(KVSImplClass, opts);
};

/*
 * This function will create a new key value pair type options list based
 * on the one passed in. The option setting will be added to the options if it
 * does not exist in the options already. The value of the setting being checked
 * will be the default value passed in unless there is a value in the config
 * settings or already on the options list.
 */
module.exports.checkAndAddConfigSetting = function(option_name, default_value, options) {
	var return_options = {};
	return_options[option_name] = module.exports.getConfigSetting(option_name, default_value);
	if(options) {
		var keys = Object.keys(options);
		for(var i in keys) {
			let key = keys[i];
			var value = options[key];
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
module.exports.normalizeX509 = function(raw) {
	var regex = /(\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-)([\s\S]*)(\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-)/;
	var matches = raw.match(regex);
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
	return matches.join('\n') + '\n';
};

/*
 * Convert a PEM encoded certificate to DER format
 * @param {string) pem PEM encoded public or private key
 * @returns {string} hex Hex-encoded DER bytes
 * @throws Will throw an error if the conversation fails
 */
module.exports.pemToDER = function(pem) {

	//PEM format is essentially a nicely formatted base64 representation of DER encoding
	//So we need to strip "BEGIN" / "END" header/footer and string line breaks
	//Then we simply base64 decode it and convert to hex string
	var contents = pem.toString().trim().split(/\r?\n/);
	//check for BEGIN and END tags
	if (!(contents[0].match(/\-\-\-\-\-\s*BEGIN ?([^-]+)?\-\-\-\-\-/) &&
		contents[contents.length - 1].match(/\-\-\-\-\-\s*END ?([^-]+)?\-\-\-\-\-/))) {
		throw new Error('Input parameter does not appear to be PEM-encoded.');
	};
	contents.shift(); //remove BEGIN
	contents.pop(); //remove END
	//base64 decode and encode as hex string
	//var hex = Buffer.from(contents.join(''), 'base64').toString('hex');
	var hex = Buffer.from(contents.join(''), 'base64');
	return hex;
};


/*
 * Converts to a Long number
 * Returns a null if the incoming value is not a string that represents a
 * number or an actual javasript number. Also allows for a Long object to be
 * passed in as the value to convert
 */
module.exports.convertToLong = function(value) {
	let result;
	if(Long.isLong(value)) {
		result = value; //already a long
	} else if(typeof value !== 'undefined' && value != null) {
		result = Long.fromValue(value);
		// Long will return a zero for invalid strings so make sure we did
		// not get a real zero as the incoming value
		if(result.equals(Long.ZERO)) {
			if(Number.isInteger(value) || value === '0') {
				// all good
			} else {
				// anything else must be a string that is not a valid number
				throw new Error(util.format('value:%s is not a valid number ',value));
			}
		}
	} else {
		throw new Error('value parameter is missing');
	}

	return result;
};
