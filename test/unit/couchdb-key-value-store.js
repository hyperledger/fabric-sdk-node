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
var CouchdbMock = require('mock-couch');

var CDBKVS = require('fabric-client/lib/impl/CouchDBKeyValueStore.js');

test('\n\n** CouchDBKeyValueStore tests', (t) => {
	t.throws(
		() => {
			new CDBKVS();
		},
		/Must provide the CouchDB database url to store membership data/,
		'Error checking in the constructor: missing opts'
	);

	t.throws(
		() => {
			new CDBKVS({dummy: 'value'});
		},
		/Must provide the CouchDB database url to store membership data/,
		'Error checking in the constructor: opts object missing required "url"'
	);

	var store;

	new CDBKVS({url: 'http://dummyUrl'})
	.then(() => {
		t.fail('Should not have been able to successfully constructed a store from an invalid URL');
		t.end();
	}).catch((err) => {
		if (err.message && err.message.indexOf('Error: getaddrinfo ENOTFOUND dummyurl') > 0) {
			t.pass('Successfully rejected the construction request due to invalid URL');
		} else {
			t.fail('Store construction failed for unknown reason: ' + err.stack ? err.stack : err);
		}

		var couchdb = CouchdbMock.createServer();
		couchdb.listen(5985);

		// override t.end function so it'll always disconnect the event hub
		t.end = ((context, mockdb, f) => {
			return function() {
				if (mockdb) {
					console.log('Disconnecting the mock couchdb server');
					mockdb.close();
				}

				f.apply(context, arguments);
			};
		})(t, couchdb, t.end);

		return new CDBKVS({url: 'http://localhost:5985'});
	}).then((st) => {
		store = st;
		t.pass('Successfully connected the key value store to couchdb at localhost:5985');

		t.notEqual(store._database, undefined, 'Check "_database" value of the constructed store object');

		return store.setValue('someKey', 'someValue');
	}).then((value) => {
		t.equal(value, 'someValue', 'Check result of setValue()');

		return store.getValue('someKey');
	}).then((value) => {
		t.equal(value, 'someValue', 'Check result of getValue()');
		t.end();
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});
});