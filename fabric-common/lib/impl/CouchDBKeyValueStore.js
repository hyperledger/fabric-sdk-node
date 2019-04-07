/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const {KeyValueStore, Utils: utils} = require('../../');
const util = require('util');
const nano = require('nano');

const logger = utils.getLogger('CouchDBKeyValueStore.js');

/**
 * This is a sample database implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses a local or remote CouchDB database instance to store the keys.
 *
 * @class
 * @extends module:api.KeyValueStore
 */
const CouchDBKeyValueStore = class extends KeyValueStore {
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

		// url is the database instance url
		this._url = options.url;
		// Name of the database, optional
		if (!options.name) {
			this._name = 'member_db';
		} else {
			this._name = options.name;
		}
	}

	async initialize() {

		// Initialize the CouchDB database client
		const dbClient = nano(this._url);
		const get = util.promisify(dbClient.db.get);
		try {
			await get(this._name);
			// Database exists
			logger.debug('%s already exists', this._name);
			// Specify it as the database to use
			this._database = dbClient.use(this._name);
		} catch (err) {
			if (err.error === 'not_found') {
				logger.debug('No %s found, creating %s', this._name);
				const create = util.promisify(dbClient.db.create);
				try {
					await create(this._name);
					logger.debug('Created %s database', this._name);
					// Specify it as the database to use
					this._database = dbClient.use(this._name);
				} catch (error) {
					throw new Error(util.format('Failed to create %s database due to error: %s', this._name, error.stack ? error.stack : error.description));
				}
			} else {
				// Other error
				throw new Error(util.format('Error initializing database to store membership data: %s', this._name, err.stack ? err.stack : err.description));
			}
		}
	}

	async getValue(name) {
		logger.debug('getValue', {key: name});

		const get = util.promisify(this._database.get);

		try {
			const body = await get(name);
			return body.member;
		} catch (err) {
			if (err.error !== 'not_found') {
				logger.error('getValue: %s, ERROR: [%s.get] - ', name, this._name, err.error);
				throw err;
			} else {
				logger.debug('getValue: %s, Entry does not exist', name);
				return null;
			}
		}
	}

	async setValue(name, value) {
		logger.debug('setValue', {key: name});

		const insert = util.promisify(this._database.insert);
		const get = util.promisify(this._database.get);
		let isNew;
		let body;
		try {
			// perform a get to see if the key exists
			body = await get(name);

			// Didn't error, so it exists
			isNew = false;
		} catch (error) {
			if (error.error !== 'not_found') {
				logger.error('setValue: %s, key check ERROR: - ', name, error.error);
				throw error;
			} else {
				// Does not exist
				isNew = true;
			}
		}

		// conditionally perform the set/update
		const opts = isNew ? {_id: name, member: value} : {_id: name, _rev: body._rev, member: value};
		try {
			await insert(opts);
			logger.debug('setValue [add]: ' + name + ', status: SUCCESS');
			return value;
		} catch (err) {
			logger.debug('Couch database insert: ' + name + ', status: FAILED');
			throw err;
		}
	}
};


module.exports = CouchDBKeyValueStore;
