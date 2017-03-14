/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// To run this test case, install SoftHSM2 library at this link:
// https://wiki.opendnssec.org/display/SoftHSMDOCS/SoftHSM+Documentation+v2
// After installing the library, you need to initialize at least one token
// which will be used below. For the 'pin' property in the configuration
// object below, use the 'user PIN' value (not SO PIN) and please set it to
// '1234' so the code below can run successfully

'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var crypto = require('crypto');
var util = require('util');
var path = require('path');

var utils = require('fabric-client/lib/utils.js');

var libpath;
switch(process.platform) {
case 'darwin': // OSX
case 'linux':  // Ubuntu VM
	libpath = '/usr/local/lib/softhsm/libsofthsm2.so';
	break;
default:
	libpath = '/usr/lib/libacsp-pkcs11.so'; //LinuxOne
}

var cryptoUtils;

test('\n\n**PKCS11 - generate an ephemeral key\n\n', (t) => {
	utils.setConfigSetting('crypto-hsm', true);

	cryptoUtils = utils.newCryptoSuite({
		lib: libpath,
		slot: 0,
		pin: '1234'
	});

	// Test generate AES key, encrypt, and decrypt.
	cryptoUtils.generateKey({ algorithm: 'AES', ephemeral: true })
	.then((key) => {
		t.pass('Successfully generated an ephemeral AES key');

		var ski = key.getSKI();
		t.comment('AES ski[' + ski.length + ']: ' + ski.toString('hex'));

		return cryptoUtils.getKey(ski);
	})
	.then((recoveredKey) => {
		t.true(!!recoveredKey, 'Successfully recovered key from calculated SKI');

		// Encrypt a message.
		var cipherText = cryptoUtils.encrypt(recoveredKey, Buffer.from('Hello World!!'), {});

		return { recoveredKey, cipherText };
	})
	.then(function(param) {
		// Decrypt a message.
		var plainText = cryptoUtils.decrypt(param.recoveredKey, param.cipherText, {});
		t.equal(plainText.toString(), 'Hello World!!', 'Successfully decrypted');
		t.end();
	})
	.catch(function(e) {
		t.fail('Error during tests. ' + e);
		t.end();
	});
});

test('\n\n**PKCS11 - generate a non-ephemeral key\n\n', (t) => {
	// must use a saved local reference, because the 'cryptoUtils' object inside
	// the 'then()' blocks are 'undefined'
	var existingCrypto = cryptoUtils;

	existingCrypto.generateKey({ algorithm: 'AES', ephemeral: false })
	.then(function(key) {
		t.pass('Successfully generated a non-ephemeral AES key');

		var ski = key.getSKI();

		// re-construct a new instance of the CryptoSuite so that when "getKey()"
		// is called it'll not have the previously generated key in memory but
		// have to retrieve it from persistence store
		existingCrypto._pkcs11.C_CloseSession(existingCrypto._pkcs11Session);
		existingCrypto._pkcs11.C_Finalize();

		var cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: 0,
			pin: '1234' });

		return cryptoUtils.getKey(ski);
	})
	.then((recoveredKey) => {
		t.true(!!recoveredKey, 'Successfully recovered key from store using calculated SKI');

		// Encrypt a message.
		var cipherText = cryptoUtils.encrypt(recoveredKey, Buffer.from('Hello World!!'), {});

		return { recoveredKey, cipherText };
	})
	.then((param) => {
		// Decrypt the message.
		var plainText = cryptoUtils.decrypt(param.recoveredKey, param.cipherText, {});
		t.equal(plainText.toString(), 'Hello World!!', 'Successfully decrypted');
		t.end();
	})
	.catch(function(e) {
		t.fail('Error during tests. ' + e);
		t.end();
	});
});

/*
 * Test import an AES key into the crypto card. Note this needs some policy to be
 * enabled. SoftHSMv2 default configuration doesn't allow this.
 */
const TEST_AES_KEY = '7430b92d84e1e3da82c06aff0801aa45f4a429e73f59bfc5141e205617a30387';

test('\n\n**PKCS11 - import an AES key into the crypto card\n\n', (t) => {

	cryptoUtils.importKey(Buffer.from(TEST_AES_KEY, 'hex'), { algorithm: 'AES' })
	.then((key) => {
		t.pass('Successfully imported an AES key into the crypto card');

		// Note cipher text has 16-byte IV prepended.
		var cipherText = cryptoUtils.encrypt(key, Buffer.from('Hello World!!'), {});
		return { key, cipherText };
	})
	.then((param) => {
		// Encrypt with software crypto, should get back same bytes
		// (minus 16-byte IV).
		var cipher = crypto.createCipheriv(
			'aes256', Buffer.from(TEST_AES_KEY, 'hex'), param.cipherText.slice(0,16));
		var cipherText = cipher.update(Buffer.from('Hello World!!'));
		cipherText = Buffer.concat([cipherText, cipher.final()]);

		// Decrypt with software crypto, should get back same plaintext.
		var decipher = crypto.createDecipheriv(
			'aes256', Buffer.from(TEST_AES_KEY, 'hex'), param.cipherText.slice(0,16));
		var plainText = decipher.update(
			param.cipherText.slice(16, param.cipherText.length));
		plainText = Buffer.concat([plainText, decipher.final()]);

		t.equal(plainText.toString(),  'Hello World!!', 'Successfully decrypted');
		t.end();
	})
	.catch(function(e) {
		t.fail('Error during tests. ' + e);
		t.end();
	});
});

test('\n\n**PKCS11 - Test generate ephemeral ECDSA key pair, sign, and verify.\n\n', (t) => {
	cryptoUtils.generateKey({ algorithm: 'ECDSA', ephemeral: true })
	.then((key) => {
		t.pass('Successfully generated ECDSA key pair');

		var ski = key.getSKI();

		var sig = cryptoUtils.sign(key, Buffer.from('Hello World!'), null);

		return { key, sig };
	})
	.then((param) => {
		t.pass('Successfully signed message');

		var v = cryptoUtils.verify(param.key, param.sig,
					   Buffer.from('Hello World!'));
		t.equal(v, true, 'Successfully verified message signature');
		t.end();
	})
	.catch(function(e) {
		t.fail('Failed. ' + e);
		t.end();
	});
});

test('\n\n**PKCS11 - Test sign and verify with non-ephemeral ECDSA key pair in the crypto card.\n\n', (t) => {
	var existingCrypto = cryptoUtils;

	existingCrypto.generateKey({ algorithm: 'ECDSA', ephemeral: false })
	.then((key) => {
		t.pass('Successfully generated ECDSA key pair');

		var ski = key.getSKI();

		// re-construct a new instance of the CryptoSuite so that when "getKey()"
		// is called it'll not have the previously generated key in memory but
		// have to retrieve it from persistence store
		existingCrypto._pkcs11.C_CloseSession(existingCrypto._pkcs11Session);
		existingCrypto._pkcs11.C_Finalize();

		var cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: 0,
			pin: '1234' });

		return cryptoUtils.getKey(ski);
	})
	.then((key) => {
		t.true(!!key, 'Successfully recovered key from store using calculated SKI');

		var sig = cryptoUtils.sign(key, Buffer.from('Hello World!'), null);

		return { key, sig };
	})
	.then((param) => {
		var v = cryptoUtils.verify(param.key, param.sig,
					   Buffer.from('Hello World!'));
		t.equal(v, true, 'Successfully verified signature');
		t.end();
	})
	.catch(function(e) {
		t.fail('Failed. ' + e);
		t.end();
	});
});
