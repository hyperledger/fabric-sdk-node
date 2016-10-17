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

var test = require('tape');
var path = require('path');
var util = require('util');
var hfc = require(path.join(__dirname,'../..'));
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

// CryptoSuite_ECDSA_SHA tests //////////
var cryptoUtils = null;
// End: CryptoSuite_ECDSA_SHA tests /////

// Peer tests ////////
// var Peer = require('../../lib/Peer.js');
// var EventEmitter = require('events');
// End: Peer tests ////////


//
// Run the FileKeyValueStore test
//

test('FileKeyValueStore read and write test', function(t){
	// clean up
	fs.existsSync(keyValStorePath, (exists) =>{
		if (exists){
			execSync('rm -rf ' + keyValStorePath);
		}
	});

	var store = utils.newKeyValueStore({
		path: keyValStorePath
	});

	fs.exists(keyValStorePath, (exists) =>{
		if (exists)
			t.pass('FileKeyValueStore read and write test: Successfully created new directory for testValueStore');
		else{
			t.fail('FileKeyValueStore read and write test: Failed to create new directory: ' + keyValStorePath);
			t.end();
		}
	});

	store.setValue(testKey, testValue)
	.then(
		function(result){
			if (result){
				t.pass('FileKeyValueStore read and write test: Successfully set value');

				fs.exists(path.join(keyValStorePath, testKey), (exists) =>{
					if (exists)
						t.pass('FileKeyValueStore read and write test: Verified the file for key ' + testKey + ' does exist');
					else{
						t.fail('FileKeyValueStore read and write test: Failed to create file for key ' + testKey);
						t.end();
					}
				});
			}
		})
	.catch(
		function(reason){
			t.fail('FileKeyValueStore read and write test: Failed to set value, reason: '+reason);
			t.end();
		});

	store.getValue(testKey)
	.then(
		// Log the fulfillment value
		function(val){
			if (val != testValue){
				t.fail('FileKeyValueStore read and write test: '+ val + ' does not equal testValue of ' + testValue);
				t.end();
			}else
				t.pass('FileKeyValueStore read and write test: Successfully retrieved value');
		})
	.catch(
		// Log the rejection reason
		function(reason){
			t.fail('FileKeyValueStore read and write test: Failed getValue, reason: '+reason);
		});

	t.end();
});

test('FileKeyValueStore constructor test', function(t){
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

test('FileKeyValueStore setValue test', function(t) {
	store1.setValue(testKey, testValue)
	.then(
		function(result) {
			if (result) {
				t.pass('FileKeyValueStore store1 setValue test:  Successfully set value');

				var exists = utils.existsSync(getAbsolutePath(keyValStorePath1), testKey);
				if (exists) {
					t.pass('FileKeyValueStore store1 setValue test:  Verified the file for key ' + testKey + ' does exist');
					store1.getValue(testKey)
					.then(
						// Log the fulfillment value
						function(val) {
							if (val != testValue) {
								t.fail('FileKeyValueStore store1 getValue test:  '+ val + ' does not equal testValue of ' + testValue + 'for FileKeyValueStore read and write test');
							} else {
								t.pass('FileKeyValueStore store1 getValue test:  Successfully retrieved value');
							}
						})
					.catch(
						// Log the rejection reason
						function(reason) {
							t.fail(reason);
						});
				} else {
					t.fail('FileKeyValueStore store1 setValue test:  Failed to create file for key ' + testKey);
				}
			}
		})
	.catch(
		function(reason) {
			t.fail('FileKeyValueStore store1 setValue test:  Failed to set value: '+reason);
		});

	store2.setValue(testKey, testValue)
	.then(
		function(result) {
			if (result) {
				t.pass('FileKeyValueStore store2 setValue test:  Successfully set value');

				var exists = utils.existsSync(getAbsolutePath(keyValStorePath2), testKey);
				if (exists) {
					t.pass('FileKeyValueStore store2 setValue test:  Verified the file for key ' + testKey + ' does exist');
					store2.getValue(testKey)
					.then(
						// Log the fulfillment value
						function(val) {
							if (val != testValue)
								t.fail('FileKeyValueStore store2 getValue test:  '+ val + ' does not equal testValue of ' + testValue + 'for FileKeyValueStore read and write test');
							else
								t.pass('FileKeyValueStore store2 getValue test:  Successfully retrieved value');
						})
					.catch(
						// Log the rejection reason
						function(reason) {
							t.fail(reason);
						});
				} else
					t.fail('FileKeyValueStore store2 setValue test:  Failed to create file for key ' + testKey);
			}
		})
	.catch(
		function(reason) {
			t.fail('FileKeyValueStore store2 setValue test:  Failed to set value: '+reason);
		});

	t.end();
});

// Chain tests /////////////
test('Chain constructor test', function(t) {
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

test('Chain setKeyValueStore getKeyValueStore test', function(t) {
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
		})
	.catch(
		function(reason) {
			t.fail('Chain getKeyValueStore test:  Failed to set value, reason: '+reason);
		});

	t.end();
});

test('Chain public methods parameters tests', function(t) {
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

// Member tests /////////
test('Member constructor set get tests', function(t) {
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

test('CryptoSuite_ECDSA_SHA constructor tests', function(t) {
	cryptoUtils = utils.getCryptoSuite();

	t.equal(256, cryptoUtils.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA constructor tests: crytoUtils default getSecurityLevel() == 256');

	var keyPair = cryptoUtils.generateKeyPair();
	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoUtils keyPair.pubKeyObj.curveName == secp256r1');

	var cryptoReq = new cryptoSuiteReq();
	t.equal(256, cryptoReq.getSecurityLevel(),
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoReq default getSecurityLevel() == 256');

	keyPair = cryptoReq.generateKeyPair();
	t.equal('secp256r1', keyPair.pubKeyObj.curveName,
		'CryptoSuite_ECDSA_SHA constructor tests: cryptoReq keyPair.pubKeyObj.curveName == secp256r1');

	t.end();
});

test('CryptoSuite_ECDSA_SHA function tests', function(t) {

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
	//console.log('keyPair.prvKeyObj.prvKeyHex: '+keyPair.prvKeyObj.prvKeyHex);
	var kps = cryptoUtils.getKeyPairForSigning(keyPair.prvKeyObj.prvKeyHex, 'hex');
    //console.log(util.inspect(keyPair, false, null))
	t.equal(keyPair.prvKeyObj.prvKeyHex.toString(16, 2), kps.priv.toString(16, 2),
		'CryptoSuite_ECDSA_SHA function tests: getKeyPairForSigning prvKeyHex == priv');

	var pubHex = kps.getPublic('hex');
	var encryptKey = cryptoUtils.getKeyPairForEncryption(pubHex, 'hex');
	//getKeyPairForEncryption (previously ecdsaKeyFromPublic)
	t.ok(encryptKey.pub, 'Encrypted public key of getKeyPairForEncryption created');

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

test('Logging utility tests - built-in logger', function(t) {
	// test 1: default logging levels for console logging
	testLogger(t);

	// test 2: custom logging levels for console logging
	var output = '';
	process.env.HFC_LOGGING = "{'debug': 'console'}"; // expected json format so this is invalid
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
	process.env.HFC_LOGGING = '{"debug": "console"}';
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

	process.env.HFC_LOGGING = util.format('{"debug": "%s", "error": "%s"}', debugPath, errorPath);
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

		var data = fs.readFileSync(errorPath);

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

test('Logging utility tests - test setting an external logger based on bunyan', function(t) {
	var logger = bunyan.createLogger({name: 'bunyanLogger'});
	hfc.setLogger(logger);

	testLogger(t);
	t.end();
});

test('Logging utility tests - test setting an external logger based on log4js', function(t) {
	var logger = log4js.getLogger();
	hfc.setLogger(logger);

	testLogger(t, true);
	t.end();
});

test('Logging utility tests - test setting an invalid external logger', function(t) {
	// construct an invalid logger
	var logger = {
		inf: function() { console.log('info'); },
	};

	try {
		hfc.setLogger(logger);
		t.fail('Should not have allowed an invalid logger to be set');
		t.end();
	} catch(err) {
		err = err.toString();
		if (err.indexOf('debug()') > 0 &&
			err.indexOf('info()') > 0 &&
			err.indexOf('warn()') > 0 &&
			err.indexOf('error()') > 0) {
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
