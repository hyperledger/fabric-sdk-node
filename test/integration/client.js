/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('integration.client');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const path = require('path');
const fs = require('fs-extra');

const Client = require('fabric-client');
const testUtil = require('../unit/util.js');
const couchdbUtil = require('./couchdb-util.js');

const tag = 'integration.client: ';
let caImport;
logger.debug('caImport = %s', JSON.stringify(caImport));

test('\n\n ** createUser happy path - file store **\n\n', (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
	caImport = utils.getConfigSetting('ca-import', 'notfound');

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	utils.setConfigSetting('crypto-keysize', 256);
	const userOrg = 'org1';

	const prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	const sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	const keyStoreOpts = {path: path.join(testUtil.getTempDir(), caImport.orgs[userOrg].storePath)};
	const client = new Client();
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	logger.debug('try to cleanup kvs Path: ' + keyStoreOpts.path);
	// clean up
	if (testUtil.existsSync(keyStoreOpts.path)) {
		fs.removeSync(keyStoreOpts.path);
		logger.debug('removed kvsPath: ' + keyStoreOpts.path);
	}

	return utils.newKeyValueStore(keyStoreOpts)
		.then((store) => {
			logger.debug('store: %s', store);
			client.setStateStore(store);
			return '';
		}).then(() => {
			return client.createUser(
				{username: caImport.orgs[userOrg].username,
					mspid: caImport.orgs[userOrg].mspid,
					cryptoContent: {privateKey: prvKey, signedCert: sgnCert}
				});
		}, (err) => {
			logger.error(err.stack ? err.stack : err);
			throw new Error('Failed createUser.');
		}).then((user) => {
			if (user) {
				t.pass(tag + ': got user');
				t.end();
			} else {
				t.fail(tag + 'createUser returned null');
				t.end();
			}
		}).catch((err) => {
			t.fail(tag + ': error, did not get user');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n ** createUser happy path - CouchDB **\n\n', (t) => {
	// Use the CouchDB specific config file
	Client.addConfigFile('test/fixtures/couchdb.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/CouchDBKeyValueStore.js');// override
	const couchdbIPAddr = Client.getConfigSetting('couchdb-ip-addr', 'notfound');
	const couchdbPort = Client.getConfigSetting('couchdb-port', 'notfound');
	const keyValStorePath = couchdbIPAddr + ':' + couchdbPort;

	// Clean up the couchdb test database
	const userOrg = 'org1';
	const dbname = (caImport.orgs[userOrg].name + '_db').toLowerCase();
	const keyStoreOpts = {name: dbname, url: keyValStorePath};
	logger.debug('couch keyStoreOpts: ' + JSON.stringify(keyStoreOpts));

	const prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	const sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	const client = new Client();
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, keyValStorePath)
		.then(() => {
			return utils.newKeyValueStore(keyStoreOpts);
		}).then((store) => {
			logger.debug('store: %s', store);
			client.setStateStore(store);
			return true;
		}).then(() => {
			return client.createUser(
				{username: caImport.orgs[userOrg].username,
					mspid: caImport.orgs[userOrg].mspid,
					cryptoContent: {privateKey: prvKey, signedCert: sgnCert},
					keyStoreOpts: keyStoreOpts
				});
		}).then((user) => {
			if (user) {
				t.pass(tag + ': got user');
				t.end();
			} else {
				t.fail(tag + 'createUser returned null');
				t.end();
			}
		}).catch((err) => {
			t.fail(tag + 'error, did not get user');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n ** createUser happy path - Cloudant  **\n\n', (t) => {
	// Use the Cloudant specific config file
	Client.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/CouchDBKeyValueStore.js');// override
	const cloudantUsername = Client.getConfigSetting('cloudant-username', 'notfound');
	const cloudantPassword = Client.getConfigSetting('cloudant-password', 'notfound');
	const cloudantBluemix = Client.getConfigSetting('cloudant-bluemix', 'notfound');
	const cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	const userOrg = 'org1';
	const dbname = (caImport.orgs[userOrg].name + '_db').toLowerCase();
	const keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.debug('cloudant keyStoreOpts: ' + JSON.stringify(keyStoreOpts));

	const prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	const sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	const client = new Client();
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, cloudantUrl)
		.then(() => {
			return utils.newKeyValueStore(keyStoreOpts);
		}).then((store) => {
			logger.debug('store: %s', store);
			client.setStateStore(store);
			return true;
		}).then(() => {
			return client.createUser(
				{username: caImport.orgs[userOrg].username,
					mspid: caImport.orgs[userOrg].mspid,
					cryptoContent: {privateKey: prvKey, signedCert: sgnCert}
				});
		}).then((user) => {
			if (user) {
				t.pass(tag + ': got user');
				t.end();
			} else {
				t.fail(tag + 'createUser returned null');
				t.end();
			}
		}).catch((err) => {
			t.fail(tag + 'error, did not get user');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n ** createUser happy path - Cloudant - PEM Strings  **\n\n', (t) => {
	// Use the Cloudant specific config file
	Client.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/CouchDBKeyValueStore.js');// override
	const cloudantUsername = Client.getConfigSetting('cloudant-username', 'notfound');
	const cloudantPassword = Client.getConfigSetting('cloudant-password', 'notfound');
	const cloudantBluemix = Client.getConfigSetting('cloudant-bluemix', 'notfound');
	const cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	const userOrg = 'org2';
	const dbname = (caImport.orgs[userOrg].name + '_db').toLowerCase();
	const keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.debug('cloudant keyStoreOpts: ' + JSON.stringify(keyStoreOpts));

	const client = new Client();
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, cloudantUrl)
		.then(() => {
			return utils.newKeyValueStore(keyStoreOpts);
		}).then((store) => {
			logger.debug('store: %s', store);
			client.setStateStore(store);
			return true;
		}).then(() => {
			return client.createUser(
				{username: caImport.orgs[userOrg].username,
					mspid: caImport.orgs[userOrg].mspid,
					cryptoContent: caImport.orgs[userOrg].cryptoContent
				});
		}, (err) => {
			logger.error(err.stack ? err.stack : err);
			throw new Error('Failed createUser.');
		}).then((user) => {
			if (user) {
				t.pass(tag + ': got user');
				t.end();
			} else {
				t.fail(tag + 'createUser returned null');
				t.end();
			}
		}).catch((err) => {
			t.fail(tag + 'error, did not get user');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});
