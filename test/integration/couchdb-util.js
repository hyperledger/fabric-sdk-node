/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Client = require('fabric-client');
var nano = require('nano');
var Cloudant = require('cloudant');

module.exports.getCloudantClient = function(configFile) {
	var username = Client.getConfigSetting('cloudant-username', 'notfound');
	var password = Client.getConfigSetting('cloudant-password', 'notfound');
	console.log('CloudantClient username = ' + username + ', password: ' + password);
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
	return new Promise(function(resolve, reject) {
		var dbClient = nano(self._url);
		dbClient.db.destroy(self._name, function(err, body) {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
};


