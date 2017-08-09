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

var Client = require('fabric-client');
var testutil = require('./util.js');
var utils = require('fabric-client/lib/utils.js');
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var os = require('os');

var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;
var ECDSA = jsrsa.ECDSA;

var CouchDBKeyValueStore = require('fabric-client/lib/impl/CouchDBKeyValueStore.js');
var CryptoSuite_ECDSA_AES = require('fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js');
var ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');
var api = require('fabric-client/lib/api.js');
var User = require('fabric-client/lib/User.js');
var elliptic = require('elliptic');
var BN = require('bn.js');
var Signature = require('elliptic/lib/elliptic/ec/signature.js');
var PKCS11 = require('fabric-client/lib/impl/bccsp_pkcs11.js');

var keyValStorePath = path.join(testutil.getTempDir(), 'keyValStore1');

var TEST_MSG = 'this is a test message';
var TEST_LONG_MSG = 'The Hyperledger project is an open source collaborative effort created to advance cross-industry blockchain technologies. ' +
	'It is a global collaboration including leaders in finance, banking, Internet of Things, supply chains, manufacturing and Technology. The Linux ' +
	'Foundation hosts Hyperledger as a Collaborative Project under the foundation. Why Create the Project? Not since the Web itself has a technology ' +
	'promised broader and more fundamental revolution than blockchain technology. A blockchain is a peer-to-peer distributed ledger forged by consensus, ' +
	'combined with a system for “smart contracts” and other assistive technologies. Together these can be used to build a new generation of transactional ' +
	'applications that establishes trust, accountability and transparency at their core, while streamlining business processes and legal constraints. ' +
	'Think of it as an operating system for marketplaces, data-sharing networks, micro-currencies, and decentralized digital communities. It has the potential ' +
	'to vastly reduce the cost and complexity of getting things done in the real world. Only an Open Source, collaborative software development approach can ' +
	'ensure the transparency, longevity, interoperability and support required to bring blockchain technologies forward to mainstream commercial adoption. That ' +
	'is what Hyperledger is about – communities of software developers building blockchain frameworks and platforms.';

var HASH_MSG_SHA384 = '6247065855a812ecd182476576c02d46a675845ef4b0056e973ca42dcf8191d3adabc8c6c4b909f20f96136032ab723a';
var HASH_LONG_MSG_SHA384 = 'e647ea97fec64412a34f522b5d80cbba9a293f89d4dc63802c79bf485078ecbaed59a0d53cd7ab08a9ae983e64f886a6';
var HASH_MSG_SHA3_384 = '9e9c2e5edf6cbc0b512807a8efa2917daff71b83e04dee28fcc00b1a1dd935fb5afc5eafa06bf55bd64792a597e2a8f3';
var HASH_LONG_MSG_SHA3_384 = '47a90d6721523682e09b81da0a60e6ee1faf839f0503252316638daf038cf682c0a842edaf310eb0f480a2e181a07af0';
var HASH_MSG_SHA256 = '4e4aa09b6d80efbd684e80f54a70c1d8605625c3380f4cb012b32644a002b5be';
var HASH_LONG_MSG_SHA256 = '0d98987f5e4e3ea611f0e3d768c594ff9aac25404265d73554d12c86d7f6fbbc';
var HASH_MSG_SHA3_256 = '7daeff454f7e91e3cd2d1c1bd5fcd1b6c9d4d5fffc6c327710d8fae7b06ee4a3';
var HASH_LONG_MSG_SHA3_256 = '577174210438a85ae4311a62e5fccf2441b960013f5691993cdf38ed6ba0c84f';

var TEST_KEY_PRIVATE = '93f15b31e3c3f3bddcd776d9219e93d8559e31453757b79e193a793cbd239573';
var TEST_KEY_PUBLIC = '04f46815aa00fe2ba2814b906aa4ef1755caf152658de8997a6a858088296054baf45b06b2eba514bcbc37ae0c0cc7465115d36429d0e0bff23dc40e3760c10aa9';
var TEST_MSG_SIGNATURE_SHA2_256 = '3046022100a6460b29373fa16ee96172bfe04666140405fdef78182280545d451f08547736022100d9022fe620ceadabbef1714b894b8d6be4b74c0f9c573bd774871764f4f789c9';
var TEST_LONG_MSG_SIGNATURE_SHA2_256 = '3045022073266302d730b07499aabd0f88f12c8749a0f90144034dbc86a8cd742722ad29022100852346f93e50911008ab97afc452f83c5985a19fa3aa6d58f615c03bddaa90a1';

var TEST_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIIDVDCCAvqgAwIBAgIBATAKBggqhkjOPQQDAjBOMRMwEQYDVQQKDArOoyBBY21l' +
'IENvMRkwFwYDVQQDExB0ZXN0LmV4YW1wbGUuY29tMQ8wDQYDVQQqEwZHb3BoZXIx' +
'CzAJBgNVBAYTAk5MMB4XDTE2MTIxNjIzMTAxM1oXDTE2MTIxNzAxMTAxM1owTjET' +
'MBEGA1UECgwKzqMgQWNtZSBDbzEZMBcGA1UEAxMQdGVzdC5leGFtcGxlLmNvbTEP' +
'MA0GA1UEKhMGR29waGVyMQswCQYDVQQGEwJOTDBZMBMGByqGSM49AgEGCCqGSM49' +
'AwEHA0IABFKnXh7hBdp6s9OJ/aadigT1z2WzBbSc7Hzb3rkaWFz4e+9alqqWg9lr' +
'ur/mDYzG9dudC8jFjVa7KIh+2BxgBayjggHHMIIBwzAOBgNVHQ8BAf8EBAMCAgQw' +
'JgYDVR0lBB8wHQYIKwYBBQUHAwIGCCsGAQUFBwMBBgIqAwYDgQsBMA8GA1UdEwEB' +
'/wQFMAMBAf8wDQYDVR0OBAYEBAECAwQwDwYDVR0jBAgwBoAEAQIDBDBiBggrBgEF' +
'BQcBAQRWMFQwJgYIKwYBBQUHMAGGGmh0dHA6Ly9vY0JDQ1NQLmV4YW1wbGUuY29t' +
'MCoGCCsGAQUFBzAChh5odHRwOi8vY3J0LmV4YW1wbGUuY29tL2NhMS5jcnQwRgYD' +
'VR0RBD8wPYIQdGVzdC5leGFtcGxlLmNvbYERZ29waGVyQGdvbGFuZy5vcmeHBH8A' +
'AAGHECABSGAAACABAAAAAAAAAGgwDwYDVR0gBAgwBjAEBgIqAzAqBgNVHR4EIzAh' +
'oB8wDoIMLmV4YW1wbGUuY29tMA2CC2V4YW1wbGUuY29tMFcGA1UdHwRQME4wJaAj' +
'oCGGH2h0dHA6Ly9jcmwxLmV4YW1wbGUuY29tL2NhMS5jcmwwJaAjoCGGH2h0dHA6' +
'Ly9jcmwyLmV4YW1wbGUuY29tL2NhMS5jcmwwFgYDKgMEBA9leHRyYSBleHRlbnNp' +
'b24wCgYIKoZIzj0EAwIDSAAwRQIgcguBb6FUxO+X8DbY17gpqSGuNC4NT4BddPg1' +
'UWUxIC0CIQDNyHQAwzhw+512meXRwG92GfpzSBssDKLdwlrqiHOu5A==' +
'-----END CERTIFICATE-----';

var TEST_KEY_PRIVATE_PEM = '-----BEGIN PRIVATE KEY-----' +
'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgZYMvf3w5VkzzsTQY' +
'I8Z8IXuGFZmmfjIX2YSScqCvAkihRANCAAS6BhFgW/q0PzrkwT5RlWTt41VgXLgu' +
'Pv6QKvGsW7SqK6TkcCfxsWoSjy6/r1SzzTMni3J8iQRoJ3roPmoxPLK4' +
'-----END PRIVATE KEY-----';
var TEST_KEY_PRIVATE_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw' +
'fzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
'biBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAK' +
'BgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTAzMDEyNDAw' +
'WhcNMTgwMTAzMDEyNDAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEG' +
'CCqGSM49AwEHA0IABLoGEWBb+rQ/OuTBPlGVZO3jVWBcuC4+/pAq8axbtKorpORw' +
'J/GxahKPLr+vVLPNMyeLcnyJBGgneug+ajE8srijfzB9MA4GA1UdDwEB/wQEAwIF' +
'oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd' +
'BgNVHQ4EFgQU9BUt7QfgDXx9g6zpzCyJGxXsNM0wHwYDVR0jBBgwFoAUF2dCPaqe' +
'gj/ExR2fW8OZ0bWcSBAwCgYIKoZIzj0EAwIDSAAwRQIgcWQbMzluyZsmvQCvGzPg' +
'f5B7ECxK0kdmXPXIEBiizYACIQD2x39Q4oVwO5uL6m3AVNI98C2LZWa0g2iea8wk' +
'BAHpeA==' +
'-----END CERTIFICATE-----';

var TEST_USER_ENROLLMENT = {
	'name': 'admin2',
	'mspid': 'test',
	'roles':null,
	'affiliation':'',
	'enrollmentSecret':'',
	'enrollment': {
		'signingIdentity': '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a',
		'identity': {
			'certificate': TEST_KEY_PRIVATE_CERT_PEM
		}
	}
};

const halfOrdersForCurve = {
	'secp256r1': elliptic.curves['p256'].n.shrn(1),
	'secp384r1': elliptic.curves['p384'].n.shrn(1)
};

var _client = new Client();

test('\n\n** utils.newCryptoSuite tests **\n\n', (t) => {
	testutil.resetDefaults();

	let cs = utils.newCryptoSuite({keysize: 384, algorithm: 'EC'});
	t.equal(cs instanceof CryptoSuite_ECDSA_AES, true, 'Should return an instance of CryptoSuite_ECDSA_AES');
	t.equal(cs._keySize, 384, 'Returned instance should have keysize of 384');

	cs = utils.newCryptoSuite({keysize: 384});
	t.equal(cs instanceof CryptoSuite_ECDSA_AES, true, 'Default test: should return an instance of CryptoSuite_ECDSA_AES');
	t.equal(cs._keySize, 384, 'Returned instance should have keysize of 384');

	cs = utils.newCryptoSuite({algorithm: 'EC'});
	t.equal(cs instanceof CryptoSuite_ECDSA_AES, true, 'Should return an instance of CryptoSuite_ECDSA_AES');
	t.equal(cs._keySize, 256, 'Returned instance should have keysize of 256');

	// each app instance is expected to use either HSM or software-based key management, as such this question
	// is answered with a config setting rather than controlled on a case-by-case basis
	utils.setConfigSetting('crypto-hsm', true);
	let expectedError = '/Error:.*\/usr\/local\/lib/';
	if (process.platform === 'win32') {
		expectedError = 'Error: Win32 error 126/';
	};
	t.throws(
		() => {
			cs = utils.newCryptoSuite({lib: '/usr/local/lib', slot: 0, pin: '1234' });
		},
		expectedError,
		'Should attempt to load the bccsp_pkcs11 module and fail because of the dummy library path'
	);
	t.end();
});

test('\n\n ** CryptoSuite_ECDSA_AES - error tests **\n\n', function (t) {
	testutil.resetDefaults();
	var cryptoUtils = utils.newCryptoSuite();
	t.throws(
		() => {
			cryptoUtils.importKey(TEST_CERT_PEM);
		},
		/importKey opts.ephemeral is false, which requires CryptoKeyStore to be set./,
		'Test missing cryptoKeyStore: cryptoSuite.importKey'
	);
	t.throws(
		() => {
			cryptoUtils.generateKey();
		},
		/generateKey opts.ephemeral is false, which requires CryptoKeyStore to be set./,
		'Test missing cryptoKeyStore: cryptoSuite.generateKey'
	);
	t.end();
});

test('\n\n ** CryptoSuite_ECDSA_AES - ephemeral true tests **\n\n', function (t) {
	testutil.resetDefaults();
	var cryptoUtils = utils.newCryptoSuite();
	var key = cryptoUtils.importKey(TEST_KEY_PRIVATE_PEM, {ephemeral: true});
	if (key && key._key && key._key.type === 'EC') {
		t.pass('importKey returned key using ephemeral true');
	} else {
		t.fail('importKey did not return key using ephemeral true');
	}

	return cryptoUtils.generateKey({ephemeral: true})
	.then(function (key) {
		if (key && key._key && key._key.type === 'EC') {
			t.pass('generateKey returned key using ephemeral true');
			t.end();
		} else {
			t.fail('generateKey did not return key using ephemeral true');
			t.end();
		}
	},(err) => {
		t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n ** CryptoSuite_ECDSA_AES - function tests **\n\n', function (t) {
	testutil.resetDefaults();

	var cryptoUtils = utils.newCryptoSuite();

	t.equal(true, (typeof cryptoUtils._ecdsaCurve !== 'undefined' && typeof cryptoUtils._ecdsa !== 'undefined'),
		'CryptoSuite_ECDSA_AES function tests: default instance has "_ecdsaCurve" and "_ecdsa" properties');

	// test default curve 256 with SHA256
	t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA256,
		'CryptoSuite_ECDSA_AES function tests: using "SHA2" hashing algorithm with default key size which should be 256');

	t.equal(cryptoUtils.hash(TEST_LONG_MSG), HASH_LONG_MSG_SHA256,
		'CryptoSuite_ECDSA_AES function tests: using "SHA2" hashing algorithm with default key size which should be 256');

	// test SHA384 hash
	utils.setConfigSetting('crypto-keysize', 384);
	cryptoUtils = utils.newCryptoSuite();
	t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA384,
		'CryptoSuite_ECDSA_AES function tests: using "SHA2" hashing algorithm with default key size which should be 384');

    //reset to default key size
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/FileKeyValueStore.js');//force for gulp test
	cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

	cryptoUtils.generateKey()
	.then(function (key) {
		t.equal('secp256r1', key.getPublicKey()._key.curveName,
			'CryptoSuite_ECDSA_AES function tests: cryptoUtils generated public key curveName == secp256r1');

		// test curve 256 with SHA3_256
		utils.setConfigSetting('crypto-hash-algo', 'SHA3');
		utils.setConfigSetting('crypto-keysize', 256);
		cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());
		return cryptoUtils.generateKey();
	},(err) => {
		t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then(function (key) {
		t.equal('secp256r1', key.getPublicKey()._key.curveName,
			'CryptoSuite_ECDSA_AES function tests: ccryptoUtils generated public key curveName == secp256r1');

		t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA3_256,
			'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 256');

		t.equal(cryptoUtils.hash(TEST_LONG_MSG), HASH_LONG_MSG_SHA3_256,
			'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 256');

		// test SHA3_384
		utils.setConfigSetting('crypto-hash-algo', 'SHA3');
		utils.setConfigSetting('crypto-keysize', 384);
		cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

		t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA3_384,
			'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 384');

		t.equal(cryptoUtils.hash(TEST_LONG_MSG), HASH_LONG_MSG_SHA3_384,
			'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 384');

		return cryptoUtils.generateKey();
	},(err) => {
		t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then(function (key) {
		t.equal('secp384r1', key.getPublicKey()._key.curveName,
			'CryptoSuite_ECDSA_AES function tests: ccryptoUtils generated public key curveName == secp384r1');

		if (!!key._key)
			t.pass('CryptoSuite_ECDSA_AES function tests: verify generateKey return object');
		else
			t.fail('CryptoSuite_ECDSA_AES function tests: verify generateKey return object');

		utils.setConfigSetting('crypto-hash-algo', 'sha3'); //lower or upper case is allowed
		cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

		t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA3_384,
			'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 384');

		// test generation options
		return cryptoUtils.generateKey({ ephemeral: true });
	},(err) => {
		t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then(function (key) {
		if (!!key._key)
			t.pass('CryptoSuite_ECDSA_AES function tests: verify generateKey ephemeral=true return object');
		else
			t.fail('CryptoSuite_ECDSA_AES function tests: verify generateKey ephemeral=true return object');

		t.throws(
			function () {
				utils.setConfigSetting('crypto-keysize', 123);
				cryptoUtils = utils.newCryptoSuite();
			},
			/^Error: Illegal key size/,
			'CryptoSuite_ECDSA_AES function tests: setting key size 123 should throw Illegal level error'
		);

		t.throws(
			function () {
				utils.setConfigSetting('crypto-keysize', 256);
				utils.setConfigSetting('crypto-hash-algo', '12345');
				cryptoUtils = utils.newCryptoSuite();
			},
			/^Error: Unsupported hash algorithm/,
			'CryptoSuite_ECDSA_AES function tests: setting hash algo to 12345 should throw Illegal Hash function family'
		);

		utils.setConfigSetting('crypto-keysize', 256);
		utils.setConfigSetting('crypto-hash-algo', 'SHA3');
		cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

		return cryptoUtils.generateKey();
	},(err) => {
		t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then(function (key) {
		t.throws(
			function () {
				cryptoUtils.sign();
			},
			/A valid key is required to sign/,
			'CryptoSuite_ECDSA_AES function tests: sign() should throw "A valid key is required to sign"'
		);

		t.throws(
			function () {
				cryptoUtils.sign('dummy key');
			},
			/A valid message is required to sign/,
			'CryptoSuite_ECDSA_AES function tests: sign() should throw "A valid message is required to sign"'
		);

		var testSignature = function (msg) {
			var sig = cryptoUtils.sign(key, cryptoUtils.hash(msg));
			if (sig) {
				// test that signatures have low-S
				var halfOrder = halfOrdersForCurve[key._key.ecparams.name];
				var sigObject = new Signature(sig);
				if (sigObject.s.cmp(halfOrder) == 1) {
					t.fail('Invalid signature object: S value larger than N/2');
				} else {
					t.pass('Valid signature object generated from sign()');
				}

				// using internal calls to verify the signature
				var pubKey = cryptoUtils._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
				// note that the signature is generated on the hash of the message, not the message itself
				t.equal(pubKey.verify(cryptoUtils.hash(msg), new Buffer(sig)), true,
					'CryptoSuite_ECDSA_AES function tests: sign() method produced proper signature that was successfully verified');
			} else {
				t.fail('Invalid signature generated by sign()');
			}
		};

		testSignature(TEST_MSG);
		testSignature(TEST_LONG_MSG);

		t.throws(
			function () {
				cryptoUtils.verify();
			},
			/A valid key is required to verify/,
			'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid key is required to verify"'
		);

		t.throws(
			function () {
				cryptoUtils.verify('dummy key');
			},
			/A valid signature is required to verify/,
			'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid signature is required to verify"'
		);

		t.throws(
			function () {
				cryptoUtils.verify('dummy key', 'dummy signature');
			},
			/A valid message is required to verify/,
			'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid message is required to verify"'
		);

		utils.setConfigSetting('crypto-keysize', 256);
		utils.setConfigSetting('crypto-hash-algo', 'SHA2');
		cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

		var testVerify = function (sig, msg, expected) {
			// manually construct a key based on the saved privKeyHex and pubKeyHex
			var f = new ECDSA({ curve: 'secp256r1' });
			f.setPrivateKeyHex(TEST_KEY_PRIVATE);
			f.setPublicKeyHex(TEST_KEY_PUBLIC);
			f.isPrivate = true;
			f.isPublic = false;

			t.equal(cryptoUtils.verify(new ecdsaKey(f), sig, msg), expected,
				'CryptoSuite_ECDSA_AES function tests: verify() method');
		};

		// these signatures have S values larger than N/2
		testVerify(TEST_MSG_SIGNATURE_SHA2_256, TEST_MSG, false);
		testVerify(TEST_LONG_MSG_SIGNATURE_SHA2_256, TEST_LONG_MSG, false);

		// test importKey()
		return cryptoUtils.importKey(TEST_CERT_PEM);
	},(err) => {
		t.fail('Failed to importKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then((pubKey) => {
		t.equal(pubKey.isPrivate(), false, 'Test imported public key isPrivate()');
		t.equal(pubKey.getSKI(), 'b5cb4942005c4ecaa9f73a49e1936a58baf549773db213cf1e22a1db39d9dbef', 'Test imported public key SKI');

		// verify that the pub key has been saved in the key store by the proper key
		t.equal(
			fs.existsSync(path.join(utils.getDefaultKeyStorePath(), 'b5cb4942005c4ecaa9f73a49e1936a58baf549773db213cf1e22a1db39d9dbef-pub')),
			true,
			'Check that the imported public key has been saved in the key store');

		return cryptoUtils.importKey(TEST_KEY_PRIVATE_PEM);
	},(err) => {
		t.fail('Failed to importKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then((privKey) => {
		t.equal(privKey.isPrivate(), true, 'Test imported private key isPrivate');
		t.equal(privKey.getSKI(), '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a', 'Test imported private key SKI');
		t.end();

		// verify that the imported private key has been saved in the key store by the proper key
		t.equal(
			fs.existsSync(path.join(utils.getDefaultKeyStorePath(), '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a-priv')),
			true,
			'Check that the imported private key has been saved in the key store');

		// verify that the imported key can properly sign messages
		var testSig = cryptoUtils.sign(privKey, cryptoUtils.hash(TEST_MSG));
		t.equal(
			cryptoUtils.verify(privKey.getPublicKey(), testSig, TEST_MSG),
			true,
			'Check that the imported private key can properly sign messages');

		// manufacture an error condition where the private key does not exist for the SKI, and only the public key does
		return cryptoUtils.importKey(TEST_KEY_PRIVATE_CERT_PEM);
	},(err) => {
		t.fail('Failed to importKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
		t.end();
	}).then((pubKey) => {
		fs.removeSync(path.join(utils.getDefaultKeyStorePath(), '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a-priv'));

		var poorUser = new User('admin2');
		poorUser.setCryptoSuite(cryptoUtils);

		return poorUser.fromString(JSON.stringify(TEST_USER_ENROLLMENT));
	}).then(() => {
		t.fail('Failed to catch missing private key expected from a user enrollment object');
		t.end();
	},(err) => {
		var msg = 'Private key missing from key store';
		if (err.message && err.message.indexOf(msg) > -1) {
			t.pass('Successfully caught missing private key expected from a user enrollment object');
			t.end();
		} else {
			t.fail(util.format('Unexpected message.  Expecting "%s" but got "%s"', msg, err));
			t.end();
		}
	}).catch((err) => {
		t.comment('final catch, caught err...');
		t.fail(err.stack ? err.stack : err);
		t.end();
	});
});

function cleanupFileKeyValueStore(keyValStorePath) {
	var absPath = getAbsolutePath(keyValStorePath);
	var exists = testutil.existsSync(absPath);
	if (exists) {
		fs.removeSync(absPath);
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
		if (!(dir.toString().substr(0, 1) === '/')) dir = '/' + dir;
		dir = path.resolve(dir);
		dir = dir.replace(/([A-Z]:[\\\/]).*?/gi, '');
		return dir;
	} else {
		if (dir.toString().substr(0, 1) === '/') dir = dir.substr(1);
		return dir;
	}
}
