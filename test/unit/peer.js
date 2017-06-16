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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var hfc = require('fabric-client');
var sdkUtil = require('fabric-client/lib/utils.js');
var util = require('util');
var fs = require('fs');
var testUtil = require('./util.js');

var Peer = require('fabric-client/lib/Peer.js');

test('Peer test', function(t) {
	var peer = new Peer('grpc://127.0.0.1:5005');

	t.doesNotThrow(
		function () {
			peer.setName('name');
		},
		null,
		'checking the peer setName()'
	);
	t.equals('name', peer.getName(), 'checking getName on Peer');

	t.end();
});

//
// Peer happy path test are implemented as part of the end-to-end tests only
// because the Peer no longer accepts random data but requires all the payload
// header structure, making it impractical to carry out a happy path test outside
// of a proposal-transaction flow

//
// Peer bad address test
//
// Attempt to initialize an Peer with a bad URL address. An invalid protocol
// error is expected in this case.
//

test('Peer bad address test', function(t) {
	testUtil.resetDefaults();

	try {
		var client = new Peer('xxxxx');
		t.fail('Peer allowed setting a bad URL.');
	}
	catch(err) {
		t.pass('peer did not allow setting bad URL.');
	}
	t.end();
});

//
// Peer missing address test
//
// Attempt to initialize an Peer with a missing URL address. A TypeError
// indicating that the URL must be a "string" is expected in this case.
//

test('Peer missing address test', function(t) {
	try {
		var client = new Peer();
		t.fail('Peer allowed setting a missing address.');
	}
	catch(err) {
		t.pass('Peer did not allow setting a missing address.');
	}
	t.end();
});

//
// Peer missing data test
//
// Send an empty broadcast message to an Peer. An error indicating that no
// data was sent is expected in this case.
//

test('Peer missing data test', function(t) {
	var client = new Peer('grpc://127.0.0.1:5005');

	client.sendProposal()
	.then(
		function(status) {
			t.fail('Should have noticed missing data.');
			t.end();
		},
		function(err) {
			t.pass('Successfully found missing data: ' + err);
			t.end();
		}
	).catch(function(err) {
		t.fail('Caught Error: should not be here if we defined promise error function: ' + err);
		t.end();
	});
});

//
// Peer unknown address  test
//
// Send a message to a bad Peer address. An error indicating
// a connection failure is expected in this case.
//

test('Peer unknown address test', function(t) {
	var client = new Peer('grpc://127.0.0.1:51006');

	client.sendProposal('some data')
	.then(
		function(status) {
			t.fail('Should have noticed a bad address.');
			t.end();
		},
		function(err) {
			t.pass('Successfully found bad address!' + err);
			t.end();
		}
	).catch(function(err) {
		t.fail('Caught Error: should not be here if we defined promise error function: '
		+ err);
		t.end();
	});
});

//
//Peer timeout  test
//
//Send a message to a running Peer address. An error indicating
//a timeout failure is expected in this case.
//

test('Peer timeout test', function(t) {
	// this does require a running network. This test does not really
	// test the timeout, but does show that it does not cause any issues
	hfc.setConfigSetting('request-timeout', 20);
	var client = new Peer('grpc://localhost:7051');

	client.sendProposal('some data')
	.then(
		function(status) {
			t.fail('Should have noticed a timeout.');
			t.end();
		},
		function(err) {
			t.pass('Successfully got the timeout' + err);
			t.end();
		}
	).catch(function(err) {
		t.fail('Caught Error: should not be here if we defined promise error function: '
		+ err);
		t.end();
	});
	hfc.setConfigSetting('request-timeout', 30000);
});
