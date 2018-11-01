/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('couchdb-fabricca');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const Client = require('fabric-client');

const User = require('fabric-client/lib/User.js');
const FabricCAServices = require('fabric-ca-client/lib/FabricCAServices');
const testUtil = require('../unit/util.js');

const couchdbUtil = require('./couchdb-util.js');

let ORGS;
const userOrg = 'org1';

const	tlsOptions = {
	trustedRoots: [],
	verify: false
};

// This test first checks to see if a user has already been enrolled. If so,
// the test terminates. If the user is not yet enrolled, the test uses the
// FabricCAClientImpl to enroll a user, and saves the enrollment materials into the
// CouchDB KeyValueStore. Then the test uses the Client class to load the member
// from the key value store.
test('Use FabricCAServices with a CouchDB KeyValueStore', (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	// Use the CouchDB specific config file
	Client.addConfigFile('test/fixtures/couchdb.json');

	const fabricCAEndpoint = ORGS[userOrg].ca.url;
	const keyValueStore = Client.getConfigSetting('key-value-store');
	logger.info('couchdb Key Value Store = ' + keyValueStore);

	const couchdbIPAddr = Client.getConfigSetting('couchdb-ip-addr', 'notfound');
	const couchdbPort = Client.getConfigSetting('couchdb-port', 'notfound');
	const keyValStorePath = couchdbIPAddr + ':' + couchdbPort;
	logger.info('couch keyValStorePath: ' + keyValStorePath);

	// override t.end function so it'll always clear the config settings
	t.end = ((context, f) => {
		return function() {
			if (global && global.hfc) {
				global.hfc.config = undefined;
			}
			require('nconf').reset();

			f.apply(context, arguments);
		};
	})(t, t.end);

	const client = new Client();

	// Set the relevant configuration values
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/CouchDBKeyValueStore.js');

	// Clean up the couchdb test database
	const dbname = 'my_member_db';

	let cryptoSuite, member;
	couchdbUtil.destroy(dbname, keyValStorePath)
		.then(() => {
			const options = {name: dbname, url: keyValStorePath};
			utils.newKeyValueStore(options)
				.then(
					(kvs) => {

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
					(err) => {
						t.fail('Error initializing CouchDB KeyValueStore. Exiting.');
						logger.error(err.stack ? err.stack : err);
						t.end();
						process.exit(1);
					})
				.then(
					(caService) => {
						logger.info('ADD: caService - ' + caService);
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
						t.fail('Failed couchdb-fabricca-test with error:');
						logger.error(err.stack ? err.stack : err);
						t.end();
					}
				);
		});
});
