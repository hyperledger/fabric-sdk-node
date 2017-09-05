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
var logger = utils.getLogger('unit.client');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var path = require('path');
var util = require('util');
var sinon = require('sinon');

var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var User = require('fabric-client/lib/User.js');
var Peer = require('fabric-client/lib/Peer.js');
var testutil = require('./util.js');

var caImport;

var grpc = require('grpc');
var _configtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;
var rewire = require('rewire');
var ClientRewired = rewire('fabric-client/lib/Client.js');

test('\n\n ** index.js **\n\n', function (t) {
	testutil.resetDefaults();

	t.equals(typeof Client, 'function');

	t.doesNotThrow(
		function() {
			var c = new Client();
		},
		null,
		'Should be able to instantiate a new instance of "Client" require');

	t.doesNotThrow(
		function() {
			var c = new Client();
			var channel = c.newChannel('test');
		},
		null,
		'Should be able to call "newChannel" on the new instance of "Client"');

	t.end();
});

test('\n\n ** eventhub **\n\n', function (t) {
	t.doesNotThrow(
		function() {
			var c = new Client();
			c._userContext = new User('name');
			var event_hub = c.newEventHub();
		},
		null,
		'Should be able to call "newEventHub" on the new instance of "hfc"');

	t.end();
});

var client = new Client();
var channelKeyValStorePath = path.join(testutil.getTempDir(), 'channelKeyValStorePath');
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';

test('\n\n ** Client.js Tests: CryptoSuite() methods **\n\n', function (t) {
	t.equals(client.getCryptoSuite(), null, 'Should return null when CryptoSuite has not been set');

	var crypto = Client.newCryptoSuite();
	client.setCryptoSuite(crypto);
	if (crypto) {
		t.pass('Successfully called newCryptoSuite()');
	}
	else {
		t.fail('newCryptoSuite() did not return an object');
	}

	crypto = client.getCryptoSuite();
	if (crypto) {
		t.pass('Successfully called getCryptoSuite()');
	}
	else {
		t.fail('getCryptoSuite() did not return an object');
	}

	client.setCryptoSuite(null);
	t.equals(client.getCryptoSuite(), null, 'Should return null when CryptoSuite has been set to null');

	t.end();

});

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

		var channel = client.newChannel('someChannel');
		t.equals(channel.getName(), 'someChannel', 'Checking channel names match');
		t.throws(
			function () {
				client.newChannel('someChannel');
			},
			/^Error: Channel someChannel already exist/,
			'Client tests: checking that channel already exists.');

		t.doesNotThrow(
			function() {
				client.getChannel('someChannel');
			},
			null,
			'Client tests: getChannel()');

		t.throws(
				function () {
					client.getChannel('someOtherChannel');
				},
				/^Error: Channel not found for name someOtherChannel./,
				'Client tests: Should throw Error: Channel not found for name someOtherChannel.');

		t.throws(
			function() {
				client.setStateStore({});
			},
			/The "keyValueStore" parameter must be an object that implements the following methods, which are missing:/,
			'Client tests: checking state store parameter implementing required functions');

		testutil.cleanupDir(channelKeyValStorePath);

		return Client.newDefaultKeyValueStore({ path: channelKeyValStorePath });
	}).then (
		function (kvs) {
			client.setStateStore(kvs);

			var exists = testutil.existsSync(channelKeyValStorePath);
			if (exists)
				t.pass('Client setKeyValueStore test:  Successfully created new directory');
			else
				t.fail('Client setKeyValueStore test:  Failed to create new directory: ' + channelKeyValStorePath);

			var store = client.getStateStore();
			return store.setValue('testKey', 'testValue');
		}).then(
			function (result) {
				t.pass('Client getStateStore test:  Successfully set value, result: ' + result);

				var exists = testutil.existsSync(channelKeyValStorePath, testKey);
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
	t.equals(typeof Client, 'function');
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
	t.equals(typeof Client, 'function');
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
			t.fail('Channel query calls, Promise.all: ');
			console.log(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** testing get and new peer calls on client **\n\n', function (t) {
	t.equals(typeof Client, 'function');
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
	t.equals(typeof Client, 'function');
	var client = new Client();

	t.doesNotThrow(
		function() {
			var orderer = client.newOrderer('grpc://somehost:9090');
		},
		null,
		'Should be able to call "newOrderer" with a valid URL');

	t.end();
});

test('\n\n ** testing get transaction ID call on client **\n\n', function (t) {
	t.equals(typeof Client, 'function');
	var client = new Client();

	t.throws(function() {
		client.newTransactionID();
	},
	/This client instance must be assigned an user context/,
	'Test This client instance must be assigned an user context');

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
	if (global && global.hfc) global.hfc.config = undefined;
	require('nconf').reset();

	t.equals(Client.getConfigSetting('request-timeout', 'notfound'), 45000, 'checking that able to get "request-timeout" value from an additional configuration file');
	//try adding another config file
	Client.addConfigFile(path.join(__dirname, '../fixtures/local.json'));
	t.equals(Client.getConfigSetting('test-2', 'notfound'), 'local', 'checking that able to test-2 value from an additional configuration file');
	t.equals(Client.getConfigSetting('test-3', 'notfound'), 'env', 'checking that test-3 environment values are used');
	t.equals(Client.getConfigSetting('test-4', 'notfound'), 'argv', 'checking that test-4 argument values are used');
	Client.setConfigSetting('test-5', 'program');
	t.equals(Client.getConfigSetting('test-5', 'notfound'), 'program', 'checking that test-5 program values are used');
	t.equals(Client.getConfigSetting('test-6', 'notfound'), 'mapped', 'checking that test-6 is enviroment mapped value');
	t.end();
});

test('\n\n ** client installChaincode() tests **\n\n', function (t) {
	var peer = client.newPeer('grpc://localhost:7051');

	var p1 = client.installChaincode({
		targets: [peer],
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing chaincodePath parameter') >= 0) {
			t.pass('P1 - Successfully caught missing chaincodePath error');
		} else {
			t.fail('Failed to catch the missing chaincodePath error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p2 = client.installChaincode({
		targets: [peer],
		chaincodeId: 'blahp1a',
		chaincodePath: 'blah',
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeVersion" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeVersion" parameter in the proposal request') >= 0) {
			t.pass('P2 - Successfully caught missing chaincodeVersion error');
		} else {
			t.fail('Failed to catch the missing chaincodeVersion error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p3 = client.installChaincode({
		targets: [peer],
		chaincodePath: 'blahp3',
		chaincodeVersion: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
			t.pass('P3 - Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p4 = client.installChaincode({
		chaincodePath: 'blahp4',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on request');
	}).catch(function (err) {
		var msg = 'Missing peer objects in install chaincode request';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('P4 - Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p5 = client.installChaincode().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing input request object on install chaincode request') >= 0) {
			t.pass('P5 - Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p5])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel installChaincode() tests, Promise.all: ');
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

	var p3 = c.createChannel({orderer : orderer, name : 'name', txId : '777', signatures : []}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of envelope request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing config') >= 0) {
			t.pass('Successfully caught missing config request error');
		} else {
			t.fail('Failed to catch the missing config request error. Error: ');
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

	var p5 = c.createChannel({config : {}, orderer : orderer, name: 'name', txId : 'fff'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing signatures request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing signatures') >= 0) {
			t.pass('Successfully caught missing signatures request error');
		} else {
			t.fail('Failed to catch the missing signatures request error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p6 = c.createChannel({config : {}, orderer : orderer, name: 'name', signatures : {}, txId : 'fff'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing signatures request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('must be an array of signatures') >= 0) {
			t.pass('Successfully caught request parameter must be an array error');
		} else {
			t.fail('Failed to catch request parameter must be an array request error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p7 = c.createChannel({config : {}, orderer : orderer, name: 'name', signatures : []}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing txId request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing txId') >= 0) {
			t.pass('Successfully caught request parameter must have txId error');
		} else {
			t.fail('Failed to catch request parameter must have txId error. Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p5, p6, p7])
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
	Client.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
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

test('\n\n ** createUser error path - missing required username **\n\n', function (t) {
	var msg = 'Client.createUser parameter \'opts username\' is required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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

test('\n\n ** createUser error path - missing required cryptoContent privateKey **\n\n', function (t) {
	var msg = 'Client.createUser both parameters \'opts cryptoContent privateKey and signedCert\' files are required.';

	var userOrg = 'org1';
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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

test('\n\n ** createUser error path - invalid cryptoContent **\n\n', function (t) {
	var msg = 'failed to load private key data';

	var userOrg = 'org1';
	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

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

test('\n\n ** createUser error path - no keyValueStore **\n\n', function (t) {
	var msg = 'Failed to load key or certificate and save to local stores';
	var userOrg = 'org2';
	utils.setConfigSetting('crypto-keysize', 256);

	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();

	client.createUser(
		{username: caImport.orgs[userOrg].username,
			mspid: caImport.orgs[userOrg].mspid,
			cryptoContent: caImport.orgs[userOrg].cryptoContent
	    })
	.then((user) => {
		if (user) {
			t.fail('createUser, did not expect successful create');
			t.end();
		} else {
			t.fail('createUser, returned null but expected error');
			t.end();
		}
	}, (err) => {
		if (err.message.indexOf(msg) > -1) {
			t.pass('createUser, error expected: '+msg);
			t.end();
		} else {
			t.fail('createUser, unexpected error: '+err.message);
			t.comment(err.stack ? err.stack : err);
			t.end();
		}
	}).catch((err) => {
		t.fail('createUser, caught unexpected error: '+err.message);
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** createUser success path - no cryptoKeyStore **\n\n', function (t) {
	var userOrg = 'org2';
	utils.setConfigSetting('crypto-keysize', 256);

	var keyStoreOpts = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};

	var client = new Client();
	var cryptoSuite = Client.newCryptoSuite();

	return utils.newKeyValueStore(keyStoreOpts)
	.then((store) => {
		logger.info('store: %s',store);
		client.setStateStore(store);
		return '';
	}).then(() => {
		return client.createUser(
			{username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: caImport.orgs[userOrg].cryptoContent
			});
	}).then((user) => {
		if (user) {
			t.pass('createUser, got user');
			t.end();
		} else {
			t.fail('createUser, returned null');
			t.end();
		}
	}).catch((err) => {
		t.fail('createUser, error, did not get user');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** test related APIs for create channel **\n\n', function (t) {
	var client = new Client();

	t.throws(
		function () {
			client.signChannelConfig();
		},
		/^Error: Channel configuration update parameter is required./,
		'Client tests: Channel configuration update parameter is required.');

	t.throws(
		function () {
			client.signChannelConfig();
		},
		/^Error: Channel configuration update parameter is required./,
		'Client tests: Channel configuration update parameter is required.');

	var p3a= client.updateChannel({config : 'a', txId : 'a', orderer : 'a', name : 'a' }
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Missing signatures request parameter for the new channel';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});
	var p3b= client.updateChannel({config : 'a', signatures : 'a', txId : 'a', orderer : 'a', name : 'a'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Signatures request parameter must be an array of signatures';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p4= client.updateChannel({config : 'a', signatures : [], orderer : 'a', name : 'a'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Missing txId request parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});

	var p6= client.updateChannel({config : 'a', signatures : [], txId : 'a', name : 'a'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Missing orderer request parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});
	var p7= client.updateChannel({config : 'a', signatures : [], txId : 'a', orderer : 'a'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Missing name request parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});
	var p8= client.createChannel({envelope : 'a'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise');
	}).catch(function (err) {
		let msg = 'Missing name request parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught the ' + msg );
		} else {
			t.fail('Failed to catch the ' + msg + ' Error: ');
			console.log(err.stack ? err.stack : err);
		}
	});
	Promise.all([p3a, p3b, p4, p6, p7, p8])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Client buildChannelConfigUpdate() tests, Promise.all: ');
			console.log(err.stack ? err.stack : err);
			t.end();
		}
	);

	t.end();
});

test('\n\n ** test internal method to rebuild ConfigSignatures **\n\n', function (t) {
	var some_proto_signatures = [];
	var proto_config_signature = new _configtxProto.ConfigSignature();
	proto_config_signature.setSignatureHeader(Buffer.from('signature_header_bytes'));
	proto_config_signature.setSignature(Buffer.from('signature_bytes'));
	some_proto_signatures.push(proto_config_signature);
	var string_config_signature = proto_config_signature.toBuffer().toString('hex');
	some_proto_signatures.push(string_config_signature);

	var _stringToSignature = ClientRewired.__get__('_stringToSignature');
	var all_proto_signatures = _stringToSignature(some_proto_signatures);
	for(let i in all_proto_signatures) {
		var start_header = proto_config_signature.getSignatureHeader().toBuffer().toString();
		var start_sig = proto_config_signature.getSignature().toBuffer().toString();
		var decode_header = all_proto_signatures[i].getSignatureHeader().toBuffer().toString();
		var decode_sig = all_proto_signatures[i].getSignature().toBuffer().toString();
		logger.info(' headers  are ==> %s :: %s', start_header, decode_header);
		logger.info(' signatures are ==> %s :: %s', start_sig, decode_sig);

		t.equals(start_header, decode_header, 'check signature headers are the same');
		t.equals(start_sig, decode_sig, 'check signatures are the same');
	}
	t.end();
});

test('\n\n*** Test per-call timeout support ***\n', function(t) {
	let sandbox = sinon.sandbox.create();
	let stub = sandbox.stub(Peer.prototype, 'sendProposal');

	// stub out the calls that requires getting MSPs from the orderer, or
	// a valid user context
	let clientUtils = ClientRewired.__get__('clientUtils');
	sandbox.stub(clientUtils, 'buildHeader').returns(Buffer.from('dummyHeader'));
	sandbox.stub(clientUtils, 'buildProposal').returns(Buffer.from('dummyProposal'));
	sandbox.stub(clientUtils, 'signProposal').returns(Buffer.from('dummyProposal'));
	let _getChaincodePackageData = ClientRewired.__set__(
		'_getChaincodePackageData',
		function() {
			return Promise.resolve(Buffer.from('dummyChaincodePackage'));
		});

	let client = new ClientRewired();
	client._userContext = new User('somebody');
	client._userContext.getIdentity = function() {
		return {
			serialize: function() { return Buffer.from(''); }
		};
	};
	client._userContext.getSigningIdentity = function() { return ''; };

	let p = client.installChaincode({
		targets: [new Peer('grpc://localhost:7051'), new Peer('grpc://localhost:7052')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'v0'
	}, 12345).then(function () {
		t.equal(stub.calledTwice, true, 'Peer.sendProposal() is called exactly twice');
		t.equal(stub.firstCall.args.length, 2, 'Peer.sendProposal() is called first time with exactly 2 arguments');
		t.equal(stub.firstCall.args[1], 12345, 'Peer.sendProposal() is called first time with a overriding timeout of 12345 (milliseconds)');
		t.equal(stub.secondCall.args.length, 2, 'Peer.sendProposal() is called 2nd time with exactly 2 arguments');
		t.equal(stub.secondCall.args[1], 12345, 'Peer.sendProposal() is called 2nd time with a overriding timeout of 12345 (milliseconds)');
		sandbox.restore();
		t.end();
	}).catch(function (err) {
		t.fail('Failed to catch the missing chaincodeVersion error. Error: ' + err.stack ? err.stack : err);
		sandbox.restore();
		t.end();
	});
});