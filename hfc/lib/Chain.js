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

var api = require('./api.js');
var utils = require('./utils.js');
var urlParser = require('url');
var net = require('net');
var util = require('util');
var Member = require('./Member.js');
var Orderer = require('./Orderer.js');

var logger = utils.getLogger('Chain.js');

/**
 * The class representing a chain with which the client SDK interacts.
 *
 * @class
 */
var Chain = class {

	/**
	 * @param {string} name to identify different chain instances. The naming of chain instances
	 * is completely at the client application's discretion.
	 */
	constructor(name) {
		// Name of the chain is only meaningful to the client
		this._name = name;

		// Security enabled flag
		this._securityEnabled = true;

		// A member cache associated with this chain
		// TODO: Make an LRU to limit size of member cache
		this._members = {}; // associated array of [name] <-> Member

		// The number of tcerts to get in each batch
		this._tcertBatchSize = utils.getConfigSetting('tcert-batch-size',200);

		// The key-val store used for this chain
		this._keyValStore = null; // KeyValueStore;

		// Is in dev mode or network mode
		this._devMode = false;

		// If in prefetch mode, we prefetch tcerts from member services to help performance
		this._preFetchMode = true;

		// Temporary variables to control how long to wait for deploy and invoke to complete before
		// emitting events.  This will be removed when the SDK is able to receive events from the
		this._deployWaitTime = utils.getConfigSetting('deploy-wait-time',20);
		this._invokeWaitTime = utils.getConfigSetting('invoke-wait-time',5);

		/**
		 * @member [CryptoSuite]{@link module:api.CryptoSuite} cryptoPrimitives The crypto primitives object provides access to the crypto suite
		 * for functions like sign, encrypt, decrypt, etc.
		 * @memberof module:api.Chain.prototype
		 */
		this.cryptoPrimitives = utils.getCryptoSuite();

		logger.info('Constructed Chain instance: name - %s, securityEnabled: %s, TCert download batch size: %s, network mode: %s', this._name, this._securityEnabled, this._tcertBatchSize, !this._devMode);
	}

	/**
	 * Get the chain name.
	 * @returns {string} The name of the chain.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Determine if security is enabled.
	 */
	isSecurityEnabled() {
		return this._keyValStore !== undefined;
	}

	/**
	 * Determine if pre-fetch mode is enabled to prefetch tcerts.
	 */
	isPreFetchMode() {
		return this._preFetchMode;
	}

	/**
	 * Set prefetch mode to true or false.
	 */
	setPreFetchMode(preFetchMode) {
		this._preFetchMode = preFetchMode;
	}

	/**
	 * Determine if dev mode is enabled.
	 */
	isDevMode() {
		return this._devMode;
	}

	/**
	 * Set dev mode to true or false.
	 */
	setDevMode(devMode) {
		this._devMode = devMode;
	}

	/**
	 * Get the key val store implementation (if any) that is currently associated with this chain.
	 * @returns {KeyValueStore} Return the current KeyValueStore associated with this chain, or undefined if not set.
	 */
	getKeyValueStore() {
		return this._keyValStore;
	}

	/**
	 * Set the key value store implementation.
	 */
	setKeyValueStore(keyValStore) {
		this._keyValStore = keyValStore;
	}

	/**
	 * Get the tcert batch size.
	 */
	getTCertBatchSize() {
		return this._tcertBatchSize;
	}

	/**
	 * Set the tcert batch size.
	 */
	setTCertBatchSize(batchSize) {
		this._tcertBatchSize = batchSize;
	}

	/**
	 * Get the user member named 'name' or create
	 * a new member if the member does not exist.
	 * @returns Promise for the Member object
	 */
	getMember(name) {
		var self = this;
		return new Promise(function(resolve, reject) {
			if (!self._keyValStore) {
				logger.error('No key value store was found on this Chain instance: name - "%s"', self._name);
				return reject(new Error('No key value store was found.  You must first call Chain.configureKeyValueStore or Chain.setKeyValueStore'));
			}

			self._getMemberHelper(name).then(
				function(member) {
					logger.debug('Requested member "%s" resolved successfully on this Chain instance: name - %s', name, self._name);
					return resolve(member);
				}
			).catch(
				function(err) {
					logger.error('Failed to construct an instance of requested member "%s" on this Chain instance: name - "%s". Error: %s', name, self._name, err.stack ? err.stack : err);
					reject(err);
				}
			);
		});
	}

	/**
	 * Get a user.
	 * A user is a specific type of member.
	 * Another type of member is a peer.
	 * @returns Promise for the Member object
	 */
	getUser(name) {
		return this.getMember(name);
	}

	// Try to get the member from cache.
	// If not found, create a new one.
	// If member is found in the key value store,
	//    restore the state to the new member, store in cache and return the member.
	// If there are no errors and member is not found in the key value store,
	//    return the new member.
	_getMemberHelper(name) {
		logger.debug('Chain._getMemberHelper - start name:'+name);
		var self = this;

		return new Promise(function(resolve, reject) {
			// Try to get the member state from the cache
			var member = self._members[name];
			if (member) {
				logger.debug('Requested member "%s" resolved from cache', name);
				return resolve(member);
			}

			// Create the member and try to restore it's state from the key value store (if found).
			member = new Member(name, self);
			logger.debug('Chain._getMemberHelper - create new member - will try to restoreState -name:'+name);
			member.restoreState()
			.then(
				function() {
					if (member.isEnrolled()) {
						self._members[name] = member;
					}
					logger.debug('Requested member "%s" loaded from key value store', name);
					return resolve(member);
				}
			).catch(
				function(err) {
					logger.error('Failed to load requested member "%s" locally in cache or key value store. Error: %s', name, err.stack ? err.stack : err);
					reject(err);
				}
			);
		});
	}

	/**
	 * Set the orderer given an endpoint specification.
	 * Will replace the existing orderer if one exists.
	 * @param url The URL of the orderer.
	 * @param opts Optional GRPC options.
	 * @returns {Orderer} Returns the new Orderer.
	 */
	setOrderer(url, opts) {
		logger.debug('Chain.setOrderer - start url:'+url);
		var orderer = new Orderer(url, opts);
		this._orderer = orderer;
		return orderer;
	}

	/**
	 * Get the current orderer for this chain.
	 */
	getOrderer() {
		return this._orderer;
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		var state = {
			name: this._name,
			orderer: this._orderer ? this._orderer._url : 'N/A'
		};

		return JSON.stringify(state);
	}

};

module.exports = Chain;
