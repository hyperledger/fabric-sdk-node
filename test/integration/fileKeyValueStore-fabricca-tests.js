/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('fileKeyValStore-fabricca');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const testUtil = require('../unit/util.js');
const fs = require('fs-extra');

const path = require('path');
const Client = require('fabric-client');

const User = require('fabric-client/lib/User.js');
const FabricCAServices = require('fabric-ca-client/lib/FabricCAServices');

const userOrg = 'org1';
let ORGS;


// This test first checks to see if a user has already been enrolled. If so,
// the test terminates. If the user is not yet enrolled, the test uses the
// FabricCAClientImpl to enroll a user, and saves the enrollment materials into the
// File KeyValueStore. Then the test uses the Client class to load the member
// from the key value store.
test('Use FabricCAServices with a File KeyValueStore', (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	const fabricCAEndpoint = ORGS[userOrg].ca.url;

	// Set the relevant configuration values
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	// var keyValueStore = Client.getConfigSetting('key-value-store');
	const keyValStorePath = path.join(testUtil.getTempDir(), 'customKeyValStorePath');

	const client = new Client();
	let cryptoSuite, member;

	// clean up
	if (testUtil.existsSync(keyValStorePath)) {
		fs.removeSync(keyValStorePath);
	}

	const	tlsOptions = {
		trustedRoots: [],
		verify: false
	};

	utils.newKeyValueStore({path: keyValStorePath})
		.then(
			(kvs) => {

				member = new User('admin2');
				cryptoSuite = Client.newCryptoSuite();
				cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: keyValStorePath}));
				member.setCryptoSuite(cryptoSuite);

				client.setStateStore(kvs);
				if (client.getStateStore() === kvs) {
					t.pass('Successfully set File KeyValueStore for client');
				} else {
					t.fail('File KeyValStore is not set successfully on this client!');
					t.end();
					process.exit(1);
				}
				return new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name,
					cryptoSuite);
			},
			(err) => {
				t.fail('Error initializing File KeyValueStore. Exiting.');
				logger.error(err.stack ? err.stack : err);
				t.end();
				process.exit(1);
			})
		.then(
			(caService) => {
				t.pass('Successfully initialized the Fabric CA service.');

				return caService.enroll({
					enrollmentID: 'admin',
					enrollmentSecret: 'adminpw'
				});
			},
			(err) => {
				t.fail('Failed to initialize the Fabric CA service. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		)
		.then(
			(admin2) => {
				t.pass('Successfully enrolled admin2 with CA server');

				// Persist the user state
				return member.setEnrollment(admin2.key, admin2.certificate, ORGS[userOrg].mspid);
			},
			(err) => {
				t.fail('Failed to use obtained private key and certificate to construct a User object. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		).then(
			() => {
				if (member.isEnrolled()) {
					t.pass('Member isEnrolled successfully.');
				} else {
					t.fail('Member isEnrolled failed.');
				}
				return client.setUserContext(member);
			},
			(err) => {
				t.fail('Failed to enroll admin2 with CA server. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			})
		.then(
			() => {
				return client.setUserContext(new User('userx'));
			})
		.then(
			() => {
				client.setCryptoSuite(cryptoSuite);
				return client.getUserContext('admin2', true);
			})
		.then(
			(user) => {
				if (user && user.getName() === 'admin2') {
					t.pass('Successfully loaded the user from key value store');
					t.end();
				} else {
					t.fail('Failed to load the user from key value store');
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to load the user admin2 from key value store. Error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			(err) => {
				t.fail('Failed fileKeyValueStore-fabricca-test with error:');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);
});
