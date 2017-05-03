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

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
utils.setConfigSetting('hfc-logging', '{"debug":"console"}');
var logger = utils.getLogger('fileKeyValStore-fabricca');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var testUtil = require('../unit/util.js');
var fs = require('fs-extra');

var path = require('path');
var hfc = require('fabric-client');

var Client = hfc;
var User = require('fabric-client/lib/User.js');
var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');

hfc.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
var ORGS = hfc.getConfigSetting('test-network');
var userOrg = 'org1';

var fabricCAEndpoint = ORGS[userOrg].ca.url;

// This test first checks to see if a user has already been enrolled. If so,
// the test terminates. If the user is not yet enrolled, the test uses the
// FabricCAClientImpl to enroll a user, and saves the enrollment materials into the
// File KeyValueStore. Then the test uses the Client class to load the member
// from the key value store.
test('Use FabricCAServices with a File KeyValueStore', function(t) {

	// Set the relevant configuration values
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/FileKeyValueStore.js');

	var keyValueStore = hfc.getConfigSetting('key-value-store');
	logger.info('File Key Value Store = ' + keyValueStore);
	var keyValStorePath = path.join(testUtil.getTempDir(), 'customKeyValStorePath');
	logger.info('keyValStorePath: '+keyValStorePath);

	var client = new Client();
	var cryptoSuite, member, opts;

	// clean up
	if (testUtil.existsSync(keyValStorePath)) {
		fs.removeSync(keyValStorePath);
	}

	var	tlsOptions = {
		trustedRoots: [],
		verify: false
	};

	t.comment('Initialize the File KeyValueStore');
	utils.newKeyValueStore({path: keyValStorePath})
	.then(
		function(kvs) {

			member = new User('admin2');
			cryptoSuite = client.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(client.newCryptoKeyStore({path: keyValStorePath}));
			member.setCryptoSuite(cryptoSuite);

			t.comment('Setting client keyValueStore to: ' +kvs);
			client.setStateStore(kvs);
			if (client.getStateStore() === kvs) {
				t.pass('Successfully set File KeyValueStore for client');
			} else {
				t.fail('File KeyValStore is not set successfully on this client!');
				t.end();
				process.exit(1);
			}
			t.comment('Initialize the CA server connection and KeyValueStore');
			t.comment('Test optional parameters passed into FabricCAServices of cryptoSettings and KVSImplClass');
			return new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name,
				cryptoSuite);
		},
		function(err) {
			t.fail('Error initializing File KeyValueStore. Exiting.');
			logger.error(err.stack ? err.stack : err);
			t.end();
			process.exit(1);
		})
	.then(
		function(caService) {
			logger.info('ADD: caService - ' + caService);
			t.pass('Successfully initialized the Fabric CA service.');

			t.comment('Begin caService.enroll');
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
			t.comment('setting UserContext...');
			return client.setUserContext(member);
		},
		function(err) {
			t.fail('Failed to enroll admin2 with CA server. Error:');
			logger.error(err.stack ? err.stack : err);
			t.end();
		})
	.then(
		function(user) {
			t.comment('setting UserContext to different user to clear out previous user');
			return client.setUserContext(new User('userx'));
		})
	.then(
		function(user) {
			t.comment('getUserContext, loading user admin2 from StateStore...');
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
			t.fail('Failed fileKeyValueStore-fabricca-test with error:');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);
});
