/**
 * Copyright 2016 IBM All Rights Reserved.
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
var util = require('util');
var hfc = require('../..');
var fs = require('fs');
var execSync = require('child_process').execSync;
var utils = require('../../lib/utils.js');
var cryptoSuiteReq = require('../../lib/impl/CryptoSuite_ECDSA_SHA.js');
var bunyan = require('bunyan');
var log4js = require('log4js');
var intercept = require('intercept-stdout');

// FileKeyValueStore tests /////////////
var FileKeyValueStore = require('../../lib/impl/FileKeyValueStore.js');

var keyValStorePath = path.join(getUserHome(), 'kvsTemp');
//Note: unix relative path does not start with '/'
//windows relative path starts with '/'
var keyValStorePath1 = 'tmp/keyValStore1';
var keyValStorePath2 = '/tmp/keyValStore2';
var keyValStorePath3 = '/tmp/keyValStore3';
var keyValStorePath4 = '/tmp/keyValStore4';
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';
var store1 = '';
var store2 = '';
// End: FileKeyValueStore tests ////////

// Chain tests /////////////
var Chain = require('../../lib/Chain.js');
var _chain = null;
var chainName = 'testChain';
var chainKeyValStorePath = 'tmp/chainKeyValStorePath';
var store3 = '';
// End: Chain tests ////////

// Member tests //////////
var Member = require('../../lib/Member.js');
var memberName = 'Donald T. Duck';
var enrollmentID = 123454321;
var roles = ['admin', 'user'];
var affiliation = 'Hyperledger Community';
var memberCfg = {'enrollmentID': enrollmentID ,
	'roles': roles,
	'affiliation': affiliation};

// GRPC Options tests ///////////////
var Remote = require('../../lib/Remote.js');
var Peer = require('../../lib/Peer.js');
var Orderer = require('../../lib/Orderer.js');
var Config = require('../../lib/Config.js');
var MemberServices = require('../../lib/impl/MemberServices.js');
var aPem = '-----BEGIN CERTIFICATE-----'+
'MIIBwTCCAUegAwIBAgIBATAKBggqhkjOPQQDAzApMQswCQYDVQQGEwJVUzEMMAoG'+
'A1UEChMDSUJNMQwwCgYDVQQDEwNPQkMwHhcNMTYwMTIxMjI0OTUxWhcNMTYwNDIw'+
'MjI0OTUxWjApMQswCQYDVQQGEwJVUzEMMAoGA1UEChMDSUJNMQwwCgYDVQQDEwNP'+
'QkMwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAR6YAoPOwMzIVi+P83V79I6BeIyJeaM'+
'meqWbmwQsTRlKD6g0L0YvczQO2vp+DbxRN11okGq3O/ctcPzvPXvm7Mcbb3whgXW'+
'RjbsX6wn25tF2/hU6fQsyQLPiJuNj/yxknSjQzBBMA4GA1UdDwEB/wQEAwIChDAP'+
'BgNVHRMBAf8EBTADAQH/MA0GA1UdDgQGBAQBAgMEMA8GA1UdIwQIMAaABAECAwQw'+
'CgYIKoZIzj0EAwMDaAAwZQIxAITGmq+x5N7Q1jrLt3QFRtTKsuNIosnlV4LR54l3'+
'yyDo17Ts0YLyC0pZQFd+GURSOQIwP/XAwoMcbJJtOVeW/UL2EOqmKA2ygmWX5kte'+
'9Lngf550S6gPEWuDQOcY95B+x3eH'+
'-----END CERTIFICATE-----';
var aHostname = 'atesthostname';
var aHostnameOverride = 'atesthostnameoverride';

test('\n\n ** Index **', function(t) {
	var chain = hfc.getChain('someChain', true);
	t.equals(chain.getName(),'someChain','Checking chain names match');
	t.throws(
		function() {
			hfc.newChain('someChain');
		},
		/^Error: Chain someChain already exist/,
		'Index tests: checking that chain already exists.'
	);
	var peer = hfc.getPeer('grpc://somehost.com:9000');
	t.throws(
		function() {
			hfc.getPeer('http://somehost.com:9000');
		},
		/^InvalidProtocol: Invalid protocol: http.  URLs must begin with grpc:\/\/ or grpcs:\/\//,
		'Index tests: checking that getPeer will fail with bad address.'
	);
	t.end();
});

/*
 * This test assumes that there is a ./config directory from the running location
 * and that there is file called 'config.json'.
 */
test('\n\n ** Config **', function(t) {
	// setup the environment
	process.argv.push('--test-4=argv');
	process.argv.push('--test-5=argv');
	process.env.TEST_3='env';
	process.env.test_6='mapped';
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	t.equals(hfc.getConfigSetting('request-timeout', 'notfound'), 3000, 'checking that able to get "request-timeout" value from an additional configuration file');
	//try adding another config file
	hfc.addConfigFile('test/fixtures/local.json');
	t.equals(hfc.getConfigSetting('test-2', 'notfound'), 'local', 'checking that able to test-2 value from an additional configuration file');
	t.equals(hfc.getConfigSetting('test-3', 'notfound'), 'env', 'checking that test-3 environment values are used');
	t.equals(hfc.getConfigSetting('test-4', 'notfound'), 'argv', 'checking that test-4 argument values are used');
	hfc.setConfigSetting('test-5','program');
	t.equals(hfc.getConfigSetting('test-5', 'notfound'), 'program', 'checking that test-5 program values are used');
	t.equals(hfc.getConfigSetting('test-6', 'notfound'), 'mapped', 'checking that test-6 is enviroment mapped value');
	t.end();
});

//
// Run the FileKeyValueStore tests
//

test('\n\n ** FileKeyValueStore - read and write test', function(t){
	// clean up
	if (utils.existsSync(keyValStorePath)) {
		execSync('rm -rf ' + keyValStorePath);
	}

	var store = utils.newKeyValueStore({
		path: keyValStorePath
	});

	if (utils.existsSync(keyValStorePath)) {
		t.pass('FileKeyValueStore read and write test: Successfully created new directory for testValueStore');

		store.setValue(testKey, testValue)
		.then(
			function(result){
				t.pass('FileKeyValueStore read and write test: Successfully set value');

				if (utils.existsSync(path.join(keyValStorePath, testKey))) {
					t.pass('FileKeyValueStore read and write test: Verified the file for key ' + testKey + ' does exist');

					return store.getValue(testKey);
				} else {
					t.fail('FileKeyValueStore read and write test: Failed to create file for key ' + testKey);
					t.end();
				}
			},
			function(reason){
				t.fail('FileKeyValueStore read and write test: Failed to set value, reason: '+reason);
				t.end();
			})
		.then(
			// Log the fulfillment value
			function(val){
				if (val != testValue)
					t.fail('FileKeyValueStore read and write test: '+ val + ' does not equal testValue of ' + testValue);
				else
					t.pass('FileKeyValueStore read and write test: Successfully retrieved value');

				t.end();
			},
			// Log the rejection reason
			function(reason){
				t.fail('FileKeyValueStore read and write test: Failed getValue, reason: '+reason);
				t.end();
			});
	} else{
		t.fail('FileKeyValueStore read and write test: Failed to create new directory: ' + keyValStorePath);
		t.end();
	}
});

test('\n\n ** FileKeyValueStore - constructor test', function(t){
	cleanupFileKeyValueStore(keyValStorePath1);
	cleanupFileKeyValueStore(keyValStorePath2);

	store1 = new FileKeyValueStore({path: getRelativePath(keyValStorePath1)});
	var exists = utils.existsSync(getAbsolutePath(keyValStorePath1));
	if (exists)
		t.pass('FileKeyValueStore constructor test:  Successfully created new directory');
	else
		t.fail('FileKeyValueStore constructor test:  Failed to create new directory: ' + keyValStorePath1);

	store2 = new FileKeyValueStore({path: getRelativePath(keyValStorePath2)});
	exists = utils.existsSync(getAbsolutePath(keyValStorePath2));
	if (exists)
		t.pass('FileKeyValueStore constructor test:  Successfully created new directory');
	else
		t.fail('FileKeyValueStore constructor test:  Failed to create new directory: ' + keyValStorePath2);


	t.end();
});

test('\n\n ** FileKeyValueStore - setValue test', function(t) {
	store1.setValue(testKey, testValue)
	.then(
		function(result) {
			t.pass('FileKeyValueStore store1 setValue test:  Successfully set value');

			var exists = utils.existsSync(getAbsolutePath(keyValStorePath1), testKey);
			if (exists) {
				t.pass('FileKeyValueStore store1 setValue test:  Verified the file for key ' + testKey + ' does exist');
				return store1.getValue(testKey);
			} else {
				t.fail('FileKeyValueStore store1 setValue test:  Failed to create file for key ' + testKey);
				t.end();
			}
		},
		function(reason) {
			t.fail('FileKeyValueStore store1 setValue test:  Failed to set value: '+reason);
			t.end();
		})
	.then(
		// Log the fulfillment value
		function(val) {
			if (val != testValue) {
				t.fail('FileKeyValueStore store1 getValue test:  '+ val + ' does not equal testValue of ' + testValue);
			} else {
				t.pass('FileKeyValueStore store1 getValue test:  Successfully retrieved value');
			}

			return store2.setValue(testKey, testValue);
		},
		function(reason) {
			t.fail(reason);
			t.end();
		})
	.then(
		function(result) {
			t.pass('FileKeyValueStore store2 setValue test:  Successfully set value');

			var exists = utils.existsSync(getAbsolutePath(keyValStorePath2), testKey);
			if (exists) {
				t.pass('FileKeyValueStore store2 setValue test:  Verified the file for key ' + testKey + ' does exist');

				return store2.getValue(testKey);
			} else {
				t.fail('FileKeyValueStore store2 setValue test:  Failed to create file for key ' + testKey);
				t.end();
			}
		},
		function(reason) {
			t.fail('FileKeyValueStore store2 setValue test:  Failed to set value: '+reason);
			t.end();
		})
	.then(
		// Log the fulfillment value
		function(val) {
			if (val != testValue)
				t.fail('FileKeyValueStore store2 getValue test:  '+ val + ' does not equal testValue of ' + testValue);
			else
				t.pass('FileKeyValueStore store2 getValue test:  Successfully retrieved value');

			t.end();
		})
	.catch(
		// Log the rejection reason
		function(reason) {
			t.fail(reason);
			t.end();
		});
});

test('FileKeyValueStore error check tests', function(t){

	t.throws(
		function() {
			store3 = new FileKeyValueStore();
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options should throw '+
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.throws(
		function() {
			store3 = new FileKeyValueStore({dir: getRelativePath(keyValStorePath3)});
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options.path should throw '+
		'"Must provide the path to the directory to hold files for the store."'
	);

	cleanupFileKeyValueStore(keyValStorePath3);
	var store3 = new FileKeyValueStore({path: getRelativePath(keyValStorePath3)});
	store3.setValue(testKey, testValue)
	.then(
		function(result) {
			t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Successfully set value');

			var exists = utils.existsSync(getAbsolutePath(keyValStorePath3), testKey);
			if (exists) {
				t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Verified the file for key ' + testKey + ' does exist');
				cleanupFileKeyValueStore(keyValStorePath3);
				exists = utils.existsSync(getAbsolutePath(keyValStorePath3), testKey);
				t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Deleted store, exists: '+exists);
				return store3.getValue(testKey);
			} else {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. Failed to create file for key ' + testKey);
			}
		})
	.then(
		// Log the fulfillment value
		function(val) {
			if (val === null) {
				t.pass('FileKeyValueStore error check tests:  Delete store & getValue test. getValue is null');
			} else {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue successfully retrieved value: '+val);
			}
		},
		function(reason) {
			t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue caught unexpected error: '+reason);
		})
	.then(
		function() {
			cleanupFileKeyValueStore(keyValStorePath4);
			var store4 = new FileKeyValueStore({path: getRelativePath(keyValStorePath4)});
			cleanupFileKeyValueStore(keyValStorePath4);
			var exists = utils.existsSync(getAbsolutePath(keyValStorePath4));
			t.comment('FileKeyValueStore error check tests:  Delete store & setValue test. Deleted store, exists: '+exists);
			return store4.setValue(testKey, testValue);
		})
	.then(
		function(result) {
			t.fail('FileKeyValueStore error check tests:  Delete store & setValue test.  Successfully set value but should have failed.');
			t.end();
		},
		function(reason) {
			t.pass('FileKeyValueStore error check tests:  Delete store & setValue test.  Failed to set value as expected: '+reason);
			t.end();
		})
	.catch(
		function(err) {
			t.fail('Failed with unexpected error: ' + err.stack ? err.stack : err);
			t.end();
		});
});


// Chain tests /////////////
test('\n\n ** Chain - constructor test', function(t) {
	_chain = new Chain(chainName);
	if (_chain.getName() === chainName)
		t.pass('Chain constructor test: getName successful');
	else t.fail('Chain constructor test: getName not successful');

	// trying to get member on a chain without keyvalue store, should fail
	_chain.getMember('randomName')
	.then(function(member) {
		t.fail('Should not have Successfully resolved a member without having keyvalue store configured first');
	}, function(err) {
		if (err.message && err.message.indexOf('No key value store was found') === 0) {
			t.pass('Successfully rejected a "getMember()" call on a chain without keyvalue store');
		} else {
			t.fail('Error: ' + err.stack ? err.stack : err);
		}
	})
	.then(function() {
		_chain.setKeyValueStore({}); // set a dummy keyvalue store to get past the check

		return _chain.getMember('randomName');
	})
	.then(function(member) {
		t.fail('Should not have Successfully resolved a member without having member services configured first');
		t.end();
	}, function(err) {
		if (err.message && err.message.indexOf('No member services was found') === 0) {
			t.pass('Successfully rejected a "getMember()" call on a chain without member services');
		} else {
			t.fail('Error: ' + err.stack ? err.stack : err);
		}
		t.end();
	});
});

test('\n\n ** Chain - setKeyValueStore getKeyValueStore test', function(t) {
	cleanupFileKeyValueStore(chainKeyValStorePath);

	_chain.setKeyValueStore(hfc.newKeyValueStore({path: getRelativePath(chainKeyValStorePath)}));

	var exists = utils.existsSync(getAbsolutePath(chainKeyValStorePath));
	if (exists)
		t.pass('Chain setKeyValueStore test:  Successfully created new directory');
	else
		t.fail('Chain setKeyValueStore test:  Failed to create new directory: ' + chainKeyValStorePath);

	store3 = _chain.getKeyValueStore();
	store3.setValue(testKey, testValue)
	.then(
		function(result){
			t.pass('Chain getKeyValueStore test:  Successfully set value, result: '+result);

			var exists = utils.existsSync(getAbsolutePath(chainKeyValStorePath), testKey);
			if (exists)
				t.pass('Chain getKeyValueStore test:  Verified the file for key ' + testKey + ' does exist');
			else
				t.fail('Chain getKeyValueStore test:  Failed to create file for key ' + testKey);

			t.end();
		})
	.catch(
		function(reason) {
			t.fail('Chain getKeyValueStore test:  Failed to set value, reason: '+reason);
			t.end();
		});
});

test('\n\n ** Chain register methods parameters tests', function(t) {
	let chain = new Chain('testChain1');

	chain.register({})
	.then(function() {
		t.fail('Should not have worked becaused the input param was missing user enrollmentID');
	}, function(err) {
		if (err.message && err.message.indexOf('Invalid parameter to "register()" function') === 0) {
			t.pass('Successfully rejected call to "register()" method with invalid parameter missing enrollmentID');
		} else {
			t.fail('Something unexpected happened. Error: ' + err.stack ? err.stack : err);
		}
	})
	.then(function() {
		return chain.registerAndEnroll({});
	})
	.then(function() {
		t.fail('Should not have worked becaused the input param was missing user enrollmentID');
		t.end();
	}, function(err) {
		if (err.message && err.message.indexOf('Invalid parameter to "registerAndEnroll()" function') === 0) {
			t.pass('Successfully rejected call to "registerAndEnroll()" method with invalid parameter missing enrollmentID');
		} else {
			t.fail('Something unexpected happened. Error: ' + err.stack ? err.stack : err);
		}
		t.end();
	});
});

test('\n\n ** Chain - method tests', function(t) {
	t.doesNotThrow(
		function() {
			_chain.setRegistrar('something');
		},
		null,
		'checking the setRegistrar'
	);
	t.equal(_chain.getRegistrar(),'something','checking the getRegistrar');
	t.doesNotThrow(
		function() {
			_chain.setMemberServicesUrl('grpc://somehost.com:9999');
		},
		null,
		'checking the setMemberServicesUrl'
	);
	t.equal(_chain.getMemberServices().toString(),' MemberServices : {url:grpc://somehost.com:9999}','checking the getMemberServices');
	t.equal(_chain.isSecurityEnabled(), true, 'checking security setting');
	t.doesNotThrow(
		function() {
			_chain.setPreFetchMode(true);
		},
		null,
		'checking the set of prefetchMode'
	);
	t.equal(_chain.isPreFetchMode(), true, 'checking prefetchMode');
	t.doesNotThrow(
			function() {
				_chain.setDevMode(true);
			},
			null,
			'checking the set of DevMode'
		);
	t.equal(_chain.isDevMode(), true, 'checking DevMode');
	t.doesNotThrow(
			function() {
				_chain.setKeyValueStore('something');
			},
			null,
			'checking the set of KeyValueStore'
		);
	t.equal(_chain.getKeyValueStore(), 'something', 'checking getKeyValueStore');
	t.doesNotThrow(
			function() {
				_chain.setTCertBatchSize(123);
			},
			null,
			'checking the set of TCertBatchSize'
		);
	t.equal(_chain.getTCertBatchSize(), 123, 'checking getTCertBatchSize');
	t.doesNotThrow(
			function() {
				_chain.setOrderer('grpc://somehost.com:1234');
			},
			null,
			'checking the set of Orderer'
		);
	t.equal(_chain.getOrderer().toString(), ' Orderer : {url:grpc://somehost.com:1234}', 'checking getOrderer');
	t.equal(_chain.toString(),'{"name":"testChain","orderer":"grpc://somehost.com:1234"}','checking chain toString');
	t.end();
});

// Member tests /////////
test('\n\n ** Member - constructor set get tests', function(t) {
	var member1 = new Member(memberName, _chain);
	if (member1.getName() === memberName)
		t.pass('Member constructor set get tests 1: new Member getName was successful');
	else
		t.fail('Member constructor set get tests 1: new Member getName was not successful');

	member1.setRoles(roles);
	if (member1.getRoles() &&
		member1.getRoles().indexOf('admin') > -1 &&
		member1.getRoles().indexOf('user') > -1)
		t.pass('Member constructor set get tests 1: setRoles getRoles was successful');

	if (member1.getChain().getName() === chainName)
		t.pass('Member constructor get set tests 1: getChain getName was successful');
	else
		t.fail('Member constructor get set tests 1: getChain getName was not successful');

	member1.setAffiliation(affiliation);
	if (member1.getAffiliation() === affiliation)
		t.pass('Member constructor get set tests 1: setAffiliation getAffiliation was successful');
	else
		t.pass('Member constructor get set tests 1: setAffiliation getAffiliation was not successful');

	var member2 = new Member(memberCfg, _chain);
	if (member2.getName() === enrollmentID)
		t.pass('Member constructor test 2: new Member cfg getName was successful');
	else
		t.fail('Member constructor test 2: new Member cfg getName was not successful');

	if (member2.getRoles() &&
		member2.getRoles().indexOf('admin') > -1 &&
		member2.getRoles().indexOf('user') > -1)
		t.pass('Member constructor test 2: new Member cfg getRoles was successful');
	else
		t.fail('Member constructor test 2: new Member cfg getRoles was not successful');

	if (member1.getAffiliation() === affiliation)
		t.pass('Member constructor get set tests 1: new Member cfg getAffiliation was successful');
	else
		t.pass('Member constructor get set tests 1: new Member cfg getAffiliation was not successful');

	if (member2.getChain().getName() === chainName)
		t.pass('Member constructor get set tests 2: getChain new Member cfg getName was successful');
	else
		t.fail('Member constructor get set tests 2: getChain new Member cfg getName was not successful');

	t.end();
});

test('\n\n ** Member sendDeploymentProposal() tests', function(t) {
	var m = new Member('does not matter', _chain);

	var p1 = m.sendDeploymentProposal({
		chaincodePath: 'blah',
		fcn: 'init'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "peer" parameter');
	}).catch(function(err) {
		if (err.message === 'Missing "target" for the endorsing peer object in the Deployment proposal request') {
			t.pass('Successfully caught missing peer error');
		} else {
			t.fail('Failed to catch the missing peer error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p2 = m.sendDeploymentProposal({
		endorserUrl: 'blah',
		fcn: 'init'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}).catch(function(err) {
		if (err.message === 'missing chaincodePath in Deployment proposal request') {
			t.pass('Successfully caught missing chaincodePath error');
		} else {
			t.fail('Failed to catch the missing chaincodePath error. Error: ' + err.stack ? err.stask : err);
		}
	});

	Promise.all([p1, p2])
	.then(
		function(data) {
			t.end();
		}
	).catch(
		function(err) {
			t.fail(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Member sendTransactionProposal() tests', function(t) {
	var m = new Member('does not matter', _chain);

	var p1 = m.sendTransactionProposal({
		chaincodeId: 'someid'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "target" parameter');
	}, function(err) {
		if (err.message === 'Missing "target" for endorser peer object in the Transaction proposal request') {
			t.pass('Successfully caught missing target error');
		} else {
			t.fail('Failed to catch the missing target error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing "target" for endorser peer object in the Transaction proposal request') {
			t.pass('Successfully caught missing target error');
		} else {
			t.fail('Failed to catch the missing target error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p2 = m.sendTransactionProposal({
		target: hfc.getPeer('grpc://somehost.com:9000')
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}, function(err) {
		if (err.message === 'Missing chaincode ID in the Transaction proposal request') {
			t.pass('Successfully caught missing chaincodeid error');
		} else {
			t.fail('Failed to catch the missing chaincodeid error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing chaincode ID in the Transaction proposal request') {
			t.pass('Successfully caught missing chaincodeid error');
		} else {
			t.fail('Failed to catch the missing chaincodeid error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p3 = m.sendTransactionProposal({
		target: hfc.getPeer('grpc://somehost.com:9000'),
		chaincodeId: 'someid'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}, function(err) {
		if (err.message === 'Missing arguments in Transaction proposal request') {
			t.pass('Successfully caught missing args error');
		} else {
			t.fail('Failed to catch the missing args error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing arguments in Transaction proposal request') {
			t.pass('Successfully caught missing args error');
		} else {
			t.fail('Failed to catch the missing args error. Error: ' + err.stack ? err.stask : err);
		}
	});

	Promise.all([p1, p2, p3])
	.then(
		function(data) {
			t.end();
		}
	).catch(
		function(err) {
			t.fail(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Member queryByChaincode() tests', function(t) {
	var m = new Member('does not matter', _chain);

	var p1 = m.queryByChaincode({
		chaincodeId: 'someid'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "target" parameter');
	}, function(err) {
		if (err.message === 'Missing "target" for endorser peer object in the Transaction proposal request') {
			t.pass('Successfully caught missing target error');
		} else {
			t.fail('Failed to catch the missing target error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing "target" for endorser peer object in the Transaction proposal request') {
			t.pass('Successfully caught missing target error');
		} else {
			t.fail('Failed to catch the missing target error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p2 = m.queryByChaincode({
		target: hfc.getPeer('grpc://somehost.com:9000')
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}, function(err) {
		if (err.message === 'Missing chaincode ID in the Transaction proposal request') {
			t.pass('Successfully caught missing chaincodeid error');
		} else {
			t.fail('Failed to catch the missing chaincodeid error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing chaincode ID in the Transaction proposal request') {
			t.pass('Successfully caught missing chaincodeid error');
		} else {
			t.fail('Failed to catch the missing chaincodeid error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p3 = m.queryByChaincode({
		target: hfc.getPeer('grpc://somehost.com:9000'),
		chaincodeId: 'someid'
	}).then(function() {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}, function(err) {
		if (err.message === 'Missing arguments in Transaction proposal request') {
			t.pass('Successfully caught missing args error');
		} else {
			t.fail('Failed to catch the missing args error. Error: ' + err.stack ? err.stask : err);
		}
	}).catch(function(err) {
		if (err.message === 'Missing arguments in Transaction proposal request') {
			t.pass('Successfully caught missing args error');
		} else {
			t.fail('Failed to catch the missing args error. Error: ' + err.stack ? err.stask : err);
		}
	});

	Promise.all([p1, p2, p3])
	.then(
		function(data) {
			t.end();
		}
	).catch(
		function(err) {
			t.fail(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Member sendTransaction() tests', function(t) {
	var m = new Member('does not matter', _chain);
	_chain._orderer = undefined;
	var p1 = m.sendTransaction()
	 .then(function() {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	 },function(err) {
		if (err.message === 'Missing proposalResponse object parameter') {
			t.pass('Successfully caught missing proposalResponse error');
		} else {
			t.fail('Failed to catch the missing object error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p2 = m.sendTransaction('data')
	 .then(function() {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	 },function(err) {
		if (err.message === 'Missing chaincodeProposal object parameter') {
			t.pass('Successfully caught missing chaincodeProposal error');
		} else {
			t.fail('Failed to catch the missing objet error. Error: ' + err.stack ? err.stask : err);
		}
	});

	var p3 = m.sendTransaction('data','data')
	 .then(function() {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	 },function(err) {
		if (err.message === 'no Orderer defined') {
			t.pass('Successfully caught missing orderer error');
		} else {
			t.fail('Failed to catch the missing order error. Error: ' + err.stack ? err.stask : err);
		}
	});

	Promise.all([p1, p2, p3])
	.then(
		function(data) {
			t.end();
		}
	).catch(
		function(err) {
			t.fail(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** CryptoSuite_ECDSA_SHA - constructor tests', function(t) {
	var cryptoUtils = utils.getCryptoSuite();

	t.equal(256, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA constructor tests: crytoUtils default getSecurityLevel() == 256');

	var keyPair = cryptoUtils.generateKeyPair();
	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoUtils keyPair.pubKeyObj.curveName == secp256r1');

	t.equal(256, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoReq default getSecurityLevel() == 256');

	keyPair = cryptoUtils.generateKeyPair();
	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoReq keyPair.pubKeyObj.curveName == secp256r1');

	t.end();
});

test('\n\n ** CryptoSuite_ECDSA_SHA - function tests', function(t) {
	var cryptoUtils = utils.getCryptoSuite();

	t.equal('ECDSA', cryptoUtils.getPublicKeyAlgorithm(),
		'CryptoSuite_ECDSA_SHA function tests: default getPublicKeyAlgorithm == "ECDSA"');

	// Test SHA3-256 //
	cryptoUtils.setHashAlgorithm('SHA3');
	if (t.equal('SHA3', cryptoUtils.getHashAlgorithm(),
		'CryptoSuite_ECDSA_SHA function tests: set/getHashAlgorithm("SHA3")'));
	cryptoUtils.setSecurityLevel(256);
	t.equal(256, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA function tests: set/getSecurityLevel == 256');
	var keyPair = cryptoUtils.generateKeyPair();
	if (!!keyPair.pubKeyObj && !!keyPair.prvKeyObj)
		t.pass('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');
	else
		t.fail('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');

	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair public curveName == secp256r1');
	t.equal('secp256r1', keyPair.prvKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair private curveName == secp256r1');

	// Test SHA3-384 //
	cryptoUtils.setHashAlgorithm('SHA3');
	cryptoUtils.setSecurityLevel(384);
	t.equal(384, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA function tests: set/getSecurityLevel == 384');
	keyPair = cryptoUtils.generateKeyPair();
	if (!!keyPair.pubKeyObj && !!keyPair.prvKeyObj)
		t.pass('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');
	else
		t.fail('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');

	t.equal('secp384r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair public curveName == secp384r1');
	t.equal('secp384r1', keyPair.prvKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair private curveName == secp384r1');

	// Test SHA2-256 //
	cryptoUtils.setSecurityLevel(256);
	cryptoUtils.setHashAlgorithm('SHA2');
	t.equal(256, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA function tests: set/getSecurityLevel == 256');
	keyPair = cryptoUtils.generateKeyPair();
	if (!!keyPair.pubKeyObj && !!keyPair.prvKeyObj)
		t.pass('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');
	else
		t.fail('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');

	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair public curveName == secp256r1');
	t.equal('secp256r1', keyPair.prvKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair private curveName == secp256r1');

	cryptoUtils.setHashAlgorithm('sha2');//lower or upper case is allowed
	if (t.equal('sha2', cryptoUtils.getHashAlgorithm(),
		'CryptoSuite_ECDSA_SHA function tests: set/getHashAlgorithm("sha2")'));
	keyPair = cryptoUtils.generateKeyPair();
	if (!!keyPair.pubKeyObj && !!keyPair.prvKeyObj)
		t.pass('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');
	else
		t.fail('CryptoSuite_ECDSA_SHA function tests: verify generateKeyPair pub/prvKeyObj');

	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair public curveName == secp256r1');
	t.equal('secp256r1', keyPair.prvKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA function tests: cryptoReq generateKeyPair private curveName == secp256r1');

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm('SHA2');
			cryptoUtils.setSecurityLevel(384);
		},
		/^Error: Unsupported/,
		'CryptoSuite_ECDSA_SHA function tests: SHA2 and 384 should throw '+
		'Error: Unsupported hash algorithm and security level pair sha2-384'
	);

	t.throws(
		function() {
			cryptoUtils.setSecurityLevel(123);
		},
		/^Error: Illegal level/,
		'CryptoSuite_ECDSA_SHA function tests: setSecurityLevel(123) should throw Illegal level error'
	);

	//SHA2 or SHA3

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm(23456);//not a string is illegal
		},
		/^Error: Illegal Hash function family/,
		'CryptoSuite_ECDSA_SHA function tests: setHashAlgorithm(23456) should throw Illegal Hash function family'
	);

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm('SHA5');
		},
		/^Error: Illegal Hash function family/,
		'CryptoSuite_ECDSA_SHA function tests: setHashAlgorithm("SHA5") should throw Illegal Hash function family'
	);

	var nonce1 = cryptoUtils.generateNonce();
	if (t.equal(24, nonce1.length,
		'CryptoSuite_ECDSA_SHA function tests: generateNonce length'));

	var nonce2 = cryptoUtils.generateNonce();
	var nonce3 = cryptoUtils.generateNonce();
	if (nonce1 != nonce2 && nonce2 != nonce3)
		t.pass('CryptoSuite_ECDSA_SHA function tests: verify generateNonce buffers are different');
	else
		t.fail('CryptoSuite_ECDSA_SHA function tests: verify generateNonce buffers are different');

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm('SHA3');
			cryptoUtils.setSecurityLevel(256);
			var keyPair = cryptoUtils.generateKeyPair();
			cryptoUtils.setSecurityLevel(384);
			cryptoUtils.asymmetricDecrypt(keyPair.prvKeyObj, 'fakeCipherText');
		},
		/^Error: Invalid key./,
		'CryptoSuite_ECDSA_SHA function tests: asymmetricDecrypt should throw ' +
		'"Error: Invalid key. It\'s security does not match the current security level 384 256"'
	);

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm('SHA3');
			cryptoUtils.setSecurityLevel(256);
			var keyPair = cryptoUtils.generateKeyPair();
			cryptoUtils.asymmetricDecrypt(keyPair.prvKeyObj, 'fakeCipherText');
		},
		/^Error: Illegal cipherText length/,
		'CryptoSuite_ECDSA_SHA function tests: asymmetricDecrypt should throw ' +
		'"Error: Illegal cipherText length: 14 must be > 97"'
	);

	t.throws(
		function() {
			cryptoUtils.setHashAlgorithm('SHA3');
			cryptoUtils.setSecurityLevel(256);
			var keyPair = cryptoUtils.generateKeyPair();
			cryptoUtils.asymmetricDecrypt(keyPair.prvKeyObj, '66616b654369706865725465787431323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930');
		},
		/^TypeError: Invalid hex string/,
		'CryptoSuite_ECDSA_SHA function tests: asymmetricDecrypt should throw ' +
		'"TypeError: Invalid hex string"'
	);

	cryptoUtils.setSecurityLevel(256);
	cryptoUtils.setHashAlgorithm('SHA2');
	keyPair = cryptoUtils.generateKeyPair();
	var kps = cryptoUtils.getKeyPairForSigning(keyPair.prvKeyObj.prvKeyHex, 'hex');
	t.equal(keyPair.prvKeyObj.prvKeyHex.toString(16, 2), kps.priv.toString(16, 2),
		'CryptoSuite_ECDSA_SHA function tests: getKeyPairForSigning prvKeyHex == priv');

	var pubHex = kps.getPublic('hex');
	var encryptKey = cryptoUtils.getKeyPairForEncryption(pubHex, 'hex');
	//getKeyPairForEncryption (previously ecdsaKeyFromPublic)
	t.ok(encryptKey.pub, 'Encrypted public key of getKeyPairForEncryption created');

	t.end();
});

test('\n\n ** Remote node tests **', function(t) {
	console.log('\n * REMOTE *');
	//Peer: secure grpcs, requires opts.pem
	var url = 'grpcs://'+aHostname+':aport';
	var opts = {pem: aPem};
	var remote = null;
	t.doesNotThrow(
		function() {
			remote = new Remote(url, opts);
		},
		null,
		'Check not passing any GRPC options.'
	);

	opts = {};
	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			remote = new Remote(url,opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			remote = new Remote(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	remote = new Remote(url,opts);
	t.equal(aHostname, remote._endpoint.addr, 'GRPC Options tests: new Remote grpcs with opts created');
	t.equal(remote.toString(),' Remote : {url:grpcs://'+aHostname+':aport}', 'Checking that peer.toString() reports correctly');

	url = 'grpc://'+aHostname+':aport';
	opts = null;
	remote = new Remote(url,opts);
	t.equal(aHostname, remote._endpoint.addr, 'GRPC Options tests: new Remote grpc with opts = null _endpoint.addr created');
	t.ok(remote._endpoint.creds, 'GRPC Options tests: new Remote grpc with opts = null _endpoint.creds created');

	opts = {pem: aPem, 'default-authority': 'some_ca'};
	remote = new Remote(url,opts);
	t.equal(aHostname, remote._endpoint.addr, 'GRPC Options tests: new Remote grpc with opts _endpoint.addr created');
	t.ok(remote._endpoint.creds, 'GRPC Options tests: new Remote grpc with opts _endpoint.creds created');
	t.equal(remote.getUrl(), url, 'checking that getURL works');

	console.log('\n * PEER *');
	//Peer: secure grpcs, requires opts.pem
	url = 'grpcs://'+aHostname+':aport';
	opts = {pem: aPem};
	var peer = null;
	t.doesNotThrow(
		function() {
			peer = new Peer(url, opts);
		},
		null,
		'Check not passing any GRPC options.'
	);

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	peer = new Peer(url,opts);
	t.equal(aHostname, peer._endpoint.addr, 'GRPC Options tests: new Peer grpcs with opts created');
	t.equal(peer.toString(),' Peer : {url:grpcs://'+aHostname+':aport}', 'Checking that peer.toString() reports correctly');
	//Peer: insecure grpc, opts.pem optional
	url = 'grpc://'+aHostname+':aport';
	opts = null;
	peer = new Peer(url,opts);
	t.equal(aHostname, peer._endpoint.addr, 'GRPC Options tests: new Peer grpc with opts = null _endpoint.addr created');
	t.ok(peer._endpoint.creds, 'GRPC Options tests: new Peer grpc with opts = null _endpoint.creds created');

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	peer = new Peer(url,opts);
	t.equal(aHostname, peer._endpoint.addr, 'GRPC Options tests: new Peer grpc with opts _endpoint.addr created');
	t.ok(peer._endpoint.creds, 'GRPC Options tests: new Peer grpc with opts _endpoint.creds created');
	t.equal(peer.getUrl(), url, 'checking that getURL works');

	// the grpc client did not throw an error as expected.
	// peer.sendProposal('bad data')
	// .then(
	// 	function(results) {
	// 		t.fail('This will not happen');
	// 	})
	// .catch(
	// 	function(err) {
	// 		t.pass('This should fail');
	// 	});

	t.throws(
		function() {
			url = 'http://'+aHostname+':aport';
			peer = new Peer(url, opts);
		},
		/^InvalidProtocol: Invalid protocol: http./,
		'GRPC Options tests: new Peer http should throw '+
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	opts = {};
	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			peer = new Peer(url,opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			peer = new Peer(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	console.log('\n * ORDERER *');
	//Peer: secure grpcs, requires opts.pem
	var url = 'grpcs://'+aHostname+':aport';
	var opts = {pem: aPem};
	var orderer = null;
	t.doesNotThrow(
		function() {
			orderer = new Orderer(url, opts);
		},
		null,
		'Check not passing any GRPC options.'
	);

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	orderer = new Orderer(url,opts);
	t.equal(aHostname, orderer._endpoint.addr, 'GRPC Options tests: new Orederer grpcs with opts created');
	t.equal(orderer.toString(),' Orderer : {url:grpcs://'+aHostname+':aport}', 'Checking that orderer.toString() reports correctly');
	//Peer: insecure grpc, opts.pem optional
	url = 'grpc://'+aHostname+':aport';
	opts = null;
	orderer = new Orderer(url,opts);
	t.equal(aHostname, orderer._endpoint.addr, 'GRPC Options tests: new Orederer grpc with opts = null _endpoint.addr created');
	t.ok(orderer._endpoint.creds, 'GRPC Options tests: new orderer grpc with opts = null _endpoint.creds created');

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	orderer = new Orderer(url,opts);
	t.equal(aHostname, orderer._endpoint.addr, 'GRPC Options tests: new Orederer grpc with opts _endpoint.addr created');
	t.ok(orderer._endpoint.creds, 'GRPC Options tests: new orderer grpc with opts _endpoint.creds created');

	opts = {pem: aPem, 'request-timeout': 2000};
	orderer = new Orderer(url,opts);
	t.equals(orderer._request_timeout, 2000, 'checking that the request timeout was set using the passed in value');

	t.throws(
		function() {
			url = 'http://'+aHostname+':aport';
			orderer = new Orderer(url, opts);
		},
		/^InvalidProtocol: Invalid protocol: http./,
		'GRPC Options tests: new orderer http should throw '+
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	opts = {};
	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			orderer = new Orderer(url,opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			orderer = new Orderer(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	console.log('\n * MemberServices *');
	//MemberServices: secure grpcs, requires opts.pem
	url = 'grpcs://'+aHostname+':aport';
	var opts = {pem: aPem};
	var memberServices = null;
	t.doesNotThrow(
		function() {
			memberServices = new MemberServices(url, opts);
		},
		null,
		'Check not passing any GRPC options.'
	);

	opts = {};
	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			memberServices = new MemberServices(url,opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	t.throws(
		function() {
			url = 'grpcs://'+aHostname+':aport';
			memberServices = new MemberServices(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw '+
		'PEM encoded certificate is required.'
	);

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	memberServices = new MemberServices(url,opts);

	t.equal(aHostname, memberServices._endpoint.addr, 'GRPC Options tests: new MemberServices grpcs with opts created');
	t.equal(memberServices.toString(),' MemberServices : {url:grpcs://'+aHostname+':aport}', 'Checking that memberServices.toString() reports correctly');

	t.doesNotThrow(
		function() {
			memberServices.setSecurityLevel(256);
		},
		null,
		'check setting the security level'
	);
	t.equal(memberServices.getSecurityLevel(),256, 'checking the security level');
	t.doesNotThrow(
			function() {
				memberServices.setHashAlgorithm('SHA3');
			},
			null,
			'check setting the HashAlgorithm'
		);
	t.equal(memberServices.getHashAlgorithm(),'SHA3', 'checking the HashAlgorithm');
	t.ok(memberServices.getCrypto(),'checking get crypto');

	t.equal(MemberServices._rolesToMask('bad'),1, 'rolesToMask = 1');
	t.equal(MemberServices._rolesToMask(['client']),1, 'rolesToMask = 1');
	t.equal(MemberServices._rolesToMask(['peer']),2, 'rolesToMask = 2');
	t.equal(MemberServices._rolesToMask(['validator']),4, 'rolesToMask = 4');
	t.equal(MemberServices._rolesToMask(['auditor']),8, 'rolesToMask = 8');


	//MemberServices: insecure grpc, opts.pem optional
	url = 'grpc://'+aHostname+':aport';
	opts = null;
	memberServices = new MemberServices(url,opts);
	t.equal(aHostname, memberServices._endpoint.addr, 'GRPC Options tests: new MemberServices grpc with opts = null _endpoint.addr created');
	t.ok(memberServices._endpoint.creds, 'GRPC Options tests: new MemberServices grpc with opts = null _endpoint.creds created');

	opts = {pem: aPem, 'ssl-target-name-override': aHostnameOverride};
	memberServices = new MemberServices(url,opts);

	t.equal(aHostname, memberServices._endpoint.addr, 'GRPC Options tests: new MemberServices grpc with opts _endpoint.addr created');
	t.ok(memberServices._endpoint.creds, 'GRPC Options tests: new MemberServices grpc with opts _endpoint.creds created');

	t.throws(
		function() {
			url = 'http://'+aHostname+':aport';
			memberServices = new MemberServices(url, opts);
		},
		/^InvalidProtocol: Invalid protocol: http./,
		'GRPC Options tests: new MemberServices http should throw '+
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	t.throws(
		function() {
			url = 'https://'+aHostname+':aport';
			memberServices = new MemberServices(url, opts);
		},
		/^InvalidProtocol: Invalid protocol: https./,
		'GRPC Options tests: new MemberServices https should throw '+
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	t.end();
});

// Logger tests /////////
function testLogger(t, ignoreLevels) {
	var output = '';

	let unhook = intercept(function(txt) {
		output += txt;
	});

	let log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0) {
		if (output.indexOf('Test logger - debug') > 0 && !ignoreLevels) {
			t.fail('Default logger setting should not have printed debug logs');
		} else {
			t.pass('Successfully tested default logger levels');
		}
	} else {
		t.fail('Failed to test default logger levels: info, warn and error');
	}
}

test('\n\n ** Logging utility tests - built-in logger', function(t) {
	// test 1: default logging levels for console logging
	testLogger(t);

	// test 2: custom logging levels for console logging
	var output = '';
	// setup the environment *ignore this*
	process.env.HFC_LOGGING = "{'debug': 'console'}"; // eslint-disable-line quotes
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	try {
		let unhook = intercept(function(txt) {
			output += txt;
		});

		let logger = utils.getLogger('testlogger');

		unhook();

		if (output.indexOf('Failed to parse environment variable "HFC_LOGGING"') > 0 && logger) {
			t.pass('Successfully caught error thrown by "utils.getLogger()" on invalid environment variable value, and returned a valid default logger');
		} else {
			t.fail('Failed to catch invalid environment variable value or return a valid default logger');
		}
	} catch(err) {
		t.fail('Failed to properly handle invalid environment variable value. ' + err.stack ? err.stack : err);
	}


	output = '';
	// setup the environment
	process.env.HFC_LOGGING = '{"debug": "console"}';
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;

	let unhook = intercept(function(txt) {
		output += txt;
	});

	let log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0 &&
		output.indexOf('Test logger - debug') > 0) {
		t.pass('Successfully tested debug logger levels');
	} else {
		t.fail('Failed to test debug logger levels. All of info, warn and error message should have appeared in console');
	}

	output = '';
	// setup the environment
	process.argv.push('--hfc-logging={"debug": "console"}');
	// internal call. clearing the cached config.
	global.hfc.config = undefined;
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;

	unhook = intercept(function(txt) {
		output += txt;
	});

	log = utils.getLogger('testlogger');
	log.error('Test logger - error');
	log.warn('Test logger - warn');
	log.info('Test logger - info');
	log.debug('Test logger - debug');

	unhook();

	if (output.indexOf('Test logger - error') > 0 &&
		output.indexOf('Test logger - warn') > 0 &&
		output.indexOf('Test logger - info') > 0 &&
		output.indexOf('Test logger - debug') > 0) {
		t.pass('Successfully tested debug logger levels');
	} else {
		t.fail('Failed to test debug logger levels. All of info, warn and error message should have appeared in console');
	}


	let prepareEmptyFile = function(logPath) {
		try {
			let stats = fs.statSync(logPath);

			if (stats.isFile()) {
				fs.truncateSync(logPath);
			}
		} catch(err) {
			if (err.code == 'ENOENT') {
				try {
					// file doesn't exist, create new
					let stats = fs.statSync(path.dirname(logPath));

					if (stats.isDirectory()) {
						fs.writeFileSync(logPath, '');
					}
				} catch(err) {
					if (err.code == 'ENOENT') {
						// create the dir
						fs.mkdirSync(path.dirname(logPath));
						fs.writeFileSync(logPath, '');
					}
				}
			} else {
				t.fail('Can not create an empty file to prepare for the rest of this test. ' + err.stack ? err.stack : err);
				t.end();
			}
		}
	};

	let debugPath = '/tmp/hfc-log/debug.log';
	let errorPath = '/tmp/hfc-log/error.log';
	prepareEmptyFile(debugPath);
	prepareEmptyFile(errorPath);

	hfc.setConfigSetting('hfc-logging', util.format('{"debug": "%s", "error": "%s"}', debugPath, errorPath));
	// internal call. clearing the cached logger.
	global.hfc.logger = undefined;
	var log1 = utils.getLogger('testlogger');
	log1.error('Test logger - error');
	log1.warn('Test logger - warn');
	log1.info('Test logger - info');
	log1.debug('Test logger - debug');

	setTimeout(function() {
		var data = fs.readFileSync(debugPath);

		if (data.indexOf('Test logger - error') > 0 &&
			data.indexOf('Test logger - warn') > 0 &&
			data.indexOf('Test logger - info') > 0 &&
			data.indexOf('Test logger - debug') > 0) {
			t.pass('Successfully tested logging to debug file');
		} else {
			t.fail('Failed to validate content in debug log file');
		}

		data = fs.readFileSync(errorPath);

		if (data.indexOf('Test logger - error') > 0) {
			if (data.indexOf('Test logger - warn') > 0 ||
				data.indexOf('Test logger - info') > 0 ||
				data.indexOf('Test logger - debug') > 0) {
				t.fail('Failed testing logging to error file, it should not contain any debug, info or warn messages.');
			} else {
				t.pass('Successfully tested logging to error file');
			}
		} else {
			t.fail('Failed to validate content in error log file');
		}

		t.end();
	}, 1000);
});

test('\n\n ** Logging utility tests - test setting an external logger based on bunyan', function(t) {
	var logger = bunyan.createLogger({name: 'bunyanLogger'});
	hfc.setLogger(logger);

	testLogger(t);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an external logger based on log4js', function(t) {
	var logger = log4js.getLogger();
	hfc.setLogger(logger);

	testLogger(t, true);
	t.end();
});

test('\n\n ** Logging utility tests - test setting an invalid external logger', function(t) {
	// construct an invalid logger
	var logger = {
		inf: function() { console.log('info'); },
	};

	try {
		hfc.setLogger(logger);
		t.fail('Should not have allowed an invalid logger to be set');
		t.end();
	} catch(err) {
		var er1 = err.toString();
		if (er1.indexOf('debug()') > 0 &&
			er1.indexOf('info()') > 0 &&
			er1.indexOf('warn()') > 0 &&
			er1.indexOf('error()') > 0) {
			t.pass('Successfully tested thrown error for an invalid logger to set on the HFC SDK');
			t.end();
		} else {
			t.fail('Failed to catch all errors for an invalid logger missing required methods');
			t.end();
		}
	}
});

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function cleanupFileKeyValueStore(keyValStorePath) {
	var absPath = getAbsolutePath(keyValStorePath);
	var exists = utils.existsSync(absPath);
	if (exists) {
		execSync('rm -rf ' + absPath);
	}
}

// prepend absolute path where this test is running, then join to the relative path
function getAbsolutePath(dir) {
	return path.join(process.cwd(), getRelativePath(dir));
}

// get relative file path for either Unix or Windows
// unix relative path does not start with '/'
// windows relative path starts with '/'
function getRelativePath(dir /*string*/) {
	if (/^win/.test(process.platform)) {
		if (!(dir.toString().substr(0,1) === '/')) dir = '/' + dir;
		dir = path.resolve(dir);
		dir = dir.replace(/([A-Z]:[\\\/]).*?/gi, '');
		return dir;
	} else {
		if (dir.toString().substr(0,1) === '/')	dir = dir.substr(1);
		return dir;
	}
}
