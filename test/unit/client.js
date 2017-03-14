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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var path = require('path');

var hfc = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var User = require('fabric-client/lib/User.js');
var testutil = require('./util.js');

test('\n\n ** index.js **\n\n', function (t) {
	t.equals(typeof hfc, 'function');

	t.doesNotThrow(
		function() {
			var c = new hfc();
		},
		null,
		'Should be able to instantiate a new instance of "hfc" require');

	t.doesNotThrow(
		function() {
			var c = new hfc();
			var chain = c.newChain('test');
		},
		null,
		'Should be able to call "newChain" on the new instance of "hfc"');

	t.end();
});

var Client = hfc;
var client = new Client();
var chainKeyValStorePath = 'tmp/chainKeyValStorePath';
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';

test('\n\n ** lib/Client.js **\n\n', function (t) {

	t.equals(client.getCryptoSuite(), null, 'Client getCryptoSuite should initially be null');
	client.setCryptoSuite(utils.newCryptoSuite());
	if (client.getCryptoSuite() != null) t.pass('Client getCryptoSuite should not be null after setCryptoSuite');

	client.getUserContext()
	.then(function(response){
		if (response === null)
			t.pass('Client tests: getUserContext successful null user name.');
		else t.fail('Client tests: getUserContext failed null name check');

		return client.saveUserToStateStore();
	}, function(error){
		t.fail('Client tests: Unexpected error, getUserContext null name check. ' + error.stack ? error.stack : error);
		t.end();
	}).then(function(response){
		t.fail('Client tests: got response, but should throw "Cannot save user to state store when userContext is null."');
		t.end();
	}, function(error){
		if (error.message === 'Cannot save user to state store when userContext is null.')
			t.pass('Client tests: Should throw "Cannot save user to state store when userContext is null."');
		else t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save user to state store when userContext is null." ' + error.stack ? error.stack : error);

		return client.setUserContext(null);
	}).then(function(response){
		t.fail('Client tests: got response, but should throw "Cannot save null userContext."');
		t.end();
	}, function(error){
		if (error.message === 'Cannot save null userContext.')
			t.pass('Client tests: Should throw "Cannot save null userContext."');
		else t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save null userContext." ' + error.stack ? error.stack : error);

		return client.getUserContext('someUser');
	}).then(function(response){
		if (response == null)
			t.pass('Client tests: getUserContext with no context in memory or persisted returns null');
		else t.fail('Client tests: getUserContext with no context in memory or persisted did not return null');

		return client.setUserContext(new User('someUser'), true);
	}, function(error){
		t.fail('Client tests: getUserContext with no context in memory or persisted did not returned error. ' + error.stack ? error.stack : error);
		t.end();
	}).then(function(response){
		if (response && response.getName() === 'someUser') {
			t.pass('Client tests: successfully setUserContext with skipPersistence.');
			return response;
		}
		else t.fail('Client tests: failed name check after setUserContext with skipPersistence.');

		return client.getUserContext('someUser');
	}, function(error){
		t.fail('Client tests: Unexpected error, failed setUserContext with skipPersistence. ' + error.stack ? error.stack : error);
		t.end();
	}).then(function(response){
		if (response && response.getName() === 'someUser')
			t.pass('Client tests: getUserContext not persisted/skipPersistence was successful.');
		else t.fail('Client tests: getUserContext not persisted/skipPersistence was not successful.');

		return client.setUserContext(new User('someUser'));
	}, function(error){
		t.fail('Client tests: Unexpected error, getUserContext not persisted/skipPersistence. ' + error.stack ? error.stack : error);
		t.end();
	}).then(function(result){
		t.fail('Client tests: setUserContext without skipPersistence and no stateStore should not return result.');
		t.end();
	}, function(error){
		if (error.message === 'Cannot save user to state store when stateStore is null.')
			t.pass('Client tests: Should throw "Cannot save user to state store when stateStore is null"');
		else t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save user to state store when stateStore is null." ' + error.stack ? error.stack : error);

		var chain = client.newChain('someChain');
		t.equals(chain.getName(), 'someChain', 'Checking chain names match');
		t.throws(
			function () {
				client.newChain('someChain');
			},
			/^Error: Chain someChain already exist/,
			'Client tests: checking that chain already exists.');

		t.doesNotThrow(
			function() {
				client.getChain('someChain');
			},
			null,
			'Client tests: getChain()');

		t.throws(
				function () {
					client.getChain('someOtherChain');
				},
				/^Error: Chain not found for name someOtherChain./,
				'Client tests: Should throw Error: Chain not found for name someOtherChain.');

		t.throws(
			function() {
				client.setStateStore({});
			},
			/The "keyValueStore" parameter must be an object that implements the following methods, which are missing:/,
			'Client tests: checking state store parameter implementing required functions');

		testutil.cleanupDir(chainKeyValStorePath);

		return Client.newDefaultKeyValueStore({ path: chainKeyValStorePath });
	}).then (
		function (kvs) {
			client.setStateStore(kvs);

			var exists = testutil.existsSync(chainKeyValStorePath);
			if (exists)
				t.pass('Client setKeyValueStore test:  Successfully created new directory');
			else
				t.fail('Client setKeyValueStore test:  Failed to create new directory: ' + chainKeyValStorePath);

			var store = client.getStateStore();
			return store.setValue('testKey', 'testValue');
		}).then(
			function (result) {
				t.pass('Client getStateStore test:  Successfully set value, result: ' + result);

				var exists = testutil.existsSync(chainKeyValStorePath, testKey);
				if (exists)
					t.pass('Client getStateStore test:  Verified the file for key ' + testKey + ' does exist');
				else
					t.fail('Client getStateStore test:  Failed to create file for key ' + testKey);

				t.end();
			}
		).catch(
			function (reason) {
				t.fail('Client getStateStore test:  Failed to set value, reason: ' + reason);
				t.end();
			}
		);
});

/*
 * This test assumes that there is a ./config directory from the running location
 * and that there is file called 'config.json'.
 */
test('\n\n ** Config **\n\n', function (t) {
	// setup the environment
	process.argv.push('--test-4=argv');
	process.argv.push('--test-5=argv');
	process.env.TEST_3 = 'env';
	process.env.test_6 = 'mapped';
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	t.equals(hfc.getConfigSetting('request-timeout', 'notfound'), 3000, 'checking that able to get "request-timeout" value from an additional configuration file');
	//try adding another config file
	hfc.addConfigFile(path.join(__dirname, '../fixtures/local.json'));
	t.equals(hfc.getConfigSetting('test-2', 'notfound'), 'local', 'checking that able to test-2 value from an additional configuration file');
	t.equals(hfc.getConfigSetting('test-3', 'notfound'), 'env', 'checking that test-3 environment values are used');
	t.equals(hfc.getConfigSetting('test-4', 'notfound'), 'argv', 'checking that test-4 argument values are used');
	hfc.setConfigSetting('test-5', 'program');
	t.equals(hfc.getConfigSetting('test-5', 'notfound'), 'program', 'checking that test-5 program values are used');
	t.equals(hfc.getConfigSetting('test-6', 'notfound'), 'mapped', 'checking that test-6 is enviroment mapped value');
	t.end();
});
