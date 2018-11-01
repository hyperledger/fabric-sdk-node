/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const api = require('../api.js');
const util = require('util');
const utils = require('../utils');
const nano = require('nano');

const logger = utils.getLogger('CouchDBKeyValueStore.js');

/**
 * This is a sample database implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses a local or remote CouchDB database instance to store the keys.
 *
 * @class
 * @extends module:api.KeyValueStore
 */
const CouchDBKeyValueStore = class extends api.KeyValueStore {
	/**
	 * @typedef {Object} CouchDBOpts
	 * @property {string} url The CouchDB instance url, in the form of http(s)://<user>:<password>@host:port
	 * @property {string} name Optional. Identifies the name of the database to use. Default: <code>member_db</code>.
	 */

	/**
	 * constructor
	 *
	 * @param {CouchDBOpts} options Settings used to connect to a CouchDB instance
	 */
	constructor(options) {
		logger.debug('constructor', {options: options});

		if (!options || !options.url) {
			throw new Error('Must provide the CouchDB database url to store membership data.');
		}

		// Create the keyValStore instance
		super();

		const self = this;
		// url is the database instance url
		this._url = options.url;
		// Name of the database, optional
		if (!options.name) {
			this._name = 'member_db';
		} else {
			this._name = options.name;
		}

		return new Promise(((resolve, reject) => {
			// Initialize the CouchDB database client
			const dbClient = nano(self._url);
			// Check if the database already exists. If not, create it.
			dbClient.db.get(self._name, (err) => {
				// Check for error
				if (err) {
					// Database doesn't exist
					if (err.error === 'not_found') {
						logger.debug('No %s found, creating %s', self._name, self._name);

						dbClient.db.create(self._name, (error) => {
							if (error) {
								return reject(new Error(util.format('Failed to create %s database due to error: %s', self._name, error.stack ? error.stack : error)));
							}

							logger.debug('Created %s database', self._name);
							// Specify it as the database to use
							self._database = dbClient.use(self._name);
							resolve(self);
						});
					} else {
						// Other error
						return reject(new Error(util.format('Error creating %s database to store membership data: %s', self._name, err.stack ? err.stack : err)));
					}
				} else {
					// Database exists
					logger.debug('%s already exists', self._name);
					// Specify it as the database to use
					self._database = dbClient.use(self._name);
					resolve(self);
				}
			});
		}));
	}

	getValue(name) {
		logger.debug('getValue', {key: name});

		const self = this;
		return new Promise(((resolve, reject) => {
			self._database.get(name, (err, body) => {
				// Check for error on retrieving from database
				if (err) {
					if (err.error !== 'not_found') {
						logger.error('getValue: %s, ERROR: [%s.get] - ', name, self._name, err.error);
						return reject(err.error);
					} else {
						logger.debug('getValue: %s, Entry does not exist', name);
						return resolve(null);
					}
				} else {
					logger.debug('getValue: %s, Retrieved message from %s.', name, self._name);
					return resolve(body.member);
				}
			});
		}));
	}

	setValue(name, value) {
		logger.debug('setValue', {key: name});

		const self = this;

		return new Promise(((resolve, reject) => {
			// Attempt to retrieve from the database to see if the entry exists
			self._database.get(name, (err, body) => {
				// Check for error on retrieving from database
				if (err) {
					if (err.error !== 'not_found') {
						logger.error('setValue: %s, ERROR: [%s.get] - ', name, self._name, err.error);
						reject(err.error);
					} else {
						// Entry does not exist
						logger.debug('setValue: %s, Entry does not exist, insert it.', name);
						self._dbInsert({_id: name, member: value})
							.then((status) => {
								logger.debug('setValue add: ' + name + ', status: ' + status);
								if (status === true) {
									resolve(value);
								} else {
									reject(new Error('Couch database insert add failed.'));
								}
							});
					}
				} else {
					// Entry already exists and must be updated
					// Update the database entry using the latest rev number
					logger.debug('setValue: %s, Retrieved entry from %s. Latest rev number: %s', name, self._name, body._rev);

					self._dbInsert({_id: name, _rev: body._rev, member: value})
						.then((status) => {
							logger.debug('setValue update: ' + name + ', status: ' + status);
							if (status === true) {
								resolve(value);
							} else {
								reject(new Error('Couch database insert update failed.'));
							}
						});
				}
			});
		}));
	}

	_dbInsert(options) {
		logger.debug('setValue, _dbInsert', {options: options});
		const self = this;
		return new Promise(((resolve, reject) => {
			self._database.insert(options, (err) => {
				if (err) {
					logger.error('setValue, _dbInsert, ERROR: [%s.insert] - ', self._name, err.error);
					reject(new Error(err.error));
				} else {
					logger.debug('setValue, _dbInsert, Inserted member into %s.', self._name);
					resolve(true);
				}
			});
		}));
	}
};


module.exports = CouchDBKeyValueStore;
