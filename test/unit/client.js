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
var logger = utils.getLogger('unit.client');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var path = require('path');
var util = require('util');

var hfc = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var User = require('fabric-client/lib/User.js');
var testutil = require('./util.js');

var caImport;

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

test('\n\n ** Client.js Tests: getUserContext() method **\n\n', function (t) {
	t.doesNotThrow(
		() => {
			client.getUserContext();
		},
		null,
		'Should not throw an error when argument list is empty'
	);

	t.equals(client.getUserContext('invalidUser'), null, 'Should return null when requested for an invalid user');

	t.throws(
		() => {
			client.getUserContext(true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is undefined/,
		'Check that error condition is properly handled when only a truthy value is passed in'
	);

	t.throws(
		() => {
			client.getUserContext(null, true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value/,
		'Check that error condition is properly handled when "checkPersistence" is true but "name" is not valid string'
	);

	t.throws(
		() => {
			client.getUserContext('', true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value/,
		'Check that error condition is properly handled when "checkPersistence" is true but "name" is not valid string'
	);

	var promise = client.getUserContext('invalidUser', true);
	t.notEqual(promise, null, 'Should not return null but a promise when "checkPersistence" is true');
	promise.then((value) => {
		t.equals(value, null, 'Promise should resolve to a null when using an invalid user name');
		t.end();
	}, (err) => {
		t.fail(util.format('Failed to resolve the requested user name: %s', err));
		t.end();
	});
});

test('\n\n ** Client.js Tests: user persistence and loading **\n\n', function (t) {

	t.equals(client.getCryptoSuite(), null, 'Client getCryptoSuite should initially be null');
	client.setCryptoSuite(utils.newCryptoSuite());
	if (client.getCryptoSuite() != null) t.pass('Client getCryptoSuite should not be null after setCryptoSuite');

	var response = client.getUserContext();
	if (response === null)
		t.pass('Client tests: getUserContext successful null user name.');
	else
		t.fail('Client tests: getUserContext failed null name check');

	client.saveUserToStateStore()
	.then(function(response){
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

		response = client.getUserContext('someUser');
		if (response == null)
			t.pass('Client tests: getUserContext with no context in memory or persisted returns null');
		else
			t.fail('Client tests: getUserContext with no context in memory or persisted did not return null');

		return client.setUserContext(new User('someUser'), true);
	}).then(function(response){
		if (response && response.getName() === 'someUser')
			t.pass('Client tests: successfully setUserContext with skipPersistence.');
		else
			t.fail('Client tests: failed name check after setUserContext with skipPersistence.');

		response = client.getUserContext('someUser');
		if (response && response.getName() === 'someUser')
			t.pass('Client tests: getUserContext not persisted/skipPersistence was successful.');
		else
			t.fail('Client tests: getUserContext not persisted/skipPersistence was not successful.');

		return client.setUserContext(new User('someUser'));
	}, function(error){
		t.fail('Client tests: Unexpected error, failed setUserContext with skipPersistence. ' + error.stack ? error.stack : error);
		t.end();
	}).then(function(result){
		t.fail('Client tests: setUserContext without skipPersistence and no stateStore should not return result.');
		t.end();
	}, function(error){
		if (error.message === 'Cannot save user to state store when stateStore is null.')
			t.pass('Client tests: Should throw "Cannot save user to state store when stateStore is null"');
		else
			t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save user to state store when stateStore is null." ' + error.stack ? error.stack : error);

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

test('\n\n ** testing devmode set and get calls on client **\n\n', function (t) {
	t.equals(typeof hfc, 'function');
	var client = new Client();
	t.doesNotThrow(
		function () {
			client.setDevMode(true);
		},
		null,
		'checking the set of DevMode'
	);
	t.equal(client.isDevMode(), true, 'checking DevMode');
	t.end();
});

test('\n\n ** testing query calls fail without correct parameters on client **\n\n', function (t) {
	t.equals(typeof hfc, 'function');
	var client = new Client();

	var p1 = client.queryInstalledChaincodes().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Peer is required') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p2 = client.queryChannels().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Peer is required') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain query calls, Promise.all: ');
			console.log(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** testing get and new peer calls on client **\n\n', function (t) {
	t.equals(typeof hfc, 'function');
	var client = new Client();

	t.doesNotThrow(
		function() {
			var peer = client.newPeer('grpc://somehost:9090');
		},
		null,
		'Should be able to call "newPeer" with a valid URL');

	t.end();
});

test('\n\n ** testing get and new orderer calls on client **\n\n', function (t) {
	t.equals(typeof hfc, 'function');
	var client = new Client();

	t.doesNotThrow(
		function() {
			var orderer = client.newOrderer('grpc://somehost:9090');
		},
		null,
		'Should be able to call "newOrderer" with a valid URL');

	t.end();
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
	t.equals(hfc.getConfigSetting('request-timeout', 'notfound'), 30000, 'checking that able to get "request-timeout" value from an additional configuration file');
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

test('\n\n ** client installChaincode() tests **\n\n', function (t) {
	var peer = client.newPeer('grpc://localhost:7051');

	var p1 = client.installChaincode({
		targets: [peer],
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing chaincodePath parameter') >= 0) {
			t.pass('Successfully caught missing chaincodePath error');
		} else {
			t.fail('Failed to catch the missing chaincodePath error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p1a = client.installChaincode({
		targets: [peer],
		chaincodeId: 'blahp1a',
		chaincodePath: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeVersion" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeVersion" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeVersion error');
		} else {
			t.fail('Failed to catch the missing chaincodeVersion error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p3 = client.installChaincode({
		targets: [peer],
		chaincodePath: 'blahp3',
		chaincodeVersion: 'blah',
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p4 = client.installChaincode({
		chaincodePath: 'blahp4',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on request');
	}).catch(function (err) {
		var msg = 'Missing peer objects in install chaincode request';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p5 = client.installChaincode({
		targets: [peer],
		chaincodePath: 'blahp5',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "txId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "txId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing txId error');
		} else {
			t.fail('Failed to catch the missing txId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p6 = client.installChaincode({
		targets: [peer],
		chaincodePath: 'blahp6',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "nonce" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "nonce" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing nonce error');
		} else {
			t.fail('Failed to catch the missing nonce error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p7 = client.installChaincode().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing input request object on install chaincode request') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p1a, p3, p4, p6, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain installChaincode() tests, Promise.all: ');
			console.log(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Client createChannel() tests **\n\n', function (t) {
	var c = new Client();
	var orderer = c.newOrderer('grpc://localhost:7050');

	var p1 = c.createChannel({ envelope : {} , name : 'name'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of orderer missing');
	}).catch(function (err) {
		if (err.message.indexOf('Missing orderer') >= 0) {
			t.pass('Successfully caught missing orderer error');
		} else {
			t.fail('Failed to catch the missing orderer error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p2 = c.createChannel(
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing all') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p3 = c.createChannel({orderer : orderer, name : 'name'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of envelope request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing envelope') >= 0) {
			t.pass('Successfully caught missing envelope request error');
		} else {
			t.fail('Failed to catch the missing envelope request error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p4 = c.createChannel({envelope : {} , orderer : orderer}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of name request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing name') >= 0) {
			t.pass('Successfully caught missing name request error');
		} else {
			t.fail('Failed to catch the missing name request error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Client createChannel() tests, Promise.all: ');
			console.log(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** createUser error path - missing required opt parameter **\n\n', function (t) {
	hfc.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
	caImport = utils.getConfigSetting('ca-import', 'notfound');
	logger.debug('caImport = %s', JSON.stringify(caImport));

	var msg = 'Client.createUser missing required \'opts\' parameter.';

	var client = new Client();
	return client.createUser()
	.then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required state store **\n\n', function (t) {
	var msg = 'Client.createUser state store must be set on this client instance.';

	var client = new Client();
	return client.createUser({username: ''})
	.then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required username **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts username\' is required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({username: ''});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required mspid **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts mspid\' is required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({username: 'anyone'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required mspid **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts mspid\' is required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({username: 'anyone'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required cryptoContent **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts cryptoContent\' is required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required cryptoContent signedCertPEM **\n\n', function (t) {
	var msg = 'Client.createUser both parameters \'opts cryptoContent privateKeyPEM and signedCertPEM\' strings are required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({cryptoContent: {privateKeyPEM: 'abcd'}, username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required cryptoContent privateKeyPEM **\n\n', function (t) {
	var msg = 'Client.createUser both parameters \'opts cryptoContent privateKeyPEM and signedCertPEM\' strings are required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({cryptoContent: {signedCertPEM: 'abcd'}, username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required cryptoContent signedCert **\n\n', function (t) {
	var msg = 'Client.createUser both parameters \'opts cryptoContent privateKey and signedCert\' files are required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({cryptoContent: {privateKey: 'abcd'}, username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required cryptoContent privateKeyPEM **\n\n', function (t) {
	var msg = 'Client.createUser both parameters \'opts cryptoContent privateKey and signedCert\' files are required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({cryptoContent: {signedCert: 'abcd'}, username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

test('\n\n ** createUser error path - missing required keyStoreOpts **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts keyStoreOpts\' is required when cryptoSuite has not been set.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: caImport.orgs[userOrg].storePath};

	var client = new Client();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser({cryptoContent: 'abcde', username: 'anyone', mspid: 'one'});
	}, (err) => {
		logger.error(err.stack ? err.stack : err);
		throw new Error('Failed createUser.');
	}).then((user) => {
		t.fail('Should not have gotten user.');
		t.end();
	}).catch((err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('Should throw '+msg);
			t.end;
		} else {
			t.fail('Expected error message: '+msg+'\n but got '+err.message);
			t.end;
		}
	});
});

