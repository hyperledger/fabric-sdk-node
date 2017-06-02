/**
 * Copyright 2016-2017 IBM All Rights Reserved.
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

'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('integration.client');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var util = require('util');
var path = require('path');
var fs = require('fs-extra');

var Client = require('fabric-client');
var User = require('fabric-client/lib/User.js');
var testUtil = require('../unit/util.js');
var couchdbUtil = require('./couchdb-util.js');

var tag = 'integration.client: ';
var caImport;
logger.debug('caImport = %s', JSON.stringify(caImport));

test('\n\n ** createUser happy path - file store **\n\n', function (t) {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
	caImport = utils.getConfigSetting('ca-import', 'notfound');

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	utils.setConfigSetting('crypto-keysize', 256);
	var userOrg = 'org1';

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var keyStoreOpts = {path: path.join(testUtil.getTempDir(), caImport.orgs[userOrg].storePath)};
	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	logger.debug('try to cleanup kvs Path: '+keyStoreOpts.path);
	// clean up
	if (testUtil.existsSync(keyStoreOpts.path)) {
		fs.removeSync(keyStoreOpts.path);
		logger.debug('removed kvsPath: '+keyStoreOpts.path);
	}

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.debug('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: { privateKey: prvKey, signedCert: sgnCert }
			});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		if (user) {
			t.pass(tag+': got user');
			t.end();
		} else {
			t.fail(tag+'createUser returned null');
			t.end();
		}
	}).catch((err) => {
		t.fail(tag+': error, did not get user');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** createUser happy path - CouchDB **\n\n', function (t) {
	// Use the CouchDB specific config file
	Client.addConfigFile('test/fixtures/couchdb.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var couchdbIPAddr = Client.getConfigSetting('couchdb-ip-addr', 'notfound');
	var couchdbPort = Client.getConfigSetting('couchdb-port', 'notfound');
	var keyValStorePath = couchdbIPAddr + ':' + couchdbPort;

	// Clean up the couchdb test database
	var userOrg = 'org1';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: keyValStorePath};
	logger.debug('couch keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, keyValStorePath)
	.then((status) => {
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.debug('store: %s',store);
		client.setStateStore(store);
		return true;
	}).then((status) => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: { privateKey: prvKey, signedCert: sgnCert },
				keyStoreOpts: keyStoreOpts
			});
	}).then((user) => {
		if (user) {
			t.pass(tag+': got user');
			t.end();
		} else {
			t.fail(tag+'createUser returned null');
			t.end();
		}
	}).catch((err) => {
		t.fail(tag+'error, did not get user');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** createUser happy path - Cloudant  **\n\n', function (t) {
	// Use the Cloudant specific config file
	Client.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var cloudantUsername = Client.getConfigSetting('cloudant-username', 'notfound');
	var cloudantPassword = Client.getConfigSetting('cloudant-password', 'notfound');
	var cloudantBluemix = Client.getConfigSetting('cloudant-bluemix', 'notfound');
	var cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	var userOrg = 'org1';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.debug('cloudant keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, cloudantUrl)
	.then((status) => {
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.debug('store: %s',store);
		client.setStateStore(store);
		return true;
	}).then((status) => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: { privateKey: prvKey, signedCert: sgnCert }
			});
	}).then((user) => {
		if (user) {
			t.pass(tag+': got user');
			t.end();
		} else {
			t.fail(tag+'createUser returned null');
			t.end();
		}
	}).catch((err) => {
		t.fail(tag+'error, did not get user');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** createUser happy path - Cloudant - PEM Strings  **\n\n', function (t) {
	// Use the Cloudant specific config file
	Client.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var cloudantUsername = Client.getConfigSetting('cloudant-username', 'notfound');
	var cloudantPassword = Client.getConfigSetting('cloudant-password', 'notfound');
	var cloudantBluemix = Client.getConfigSetting('cloudant-bluemix', 'notfound');
	var cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	var userOrg = 'org2';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.debug('cloudant keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(keyStoreOpts));
	client.setCryptoSuite(cryptoSuite);

	couchdbUtil.destroy(dbname, cloudantUrl)
	.then((status) => {
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.debug('store: %s',store);
		client.setStateStore(store);
		return true;
	}).then((status) => {
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
			t.pass(tag+': got user');
			t.end();
		} else {
			t.fail(tag+'createUser returned null');
			t.end();
		}
	}).catch((err) => {
		t.fail(tag+'error, did not get user');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});
