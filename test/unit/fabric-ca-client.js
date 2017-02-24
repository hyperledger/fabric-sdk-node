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

testutil.resetDefaults();

var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
var FabricCAClient = FabricCAServices.FabricCAClient;

/**
 * FabricCAClient class tests
 */
//test constructor
test('FabricCAClient: Test constructor', function (t) {

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

	t.end();

});

//FabricCAClient _pemToDER tests
var ecertPEM = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabriccop/ecert.pem'));

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
			cop.register({enrollmentID: 'testUser'}, {});
		},
		/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
		'Must fail if registrar argument is not a User object'
	);

	cop.register({enrollmentID: 'testUser'}, { getSigningIdentity: function() { return 'dummy'; } })
	.then(() => {
		t.fail('Should not have been able to resolve this request');
		t.end();
	}).catch((err) => {
		t.pass('Successfully rejected register call due to invalid parameters');

		t.end();
	});
});

test('FabricCAServices: Test revoke() function', function(t) {
	var cop = new FabricCAServices('http://localhost:7054');

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
			cop.revoke({enrollmentID: null, aki: 'someId', serial: 'someId', reason: 0}, {getSigningIdentity: function() { return 'dummy'; }})
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

test('FabricCAServices: Test _parseURL() function', function (t) {

	var goodHost = 'www.example.com';
	var goodPort = 7054;
	var goodURL = 'http://' + goodHost + ':' + goodPort;
	var goodURLSecure = 'https://' + goodHost + ':' + goodPort;

	var badHost = '';
	var badURL = 'http://' + badHost + ':' + goodPort;
	var badURL2 = 'httpD://' + goodHost + ':' + goodPort;
	var badURL3 = 'httpsD://' + goodHost + ':' + goodPort;
	var badURL4 = goodHost + ':' + goodPort;


	t.plan(10);

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

	client.enroll()
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