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

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('couchdb-fabricca');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var Client = require('fabric-client');

var User = require('fabric-client/lib/User.js');
var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
var testUtil = require('../unit/util.js');

var couchdbUtil = require('./couchdb-util.js');

var ORGS;
var userOrg = 'org1';

var	tlsOptions = {
	trustedRoots: [],
	verify: false
};

// This test first checks to see if a user has already been enrolled. If so,
// the test terminates. If the user is not yet enrolled, the test uses the
// FabricCAClientImpl to enroll a user, and saves the enrollment materials into the
// CouchDB KeyValueStore. Then the test uses the Client class to load the member
// from the key value store.
test('Use FabricCAServices with a CouchDB KeyValueStore', function(t) {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	// Use the CouchDB specific config file
	Client.addConfigFile('test/fixtures/couchdb.json');

	var fabricCAEndpoint = ORGS[userOrg].ca.url;
	var keyValueStore = Client.getConfigSetting('key-value-store');
	logger.info('couchdb Key Value Store = ' + keyValueStore);

	var couchdbIPAddr = Client.getConfigSetting('couchdb-ip-addr', 'notfound');
	var couchdbPort = Client.getConfigSetting('couchdb-port', 'notfound');
	var keyValStorePath = couchdbIPAddr + ':' + couchdbPort;
	logger.info('couch keyValStorePath: '+keyValStorePath);

	// override t.end function so it'll always clear the config settings
	t.end = ((context, f) => {
		return function() {
			if (global && global.hfc) global.hfc.config = undefined;
			require('nconf').reset();

			f.apply(context, arguments);
		};
	})(t, t.end);

	var client = new Client();

	// Set the relevant configuration values
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');

	// Clean up the couchdb test database
	var dbname = 'my_member_db';

	var cryptoSuite, member, options;
	couchdbUtil.destroy(dbname, keyValStorePath)
	.then( function(status) {
		var options = {name: dbname, url: keyValStorePath};
		utils.newKeyValueStore(options)
		.then(
			function(kvs) {

				member = new User('admin2');
				cryptoSuite = Client.newCryptoSuite(options);
				cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(options));
				client.setCryptoSuite(cryptoSuite);
				member.setCryptoSuite(cryptoSuite);

				client.setStateStore(kvs);
				if (client.getStateStore() === kvs) {
					t.pass('Successfully set CouchDB KeyValueStore for client');
				} else {
					t.fail('CouchDB KeyValStore is not set successfully on this client!');
					t.end();
					process.exit(1);
				}
				return new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name,
					cryptoSuite);
			},
			function(err) {
				t.fail('Error initializing CouchDB KeyValueStore. Exiting.');
				logger.error(err.stack ? err.stack : err);
				t.end();
				process.exit(1);
			})
		.then(
			function(caService) {
				logger.info('ADD: caService - ' + caService);
				t.pass('Successfully initialized the Fabric CA service.');

				return caService.enroll({
					enrollmentID: 'admin',
					enrollmentSecret: 'adminpw'
				});
			},
			function(err) {
				t.fail('Failed to initialize the Fabric CA service. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		)
		.then(
			function(admin2) {
				t.pass('Successfully enrolled admin2 with CA server');

				// Persist the user state
				return member.setEnrollment(admin2.key, admin2.certificate, ORGS[userOrg].mspid);
			},
			function(err) {
				t.fail('Failed to use obtained private key and certificate to construct a User object. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function() {
				if (member.isEnrolled()) {
					t.pass('Member isEnrolled successfully.');
				} else {
					t.fail('Member isEnrolled failed.');
				}
				return client.setUserContext(member);
			},
			function(err) {
				t.fail('Failed to enroll admin2 with CA server. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			})
		.then(
			function(user) {
				return client.setUserContext(new User('userx'));
			})
		.then(
			function(user) {
				client.setCryptoSuite(cryptoSuite);
				return client.getUserContext('admin2', true);
			})
		.then(
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
				t.fail('Failed to load the user admin2 from key value store. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed couchdb-fabricca-test with error:');
				 logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);
	});
});
