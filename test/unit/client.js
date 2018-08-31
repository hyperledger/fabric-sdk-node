/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('unit.client');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const path = require('path');
const sinon = require('sinon');

const Client = require('fabric-client');
const User = require('fabric-client/lib/User.js');
const Peer = require('fabric-client/lib/Peer.js');
const NetworkConfig = require('fabric-client/lib/impl/NetworkConfig_1_0.js');
const testutil = require('./util.js');

let caImport;

const grpc = require('grpc');
const _configtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;
const rewire = require('rewire');
const ClientRewired = rewire('fabric-client/lib/Client.js');

const aPem = '-----BEGIN CERTIFICATE-----' +
	'MIIBwTCCAUegAwIBAgIBATAKBggqhkjOPQQDAzApMQswCQYDVQQGEwJVUzEMMAoG' +
	'A1UEChMDSUJNMQwwCgYDVQQDEwNPQkMwHhcNMTYwMTIxMjI0OTUxWhcNMTYwNDIw' +
	'MjI0OTUxWjApMQswCQYDVQQGEwJVUzEMMAoGA1UEChMDSUJNMQwwCgYDVQQDEwNP' +
	'QkMwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAR6YAoPOwMzIVi+P83V79I6BeIyJeaM' +
	'meqWbmwQsTRlKD6g0L0YvczQO2vp+DbxRN11okGq3O/ctcPzvPXvm7Mcbb3whgXW' +
	'RjbsX6wn25tF2/hU6fQsyQLPiJuNj/yxknSjQzBBMA4GA1UdDwEB/wQEAwIChDAP' +
	'BgNVHRMBAf8EBTADAQH/MA0GA1UdDgQGBAQBAgMEMA8GA1UdIwQIMAaABAECAwQw' +
	'CgYIKoZIzj0EAwMDaAAwZQIxAITGmq+x5N7Q1jrLt3QFRtTKsuNIosnlV4LR54l3' +
	'yyDo17Ts0YLyC0pZQFd+GURSOQIwP/XAwoMcbJJtOVeW/UL2EOqmKA2ygmWX5kte' +
	'9Lngf550S6gPEWuDQOcY95B+x3eH' +
	'-----END CERTIFICATE-----';

test('\n\n ** index.js **\n\n', (t) => {
	testutil.resetDefaults();

	t.equals(typeof Client, 'function');

	t.doesNotThrow(
		() => {
			new Client();
		},
		'Should be able to instantiate a new instance of "Client" require');

	t.doesNotThrow(
		() => {
			const c = new Client();
			c.newChannel('test');
		},
		'Should be able to call "newChannel" on the new instance of "Client"');

	t.end();
});

const channelKeyValStorePath = path.join(testutil.getTempDir(), 'channelKeyValStorePath');
const testKey = 'keyValFileStoreName';

const prepareClient = () => {
	const client = new Client();
	const cryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);
	return client;
};

test('\n\n ** config **\n\n', (t) => {
	t.doesNotThrow(
		() => {
			const c = new Client();
			t.equals(c.getConfigSetting('something', 'ABC'), 'ABC', 'Check getting default config setting value');
			c.setConfigSetting('something', 'DEF');
			t.equals(c.getConfigSetting('something', 'ABC'), 'DEF', 'Check getting a set config setting value');
		},
		'Should be able to call "getConfigSetting" on the new instance of "hfc"');

	t.end();
});

test('\n\n ** Client.js Tests: CryptoSuite() methods **\n\n', (t) => {
	const client = new Client();
	t.equals(client.getCryptoSuite(), null, 'Should return null when CryptoSuite has not been set');

	let crypto = Client.newCryptoSuite();
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

test('\n\n ** Client.js Tests: getUserContext() method **\n\n', async (t) => {
	const client = prepareClient();
	try {
		await client.getUserContext();
	} catch (e) {
		t.fail('Should not throw an error when argument list is empty');
	}

	let invalidUser = await client.getUserContext('invalidUser');
	t.notOk(invalidUser, 'Should return null when requested for an invalid user');

	invalidUser = await client.getUserContext('invalidUser', true);
	t.notOk(invalidUser, 'return null when using invalid user and "checkPersistence" is true');

	await testutil.tapeAsyncThrow(t,
		async () => {
			await client.getUserContext(true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is undefined/,
		'Check that error condition is properly handled when only a truthy value is passed in');

	await testutil.tapeAsyncThrow(t,
		async () => {
			await client.getUserContext(null, true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value/,
		'Check that error condition is properly handled when "checkPersistence" is true but "name" is not valid string'
	);


	await testutil.tapeAsyncThrow(t,
		async () => {
			await client.getUserContext('', true);
		},
		/Illegal arguments: "checkPersistence" is truthy but "name" is not a valid string value/,
		'Check that error condition is properly handled when "checkPersistence" is true but "name" is not valid string'
	);

	t.end();
});

test('\n\n ** Client.js Tests: user persistence and loading **\n\n', async (t) => {

	const client = prepareClient();
	let response;

	try {
		await client.saveUserToStateStore();
		t.fail('Client tests: got response, but should throw "Cannot save user to state store when userContext is null."');
	} catch (error) {
		if (error.message === 'Cannot save user to state store when userContext is null.') {
			t.pass('Client tests: Should throw "Cannot save user to state store when userContext is null."');
		} else {
			t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save user to state store when userContext is null." ' + error.stack ? error.stack : error);
		}
	}

	try {
		await client.setUserContext(null);
		t.fail('Client tests: got response, but should throw "Cannot save null userContext."');
		t.end();
	} catch (error) {
		if (error.message === 'Cannot save null userContext.')
			t.pass('Client tests: Should throw "Cannot save null userContext."');
		else t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save null userContext." ' + error.stack ? error.stack : error);
	}

	try {
		response = await client.getUserContext('someUser');
		if (response == null) {
			t.pass('Client tests: getUserContext with no context in memory or persisted returns null');
		} else {
			t.fail('Client tests: getUserContext with no context in memory or persisted did not return null');
		}

		response = await client.setUserContext(new User('someUser'), true);
		if (response && response.getName() === 'someUser') {
			t.pass('Client tests: successfully setUserContext with skipPersistence.');
		} else {
			t.fail('Client tests: failed name check after setUserContext with skipPersistence.');
		}

		response = await client.getUserContext('someUser');
		if (response && response.getName() === 'someUser') {
			t.pass('Client tests: getUserContext not persisted/skipPersistence was successful.');
		} else {
			t.fail('Client tests: getUserContext not persisted/skipPersistence was not successful.');
		}

		response = await client.getUserContext('someUser');
		if (response && response.getName() === 'someUser') {
			t.pass('Client tests: getUserContext not persisted/skipPersistence was successful.');
		} else {
			t.fail('Client tests: getUserContext not persisted/skipPersistence was not successful.');
		}

		try {
			await client.setUserContext(new User('someUser'));
			t.fail('Client tests: setUserContext without skipPersistence and no stateStore should not return result.');
			t.end();
		} catch (error) {
			if (error.message === 'Cannot save user to state store when stateStore is null.')
				t.pass('Client tests: Should throw "Cannot save user to state store when stateStore is null"');
			else
				t.fail('Client tests: Unexpected error message thrown, should throw "Cannot save user to state store when stateStore is null." ' + error.stack ? error.stack : error);
		}

		const channel = client.newChannel('somechannel');
		t.equals(channel.getName(), 'somechannel', 'Checking channel names match');
		t.throws(
			() => {
				client.newChannel('somechannel');
			},
			/^Error: Channel somechannel already exist/,
			'Client tests: checking that channel already exists.');

		t.doesNotThrow(
			() => {
				client.getChannel('somechannel');
			},
			'Client tests: getChannel()');

		t.throws(
			() => {
				client.getChannel('someOtherChannel');
			},
			/^Error: Channel not found for name someOtherChannel./,
			'Client tests: Should throw Error: Channel not found for name someOtherChannel.');

		t.throws(
			() => {
				client.setStateStore({});
			},
			/The "keyValueStore" parameter must be an object that implements the following methods, which are missing:/,
			'Client tests: checking state store parameter implementing required functions');

		testutil.cleanupDir(channelKeyValStorePath);
		const kvs = await Client.newDefaultKeyValueStore({path: channelKeyValStorePath});
		client.setStateStore(kvs);

		let exists = testutil.existsSync(channelKeyValStorePath);
		if (exists) {
			t.pass('Client setKeyValueStore test:  Successfully created new directory');
		} else {
			t.fail('Client setKeyValueStore test:  Failed to create new directory: ' + channelKeyValStorePath);
		}

		const store = client.getStateStore();
		const result = await store.setValue('testKey', 'testValue');
		t.pass('Client getStateStore test:  Successfully set value, result: ' + result);

		exists = testutil.existsSync(channelKeyValStorePath, testKey);
		if (exists) {
			t.pass('Client getStateStore test:  Verified the file for key ' + testKey + ' does exist');
		} else {
			t.fail('Client getStateStore test:  Failed to create file for key ' + testKey);
		}

		t.end();
	} catch (e) {
		t.fail(`Client StateStore tests:  Error ${e}`);
		t.end();
	}
});

test('\n\n ** testing channel operation on client **\n\n', async (t) => {

	const client = prepareClient();
	await client.setUserContext(new User('someUser'), true);
	const channelName = 'somechannel';
	client.newChannel(channelName);
	t.throws(
		() => {
			client.newChannel(channelName);
		},
		/^Error: Channel somechannel already exist/,
		'Client tests: checking that channel already exists.');

	t.doesNotThrow(
		() => {
			client.getChannel(channelName);
		},
		'Client tests: getChannel()');

	t.throws(
		() => {
			client.getChannel('someOtherChannel');
		},
		/^Error: Channel not found for name someOtherChannel./,
		'Client tests: Should throw Error: Channel not found for name someOtherChannel.');

	t.end();
});

test('\n\n ** testing devmode set and get calls on client **\n\n', (t) => {
	const client = new Client();
	t.doesNotThrow(
		() => {
			client.setDevMode(true);
		},
		'checking the set of DevMode'
	);
	t.equal(client.isDevMode(), true, 'checking DevMode');
	t.end();
});

test('\n\n ** testing query calls fail without correct parameters on client **\n\n', async (t) => {
	const client = new Client();

	try {
		await client.queryInstalledChaincodes();
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	} catch (e) {
		if (e.message.includes('Peer is required')) {
			t.pass('p1 - Successfully caught missing request error');
		} else {
			t.fail('p1 - Failed to catch the missing request error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.queryInstalledChaincodes('somename');
		t.fail('Should not have been able to resolve the promise because of No network configuraton loaded');
	} catch (e) {
		if (e.message.includes('not found')) {
			t.pass('Successfully caught No network configuraton loaded error');
		} else {
			t.fail('Failed to catch the No network configuraton loaded error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.queryChannels();
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	} catch (e) {
		if (e.message.includes('Peer is required')) {
			t.pass('p2 - Successfully caught missing request error');
		} else {
			t.fail('p2 - Failed to catch the missing request error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.queryChannels('somename');
		t.fail('Should not have been able to resolve the promise because of no network loaded');
	} catch (e) {
		if (e.message.includes('not found')) {
			t.pass('Successfully caught no network loaded error');
		} else {
			t.fail('Failed to catch the no network loaded error. Error: ' + e.stack ? e.stack : e);
		}
	}

	client._network_config = new NetworkConfig({}, client);
	try {
		await client.queryChannels('somename');
		t.fail('Should not have been able to resolve the promise because of wrong request parameter');
	} catch (e) {
		if (e.message.includes('not found')) {
			t.pass('Successfully caught wrong request error');
		} else {
			t.fail('Failed to catch the wrong request error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.queryInstalledChaincodes('somename');
		t.fail('Should not have been able to resolve the promise because of wrong request parameter');
	} catch (e) {
		if (e.message.includes('not found')) {
			t.pass('Successfully caught wrong request error');
		} else {
			t.fail('Failed to catch the wrong request error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.queryChannels({});
		t.fail('Should not have been able to resolve the promise because of wrong object request parameter');
	} catch (e) {
		if (e.message.includes('Target peer is not a valid peer object instance')) {
			t.pass('Successfully caught wrong object request error');
		} else {
			t.fail('Failed to catch the wrong object request error. Error: ' + e.stack ? e.stack : e);
		}
	}
	t.end();
});

test('\n\n ** testing get and new peer calls on client **\n\n', (t) => {
	const client = new Client();

	t.doesNotThrow(
		() => {
			client.newPeer('grpc://somehost:9090');
		},
		'Should be able to call "newPeer" with a valid URL');

	t.end();
});

test('\n\n ** testing get and new orderer calls on client **\n\n', (t) => {
	const client = new Client();

	t.doesNotThrow(
		() => {
			client.newOrderer('grpc://somehost:9090');
		},
		'Should be able to call "newOrderer" with a valid URL');

	t.end();
});

test('\n\n ** testing get transaction ID call on client **\n\n', (t) => {
	const client = new Client();

	t.throws(
		() => {
			client.newTransactionID();
		},
		/No identity has been assigned to this client/,
		'Test - No identity has been assigned to this client');

	t.end();
});

/*
 * This test assumes that there is a ./config directory from the running location
 * and that there is file called 'config.json'.
 */
test('\n\n ** Config **\n\n', (t) => {
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

test('\n\n ** client installChaincode() tests **\n\n', async (t) => {
	const client = prepareClient();
	const peer = client.newPeer('grpc://localhost:7051');

	try {
		await client.installChaincode();
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	} catch (e) {
		if (e.message.includes('Missing input request object on install chaincode request')) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.installChaincode({
			targets: [peer],
			chaincodeId: 'blah',
			chaincodeVersion: 'blah',
		});
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');

	} catch (err) {
		if (err.message.includes('Missing chaincodePath parameter')) {
			t.pass('Successfully caught missing chaincodePath error');
		} else {
			t.fail(`Failed to catch the missing chaincodePath error. Error: ${err.stack ? err.stack : err}`);
		}
	}

	try {
		await client.installChaincode({
			targets: [peer],
			chaincodeId: 'blahp1a',
			chaincodePath: 'blah',
		});
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeVersion" parameter');
	} catch (err) {
		if (err.message.includes('Missing "chaincodeVersion" parameter in the proposal request')) {
			t.pass('Successfully caught missing chaincodeVersion error');
		} else {
			t.fail(`Failed to catch the missing chaincodeVersion error. Error: ${err.stack ? err.stack : err}`);
		}
	}

	try {
		await client.installChaincode({
			targets: [peer],
			chaincodePath: 'blahp3',
			chaincodeVersion: 'blah'
		});
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter');
	} catch (e) {
		if (e.message.includes('Missing "chaincodeId" parameter in the proposal request')) {
			t.pass('Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the missing chaincodeId error. Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.installChaincode({
			chaincodePath: 'blahp4',
			chaincodeId: 'blah',
			chaincodeVersion: 'blah'
		});
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on request');
	} catch (e) {
		const msg = 'Missing peer objects in install chaincode request';
		if (e.message.includes(msg)) {
			t.pass('Successfully caught error: ' + msg);
		} else {
			t.fail(`Failed to catch : ${msg}. Error: ${e.stack ? e.stack : e}`);
		}
	}


	try {
		await client.installChaincode({
			targets: ['somename'],
			chaincodePath: 'blahp4',
			chaincodeId: 'blah',
			chaincodeVersion: 'blah'
		});
		t.fail('Should not have been able to resolve the promise because of "targets"');
	} catch (e) {
		if (e.message.includes('not found')) {
			t.pass('Successfully caught bad request param "targets"');
		} else {
			t.fail('Failed to catch the bad request param "targets". Error: ' + e.stack ? e.stack : e);
		}
	}

	try {
		await client.installChaincode({
			targets: [{}],
			chaincodePath: 'blahp4',
			chaincodeId: 'blah',
			chaincodeVersion: 'blah'
		});
		t.fail('Should not have been able to resolve the promise because of "targets" including non-peer Object');
	} catch (e) {
		if (e.message.includes('Target peer is not a valid peer object')) {
			t.pass('Successfully caught bad request param "targets" including non-peer Object');
		} else {
			t.fail('Failed to catch the bad request param "targets" including non-peer Object. Error: ' + e.stack ? e.stack : e);
		}
	}

	t.end();
});

test('\n\n ** Client createChannel(), updateChannel() tests **\n\n', async (t) => {
	const client = new Client();
	const orderer = client.newOrderer('grpc://localhost:7050');

	t.throws(
		() => {
			client.signChannelConfig();
		}, /^Error: Channel configuration update parameter is required./,
		'Client tests: Channel configuration update parameter is required.');

	for (const action of ['createChannel', 'updateChannel']) {
		try {
			await client[action]();
			t.fail('Should not have been able to resolve the promise because of missing request parameter');
		} catch (err) {
			if (err.message.includes('Missing all')) {
				t.pass('Successfully caught missing request error');
			} else {
				t.fail(`Failed to catch the missing request error. Error: ${err}`);
			}
		}

		try {
			await client[action]({envelope: {}, name: 'name', txId: '77'});
			t.fail('Should not have been able to resolve the promise because of orderer missing');
		} catch (err) {
			if (err.message.includes('Missing "orderer" request parameter')) {
				t.pass('Successfully caught missing orderer error');
			} else {
				t.fail(`Failed to catch the missing orderer error. : ${err}`);
			}
		}
		try {
			await client[action]({config: 'a', signatures: [], txId: 'a', name: 'a', orderer: {}});
			t.fail('Should not have been able to resolve the promise');
		} catch (err) {
			const msg = '"orderer" request parameter is not valid';
			if (err.message.includes(msg)) {
				t.pass('Successfully caught invalid "orderer" parameter');
			} else {
				t.fail(`Failed to catch invalid "orderer" parameter: ${err}`);
			}
		}


		try {
			await client[action]({orderer: orderer, name: 'name', txId: '777', signatures: []});
			t.fail('Should not have been able to resolve the promise because of envelope request parameter');
		} catch (err) {
			if (err.message.includes('Missing config')) {
				t.pass('Successfully caught missing config request error');
			} else {
				t.fail(`Failed to catch the missing config request error. Error: ${err}`);
			}
		}

		try {
			await client[action]({envelope: {}, orderer, config: 'a', signatures: [], txId: 'a'});
			t.fail('Should not have been able to resolve the promise because of name request parameter');
		} catch (err) {
			if (err.message.includes('Missing name request parameter')) {
				t.pass('Successfully caught missing name request error');
			} else {
				t.fail(`Failed to catch the missing name request error. Error: ${err}`);
			}
		}

		try {
			await client[action]({config: {}, orderer: orderer, name: 'name', txId: 'fff'});
			t.fail('Should not have been able to resolve the promise because of missing signatures request parameter');
		} catch (err) {
			if (err.message.includes('Missing signatures request parameter for the new channel')) {
				t.pass('Successfully caught missing signatures request error');
			} else {
				t.fail(`Failed to catch the missing signatures request error. Error: ${err}`);
			}
		}

		try {
			await client[action]({
				config: {},
				orderer: orderer,
				name: 'name',
				signatures: {},
				txId: 'fff'
			});
			t.fail('Should not have been able to resolve the promise because of missing signatures request parameter');
		} catch (err) {
			if (err.message.includes('Signatures request parameter must be an array of signatures')) {
				t.pass('Successfully caught Signatures must be an array error');
			} else {
				t.fail(`Failed to catch Signatures must be an array. Error: ${err}`);
			}
		}

		try {
			await client[action]({config: {}, orderer: orderer, name: 'name', signatures: []});
			t.fail('Should not have been able to resolve the promise because of missing txId request parameter');
		} catch (err) {
			if (err.message.includes('Missing txId request parameter')) {
				t.pass('Successfully caught request parameter must have txId error');
			} else {
				t.fail(`Failed to catch request parameter must have txId error. Error: ${err}`);
			}
		}
	}


	t.end();
});

test('\n\n ** createUser tests **\n\n', async (t) => {
	Client.addConfigFile(path.join(__dirname, '../fixtures/caimport.json'));
	caImport = utils.getConfigSetting('ca-import', 'notfound');
	logger.debug('caImport = %s', JSON.stringify(caImport));


	const client = new Client();
	const errorHandler = (e, msg) => {
		if (e.message.includes(msg)) {
			t.pass(`Should throw ${msg}`);
		} else {
			t.fail(`Expected error message: ${msg}; but got ${e.message}`);
		}
	};
	try {
		await client.createUser();
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser missing required \'opts\' parameter.';
		errorHandler(e, msg);
	}

	const org1KeyStore = {path: path.join(testutil.getTempDir(), caImport.orgs['org1'].storePath)};

	const store = await utils.newKeyValueStore(org1KeyStore);
	logger.info('store: %s', store);
	client.setStateStore(store);

	try {
		await client.createUser({username: ''});
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser parameter \'opts username\' is required.';
		errorHandler(e, msg);
	}

	try {
		await client.createUser({username: 'anyone'});
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser parameter \'opts mspid\' is required.';
		errorHandler(e, msg);
	}

	try {
		await client.createUser({username: 'anyone', mspid: 'one'});
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser parameter \'opts cryptoContent\' is required.';
		errorHandler(e, msg);
	}
	try {
		await client.createUser({cryptoContent: {privateKeyPEM: 'abcd'}, username: 'anyone', mspid: 'one'});
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser either \'opts cryptoContent signedCert or signedCertPEM\' is required.';
		errorHandler(e, msg);
	}

	try {
		await client.createUser({cryptoContent: {signedCertPEM: 'abcd'}, username: 'anyone', mspid: 'one'});
		t.fail('Should not have gotten user.');
	} catch (e) {
		const msg = 'Client.createUser one of \'opts cryptoContent privateKey, privateKeyPEM or privateKeyObj\' is required.';
		errorHandler(e, msg);
	}

	t.end();
});


test('\n\n ** createUser tests 2 **\n\n', async (t) => {
	const userOrg = 'org2';
	utils.setConfigSetting('crypto-keysize', 256);

	const client = new Client();

	try {
		await client.createUser(
			{
				username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: caImport.orgs[userOrg].cryptoContent
			});
		t.fail('createUser, did not expect successful create');
	} catch (err) {
		const msg = 'Cannot save user to state store when stateStore is null.';
		if (err.message.includes(msg)) {
			t.pass(`createUser, error expected: ${msg}`);
		} else {
			t.fail(`createUser, unexpected error: ${err.message}`);
		}
	}
	const org2KeyStore = {path: path.join(testutil.getTempDir(), caImport.orgs[userOrg].storePath)};
	t.comment('createUser success path - no cryptoKeyStore');
	const store = await utils.newKeyValueStore(org2KeyStore);

	logger.info('store: %s', store);
	client.setStateStore(store);

	try {
		const user = await client.createUser(
			{
				username: caImport.orgs[userOrg].username,
				mspid: caImport.orgs[userOrg].mspid,
				cryptoContent: caImport.orgs[userOrg].cryptoContent
			});
		if (user) {
			t.pass('createUser, got user');
		} else {
			t.fail('createUser, returned null');
		}
	} catch (e) {
		t.fail(`createUser, error, did not get user ${e.message}`);
	}
	t.end();

});


test('\n\n ** test internal method to rebuild ConfigSignatures **\n\n', (t) => {
	const some_proto_signatures = [];
	const proto_config_signature = new _configtxProto.ConfigSignature();
	proto_config_signature.setSignatureHeader(Buffer.from('signature_header_bytes'));
	proto_config_signature.setSignature(Buffer.from('signature_bytes'));
	some_proto_signatures.push(proto_config_signature);
	const string_config_signature = proto_config_signature.toBuffer().toString('hex');
	some_proto_signatures.push(string_config_signature);

	const _stringToSignature = ClientRewired.__get__('_stringToSignature');
	const all_proto_signatures = _stringToSignature(some_proto_signatures);
	for (const i in all_proto_signatures) {
		const start_header = proto_config_signature.getSignatureHeader().toBuffer().toString();
		const start_sig = proto_config_signature.getSignature().toBuffer().toString();
		const decode_header = all_proto_signatures[i].getSignatureHeader().toBuffer().toString();
		const decode_sig = all_proto_signatures[i].getSignature().toBuffer().toString();
		logger.info(' headers  are ==> %s :: %s', start_header, decode_header);
		logger.info(' signatures are ==> %s :: %s', start_sig, decode_sig);

		t.equals(start_header, decode_header, 'check signature headers are the same');
		t.equals(start_sig, decode_sig, 'check signatures are the same');
	}
	t.end();
});

test('\n\n ** Test per-call timeout support [client] **\n', (t) => {
	const sandbox = sinon.sandbox.create();
	const stub = sandbox.stub(Peer.prototype, 'sendProposal');

	// stub out the calls that requires getting MSPs from the orderer, or
	// a valid user context
	const clientUtils = ClientRewired.__get__('clientUtils');
	sandbox.stub(clientUtils, 'buildHeader').returns(Buffer.from('dummyHeader'));
	sandbox.stub(clientUtils, 'buildProposal').returns(Buffer.from('dummyProposal'));
	sandbox.stub(clientUtils, 'signProposal').returns(Buffer.from('dummyProposal'));
	ClientRewired.__set__(
		'_getChaincodeDeploymentSpec',
		() => {
			return Promise.resolve(Buffer.from('dummyChaincodePackage'));
		});

	const client = new ClientRewired();
	client._userContext = new User('somebody');
	client._userContext.getIdentity = function () {
		return {
			serialize: function () {
				return Buffer.from('');
			}
		};
	};
	client._userContext.getSigningIdentity = function () {
		return {
			serialize: function () {
				return Buffer.from('');
			}
		};
	};

	client.installChaincode({
		targets: [new Peer('grpc://localhost:7051'), new Peer('grpc://localhost:7052')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'v0'
	}, 12345).then(() => {
		t.equal(stub.calledTwice, true, 'Peer.sendProposal() is called exactly twice');
		t.equal(stub.firstCall.args.length, 2, 'Peer.sendProposal() is called first time with exactly 2 arguments');
		t.equal(stub.firstCall.args[1], 12345, 'Peer.sendProposal() is called first time with a overriding timeout of 12345 (milliseconds)');
		t.equal(stub.secondCall.args.length, 2, 'Peer.sendProposal() is called 2nd time with exactly 2 arguments');
		t.equal(stub.secondCall.args[1], 12345, 'Peer.sendProposal() is called 2nd time with a overriding timeout of 12345 (milliseconds)');
		sandbox.restore();
		t.end();
	}).catch((err) => {
		t.fail('Failed to catch the missing chaincodeVersion error. Error: ' + err.stack ? err.stack : err);
		sandbox.restore();
		t.end();
	});
});

test('\n\n*** Test error condition on network config ***\n', (t) => {
	const client = new Client();
	t.throws(
		() => {

			client.getCertificateAuthority();
		},
		/No network configuration has been loaded/,
		'Check that No network configuration has been loaded'
	);

	t.end();
});

test('\n\n*** Test normalizeX509 ***\n', (t) => {
	t.throws(
		() => {

			Client.normalizeX509('cause error');
		},
		/Failed to find start line or end line of the certificate./,
		'Check that a bad stream will throw error'
	);

	const TEST_CERT_PEM = '-----BEGIN CERTIFICATE-----MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw-----END CERTIFICATE-----';

	const normalized = Client.normalizeX509(TEST_CERT_PEM);
	let matches = normalized.match(/-----\s*BEGIN ?[^-]+?-----\n/);
	t.equals(matches.length, 1, 'Check that the normalized CERT has the standalone start line');
	matches = normalized.match(/\n-----\s*END ?[^-]+?-----\n/);
	t.equals(matches.length, 1, 'Check that the normalized CERT has the standalone end line');

	t.end();
});

test('\n\n*** Test Add TLS ClientCert ***\n', (t) => {
	const testClient = new Client();
	t.doesNotThrow(
		() => {
			testClient.addTlsClientCertAndKey({});
		},
		'Check that error is not thrown when crypto suite is not set'
	);
	testClient.setCryptoSuite(Client.newCryptoSuite());
	t.doesNotThrow(
		() => {
			testClient.addTlsClientCertAndKey({});
		},
		'Check that error is not thrown when user context is not set'
	);
	testClient.setUserContext(new User('testUser'), true);
	try {
		t.notOk(testClient._tls_mutual.clientKey, 'Check that client key is not there');
		t.notOk(testClient._tls_mutual.clientCert, 'Check that client certain is not there');
		t.notOk(testClient._tls_mutual.clientCertHash, 'Check that cert hash was not cached');

		t.ok(testClient.getClientCertHash(true), 'Check forcing the hash to be based off the user');
		t.ok(testClient._tls_mutual.clientCertHash, 'Check that cert hash was cached');

		const tls_cert_key = {};
		testClient.addTlsClientCertAndKey(tls_cert_key);
		t.ok(tls_cert_key.clientCert, 'Check that clientCert exists');
		t.ok(tls_cert_key.clientKey, 'Check that clientKey exists');
		t.ok(testClient._tls_mutual.clientKey, 'Check that client key is there');
		t.ok(testClient._tls_mutual.clientCert, 'Check that client cert is there');
	} catch (err) {
		t.fail('addTlsClientCertandKey failed: ' + err);
	}

	t.end();
});

test('\n\n*** Test Set and Add TLS ClientCert ***\n', (t) => {
	const client = new Client();
	t.notOk(client.getClientCertHash(), 'Check getting null hash when no client cert assigned');
	client.setTlsClientCertAndKey(aPem, aPem);
	t.pass('Able to set the client cert and client key');
	const tls_cert_key = {};
	client.addTlsClientCertAndKey(tls_cert_key);
	t.equals(tls_cert_key.clientCert, aPem, 'Checking being able to update an options object with the client cert');
	t.equals(tls_cert_key.clientKey, aPem, 'Checking being able to update an options object with the client key');

	t.equals(client.getClientCertHash().toString('hex'), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'checking the client certificate hash');

	t.end();
});

test('\n\n*** Test channel selection if no channel name provided ***\n', (t) => {
	const config = {
		'name': 'test',
		'version': '1.0.0',
		'channels': {
			'testchannel': {
				'orderers': [
					'orderer.example.com'
				],
				'peers': {
					'peer0.org1.example.com': {}
				}
			},
			'anotherchannel': {
				'orderers': [
					'orderer.example.com'
				],
				'peers': {
					'peer0.org1.example.com': {}
				}
			}
		},
		'organizations': {
			'Org1': {
				'mspid': 'Org1MSP',
				'peers': [
					'peer0.org1.example.com'
				]
			}
		},
		'orderers': {
			'orderer.example.com': {
				'url': 'grpc://localhost:7050'
			}
		},
		'peers': {
			'peer0.org1.example.com': {
				'url': 'grpc://localhost:7051',
			}
		}
	};

	let client = Client.loadFromConfig(config);
	t.doesNotThrow(() => {
		// TODO: really ? have to set this even if it's not used
		client.setTlsClientCertAndKey(aPem, aPem);
		const channel = client.getChannel();
		t.equals(channel.getName(), 'testchannel', 'correct channel is returned from network config');
	});

	client = new Client();
	client._channels.set('aChannel', 'SomeChannelObject');
	t.doesNotThrow(() => {
		client.setTlsClientCertAndKey(aPem, aPem);
		const channel = client.getChannel();
		t.equals(channel, 'SomeChannelObject', 'correct channel is returned from channel map');
	});

	t.end();
});

test('\n\n*** Test Client.getPeersForOrgOnChannel ***\n', (t) => {
	const config = {
		'name': 'test',
		'version': '1.0.0',
		'client': {
			'organization': 'Org1'
		},
		'channels': {
			'testchannel': {
				'orderers': [
					'orderer.example.com'
				],
				'peers': {
					'peer0.org1.example.com': {}
				}
			},
			'anotherchannel': {
				'orderers': [
					'orderer.example.com'
				],
				'peers': {
					'peer0.org1.example.com': {},
					'peer0.org2.example.com': {}
				}
			}
		},
		'organizations': {
			'Org1': {
				'mspid': 'Org1MSP',
				'peers': [
					'peer0.org1.example.com'
				]
			},
			'Org2': {
				'mspid': 'Org2MSP',
				'peers': [
					'peer0.org2.example.com'
				]
			}
		},
		'orderers': {
			'orderer.example.com': {
				'url': 'grpc://localhost:7050'
			}
		},
		'peers': {
			'peer0.org1.example.com': {
				'url': 'grpc://localhost:7051',
			},
			'peer0.org2.example.com': {
				'url': 'grpc://localhost:8051',
			}
		}
	};

	let client = Client.loadFromConfig(config);
	client.setTlsClientCertAndKey(aPem, aPem);
	client._mspid = 'Org1MSP';
	let peer_results = client.getPeersForOrgOnChannel();
	t.equals(peer_results.length, 1, 'correct number of peers returned when no channel specified');
	t.equals(peer_results[0].getName(), 'peer0.org1.example.com', 'correct peer for Org1 returned');

	peer_results = client.getPeersForOrgOnChannel('testchannel');
	t.equals(peer_results.length, 1, 'correct number of peers returned when testchannel specified');
	t.equals(peer_results[0].getName(), 'peer0.org1.example.com', 'correct peer for Org1 returned');

	peer_results = client.getPeersForOrgOnChannel('anotherchannel');
	t.equals(peer_results.length, 1, 'correct number of peers returned when anotherchannel specified');
	t.equals(peer_results[0].getName(), 'peer0.org1.example.com', 'correct peer for Org1 returned');

	config.client.organization = 'Org2';
	client = Client.loadFromConfig(config);
	client._mspid = 'Org2MSP';
	client.setTlsClientCertAndKey(aPem, aPem);
	peer_results = client.getPeersForOrgOnChannel();
	t.equals(peer_results.length, 0, 'correct number of peers returned when no channel specified');

	peer_results = client.getPeersForOrgOnChannel('testchannel');
	t.equals(peer_results.length, 0, 'correct number of peers returned when testchannel specified');

	peer_results = client.getPeersForOrgOnChannel('anotherchannel');
	t.equals(peer_results.length, 1, 'correct number of peers returned when anotherchannel specified');
	t.equals(peer_results[0].getName(), 'peer0.org2.example.com', 'correct peer for Org2 returned');

	t.end();
});


test('\n\n Test _getChaincodeDeploymentSpec ***\n', function (t) {
	let ccPath = testutil.NODE_CHAINCODE_PATH;
	let ccInstallRequest = {
		chaincodeType: 'node',
		chaincodePath: ccPath,
		chaincodeId: 'example_cc',
		chaincodeVersion: '1.0.0'
	};
	let _getChaincodeDeploymentSpec = rewire('fabric-client/lib/Client.js').__get__('_getChaincodeDeploymentSpec');

	// install from source
	_getChaincodeDeploymentSpec(ccInstallRequest, false)
		.then((cdsBytes) => {
			t.pass('Successfully got chaincode deployment spec from source');
			// capture the cdsBytes for next test
			return Buffer.from(cdsBytes);
		})
		.then((packageBytes) => {
			// install using existing package
			ccInstallRequest.chaincodePackage = packageBytes;
			_getChaincodeDeploymentSpec(ccInstallRequest, false)
				.then((cdsBytes) => {
					// should get back what was passed in
					if (packageBytes.equals(cdsBytes)) {
						t.pass('Successfully got chaincode deployment spec from existing package');
					} else {
						t.fail('Failed to get correct deployment spec from existing package  ' + cdsBytes.length + ' | ' + packageBytes.length);
					}
				})
				.catch((err) => {
					t.fail('Failed to get deployment spec from existing package. Error: ' + err.stack ? err.stack : err);
				});
		})
		.catch((err) => {
			t.fail('Failed to get deployment spec. Error: ' + err.stack ? err.stack : err);
		});
	t.end();
});
