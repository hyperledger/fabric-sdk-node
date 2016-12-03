/**
 * Copyright 2016 IBM All Rights Reserved.
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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
var path = require('path');
var testUtil = require('./util.js');
var utils = require('hfc/lib/utils.js');

var keyValStorePath = testUtil.KVS;


var FabricCOPServices = require('hfc-cop/lib/FabricCOPImpl');
var FabricCOPClient = FabricCOPServices.FabricCOPClient;

/**
 * FabricCOPClient enroll tests
 */
test('FabricCOPClient: Test enroll with missing parameters', function (t) {

	var client = new FabricCOPClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 8888
	});

	//
	return client.enroll()
		.then(function (csr) {
			t.fail('Enrollment must fail when missing required parameters');
		})
		.catch(function (err) {
			if (err.message.startsWith('Missing required parameters')) {
				t.pass('Enrollment should fail when missing required parameters');
			} else {
				t.fail('Enrollment should have failed with \'Missing required parameters\'');
			}
		});
});

var enrollmentID = 'sdk';
var enrollmentSecret = 'sdkpw';
var csr = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabriccop/enroll-csr.pem'));


test('FabricCOPClient: Test enroll', function (t) {

	var client = new FabricCOPClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 8888
	});

	//
	return client.enroll(enrollmentID,enrollmentSecret, csr)
		.then(function (csr) {
			t.comment(csr);
			t.pass('Successfully enrolled with enrollmentID \''+ enrollmentID + '\'');
		})
		.catch(function (err) {
			t.fail('Failed to enroll \'' + enrollmentID + '\'.  ' + err);
		});
});

/**
 * FabricCOPServices class tests
 */

//run the enroll test

test('FabricCOPServices: Test enroll()', function (t) {

	//
	// Create and configure the test chain
	//
	var chain = hfc.newChain('testChain-ca');

	// need to override the default key size 384 to match the member service backend
	// otherwise the client will not be able to decrypt the enrollment challenge
	utils.setConfigSetting('crypto-keysize', 256);

	chain.setKeyValueStore(hfc.newKeyValueStore({
		path: keyValStorePath
	}));

	var cop = new FabricCOPServices('http://localhost:8888');

	var req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	return cop.enroll(req)
		.then(
		function (enrollment) {
			console.log(enrollment.toString());
			t.pass('Successfully enrolled \'' + req.enrollmentID + '\'.');
		},
		function (err) {
			t.fail('Failed to enroll \'' + req.enrollmentID + '\'.  ' + err);
		}
		);

});
