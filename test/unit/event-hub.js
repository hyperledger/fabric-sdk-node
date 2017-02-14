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

testutil.resetDefaults();

var EventHub = require('fabric-client/lib/EventHub.js');

test('\n\n** EventHub tests\n\n', (t) => {
	var eh = new EventHub();

	t.throws(
		() => {
			eh.connect();
		},
		/Must set peer address before connecting/,
		'Must not allow connect() when peer address has not been set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('badUrl');
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Must not allow a bad url without protocol to be set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('http://badUrl');
		},
		/InvalidProtocol: Invalid protocol: http/,
		'Must not allow an http url to be set'
	);

	t.throws(
		() => {
			eh.setPeerAddr('https://badUrl');
		},
		/InvalidProtocol: Invalid protocol: https/,
		'Must not allow an https url to be set'
	);

	t.doesNotThrow(
		() => {
			eh.setPeerAddr('grpc://localhost:7053');
		},
		null,
		'Test valid url connect and disconnect'
	);

	eh.registerTxEvent('dummyId', () => {
		// dummy function
	});

	t.equal(eh.txRegistrants.size(), 1, 'txRegistrants size should be 1 after registering a transaction event listener');

	t.end();
});