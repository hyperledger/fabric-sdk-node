/**
 * Copyright 2017, 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const nano = require('nano');

module.exports.destroy = function(name, url) {
	this._url = url;
	this._name = name;
	// Name of the database, optional
	if (!name) {
		this._name = 'member_db';
	}
	const self = this;
	return new Promise(((resolve) => {
		const dbClient = nano(self._url);
		dbClient.db.destroy(self._name, (err) => {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	}));
};
