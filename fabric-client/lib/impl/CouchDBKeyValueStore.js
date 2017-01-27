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

var api = require('../api.js');
var fs = require('fs-extra');
var path = require('path');
var utils = require('../utils');
var nano = require('nano');

var logger = utils.getLogger('CouchDBKeyValueStore.js');

/**
 * This is a sample database implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses a local or remote CouchDB database instance to store the keys.
 *
 * @class
 */
var CouchDBKeyValueStore = class extends api.KeyValueStore {

	/**
	 * constructor
	 *
	 * @description <b>options</b> contains a path property which represents a CouchDB client instance.
	 * The following code snippet shows how to create a nano minimalistic client for CouchDB.  For more
	 * information see <a href='https://github.com/dscape/nano'>github dscape / nano</a>.
	 * <pre><code>var nano = require('nano');
	 * var couchDBClient = nano(couchdb_IP_Address + ':' + couchdb_Port);</code></pre>
	 *
	 * <br>The following code snippet shows how to create a Cloudant CouchDB client.
	 * Username and password map to the IBM Bluemix service credentials VCAP_SERVICES environment variables username and password.
	 * To obtain an instance of Cloudant, see the IBM Bluemix Catalog --> Services --> Data & Analytics at
	 * <a href='https://console.ng.bluemix.net/catalog/services/cloudant-nosql-db'>Cloudant NoSQL DB</a>.
	 * <pre><code>var Cloudant = require('cloudant');
	 * var cloudantClient = Cloudant({account: username, password: password});</code></pre>
	 * <br>
	 *
	 * @param {Object} options Contains two properties:
	 * <li>path - The CouchDB database client instance.
	 * <li>name - Optional.  Identifies the name of the database if different from the default of 'member_db'.
	 */
	constructor(options) {
		logger.debug('constructor, options: ' + options);

		if (!options || !options.path) {
			throw new Error('Must provide the CouchDB database client instance to store membership data.');
		}

		// Create the keyValStore instance
		super();

		var self = this;
		// path is the database client instance
		this._path = options.path;
		// Name of the database, optional
		if (!options.name) {
			this._name = 'member_db';
		} else {
			this._name = options.name;
		}

		logger.debug('options.path - ' + options.path);
		logger.debug('options.name - ' + options.name);

		return new Promise(function(resolve, reject) {
			// Initialize the CouchDB database client
			var dbClient = self._path;
			// Check if the database already exists. If not, create it.
			dbClient.db.get(self._name, function(err, body) {
				// Check for error
				if (err) {
					// Database doesn't exist
					if (err.error == 'not_found') {
						logger.info('No member_db found, creating member_db');

						dbClient.db.create(self._name, function() {
							logger.info('Created member_db database');
							// Specify it as the database to use
							self._database = dbClient.use(self._name);
							resolve(self);
						});
					} else {
						// Other error
						logger.error('ERROR: ' + err);
						reject(new Error('Error creating member_db database to store membership data.'));
					}
				} else {
					// Database exists
					logger.info('member_db already exists');
					// Specify it as the database to use
					self._database = dbClient.use(self._name);
					resolve(self);
				}
			});
		});
	}

	/**
	 * Get the value associated with name.
	 * @param {string} name
	 * @returns Promise for the value
	 * @ignore
	 */
	getValue(name) {
		logger.debug('getValue: ' + name);

		var self = this;
		return new Promise(function(resolve, reject) {
			self._database.get(name, function(err, body) {
				// Check for error on retrieving from database
				if (err) {
					if (err.error !== 'not_found') {
						logger.error('getValue: ' + name + ', ERROR: [member_db.get] - ', err.error);
						return reject(err.error);
					} else {
						logger.info('getValue: ' + name + ', Entry does not exist');
						return resolve(null);
					}
				} else {
					logger.debug('getValue: ' + name + ', Retrieved message from member_db.');
					return resolve(body.member);
				}
			});
		});
	}

	/**
	 * Set the value associated with name.
	 * @param {string} name
	 * @param {string} value
	 * @returns Promise for a 'true' value on successful completion
	 * @ignore
	 */
	setValue(name, value) {
		logger.debug('setValue: ' + name);

		var self = this;

		return new Promise(function(resolve, reject) {
			// Attempt to retrieve from the database to see if the entry exists
			self._database.get(name, function(err, body) {
				// Check for error on retrieving from database
				if (err) {
					if (err.error !== 'not_found') {
						logger.error('setValue: ' + name + ', ERROR: [member_db.get] - ', err.error);
						reject(err.error);
					} else {
						// Entry does not exist
						logger.debug('setValue: ' + name + ', Entry does not exist, insert it.');
						self._dbInsert({ _id: name, member: value })
						.then( function (status) {
							logger.debug('setValue add: ' + name + ', status: ' + status);
							if (status == true) resolve(value);
							else reject(new Error('Couch database insert add failed.'));
						});
					}
				} else {
					// Entry already exists and must be updated
					logger.debug('setValue: ' + name + ', Retrieved entry from member_db.');

					// Update the database entry using the latest rev number
					logger.debug('setValue: ' + name + ', Latest rev number : ' + body._rev);
					self._dbInsert({ _id: name, _rev: body._rev, member: value })
					.then( function (status) {
						logger.debug('setValue update: ' + name + ', status: ' + status);
						if (status == true) resolve(value);
						else reject(new Error('Couch database insert update failed.'));
					});
				}
			});
		});
	}

	_dbInsert(options) {
		logger.debug('setValue, _dbInsert, options: ' + JSON.stringify(options));
		var self = this;
		return new Promise(function(resolve,reject) {
			self._database.insert(options, function(err, body, header) {
				if (err) {
					logger.error('setValue, _dbInsert, ERROR: [member_db.insert] - ', err.error);
					reject(new Error(err.error));
				} else {
					logger.debug('setValue, _dbInsert, Inserted member into member_db.');
					resolve(true);
				}
			});
		});
	}
};


module.exports = CouchDBKeyValueStore;
