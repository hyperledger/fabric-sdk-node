/**
 * Copyright 2017, 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

var Client = require('fabric-client');
var nano = require('nano');
var Cloudant = require('@cloudant/cloudant');

module.exports.getCloudantClient = function() {
	var username = Client.getConfigSetting('cloudant-username', 'notfound');
	var password = Client.getConfigSetting('cloudant-password', 'notfound');

	return Cloudant({account: username, password: password});
};

module.exports.destroy = function(name, url) {
	this._url = url;
	this._name = name;
	// Name of the database, optional
	if (!name) {
		this._name = 'member_db';
	}
	var self = this;
	return new Promise(function(resolve) {
		var dbClient = nano(self._url);
		dbClient.db.destroy(self._name, function(err) {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
};
