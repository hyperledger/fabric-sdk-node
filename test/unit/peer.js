/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var Client = require('fabric-client');
var testUtil = require('./util.js');

var Peer = require('fabric-client/lib/Peer.js');

test('Peer test', function(t) {
	let peer = new Peer('grpc://127.0.0.1:5005');

	t.doesNotThrow(
		function () {
			peer.setName('name');
			peer.close();
		},
		null,
		'checking the peer setName() and close()'
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
		new Peer('xxxxx');
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
		new Peer();
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
	let peer = new Peer('grpc://127.0.0.1:5005');
	peer.sendProposal()
		.then(
			function() {
				t.fail('Should have noticed missing data.');
			},
			function(err) {
				t.pass('Successfully found missing data: ' + err);
				peer.close();
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined promise error function: ' + err);
		});
	peer.sendDiscovery()
		.then(
			function() {
				t.fail('Should have noticed missing discovery data.');
				t.end();
			},
			function(err) {
				t.pass('Successfully found missing discovery data: ' + err);
				peer.close();
				t.end();
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined discovery promise error function: ' + err);
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
	let peer = new Peer('grpc://127.0.0.1:51006');

	peer.sendProposal('some data')
		.then(
			function() {
				t.fail('Should have noticed a bad address.');
			},
			function(err) {
				t.equal(err.message, 'Failed to connect before the deadline',
					'sendProposal to unreachable peer should response connection failed');
				t.pass('Successfully found bad address!' + err);
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined promise error function: '
		+ err);
		});

	peer.sendDiscovery('some data')
		.then(
			function() {
				t.fail('Should have noticed a bad address.');
				t.end();
			},
			function(err) {
				t.equal(err.message, 'Failed to connect before the deadline',
					'sendProposal to unreachable peer should response connection failed');
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
	let peer = new Peer('grpc://localhost:7051');

	peer.sendProposal('some data', 1)
		.then(
			function() {
				t.fail('Should have noticed a timeout.');
			},
			function(err) {
				t.pass('Successfully got the timeout' + err);
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined promise error function: '
		+ err);
		});
	peer.sendDiscovery('some data', 1)
		.then(
			function() {
				t.fail('Should have noticed a discovery timeout.');
			},
			function(err) {
				t.pass('Successfully got the discovery timeout' + err);
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined discovery promise error function: '
		+ err);
		});

	const backup = Client.getConfigSetting('request-timeout');
	Client.setConfigSetting('request-timeout', 1);
	peer = new Peer('grpc://localhost:7051');

	peer.sendProposal('some data')
		.then(
			function() {
				t.fail('Should have noticed a timeout.');
			},
			function(err) {
				t.pass('Successfully got the timeout' + err);
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined promise error function: '
		+ err);
		});

	peer.sendDiscovery('some data')
		.then(
			function() {
				t.fail('Should have noticed a discovery timeout.');
				t.end();
			},
			function(err) {
				t.pass('Successfully got the discovery timeout' + err);
				t.end();
			}
		).catch(function(err) {
			t.fail('Caught Error: should not be here if we defined discovery promise error function: '
		+ err);
			t.end();
		});

	// put back the setting
	Client.setConfigSetting('request-timeout', backup);
});

test('Peer clientCert est', function(t) {
	var peer = new Peer('grpc://127.0.0.1:5005', {clientCert: 'some cert'});

	t.equals('some cert', peer.clientCert, 'checking client certificate on peer');

	t.end();
});
