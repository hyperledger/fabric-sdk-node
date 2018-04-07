/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

var api = require('../api.js');
var fs = require('fs-extra');
var path = require('path');
var utils = require('../utils');

var logger = utils.getLogger('FileKeyValueStore.js');

/**
 * This is a default implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses files to store the key values.
 *
 * @class
 * @extends module:api.KeyValueStore
 */
var FileKeyValueStore = class extends api.KeyValueStore {

	/**
	 * constructor
	 *
	 * @param {Object} options contains a single property <code>path</code> which points to the top-level directory
	 * for the store
	 */
	constructor(options) {
		logger.debug('constructor', { options: options });

		if (!options || !options.path) {
			throw new Error('Must provide the path to the directory to hold files for the store.');
		}

		// Create the keyValStore instance
		super();

		var self = this;
		this._dir = options.path;
		return new Promise(function (resolve, reject) {
			fs.mkdirs(self._dir, function (err) {
				if (err) {
					logger.error('constructor, error creating directory, code: %s' , err.code);
					return reject(err);
				}
				return resolve(self);
			});
		});
	}

	getValue(name) {
		logger.debug('getValue', { key: name });

		var self = this;

		return new Promise(function (resolve, reject) {
			var p = path.join(self._dir, name);
			fs.readFile(p, 'utf8', function (err, data) {
				if (err) {
					if (err.code !== 'ENOENT') {
						return reject(err);
					} else {
						return resolve(null);
					}
				}
				return resolve(data);
			});
		});
	}

	setValue(name, value) {
		logger.debug('setValue', { key: name });

		var self = this;

		return new Promise(function (resolve, reject) {
			var p = path.join(self._dir, name);
			fs.writeFile(p, value, function (err) {
				if (err) {
					reject(err);
				} else {
					return resolve(value);
				}
			});
		});
	}
};

module.exports = FileKeyValueStore;
