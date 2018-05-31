/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var TransactionID = require('fabric-client/lib/TransactionID.js');
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var testutil = require('./util.js');

var TEST_CERT_PEM = require('./user.js').TEST_CERT_PEM;

test('\n\n ** Transaction - constructor set get tests **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(function() {
		new TransactionID();
	},
	/Missing userContext or signing identity parameter/,
	'Test Missing signer parameter');

	var member = new User('admin');
	// test set enrollment for identity and signing identity
	var cryptoUtils = utils.newCryptoSuite();
	cryptoUtils.generateKey({ephemeral : true})
	.then(function (key) {
		// the private key and cert don't match, but it's ok, the code doesn't check
		return member.setEnrollment(key, TEST_CERT_PEM, 'DEFAULT');
	}).then(() =>{
		var trans_id = new TransactionID(member.getSigningIdentity());
		t.pass('Successfully created a new TransactionID');
		t.equals(trans_id.isAdmin(), false, ' should have false admin');
		trans_id = new TransactionID(member.getSigningIdentity(), true);
		t.equals(trans_id.isAdmin(), true, ' should have true admin');

		t.end();
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});

});
