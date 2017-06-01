/**
 * Copyright 2017 IBM All Rights Reserved.
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

var TransactionID = require('fabric-client/lib/TransactionID.js');
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var testutil = require('./util.js');

var enrollmentID = 123454321;
var roles = ['admin', 'user'];
var memberCfg = {
	'enrollmentID': enrollmentID,
	'roles': roles
};

var TEST_CERT_PEM = require('./user.js').TEST_CERT_PEM;

test('\n\n ** Transaction - constructor set get tests **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(function() {
		new TransactionID();
	},
	/Missing userContext parameter/,
	'Test Missing userContext parameter');

	t.throws(function() {
		new TransactionID({});
	},
	/Parameter "userContext" must be an instance of the "User" class/,
	'Test Parameter "userContext" must be an instance of the "User" class');

	var member = new User('admin');
	// test set enrollment for identity and signing identity
	var cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.generateKey({ephemeral : true})
	.then(function (key) {
		// the private key and cert don't match, but it's ok, the code doesn't check
		return member.setEnrollment(key, TEST_CERT_PEM, 'DEFAULT');
	}).then(() =>{
		var trans_id = new TransactionID(member);
		t.pass('Successfully created a new TransactionID');
		t.end();
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});

});