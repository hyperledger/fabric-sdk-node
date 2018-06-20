/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// To run this test case, install SoftHSM2 library at this link:
// https://wiki.opendnssec.org/display/SoftHSMDOCS/SoftHSM+Documentation+v2
// After installing the library, you need to initialize at least one token
// which will be used below.  The test case assumes you have configured slot 0
// with user pin = 98765432.
// Sample configuration using softhsm2-util command line utility:
// softhsm2-util --init-token --slot 0 --label "My token 1" so pin abcd user pin 98765432

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');

const crypto = require('crypto');

const Client = require('fabric-client');
const utils = require('fabric-client/lib/utils.js');
const testutil = require('./util.js');

let libpath;
let pin = '98765432'; // user pin not SO pin
let slot = 0;
let cryptoUtils;

// Common locations of the PKCS11 library.
// Based on findPKCS11Lib() in fabric/bccsp/pkcs11/impl_test.go
const common_pkcs_pathnames = [
	'/usr/lib/softhsm/libsofthsm2.so',								// Ubuntu
	'/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so',				// Ubuntu  apt-get install
	'/usr/lib/s390x-linux-gnu/softhsm/libsofthsm2.so',				// Ubuntu
	'/usr/local/lib/softhsm/libsofthsm2.so',						// Ubuntu, OSX (tar ball install)
	'/usr/lib/powerpc64le-linux-gnu/softhsm/libsofthsm2.so',		// Power (can't test this)
	'/usr/lib/libacsp-pkcs11.so'									// LinuxOne
];

test('\n\n**PKCS11 - locate PKCS11 libpath\n\n', async (t) => {
	testutil.resetDefaults();

	if (typeof process.env.PKCS11_LIB === 'string' && process.env.PKCS11_LIB !== '') {
		libpath = process.env.PKCS11_LIB;
	} else {
		//
		// Check common locations for PKCS library
		//
		for (let i = 0; i < common_pkcs_pathnames.length; i++) {
			if (fs.existsSync(common_pkcs_pathnames[i])) {
				libpath = common_pkcs_pathnames[i];
				t.pass('Found a library at ' + libpath);
				break;
			}
		}
	}

	if (typeof process.env.PKCS11_PIN === 'string' && process.env.PKCS11_PIN !== '') {
		pin = process.env.PKCS11_PIN;
	}

	if (typeof process.env.PKCS11_SLOT === 'string' && process.env.PKCS11_SLOT !== '') {
		slot = parseInt(process.env.PKCS11_SLOT);
	}


	if (!libpath) {
		t.fail('Could not locate a PKCS11 library -- PKCS11 tests will probably fail');
		t.end();
	} else {

		utils.setConfigSetting('crypto-hsm', true);
		cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: slot,
			pin: pin
		});

		try {
			// Test generate AES key, encrypt, and decrypt.
			const key = await cryptoUtils.generateKey({algorithm: 'AES', ephemeral: true});
			t.pass('Successfully generated an ephemeral AES key');

			const ski = key.getSKI();
			t.comment('AES ski[' + ski.length + ']: ' + ski.toString('hex'));

			const recoveredKey = await cryptoUtils.getKey(ski);
			t.true(!!recoveredKey, 'Successfully recovered key from calculated SKI');

			const message = 'Hello World!!';
			// Encrypt a message.
			const cipherText = cryptoUtils.encrypt(recoveredKey, Buffer.from(message), {});

			// Decrypt a message.
			const plainText = cryptoUtils.decrypt(recoveredKey, cipherText, {});
			t.equal(plainText.toString(), message, 'Successfully decrypted');
			t.end();
		} catch (e) {
			t.fail('Error during tests. ' + e);
			t.end();
		}
	}
});

test('\n\n**PKCS11 - generate a non-ephemeral key\n\n', async (t) => {

	try {
		const key = await cryptoUtils.generateKey({algorithm: 'AES', ephemeral: false});
		t.pass('Successfully generated a non-ephemeral AES key');

		const ski = key.getSKI();

		// re-construct a new instance of the CryptoSuite so that when "getKey()"
		// is called it'll not have the previously generated key in memory but
		// have to retrieve it from persistence store
		cryptoUtils.closeSession();
		cryptoUtils.finalize();

		cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: 0,
			pin: pin
		});

		const recoveredKey = await cryptoUtils.getKey(ski);
		t.true(!!recoveredKey, 'Successfully recovered key from store using calculated SKI');

		const message = 'Hello World!!';
		// Encrypt a message.
		const cipherText = cryptoUtils.encrypt(recoveredKey, Buffer.from(message), {});

		// Decrypt the message.
		const plainText = cryptoUtils.decrypt(recoveredKey, cipherText, {});
		t.equal(plainText.toString(), message, 'Successfully decrypted');
		t.end();
	} catch (e) {
		t.fail('Error during tests. ' + e);
		t.end();
	}
});

/*
 * Test import an AES key into the crypto card. Note this needs some policy to be
 * enabled. SoftHSMv2 default configuration doesn't allow this.
 */
const TEST_AES_KEY = '7430b92d84e1e3da82c06aff0801aa45f4a429e73f59bfc5141e205617a30387';

test('\n\n**PKCS11 - import an AES key into the crypto card\n\n', async (t) => {

	try {
		const key = await cryptoUtils.importKey(Buffer.from(TEST_AES_KEY, 'hex'), {algorithm: 'AES'});
		t.pass('Successfully imported an AES key into the crypto card');

		const message = 'Hello World!!';
		// Note cipher text has 16-byte IV prepended.
		const cipherText = cryptoUtils.encrypt(key, Buffer.from(message), {});

		// Encrypt with software crypto, should get back same bytes
		// (minus 16-byte IV).
		// var cipher = crypto.createCipheriv(
		// 	'aes256', Buffer.from(TEST_AES_KEY, 'hex'), param.cipherText.slice(0,16));
		// var cipherText = cipher.update(Buffer.from('Hello World!!'));
		// cipherText = Buffer.concat([cipherText, cipher.final()]);

		// Decrypt with software crypto, should get back same plaintext.
		const decipher = crypto.createDecipheriv(
			'aes256', Buffer.from(TEST_AES_KEY, 'hex'), cipherText.slice(0, 16));
		let plainText = decipher.update(
			cipherText.slice(16, cipherText.length));
		plainText = Buffer.concat([plainText, decipher.final()]);

		t.equal(plainText.toString(), message, 'Successfully decrypted');
		t.end();
	} catch (e) {
		t.fail('Error during tests. ' + e);
		t.end();
	}
});

test('\n\n**PKCS11 - Test generate ephemeral ECDSA key pair, sign, and verify.\n\n', async (t) => {
	try {
		const key = await cryptoUtils.generateKey({algorithm: 'ECDSA', ephemeral: true});
		t.pass('Successfully generated ECDSA key pair');

		const message = 'Hello World!';
		const sig = cryptoUtils.sign(key, Buffer.from(message), null);
		t.pass('Successfully signed message');

		const v = cryptoUtils.verify(key, sig, Buffer.from(message));
		t.equal(v, true, 'Successfully verified message signature');
		t.end();
	} catch (e) {
		t.fail('Failed. ' + e);
		t.end();
	}
});

test('\n\n**PKCS11 - Test sign and verify with non-ephemeral ECDSA key pair in the crypto card.\n\n', async (t) => {

	try {
		let key = await cryptoUtils.generateKey({algorithm: 'ECDSA', ephemeral: false});
		t.pass('Successfully generated ECDSA key pair');

		const ski = key.getSKI();

		// re-construct a new instance of the CryptoSuite so that when "getKey()"
		// is called it'll not have the previously generated key in memory but
		// have to retrieve it from persistence store
		cryptoUtils.closeSession();
		cryptoUtils.finalize();

		cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: 0,
			pin: pin
		});

		key = await cryptoUtils.getKey(ski);
		t.true(!!key, 'Successfully recovered key from store using calculated SKI');

		const message = 'Hello World!';
		const sig = cryptoUtils.sign(key, Buffer.from(message), null);

		const v = cryptoUtils.verify(key, sig, Buffer.from(message));
		t.equal(v, true, 'Successfully verified signature');
		t.end();
	} catch (e) {
		t.fail('Failed. ' + e);
		t.end();
	}
});

test('\n\n**PKCS11 - Test Client.createUser with existing PKCS11 key.\n\n', async (t) => {
	// override t.end function so it'll always clear the config settings
	t.end = ((context, f) => {
		return function () {
			if (global && global.hfc) global.hfc.config = undefined;
			require('nconf').reset();

			f.apply(context, arguments);
		};
	})(t, t.end);

	try {
		const key = await cryptoUtils.generateKey({algorithm: 'ECDSA', ephemeral: false});
		t.pass('Successfully generated ECDSA key pair');

		const ski = await key.getSKI();

		// re-construct a new instance of the CryptoSuite so that when "getKey()"
		// is called it'll not have the previously generated key in memory but
		// have to retrieve it from persistence store
		cryptoUtils.closeSession();
		cryptoUtils.finalize();

		cryptoUtils = utils.newCryptoSuite({
			lib: libpath,
			slot: 0,
			pin: pin
		});

		const pkcs11Key = await cryptoUtils.getKey(ski);
		const client = new Client();
		client.setCryptoSuite(cryptoUtils);
		const user = await client.createUser(
			{
				username: 'pkcs11user',
				mspid: 'pkcs11MSP',
				skipPersistence: true,
				cryptoContent: {
					privateKeyObj: pkcs11Key,
					signedCertPEM: '-----BEGIN CERTIFICATE-----MIIB8TCCAZegAwIBAgIUasxwoRvBrGrdyg9+HtdJ3brpcuMwCgYIKoZIzj0EAwIwfzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAKBgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTE5MTk1NjAwWhcNMTcxMjE5MDM1NjAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABPHym/0MIKF/AehrshFR/bPsZOYLeTZOXx7sNYD19nhykv292TRkyBBkqjwabrU1JO4cxnzOne5mftA5wKbC4OCjYDBeMA4GA1UdDwEB/wQEAwICBDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBQtEfVCvKOzNSiTgpaWzaYVm6eaBzAfBgNVHSMEGDAWgBQXZ0I9qp6CP8TFHZ9bw5nRtZxIEDAKBggqhkjOPQQDAgNIADBFAiEAvGd5YDIBeQZWpP9wEHFmezvSCjrzy8VcvH/7Yuv3vcoCICy5ssNrEHEyWXqBqeKfU/zrPhHsWJFIaJEDQLRQE05l-----END CERTIFICATE-----'
				}
			});
		if (user) {
			t.pass('createUser, got user');
			t.end();
		} else {
			t.fail('createUser, returned null');
			t.end();
		}
	} catch (e) {
		t.fail('Failed. ' + e);
		t.end();
	}

});
