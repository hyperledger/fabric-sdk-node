/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var hfc = require('fabric-client');
var Client = hfc;
var User = require('fabric-client/lib/User.js');
var FabricCOPServices = require('fabric-ca-client/lib/FabricCAClientImpl');

var utils = require('fabric-client/lib/utils.js');
var couchdbUtil = require('./couchdb-util.js');

// Use the CouchDB specific config file
hfc.addConfigFile('test/fixtures/couchdb.json');
var dbClient = couchdbUtil.getCouchDBClient();
var keyValueStore = hfc.getConfigSetting('key-value-store');
console.log('Key Value Store = ' + keyValueStore);

// This test first checks to see if a user has already been enrolled. If so,
// the test terminates. If the user is not yet enrolled, the test uses the
// FabricCAClientImpl to enroll a user, and saves the enrollment materials into the
// CouchDB KeyValueStore. Then the test uses the Chain class to load the member
// from the key value store.
test('Use FabricCOPServices with a CouchDB KeyValueStore', function(t) {

	//var user = new User();
	var client = new Client();

	// Set the relevant configuration values
	utils.setConfigSetting('crypto-keysize', 256);

	// Clean up the couchdb test database
	var dbname = 'member_db';
	couchdbUtil.destroy(dbname, dbClient)
	.then( function(status) {
		t.comment('Cleanup of existing ' + dbname + ' returned '+status);
		t.comment('Initilize the CouchDB KeyValueStore');
		utils.newKeyValueStore({name: dbname, path: dbClient})
		.then(
			function(kvs) {
				t.comment('Setting client keyValueStore to: ' +kvs);
				client.setStateStore(kvs);
				if (client.getStateStore() === kvs) {
					t.pass('Successfully set CouchDB KeyValueStore for client');
				} else {
					t.pass('CouchDB KeyValStore is not set successfully on this client!');
					t.end();
					process.exit(1);
				}
				t.comment('Initialize the COP server connection and KeyValueStore');
				return new FabricCOPServices('http://localhost:7054', kvs);
			},
			function(err) {
				console.log(err);
				t.fail('Error initializing CouchDB KeyValueStore. Exiting.');
				t.end();
				process.exit(1);
			})
		.then(
			function(copService) {
				console.log('ADD: copService - ' + copService);
				t.pass('Successfully initialized the Fabric COP service.');

				client.setCryptoSuite(copService.getCrypto());
				t.comment('Set cryptoSuite on client');
				t.comment('Begin copService.enroll');
				return copService.enroll({
					enrollmentID: 'admin2',
					enrollmentSecret: 'adminpw2'
				});
			},
			function(err) {
				t.fail('Failed to initilize the Fabric COP service: ' + err);
				t.end();
			}
		)
		.then(
			function(admin2) {
				t.pass('Successfully enrolled admin2 with COP server');

				// Persist the user state
				var member = new User('admin2', client);
				member.setEnrollment(admin2.key, admin2.certificate);
				if (member.isEnrolled()) {
					t.pass('Member isEnrolled successfully.');
				} else {
					t.fail('Member isEnrolled failed.');
				}
				return client.setUserContext(member);
			},
			function(err) {
				t.fail('Failed to enroll admin2 with COP server. Error: ' + err);
				t.end();
			})
		.then(
			function(user) {
				return client.loadUserFromStateStore('admin2');
			}
		).then(
			function(user) {
				if (user && user.getName() === 'admin2') {
					t.pass('Successfully loaded the user from key value store');
					t.end();
				} else {
					t.fail('Failed to load the user from key value store');
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to load the user admin2 from key value store. Error: ' + err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed couchdb-fabriccop-test with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	});
});
