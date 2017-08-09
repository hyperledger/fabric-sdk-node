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
var fs = require('fs');
var path = require('path');
var util = require('util');
var rewire = require('rewire');

var FabricCAServices = rewire('fabric-ca-client/lib/FabricCAClientImpl');
var FabricCAClient = FabricCAServices.FabricCAClient;

const SAMPLE_PEM_ENCODED_CERTIFICATE = '-----BEGIN CERTIFICATE-----' +
	'MIIBbDCCARKgAwIBAwICA+gwCgYIKoZIzj0EAwIwEzERMA8GA1UEAwwIcGVlck9y' +
	'zAwHhcNMTcwMjIwMTkwNjEwWhcNMTgwMjIwMTkwNjEwWjATMREwDwYDVQQDDAhw' +
	'ZWVyT3JnMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKJfDc/CcaiHRipTG2AB' +
	'K5fA0LO9SOlbtC9bZcjLo/xsL157p+3QB3UVF3gt7nkwgMs/ul3FhSEFTk2EVNlF' +
	'1QCjVjBUMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFFQzuQR1RZP/Qn/B' +
	'NDtGSa8n4eN/MB8GA1UdIwQYMBaAFFQzuQR1RZP/Qn/BNDtGSa8n4eN/MAoGCCqG' +
	'SM49BAMCA0gAMEUCIAuG+/Fy3x9JXAD1/rFsu3ZpCKbXiXZLGF7P6Gma8is5AiEA' +
	'pSQpRcdukxe4zvcfRmNBjMbNLWCoWlHSQA2jD678QGE=' +
	'-----END CERTIFICATE-----';

/**
 * FabricCAClient class tests
 */
//test constructor
test('FabricCAClient: Test constructor', function (t) {
	testutil.resetDefaults();

	var connectOpts = {};

	t.throws(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Protocol must be set to 'http' or 'https'/,
		'Throw error for missing protocol'
	);

	connectOpts.protocol = 'dummy';

	t.throws(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Protocol must be set to 'http' or 'https'/,
		'Throw error for invalid protocol'
	);

	connectOpts.protocol = 'http';
	connectOpts.hostname = 'hostname';

	t.doesNotThrow(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Protocol must be set to 'http' or 'https'/,
		'HTTP is a valid protocol'
	);

	connectOpts.protocol = 'https';

	t.doesNotThrow(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Protocol must be set to 'http' or 'https'/,
		'HTTPS is a valid protocol'
	);

	delete connectOpts.hostname;

	t.throws(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Hostname must be set/,
		'Throw error for missing hostname'
	);

	connectOpts.hostname = 'hostname';

	t.doesNotThrow(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Port must be an integer/,
		'Should not throw error if port is not set'
	);

	connectOpts.port = '7054';

	t.throws(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Port must be an integer/,
		'Throw error for invalid port'
	);

	connectOpts.port = 7054;

	t.doesNotThrow(
		function () {
			let client = new FabricCAClient(connectOpts);
		},
		/Invalid connection options.  Port must be an integer/,
		'Integer is a valid type for port'
	);

	// Add TLS options to the client -- all default values
	connectOpts.tlsOptions = {};
	{
		let client = null;
		t.doesNotThrow(
			function () {
				client = new FabricCAClient(connectOpts);
			},
			/Invalid connection options. /,
			'Add tlsOptions to client connect_opts -- all default values'
		);
		t.true(client._tlsOptions.verify, 'Check default tlsOptions.verify');
		t.true(client._tlsOptions.trustedRoots.length === 0,
			'Check default tlsOptions.trustedRoots');
	}

	// Add TLS options to the client -- specify fields
	connectOpts.tlsOptions = {verify: true, trustedRoots: [SAMPLE_PEM_ENCODED_CERTIFICATE]};
	{
		let client = null;
		t.doesNotThrow(
			function () {
				client = new FabricCAClient(connectOpts);
			},
			/Invalid connection options. /,
			'Add tlsOptions to client connect_opts -- non default values'
		);
		t.true(client._tlsOptions.verify, 'Check specified tlsOptions.verify');
		t.equal(client._tlsOptions.trustedRoots.length, 1,
			'Check size of tlsOptions.trustedRoots[]');
		t.equal(client._tlsOptions.trustedRoots[0], SAMPLE_PEM_ENCODED_CERTIFICATE,
			'Check specified tlsOptions.trustedRoots[] value');
	}
	// Add TLS options to the client -- verify is false
	connectOpts.tlsOptions = {verify: false, trustedRoots: [SAMPLE_PEM_ENCODED_CERTIFICATE]};
	{
		let client = null;
		t.doesNotThrow(
			function () {
				client = new FabricCAClient(connectOpts);
			},
			/Invalid connection options. /,
			'Add tlsOptions to client connect_opts -- non default values'
		);
		t.false(client._tlsOptions.verify, 'Check specified tlsOptions.verify');
		t.equal(client._tlsOptions.trustedRoots.length, 1,
			'Check size of tlsOptions.trustedRoots[]');
		t.equal(client._tlsOptions.trustedRoots[0], SAMPLE_PEM_ENCODED_CERTIFICATE,
			'Check specified tlsOptions.trustedRoots[] value');
	}
	t.end();

});

//FabricCAClient _pemToDER tests
var ecertPEM = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabricca/ecert.pem'));

test('FabricCAClient: Test _pemToDer static method',function(t){

	t.plan(2);

	//call function with garbage
	t.throws(
		function(){
			var hex = FabricCAClient.pemToDER('garbage');
		},
		/Input parameter does not appear to be PEM-encoded./,
		'Throw an error when input is not PEM-encoded'
	);

	try {
		var hex = FabricCAClient.pemToDER(ecertPEM.toString());
		t.pass('Sucessfully converted ecert from PEM to DER');
	} catch(err) {
		t.fail('Failed to convert PEM to DER due to ' + err);
	}

	t.end();
});

// Test newCryptoSuite() function
test('FabricCAServices:  Test newCryptoSuite() function', function(t) {
	var	tlsOptions = {
		trustedRoots: [],
		verify: false
	};
	var CAClient = require('fabric-ca-client');

 	var crypto = CAClient.newCryptoSuite({software: true, keysize: 384});

 	var client = new CAClient('http://localhost:7054', tlsOptions, 'peerOrg1', crypto);
 	client.setCryptoSuite(crypto);

	var crypto = client.getCryptoSuite();

	if (crypto) {
		t.pass('Successfully called getCryptoSuite()');
	}
	else {
		t.fail('getCryptoSuite() did not return an object');
	}
	t.end();
});

// Test newCryptoKeyStore() function
test('FabricCAServices:  Test newCryptoKeyStore() function', function(t) {
	var	tlsOptions = {
		trustedRoots: [],
		verify: false
	};
	var CAClient = require('fabric-ca-client');

 	var crypto = CAClient.newCryptoSuite({software: true, keysize: 384});
	var keyValStorePath = path.join(testutil.getTempDir(), 'kvsTemp');
	if (!crypto._cryptoKeyStore) {
		t.pass('cryptoKeyStore is not set on a new cryptoSuite');
	} else {
		t.fail('cryptoKeyStore should not be set on a new cryptoSuite');
	}

	var cks = CAClient.newCryptoKeyStore({path:keyValStorePath});
	crypto.setCryptoKeyStore(cks);

 	var client = new CAClient('http://localhost:7054', tlsOptions, 'peerOrg1', crypto);
 	client.setCryptoSuite(crypto);

	var crypto = client.getCryptoSuite();

	if (crypto && crypto._cryptoKeyStore) {
		t.pass('Successfully called getCryptoSuite() with cryptoKeyStore set');
	}
	else {
		if (!crypto) {
			t.fail('getCryptoSuite() did not return an object');
		} else {
			t.fail('getCryptoSuite() should contain a cryptoKeyStore');
		}
	}
	t.end();
});

// Test getCryptoSuite() function
test('FabricCAServices:  Test getCryptoSuite() function', function(t) {
	var ca = new FabricCAServices('http://localhost:7054');
	var crypto = ca.getCryptoSuite();

	if (crypto) {
		t.pass('Successfully called getCrypto()');
	}
	else {
		t.fail('getCryptoSuite() did not return an object');
	}
	t.end();
});

test('FabricCAServices: Test register() function', function(t) {
	var cop = new FabricCAServices('http://localhost:7054');

	t.throws(
		() => {
			cop.register();
		},
		/Missing required argument "request"/,
		'Must fail if missing request argument'
	);
	t.throws(
		() => {
			cop.register({});
		},
		/Missing required argument "request.enrollmentID"/,
		'Must fail if missing request.enrollmentID argument'
	);
	t.throws(
		() => {
			cop.register({dummy: 'value'});
		},
		/Missing required argument "request.enrollmentID"/,
		'Must fail if missing request argument'
	);
	t.throws(
		() => {
			cop.register({enrollmentID: 'testUser'});
		},
		/Missing required argument "registrar"/,
		'Must fail if missing registrar argument'
	);
	t.throws(
		() => {
			cop.register({enrollmentID: 'testUser3', maxEnrollments: null}, {});
		},
		/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
		'Must fail if registrar argument is not a User object'
	);

	return cop.register({enrollmentID: 'testUser'}, { getSigningIdentity: function() { return 'dummy'; } })
	.then(() => {
		t.fail('Should not have been able to resolve this request');
		t.end();
	}).catch((err) => {
		t.pass('Successfully rejected register call due to invalid parameters');

		t.end();
	});
});



/*
**
 * FabricCAServices enroll tests
 */
test('FabricCAServices: Test enroll with missing parameters', function (t) {

	var ca = new FabricCAServices('http://localhost:7054');
	var req = null;

	ca.enroll()
	.then(
		function (key, cert) {
			t.fail('Enroll() must fail when missing required parameters');
			t.end();
		},
		function (err) {
			t.equal(err.message , 'Missing required argument "request"',
				'Verify error message returned by enroll()');
			t.end();
		}
	)
	.catch(function (err) {
		t.fail('Unexpected result from enroll()');
		t.end();
	});

	ca.enroll({})
	.then(
		function () {
			t.fail('Enroll() must fail when req does not specify enrollment ID');
			t.end();
		},
		function (err) {
			t.equal(err.message , 'req.enrollmentID is not set',
				'Verify error message returned by enroll(no enrollment ID)');
			t.end();
		}
	)
	.catch(function (err) {
		t.fail('Unexpected failure of enroll()');
		t.end();
	});

	ca.enroll({enrollmentID: 'testUser'})
	.then(
		function () {
			t.fail('Enroll() must fail when req does not specify enrollment secret');
			t.end();
		},
		function (err) {
			t.equal(err.message , 'req.enrollmentSecret is not set',
				'Verify error message returned by enroll(no enrollment secret)');
			t.end();
		}
	)
	.catch(function (err) {
		t.fail('Unexpected failure of enroll(no enrollment secret)');
		t.end();
	});
});

test('FabricCAServices: Test revoke() function', function(t) {
	var cop = new FabricCAServices('http://localhost:7054');
	t.throws(
		() => {
			cop.revoke();
		},
		/Missing required argument "request"/,
		'Test missing request'
	);

	t.throws(
		() => {
			cop.revoke({enrollmentID: null, aki: null, serial: '', reason: 0});
		},
		/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/,
		'Test missing both enrollmentID and aki/serial'
	);
	t.throws(
		() => {
			cop.revoke({enrollmentID: null, aki: 'someId', serial: '', reason: 0});
		},
		/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/,
		'Test having valid "aki" but missing "serial"'
	);
	t.throws(
		() => {
			cop.revoke({enrollmentID: null, aki: '', serial: 'someId', reason: 0});
		},
		/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/,
		'Test having valid "serial" but missing "aki"'
	);
	t.throws(
		() => {
			cop.revoke({enrollmentID: null, aki: 'someId', serial: 'someId', reason: 0}, {});
		},
		/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
		'Test invalid "signingIdentity"'
	);
	t.doesNotThrow(
		() => {
			return cop.revoke({enrollmentID: null, aki: 'someId', serial: 'someId', reason: 0}, {getSigningIdentity: function() { return 'dummy'; }})
			.then(() => {
				t.fail('Should not have been able to successfully resolved the revoke call');
				t.end();
			}).catch(() => {
				t.pass('Successfully rejected the request to revoke due to invalid parameters');
				t.end();
			});
		},
		null,
		'Test invalid "signingIdentity"'
	);
});

var CERT_WITHOUT_CN = '-----BEGIN CERTIFICATE-----' +
'MIIFjzCCA3egAwIBAgIJAOLWW2j2g36vMA0GCSqGSIb3DQEBCwUAMF4xCzAJBgNV' +
'BAYTAlVTMRcwFQYDVQQIDA5Ob3J0aCBDYXJvbGluYTEPMA0GA1UEBwwGRHVyaGFt' +
'MRQwEgYDVQQKDAtIeXBlcmxlZGdlcjEPMA0GA1UECwwGRmFicmljMB4XDTE3MDMy' +
'OTA0MTc0OFoXDTE4MDMyOTA0MTc0OFowXjELMAkGA1UEBhMCVVMxFzAVBgNVBAgM' +
'Dk5vcnRoIENhcm9saW5hMQ8wDQYDVQQHDAZEdXJoYW0xFDASBgNVBAoMC0h5cGVy' +
'bGVkZ2VyMQ8wDQYDVQQLDAZGYWJyaWMwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAw' +
'ggIKAoICAQC/1MwnAefSeTNtUtQSEoH/KiFR3kEWPpBdG5BwMsf5p8X67jBIZoQZ' +
'8NG3iOjF/H3kUbOw3YdrJ7ow+Pq1q5siyYweW2NZKj6cHkkHzrohJkvDTLE7nCwf' +
'OPp/j2Rsk44J0v2v9B5wWCSzjmwJMTIul9PYEc3OkivuwxOMu8RZ7ocWriI6nbs3' +
'42Z1vIgDsJTOrKNfluqL6xHbQvSUPNikIqsrnIHRLsFZIahfmxA9mmRW75u76oiu' +
'JIgbqGnItcxD0092KoBBVbB5/2SSC9tBGDdFaF3aPlRQkllN1sHDt689zZ1TbYd/' +
'NlVC0SKJwaLyKjYpjOZMYYhoDYJoq84yF33vsn5q9zdiGhF48XHjx69QTnp8MHuo' +
'5AyJYXHG+6MXuRrmi9YOMmTGyp6kRkJh/E8PDO+rMMSuqNFNQGGKJMnC08N2o0EO' +
'xo11uSwdSDiguUNTLnL2lAK0U7MbpnwdP4u3E4riRUIUhjN8CfWKGKe9bR3YyIZg' +
'ig3Y+reTI+bMnZ9E/bqghikApS+tawAy7m9EgWf1jkrsBiudd21qE+THLX2X2zh4' +
'+kL+MhoE1+Tat8nCBhvR/adxKKmqy+tT2GAQMKf+f35sqN+twI/aiwn8jv1KxQLt' +
'PFmHaoNJUDwnGjNk09QFkMNRulhwHXXMf/FO/dyKYb1USpYLT+SQHwIDAQABo1Aw' +
'TjAdBgNVHQ4EFgQU3H7zu+z+t0MJ/PrnPvp/SZk20agwHwYDVR0jBBgwFoAU3H7z' +
'u+z+t0MJ/PrnPvp/SZk20agwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOC' +
'AgEAYj9VrdQlSzCVBxgEizl/H92Loov/5CPxRBqkBAWi+09NrUNnvIQcmMMbbIXe' +
'nXo2/egPM0z8cxJH3CfVFomHfQFiquWvm25L/38PAYjoOLDEwGHl3J7q9NXiAMft' +
'glMcef+IhVXCoayFxhMlxmN13bPYN/vLAAFasDU5ElhZTEH5DEUTV4ku9q0FsF2f' +
'fG6TXk++fVjUA5ykYo+megb0D39uBUE1E6CHLPuFrOrjWBRIf7CP8hWEwIwvJYKh' +
'x1iz6INS6Zu/juTTcAD1jMjnAPy2nz2VbEQc/LNtFEi0E7s9dJvYItLwk7NMYAAg' +
'DbWcEARwRtJCbcb/53j2fQyN7XNIAo58Oioa7rsINX6oy4F0XCKToF3FpTvXF8pn' +
'0Mu65Q7XYfeMyNBhbdrvXVwL2jeIHMM0clVz4W2k8BNpvy/KBU6fai3xwfIjqDtl' +
'aGzPELag9dwLOERJ5rLF5hQfRpok3ntZvBFq3nONfQ/o3qK5TyE3dTEGPG1/8nY3' +
'qYFLWCZ1XvCo1bQ+Ujm0WdWrgggAEwov07m1SnSeBactg0YKUd+KI5EkDbSMuGyG' +
'Pe6+emu31ygH9hiCNQ9XoRJDHsZpbenyqpGRKPw+F9jqjR/Z2CjCluDqqBCyDkAB' +
'HSiaITVCUB0ecS/2d4DyIBf/His2WR5+rEbctl8INrdFaM4=' +
'-----END CERTIFICATE-----';

var VALID_CERT = '-----BEGIN CERTIFICATE-----' +
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

var VALID_CERT1 = '-----BEGIN CERTIFICATE-----\n' +
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
'BAHpeA==\n' +
'-----END CERTIFICATE-----';

var VALID_CERT2 = '-----BEGIN CERTIFICATE-----\n' +
'MIIB7TCCAZSgAwIBAgIUWNR5HJQyrzJ0aHgXRrdoBmQoZCUwCgYIKoZIzj0EAwIw\n' +
'cDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh\n' +
'biBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xGTAXBgNVBAMT\n' +
'EG9yZzEuZXhhbXBsZS5jb20wHhcNMTcwNTEwMDE1NDAwWhcNMTgwNDA4MDk1NDAw\n' +
'WjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABDKv\n' +
'/P/qWWgCmpy/3La1GEtIasDLNmSgXaptmcNJQmLzUC4oqY1hHsdoSqVXl2kC8wWa\n' +
'37Tt/mR0aa1rUIvC3TmjbDBqMA4GA1UdDwEB/wQEAwICBDAMBgNVHRMBAf8EAjAA\n' +
'MB0GA1UdDgQWBBRn3bJEh7/z/fcL2tX4v3EfOacd5DArBgNVHSMEJDAigCCiLa81\n' +
'ayqrV5LqU+NfZvzO8dfxqis6K5Lb+/lqRI6iajAKBggqhkjOPQQDAgNHADBEAiBl\n' +
'In4FyyFHZVU8uGZDqufNXxQU2skYDZDVYP+y5HTi0wIgHwX3UWwHU/9XEerDLV7M\n' +
'jTSXP2wxocvyk8upDrUD9XI=\n' +
'-----END CERTIFICATE-----\n';

test('FabricCAServices: Test reenroll() function', function(t) {
	var cop = new FabricCAServices('http://localhost_bad:7054');

	t.throws(
		() => {
			cop.reenroll();
		},
		/Invalid re-enroll request, missing argument "currentUser"/,
		'Must throw error when missing current user'
	);

	t.throws(
		() => {
			cop.reenroll({});
		},
		/Invalid re-enroll request, "currentUser" is not a valid User object, missing "getIdentity\(\)" method/,
		'Must throw error when current user is not a valid User object'
	);

	t.throws(
		() => {
			cop.reenroll({ getIdentity: function() {} });
		},
		/Invalid re-enroll request, "currentUser" is not a valid User object, missing "getSigningIdentity\(\)" method/,
		'Must throw error when current user is not a valid User object'
	);

	t.throws(
		() => {
			cop.reenroll({
				getIdentity: function() {
					return { _certificate: CERT_WITHOUT_CN };
				},
				getSigningIdentity: function() {}
			});
		},
		/Failed to parse the enrollment certificate of the current user for its subject/,
		'Must throw error when current user enrollment certificate does not have a "CN" value'
	);

	var getSubjectCommonName = FabricCAServices.__get__('getSubjectCommonName');

	t.throws(
		() => {
			getSubjectCommonName(CERT_WITHOUT_CN);
		},
		/Certificate PEM does not seem to contain a valid subject with common name "CN"/,
		'Must throw error when target certificate does not contain a common name'
	);

	t.doesNotThrow(
		() => {
			getSubjectCommonName(VALID_CERT);
		},
		null,
		'Must not throw error when target certificate is valid and contains a common name'
	);

	t.doesNotThrow(
		() => {
			return cop.reenroll({
				getIdentity: function() {
					return { _certificate: VALID_CERT };
				},
				getSigningIdentity: function() {
					return { _certificate: VALID_CERT };
				}
			}).catch((err) => {
				var msg = err.message ? err.message : err;
				if (err.message && err.message.indexOf('signingIdentity.sign is not a function') >= 0)
					t.pass('Properly failed due to mockup user object missing signer');
				else
					t.fail(err);
			});
		},
		null,
		'Must not throw error when current user is valid'
	);

	t.end();
});

test('FabricCAServices: Test static method normalizeX509()', function (t) {
	testNormalizer(VALID_CERT, t);
	testNormalizer(VALID_CERT1, t);
	testNormalizer(VALID_CERT2, t);
	t.end();
});

function testNormalizer(cert, t) {
	var normalized = FabricCAServices.normalizeX509(cert);
	var matches = normalized.match(/\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-\n/);
	t.equals(matches.length, 1, 'Check that the normalized CERT has the standalone start line');
	matches = normalized.match(/\n\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-/);
	t.equals(matches.length, 1, 'Check that the normalized CERT has the standalone end line');
}

test('FabricCAServices: Test _parseURL() function', function (t) {

	var goodHost = 'www.example.com';
	var goodPort = 7054;
	var goodURL = 'http://' + goodHost + ':' + goodPort;
	var goodURLSecure = 'https://' + goodHost + ':' + goodPort;
	var goodUrlNoPort = 'https://' + goodHost;

	var badHost = '';
	var badURL = 'http://' + badHost + ':' + goodPort;
	var badURL2 = 'httpD://' + goodHost + ':' + goodPort;
	var badURL3 = 'httpsD://' + goodHost + ':' + goodPort;
	var badURL4 = goodHost + ':' + goodPort;
	var badURL5 = 'ftp://' + goodHost + ':' + goodPort;


	t.plan(12);

	//valid http endpoint
	var endpointGood = FabricCAServices._parseURL(goodURL);
	t.equals(endpointGood.protocol, 'http', 'Check that protocol is set correctly to \'http\'');
	t.equals(endpointGood.hostname, goodHost, 'Check that hostname is set correctly');
	t.equals(endpointGood.port, goodPort, 'Check that port is set correctly');

	//valid https endpoint
	var endpointGoodSecure = FabricCAServices._parseURL(goodURLSecure);
	t.equals(endpointGoodSecure.protocol, 'https', 'Check that protocol is set correctly to \'https\'');
	t.equals(endpointGoodSecure.hostname, goodHost, 'Check that hostname is set correctly');
	t.equals(endpointGoodSecure.port, goodPort, 'Check that port is set correctly');

	var endpointGoodUrlNoPort = FabricCAServices._parseURL(goodUrlNoPort);
	t.notOk(endpointGoodUrlNoPort.port, 'Check default port value');

	//check invalid endpoints
	t.throws(
		function () {
			FabricCAServices._parseURL(badURL);
		},
		/InvalidURL: missing hostname./,
		'Throw error for missing hostname'
	);

	t.throws(
		function () {
			FabricCAServices._parseURL(badURL2);
		},
		/InvalidURL: url must start with http or https./,
		'Throw error for invalid protocol'
	);

	t.throws(
		function () {
			FabricCAServices._parseURL(badURL3);
		},
		/InvalidURL: url must start with http or https./,
		'Throw error for invalid protocol'
	);

	t.throws(
		function () {
			FabricCAServices._parseURL(badURL3);
		},
		/InvalidURL: url must start with http or https./,
		'Throw error for missing protocol'
	);

	t.throws(
		function () {
			FabricCAServices._parseURL(badURL5);
		},
		/InvalidURL: url must start with http or https./,
		'Throw error for invalid protocol'
	);

	t.end();
});

test('FabricCAServices: Test toString() function', function(t) {
	var ca = new FabricCAServices('http://localhost:7054');
	var printableCa = ca.toString();

	if ((typeof printableCa == 'string') && (printableCa.length > 1)) {
		t.pass('toString() returned a string of length ' + printableCa.length);
	}
	else {
		t.fail('toString() did not return a string');
	}
	t.end();
});

/**
 * FabricCAClient enroll tests
 */
test('FabricCAClient: Test enroll with missing parameters', function (t) {

	var client = new FabricCAClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 7054
	});

	return client.enroll()
	.then(function (csr) {
		t.fail('Enrollment must fail when missing required parameters');
		t.end();
	})
	.catch(function (err) {
		if (err.message.startsWith('Missing required parameters')) {
			t.pass('Enrollment should fail when missing required parameters');
		} else {
			t.fail('Enrollment should have failed with \'Missing required parameters\'');
		}

		t.end();
	});
});

/**
 * FabricCAClient register tests
 */
test('FabricCAClient: Test register with missing parameters', function (t) {

	var client = new FabricCAClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 7054
	});

	t.throws(
		() => {
			client.register();
		},
		/Missing required parameters/,
		'Test missing all parameters'
	);

	t.end();
});

/**
 * FabricCAClient revoke tests
 */
test('FabricCAClient: Test revoke with missing parameters', function (t) {

	var client = new FabricCAClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 7054
	});

	t.throws(
		() => {
			client.revoke();
		},
		/Missing required parameters/,
		'Test missing all parameters'
	);

	t.end();
});