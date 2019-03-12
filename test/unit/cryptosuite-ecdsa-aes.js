/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const testutil = require('./util.js');
const utils = require('fabric-client/lib/utils.js');
const path = require('path');
const fs = require('fs-extra');
const util = require('util');

const jsrsa = require('jsrsasign');
const ECDSA = jsrsa.ECDSA;

const CryptoSuite_ECDSA_AES = require('fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js');
const ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');
const User = require('fabric-client/lib/User.js');
const elliptic = require('elliptic');
const Signature = require('elliptic/lib/elliptic/ec/signature.js');

const constants = require('./constants');
const TEST_MSG = constants.TEST_MSG;
const TEST_LONG_MSG = constants.TEST_LONG_MSG;
const HASH_MSG_SHA384 = constants.HASH_MSG_SHA384;
const HASH_MSG_SHA3_384 = constants.HASH_MSG_SHA3_384;
const HASH_LONG_MSG_SHA3_384 = constants.HASH_LONG_MSG_SHA3_384;
const HASH_MSG_SHA256 = constants.HASH_MSG_SHA256;
const HASH_LONG_MSG_SHA256 = constants.HASH_LONG_MSG_SHA256;
const HASH_MSG_SHA3_256 = constants.HASH_MSG_SHA3_256;
const HASH_LONG_MSG_SHA3_256 = constants.HASH_LONG_MSG_SHA3_256;
const TEST_KEY_PRIVATE = constants.TEST_KEY_PRIVATE;
const TEST_KEY_PUBLIC = constants.TEST_KEY_PUBLIC;
const TEST_MSG_SIGNATURE_SHA2_256 = constants.TEST_MSG_SIGNATURE_SHA2_256;
const TEST_LONG_MSG_SIGNATURE_SHA2_256 = constants.TEST_LONG_MSG_SIGNATURE_SHA2_256;
const TEST_CERT_PEM = constants.TEST_CERT_PEM;
const TEST_KEY_PRIVATE_PEM = constants.TEST_KEY_PRIVATE_PEM;
const TEST_KEY_PRIVATE_CERT_PEM = constants.TEST_KEY_PRIVATE_CERT_PEM;

const TEST_USER_ENROLLMENT = {
	'name': 'admin2',
	'mspid': 'test',
	'roles': null,
	'affiliation': '',
	'enrollmentSecret': '',
	'enrollment': {
		'signingIdentity': '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a',
		'identity': {
			'certificate': TEST_KEY_PRIVATE_CERT_PEM
		}
	}
};

const halfOrdersForCurve = {
	'secp256r1': elliptic.curves.p256.n.shrn(1),
	'secp384r1': elliptic.curves.p384.n.shrn(1)
};

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
	/* eslint-disable-next-line */
	let expectedError = '/Error:.*\/usr\/local\/lib/';
	if (process.platform === 'win32') {
		expectedError = 'Error: Win32 error 126/';
	}
	t.throws(
		() => {
			cs = utils.newCryptoSuite({lib: '/usr/local/lib', slot: 0, pin: '1234'});
		},
		expectedError,
		'Should attempt to load the bccsp_pkcs11 module and fail because of the dummy library path'
	);
	t.end();
});

test('\n\n ** CryptoSuite_ECDSA_AES - error tests **\n\n', async (t) => {
	testutil.resetDefaults();
	const cryptoUtils = utils.newCryptoSuite();

	try {
		await cryptoUtils.importKey(TEST_CERT_PEM);
		t.fail('Import key did not fail when testing missing cryptoKeyStore');
	} catch (err) {
		t.ok(err.toString()
			.includes('importKey requires CryptoKeyStore to be set.'),
		'Test missing cryptoKeyStore: cryptoSuite.importKey');
	}

	try {
		await cryptoUtils.generateKey();
		t.fail('generateKey did not fail when testing missing cryptoKeyStore');
	} catch (err) {
		t.ok(err.toString()
			.includes('generateKey requires CryptoKeyStore to be set.'),
		'Test missing cryptoKeyStore: cryptoSuite.generateKey');
	}

	t.end();
});

test('\n\n ** CryptoSuite_ECDSA_AES - generateEphemeralKey tests **\n\n', (t) => {
	testutil.resetDefaults();
	const cryptoUtils = utils.newCryptoSuite();
	const key = cryptoUtils.generateEphemeralKey();
	if (key && key._key && key._key.type === 'EC') {
		t.pass('generateEphemeralKey returned key');
		t.end();
	} else {
		t.fail('generateEphemeralKey did not return key');
		t.end();
	}

});

test('\n\n ** CryptoSuite_ECDSA_AES - createKeyFromRaw **\n\n', async (t) => {
	testutil.resetDefaults();
	const cryptoUtils = utils.newCryptoSuite();
	const key = cryptoUtils.createKeyFromRaw(TEST_KEY_PRIVATE_PEM);
	if (key && key._key && key._key.type === 'EC') {
		t.pass('importKey returned key using ephemeral true');
	} else {
		t.fail('importKey did not return key using ephemeral true');
	}
});

test('\n\n ** CryptoSuite_ECDSA_AES - function tests **\n\n', (t) => {
	testutil.resetDefaults();

	let cryptoUtils = utils.newCryptoSuite();

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

	// reset to default key size
	utils.setConfigSetting('crypto-keysize', 256);
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');// force for gulp test
	cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

	cryptoUtils.generateKey()
		.then((key) => {
			t.equal('secp256r1', key.getPublicKey()._key.curveName,
				'CryptoSuite_ECDSA_AES function tests: cryptoUtils generated public key curveName == secp256r1');

			// test curve 256 with SHA3_256
			utils.setConfigSetting('crypto-hash-algo', 'SHA3');
			utils.setConfigSetting('crypto-keysize', 256);
			cryptoUtils = utils.newCryptoSuite();
			cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());
			return cryptoUtils.generateKey();
		}, (err) => {
			t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
			t.end();
		}).then((key) => {
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
		}, (err) => {
			t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
			t.end();
		}).then((key) => {
			t.equal('secp384r1', key.getPublicKey()._key.curveName,
				'CryptoSuite_ECDSA_AES function tests: ccryptoUtils generated public key curveName == secp384r1');

			if (key._key) {
				t.pass('CryptoSuite_ECDSA_AES function tests: verify generateKey return object');
			} else {
				t.fail('CryptoSuite_ECDSA_AES function tests: verify generateKey return object');
			}

			utils.setConfigSetting('crypto-hash-algo', 'sha3'); // lower or upper case is allowed
			cryptoUtils = utils.newCryptoSuite();
			cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

			t.equal(cryptoUtils.hash(TEST_MSG), HASH_MSG_SHA3_384,
				'CryptoSuite_ECDSA_AES function tests: using "SHA3" hashing algorithm with key size 384');

			// test generation options
			return cryptoUtils.generateKey({ephemeral: true});
		}, (err) => {
			t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
			t.end();
		}).then((key) => {
			if (key._key) {
				t.pass('CryptoSuite_ECDSA_AES function tests: verify generateKey ephemeral=true return object');
			} else {
				t.fail('CryptoSuite_ECDSA_AES function tests: verify generateKey ephemeral=true return object');
			}

			t.throws(
				() => {
					utils.setConfigSetting('crypto-keysize', 123);
					cryptoUtils = utils.newCryptoSuite();
				},
				/^Error: Illegal key size/,
				'CryptoSuite_ECDSA_AES function tests: setting key size 123 should throw Illegal level error'
			);

			t.throws(
				() => {
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
		}, (err) => {
			t.fail('Failed to generateKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
			t.end();
		}).then((key) => {
			t.throws(
				() => {
					cryptoUtils.sign();
				},
				/A valid key is required to sign/,
				'CryptoSuite_ECDSA_AES function tests: sign() should throw "A valid key is required to sign"'
			);

			t.throws(
				() => {
					cryptoUtils.sign('dummy key');
				},
				/A valid message is required to sign/,
				'CryptoSuite_ECDSA_AES function tests: sign() should throw "A valid message is required to sign"'
			);

			const testSignature = function (msg) {
				const sig = cryptoUtils.sign(key, cryptoUtils.hash(msg));
				if (sig) {
				// test that signatures have low-S
					const halfOrder = halfOrdersForCurve[key._key.ecparams.name];
					const sigObject = new Signature(sig);
					if (sigObject.s.cmp(halfOrder) === 1) {
						t.fail('Invalid signature object: S value larger than N/2');
					} else {
						t.pass('Valid signature object generated from sign()');
					}

					// using internal calls to verify the signature
					const pubKey = cryptoUtils._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
					// note that the signature is generated on the hash of the message, not the message itself
					t.equal(pubKey.verify(cryptoUtils.hash(msg), Buffer.from(sig)), true,
						'CryptoSuite_ECDSA_AES function tests: sign() method produced proper signature that was successfully verified');
				} else {
					t.fail('Invalid signature generated by sign()');
				}
			};

			testSignature(TEST_MSG);
			testSignature(TEST_LONG_MSG);

			t.throws(
				() => {
					cryptoUtils.verify();
				},
				/A valid key is required to verify/,
				'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid key is required to verify"'
			);

			t.throws(
				() => {
					cryptoUtils.verify('dummy key');
				},
				/A valid signature is required to verify/,
				'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid signature is required to verify"'
			);

			t.throws(
				() => {
					cryptoUtils.verify('dummy key', 'dummy signature');
				},
				/A valid message is required to verify/,
				'CryptoSuite_ECDSA_AES function tests: verify() should throw "A valid message is required to verify"'
			);

			utils.setConfigSetting('crypto-keysize', 256);
			utils.setConfigSetting('crypto-hash-algo', 'SHA2');
			cryptoUtils = utils.newCryptoSuite();
			cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());

			const testVerify = function (sig, msg, expected) {
			// manually construct a key based on the saved privKeyHex and pubKeyHex
				const f = new ECDSA({curve: 'secp256r1'});
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
		}, (err) => {
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
		}, (err) => {
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
			const testSig = cryptoUtils.sign(privKey, cryptoUtils.hash(TEST_MSG));
			t.equal(
				cryptoUtils.verify(privKey.getPublicKey(), testSig, TEST_MSG),
				true,
				'Check that the imported private key can properly sign messages');

			// manufacture an error condition where the private key does not exist for the SKI, and only the public key does
			return cryptoUtils.importKey(TEST_KEY_PRIVATE_CERT_PEM);
		}, (err) => {
			t.fail('Failed to importKey. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			fs.removeSync(path.join(utils.getDefaultKeyStorePath(), '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a-priv'));

			const poorUser = new User('admin2');
			poorUser.setCryptoSuite(cryptoUtils);

			return poorUser.fromString(JSON.stringify(TEST_USER_ENROLLMENT));
		}).then(() => {
			t.fail('Failed to catch missing private key expected from a user enrollment object');
			t.end();
		}, (err) => {
			const msg = 'Private key missing from key store';
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
