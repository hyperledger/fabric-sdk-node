/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const api = require('../api.js');
const fs = require('fs-extra');
const path = require('path');
const utils = require('../utils');

const logger = utils.getLogger('FileKeyValueStore.js');

/**
 * This is a default implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses files to store the key values.
 *
 * @class
 * @extends module:api.KeyValueStore
 */
const FileKeyValueStore = class extends api.KeyValueStore {

	/**
	 * constructor
	 *
	 * @param {Object} options contains a single property <code>path</code> which points to the top-level directory
	 * for the store
	 */
	constructor(options) {
		logger.debug('constructor', {options: options});

		if (!options || !options.path) {
			throw new Error('Must provide the path to the directory to hold files for the store.');
		}

		// Create the keyValStore instance
		super();

		const self = this;
		this._dir = options.path;
		return new Promise(((resolve, reject) => {
			fs.mkdirs(self._dir, (err) => {
				if (err) {
					logger.error('constructor, error creating directory, code: %s', err.code);
					return reject(err);
				}
				return resolve(self);
			});
		}));
	}

	getValue(name) {
		logger.debug('getValue', {key: name});

		const self = this;

		return new Promise(((resolve, reject) => {
			const p = path.join(self._dir, name);
			fs.readFile(p, 'utf8', (err, data) => {
				if (err) {
					if (err.code !== 'ENOENT') {
						return reject(err);
					} else {
						return resolve(null);
					}
				}
				return resolve(data);
			});
		}));
	}

	setValue(name, value) {
		logger.debug('setValue', {key: name});

		const self = this;

		return new Promise(((resolve, reject) => {
			const p = path.join(self._dir, name);
			fs.writeFile(p, value, (err) => {
				if (err) {
					reject(err);
				} else {
					return resolve(value);
				}
			});
		}));
	}
};

module.exports = FileKeyValueStore;
