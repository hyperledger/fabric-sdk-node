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

var testutil = require('./util.js');
var utils = require('fabric-client/lib/utils.js');
var fs = require('fs-extra');
var path = require('path');
var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;

testutil.resetDefaults();

var ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');
var CKS = require('fabric-client/lib/impl/CryptoKeyStore.js');

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

test('\n\n** CryptoKeyStore tests **\n\n', function(t) {
	t.throws(
		() => {
			CKS();
		},
		/Must provide the path to the directory to hold files for the store/,
		'Test invalid constructor calls: missing options parameter'
	);

	t.throws(
		() => {
			CKS({something: 'useless'});
		},
		/Must provide the path to the directory to hold files for the store/,
		'Test invalid constructor calls: missing "path" property in the "options" parameter'
	);

	var f1 = KEYUTIL.getKey(TEST_KEY_PRIVATE_PEM);
	var testPrivKey = new ecdsaKey(f1);
	var f2 = KEYUTIL.getKey(TEST_KEY_PRIVATE_CERT_PEM);
	var testPubKey = new ecdsaKey(f2);

	var store;
	CKS({path: '/tmp/hfc-cks'})
	.then((st) => {
		store = st;
		return store.putKey(testPrivKey);
	}).then((keyPEM) => {
		t.pass('Successfully saved private key in store');

		t.equal(fs.existsSync(path.join('/tmp/hfc-cks', testPrivKey.getSKI() + '-priv')), true,
			'Check that the private key has been saved with the proper <SKI>-priv index');

		return store.getKey(testPrivKey.getSKI());
	}).then((recoveredKey) => {
		t.notEqual(recoveredKey, null, 'Successfully read private key from store using SKI');
		t.equal(recoveredKey.isPrivate(), true, 'Test if the recovered key is a private key');

		return store.putKey(testPubKey);
	}).then((keyPEM) => {
		t.equal(fs.existsSync(path.join('/tmp/hfc-cks', testPrivKey.getSKI() + '-pub')), true,
			'Check that the public key has been saved with the proper <SKI>-pub index');

		return store.getKey(testPubKey.getSKI());
	}).then((recoveredKey) => {
		t.notEqual(recoveredKey, null, 'Successfully read public key from store using SKI');
		t.equal(recoveredKey.isPrivate(), true, 'Test if the recovered key is a private key');

		// delete the private key entry and test if getKey() would return the public key
		fs.unlinkSync(path.join('/tmp/hfc-cks', testPrivKey.getSKI() + '-priv'));
		return store.getKey(testPubKey.getSKI());
	}).then((recoveredKey) => {
		t.notEqual(recoveredKey, null, 'Successfully read public key from store using SKI');
		t.equal(recoveredKey.isPrivate(), false, 'Test if the recovered key is a public key');
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
	});

	t.end();
});