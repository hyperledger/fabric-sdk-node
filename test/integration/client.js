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

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
utils.setConfigSetting('hfc-logging', '{"debug":"console"}');
var logger = utils.getLogger('integration.client');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var util = require('util');
var path = require('path');
var fs = require('fs-extra');

var hfc = require('fabric-client');
var User = require('fabric-client/lib/User.js');
var Client = require('fabric-client/lib/Client.js');
var testUtil = require('../unit/util.js');
var couchdbUtil = require('./couchdb-util.js');

var tag = 'integration.client: ';
hfc.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
var caImport = utils.getConfigSetting('ca-import', 'notfound');
logger.debug('caImport = %s', JSON.stringify(caImport));

test('\n\n ** createUser happy path - file store **\n\n', function (t) {
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	utils.setConfigSetting('crypto-keysize', 256);
	var userOrg = 'org1';

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};
	var client = new Client();

	logger.info('try to cleanup kvs Path: '+keyStoreOpts.path);
	// clean up
	if (testUtil.existsSync(keyStoreOpts.path)) {
		fs.removeSync(keyStoreOpts.path);
		logger.info('removed kvsPath: '+keyStoreOpts.path);
	}

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: { privateKey: prvKey, signedCert: sgnCert },
				keyStoreOpts: keyStoreOpts
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
	hfc.addConfigFile('test/fixtures/couchdb.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var couchdbIPAddr = hfc.getConfigSetting('couchdb-ip-addr', 'notfound');
	var couchdbPort = hfc.getConfigSetting('couchdb-port', 'notfound');
	var keyValStorePath = couchdbIPAddr + ':' + couchdbPort;

	// Clean up the couchdb test database
	var userOrg = 'org1';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: keyValStorePath};
	logger.info('couch keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var client = new Client();
	couchdbUtil.destroy(dbname, keyValStorePath)
	.then((status) => {
		t.comment(tag+'Cleanup of existing ' + dbname + ' returned '+status);
		t.comment(tag+'Initialize the CouchDB KeyValueStore');
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.info('store: %s',store);
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
	hfc.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var cloudantUsername = hfc.getConfigSetting('cloudant-username', 'notfound');
	var cloudantPassword = hfc.getConfigSetting('cloudant-password', 'notfound');
	var cloudantBluemix = hfc.getConfigSetting('cloudant-bluemix', 'notfound');
	var cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	var userOrg = 'org1';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.info('cloudant keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var prvKey =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.privateKey);
	var sgnCert =  path.join(__dirname, caImport.orgs[userOrg].cryptoContent.signedCert);

	var client = new Client();
	couchdbUtil.destroy(dbname, cloudantUrl)
	.then((status) => {
		t.comment(tag+'Cleanup of existing ' + dbname + ' returned '+status);
		t.comment(tag+'Initialize the CouchDB KeyValueStore');
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.info('store: %s',store);
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

test('\n\n ** createUser happy path - Cloudant - PEM Strings  **\n\n', function (t) {
	// Use the Cloudant specific config file
	hfc.addConfigFile('test/fixtures/cloudant.json');
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/CouchDBKeyValueStore.js');//override
	var cloudantUsername = hfc.getConfigSetting('cloudant-username', 'notfound');
	var cloudantPassword = hfc.getConfigSetting('cloudant-password', 'notfound');
	var cloudantBluemix = hfc.getConfigSetting('cloudant-bluemix', 'notfound');
	var cloudantUrl = 'https://' + cloudantUsername + ':' + cloudantPassword + cloudantBluemix;

	// Clean up the cloudant test database
	var userOrg = 'org2';
	var dbname = (caImport.orgs[userOrg].name+'_db').toLowerCase();
	var keyStoreOpts = {name: dbname, url: cloudantUrl};
	logger.info('cloudant keyStoreOpts: '+ JSON.stringify(keyStoreOpts));

	var client = new Client();
	couchdbUtil.destroy(dbname, cloudantUrl)
	.then((status) => {
		t.comment(tag+'Cleanup of existing ' + dbname + ' returned '+status);
		t.comment(tag+'Initialize the CouchDB KeyValueStore');
		return utils.newKeyValueStore(keyStoreOpts);
	}).then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return true;
	}).then((status) => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: caImport.orgs[userOrg].cryptoContent,
				keyStoreOpts: keyStoreOpts
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
