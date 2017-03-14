/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var sdkUtils = require('./utils.js');
process.env.GRPC_SSL_CIPHER_SUITES = sdkUtils.getConfigSetting('grpc-ssl-cipher-suites');

var Chain = require('./Chain.js');
var logger = sdkUtils.getLogger('Client.js');
var api = require('./api.js');
var User = require('./User.js');
var util = require('util');

/**
 * Main interaction handler with end user. A client instance provides a handler to interact
 * with a network of peers, orderers and optionally member services. An application using the
 * SDK may need to interact with multiple networks, each through a separate instance of the Client.
 *
 * Each client when initially created should be initialized with configuration data from the
 * consensus service, which includes a list of trusted roots, orderer certificates and IP addresses,
 * and a list of peer certificates and IP addresses that it can access. This must be done out of band
 * as part of bootstrapping the application environment. It is also the responsibility of the application
 * to maintain the configuration of a client as the SDK does not persist this object.
 *
 * Each Client instance can maintain several {@link Chain} instances representing channels and the associated
 * private ledgers.
 *
 * @class
 *
 */
var Client = class {

	constructor() {
		this._chains = {};
		this._stateStore = null;
		// TODO, assuming a single CrytoSuite implementation per SDK instance for now
		// change this to be per Client or per Chain
		this._cryptoSuite = null;
		this._userContext = null;
	}

	setCryptoSuite(cryptoSuite) {
		this._cryptoSuite = cryptoSuite;
	}

	getCryptoSuite() {
		return this._cryptoSuite;
	}

    /**
	 * Returns a chain instance with the given name. This represents a channel and its associated ledger
     * (as explained above), and this call returns an empty object. To initialize the chain in the blockchain network,
     * a list of participating endorsers and orderer peers must be configured first on the returned object.
     * @param {string} name The name of the chain.  Recommend using namespaces to avoid collision.
	 * @returns {Chain} The uninitialized chain instance.
	 * @throws {Error} if the chain by that name already exists in the application's state store
	 */
	newChain(name) {
		var chain = this._chains[name];

		if (chain)
			throw new Error(util.format('Chain %s already exists', name));

		var chain = new Chain(name, this);
		this._chains[name] = chain;
		return chain;
	}

	/**
	 * Get a {@link Chain} instance from the state storage. This allows existing chain instances to be saved
	 * for retrieval later and to be shared among instances of the application. Note that it’s the
	 * application/SDK’s responsibility to record the chain information. If an application is not able
	 * to look up the chain information from storage, it may call another API that queries one or more
	 * Peers for that information.
	 * @param {string} name The name of the chain.
	 * @returns {Chain} The chain instance
	 * @throws {Error} if the state store has not been set or a chain does not exist under that name.
	 */
	getChain(name) {
		var ret = this._chains[name];

		// TODO: integrate reading from state store

		if (ret)
			return ret;
		else {
			logger.error('Chain not found for name '+name+'.');
			throw new Error('Chain not found for name '+name+'.');
		}
	}

	/**
	 * This is a network call to the designated Peer(s) to discover the chain information.
	 * The target Peer(s) must be part of the chain to be able to return the requested information.
	 * @param {string} name The name of the chain.
	 * @param {Peer[]} peers Array of target Peers to query.
	 * @returns {Chain} The chain instance for the name or error if the target Peer(s) does not know
	 * anything about the chain.
	 */
	queryChainInfo(name, peers) {
		//to do
	}

	/**
	 * The enrollment materials for Users that have appeared in the instances of the application.
	 *
	 * The SDK should have a built-in key value store file-based implementation to allow easy setup during
	 * development. Production systems would use a store backed by database for more robust storage and
	 * clustering, so that multiple app instances can share app state via the database.
	 * This API makes this pluggable so that different store implementations can be selected by the application.
	 * @param {KeyValueStore} keyValueStore Instance of an alternative KeyValueStore implementation provided by
	 * the consuming app.
	 */
	setStateStore(keyValueStore) {
		var err = '';

		var methods = sdkUtils.getClassMethods(api.KeyValueStore);
		methods.forEach(function(m) {
			if (typeof keyValueStore[m] !== 'function') {
				err += m + '() ';
			}
		});

		if (err !== '') {
			throw new Error('The "keyValueStore" parameter must be an object that implements the following methods, which are missing: ' + err);
		}

		this._stateStore = keyValueStore;
	}

	/**
	 * Save the state of this member to the key value store.
	 * @returns {Promise} A Promise for the user context object upon successful save
	 */
	saveUserToStateStore() {
		var self = this;
		logger.debug('saveUserToStateStore, userContext: ' + self._userContext);
		return new Promise(function(resolve, reject) {
			if (self._userContext && self._userContext._name && self._stateStore) {
				logger.debug('saveUserToStateStore, begin promise stateStore.setValue');
				self._stateStore.setValue(self._userContext._name, self._userContext.toString())
				.then(
					function(result) {
						logger.debug('saveUserToStateStore, store.setValue, result = ' + result);
						resolve(self._userContext);
					},
					function (reason) {
						logger.debug('saveUserToStateStore, store.setValue, reject reason = ' + reason);
						reject(reason);
					}
				).catch(
					function(err) {
						logger.debug('saveUserToStateStore, store.setValue, error: ' +err);
						reject(new Error(err));
					}
				);
			} else {
				if (self._userContext == null) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext is null.');
					reject(new Error('Cannot save user to state store when userContext is null.'));
				} else if (self._userContext._name == null) {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when userContext has no name.');
					reject(new Error('Cannot save user to state store when userContext has no name.'));
				} else {
					logger.debug('saveUserToStateStore Promise rejected, Cannot save user to state store when stateStore is null.');
					reject(new Error('Cannot save user to state store when stateStore is null.'));
				}
			}
		});
	}

	/**
	 * Sets an instance of the User class as the security context of self client instance. This user’s
	 * credentials (ECert), or special transaction certificates that are derived from the user's ECert,
	 * will be used to conduct transactions and queries with the blockchain network.
	 * Upon setting the user context, the SDK saves the object in a persistence cache if the “state store”
	 * has been set on the Client instance. If no state store has been set, this cache will not be established
	 * and the application is responsible for setting the user context again if the application crashes and is recovered.
	 *
	 * @param {User} user An instance of the User class encapsulating the authenticated user’s signing materials
	 * (private key and enrollment certificate)
	 * @param {boolean} skipPersistence Whether to skip saving the user object into persistence. Default is false and the
	 * method will attempt to save the user object to the state store.
	 * @returns {Promise} Promise of the 'user' object upon successful persistence of the user to the state store
	 */
	setUserContext(user, skipPersistence) {
		logger.debug('setUserContext, user: ' + user + ', skipPersistence: ' + skipPersistence);
		var self = this;
		return new Promise((resolve, reject) => {
			if (user) {
				self._userContext = user;
				if (!skipPersistence) {
					logger.debug('setUserContext begin promise to saveUserToStateStore');
					self.saveUserToStateStore()
					.then((user) => {
						return resolve(user);
					}).catch((err) => {
						reject(err);
					});
				} else {
					logger.debug('setUserContext, resolved user');
					return resolve(user);
				}
			} else {
				logger.debug('setUserContext, Cannot save null userContext');
				reject(new Error('Cannot save null userContext.'));
			}
		});
	}

	/**
	 * As explained above, the client instance can have an optional state store. The SDK saves enrolled users
	 * in the storage which can be accessed by authorized users of the application (authentication is done by
	 * the application outside of the SDK). This function attempts to load the user by name from the local storage
	 * (via the KeyValueStore interface). The loaded user object must represent an enrolled user with a valid
	 * enrollment certificate signed by a trusted CA (such as the CA server).
	 *
	 * @param {String} name Optional. If not specified, will only return the in-memory user context object, or null
	 * if not found in memory. If "name" is specified, will also attempt to load it from the state store if search
	 * in memory failed.
	 * @returns {Promise} The user object corresponding to the name, or null if the user does not exist or if the
	 * state store has not been set.
	 */
	getUserContext(name) {
		var self = this;
		var username = name;
		return new Promise(function(resolve, reject) {
			if (self._userContext) {
				return resolve(self._userContext);
			} else {
				if (typeof username === 'undefined' || !username) {
					return resolve(null);
				}

				// this could be because they application has not set a user context yet for this client, which would
				// be an error condiditon, or it could be that this app has crashed before and is recovering, so we
				// should allow the previously saved user context object to be deserialized

				// first check if there is a user context of the specified name in persistence
				if (self._stateStore) {
					self.loadUserFromStateStore(username).then(
						function(userContext) {
							if (userContext) {
								logger.debug('Requested user "%s" loaded successfully from the state store on this Client instance: name - %s', name, name);
								return self.setUserContext(userContext, false);
							} else {
								logger.debug('Requested user "%s" not loaded from the state store on this Client instance: name - %s', name, name);
								return null;
							}
						}
					).then(
						function(userContext) {
							return resolve(userContext);
						}
					).catch(
						function(err) {
							logger.error('Failed to load an instance of requested user "%s" from the state store on this Client instance. Error: %s', name, err.stack ? err.stack : err);
							reject(err);
						}
					);
				} else {
					// we don't have it in memory or persistence, just return null
					return resolve(null);
				}
			}
		});
	}

	/**
	 * Restore the state of this member from the key value store (if found).  If not found, do nothing.
	 * @returns {Promise} A Promise for a {User} object upon successful restore, or if the user by the name
	 * does not exist in the state store, returns null without rejecting the promise
	 */
	loadUserFromStateStore(name) {
		var self = this;

		return new Promise(function(resolve, reject) {
			self._stateStore.getValue(name)
			.then(
				function(memberStr) {
					if (memberStr) {
						// The member was found in the key value store, so restore the state.
						var newUser = new User(name, self);

						return newUser.fromString(memberStr);
					} else {
						return null;
					}
				})
			.then(function(data) {
				if (data) {
					logger.info('Successfully loaded user "%s" from local key value store', name);
					return resolve(data);
				} else {
					logger.info('Failed to load user "%s" from local key value store', name);
					return resolve(null);
				}
			}).catch(
				function(err) {
					logger.error('Failed to load user "%s" from local key value store. Error: %s', name, err.stack ? err.stack : err);
					reject(err);
				}
			);
		});
	}

	/**
	 * A convenience method for obtaining the state store object in use for this client.
	 * @return {KeyValueStore} The KeyValueStore implementation object set within this Client, or null if it does not exist.
	 */
	getStateStore() {
		return this._stateStore;
	}

	/**
	 * Obtains an instance of the [KeyValueStore]{@link module:api.KeyValueStore} class. By default
	 * it returns the built-in implementation, which is based on files ([FileKeyValueStore]{@link module:api.FileKeyValueStore}).
	 * This can be overriden with an environment variable KEY_VALUE_STORE, the value of which is the
	 * full path of a CommonJS module for the alternative implementation.
	 *
	 * @param {Object} options is whatever the implementation requires for initializing the instance. For the built-in
	 * file-based implementation, this requires a single property "path" to the top-level folder for the store
	 * @returns [KeyValueStore]{@link module:api.KeyValueStore} an instance of the KeyValueStore implementation
	 */
	static newDefaultKeyValueStore(options) {
		return sdkUtils.newKeyValueStore(options);
	}

	/**
	 * Configures a logger for the entire HFC SDK to use and override the default logger. Unless this method is called,
	 * HFC uses a default logger (based on winston). When using the built-in "winston" based logger, use the environment
	 * variable HFC_LOGGING to pass in configurations in the following format:
	 *
	 * {
	 *   'error': 'error.log',				// 'error' logs are printed to file 'error.log' relative of the current working dir for node.js
	 *   'debug': '/tmp/myapp/debug.log',	// 'debug' and anything more critical ('info', 'warn', 'error') can also be an absolute path
	 *   'info': 'console'					// 'console' is a keyword for logging to console
	 * }
	 *
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
	 * Adds a file to the top of the list of configuration setting files that are
	 * part of the hierarchical configuration.
	 * These files will override the default settings and be overriden by environment,
	 * command line arguments, and settings programmatically set into configuration settings.
	 *
	 * hierarchy search order:
	 *  1. memory - all settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} path - The path to the file to be added to the top of list of configuration files
	 */
	static addConfigFile(path) {

		sdkUtils.addConfigFile(path);
	}

	/**
	 * Adds a setting to override all settings that are
	 * part of the hierarchical configuration.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with this call
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} value - The value of a setting
	 */
	static setConfigSetting(name, value) {

		sdkUtils.setConfigSetting(name, value);
	}

	/**
	 * Retrieves a setting from the hierarchical configuration and if not found
	 * will return the provided default value.
	 *
	 * hierarchy search order:
	 *  1. memory - settings added with sdkUtils.setConfigSetting(name,value)
	 *  2. Command-line arguments
	 *  3. Environment variables (names will be change from AAA-BBB to aaa-bbb)
	 *  4. Custom Files - all files added with the addConfigFile(path)
	 *     will be ordered by when added, were last one added will override previously added files
	 *  5. The file located at 'config/default.json' with default settings
	 *
	 * @param {String} name - The name of a setting
	 * @param {Object} default_value - The value of a setting if not found in the hierarchical configuration
	 */
	static getConfigSetting(name, default_value) {

		return sdkUtils.getConfigSetting(name, default_value);
	}
};

module.exports = Client;
