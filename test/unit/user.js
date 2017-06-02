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
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');

var memberName = 'Donald T. Duck';
var enrollmentID = 123454321;
var roles = ['admin', 'user'];
var memberCfg = {
	'enrollmentID': enrollmentID,
	'roles': roles
};

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

module.exports.TEST_CERT_PEM = TEST_CERT_PEM;

test('\n\n ** User - constructor set get tests **\n\n', function (t) {
	testutil.resetDefaults();

	utils.setConfigSetting('crypto-hsm', false);

	var member1 = new User(memberName);
	if (member1.getName() === memberName)
		t.pass('User constructor set get tests 1: new User getName was successful');
	else
		t.fail('User constructor set get tests 1: new User getName was not successful');

	member1.setRoles(roles);
	if (member1.getRoles() &&
		member1.getRoles().indexOf('admin') > -1 &&
		member1.getRoles().indexOf('user') > -1)
		t.pass('User constructor set get tests 1: setRoles getRoles was successful');
	else
		t.fail('User constructor set get tests 1: setRoles getRoles was not successful');

	t.throws(function() {
		member1.setEnrollment();
	},
	/Invalid parameter. Must have a valid private key/,
	'Test invalid enrollment without private key');

	t.throws(function() {
		member1.setEnrollment('');
	},
	/Invalid parameter. Must have a valid private key/,
	'Test invalid enrollment with empty private key');

	t.throws(function() {
		member1.setEnrollment('dummy');
	},
	/Invalid parameter. Must have a valid certificate/,
	'Test invalid enrollment without certificate');

	t.throws(function() {
		member1.setEnrollment('dummy', '');
	},
	/Invalid parameter. Must have a valid certificate/,
	'Test invalid enrollment with empty certificate');

	t.throws(function() {
		member1.setEnrollment('dummy', 'dummy');
	},
	/Invalid parameter. Must have a valid mspId/,
	'Test invalid enrollment with no mspId');

	t.throws(function() {
		member1.setEnrollment('dummy', 'dummy', null);
	},
	/Invalid parameter. Must have a valid mspId/,
	'Test invalid enrollment with null mspId');

	t.throws(function() {
		member1.setEnrollment('dummy', 'dummy', '');
	},
	/Invalid parameter. Must have a valid mspId/,
	'Test invalid enrollment with empty mspId');

	var member2 = new User(memberCfg);
	t.equals(member2.getCryptoSuite(), null, 'User getCryptoSuite should initially be null');

	if (member2.getName() === enrollmentID)
		t.pass('User constructor test 2: new User cfg getName was successful');
	else
		t.fail('User constructor test 2: new User cfg getName was not successful');

	if (member2.getRoles() &&
		member2.getRoles().indexOf('admin') > -1 &&
		member2.getRoles().indexOf('user') > -1)
		t.pass('User constructor test 2: new User cfg getRoles was successful');
	else
		t.fail('User constructor test 2: new User cfg getRoles was not successful');

	// test set enrollment for identity and signing identity
	var cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());
	cryptoUtils.generateKey()
	.then(function (key) {
		// the private key and cert don't match, but it's ok, the code doesn't check
		return member2.setEnrollment(key, TEST_CERT_PEM, 'DEFAULT');
	}).then(() => {
		var id = member2.getIdentity();

		t.equal(id._publicKey._key.pubKeyHex, '0452a75e1ee105da7ab3d389fda69d8a04f5cf65b305b49cec7cdbdeb91a585cf87bef5a96aa9683d96bbabfe60d8cc6f5db9d0bc8c58d56bb28887ed81c6005ac', 'User class setEnrollment() test');
		t.end();
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});
});
