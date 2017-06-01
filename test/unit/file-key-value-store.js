/**
 * Copyright 2016 IBM All Rights Reserved.
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
var rewire = require('rewire');

var path = require('path');
var util = require('util');
var testUtil = require('./util.js');
var fs = require('fs-extra');
var utils = require('fabric-client/lib/utils.js');

var FileKeyValueStore = require('fabric-client/lib/impl/FileKeyValueStore.js');

var keyValStorePath = path.join(testUtil.getTempDir(), 'kvsTemp');
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';
var store1 = '';

test('\n\n ** FileKeyValueStore - read and write test **\n\n', function (t) {
	testUtil.resetDefaults();

	// clean up
	if (testUtil.existsSync(keyValStorePath)) {
		fs.removeSync(keyValStorePath);
	}
	utils.newKeyValueStore({
		path: keyValStorePath
	})
	.then(
		function (store) {
			if (testUtil.existsSync(keyValStorePath)) {
				t.pass('FileKeyValueStore read and write test: Successfully created new directory for testValueStore');
			} else {
				t.fail('FileKeyValueStore read and write test: failed to create new directory for testValueStore');
				t.end();
			}
			store1 = store;
			return store.setValue(testKey, testValue);
		}
	).then(
		function (result) {
			if (result == testValue) {
				t.pass('FileKeyValueStore read and write test: Successfully set value');
			} else {
				t.fail('FileKeyValueStore read and write test: set value '+result+ 'does not match testValue '+testValue);
				t.end();
			}
			if (testUtil.existsSync(path.join(keyValStorePath, testKey))) {
				t.pass('FileKeyValueStore read and write test: Verified the file for key ' + testKey + ' does exist');

				return store1.getValue(testKey);
			} else {
				t.fail('FileKeyValueStore read and write test: Failed to create file for key ' + testKey);
				t.end();
			}
		},
		function (reason) {
			t.fail('FileKeyValueStore read and write test: Failed to set value, reason: ' + reason);
			t.end();
		}
	).then(
		// Log the fulfillment value
		function (val) {
			if (val != testValue)
				t.fail('FileKeyValueStore read and write test: get value ' + val + ' does not equal testValue of ' + testValue);
			else
				t.pass('FileKeyValueStore read and write test: Successfully retrieved value');

			// now test getValue() when the underlying directory get deleted
			fs.removeSync(keyValStorePath);
			return store1.getValue(testKey);
		},
		// Log the rejection reason
		function (reason) {
			t.fail('FileKeyValueStore read and write test: Failed getValue, reason: ' + reason);
			t.end();
		}
	).then(
		// Log the fulfillment value
		function (val) {
			if (val === null) {
				t.pass('FileKeyValueStore error check tests:  Delete store & getValue test. getValue() returns null as expected');
			} else {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue() should not have returned value: ' + val);
			}

			return new FileKeyValueStore({ path: keyValStorePath });
		},
		function (reason) {
			t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue caught unexpected error: ' + reason);
		}
	)
	.then(
		function (store) {
			// now test setValue() when the underlying directory get deleted
			fs.removeSync(keyValStorePath);
			return store.setValue(testKey, testValue);
		})
	.then(
		function (result) {
			t.fail('FileKeyValueStore error check tests:  Delete store & setValue test.  setValue() should have failed.');
			t.end();
		},
		function (reason) {
			t.pass('FileKeyValueStore error check tests:  Delete store & setValue test.  setValue() failed as expected: ' + reason);
			t.end();
		})
	.catch(
		function (err) {
			t.fail('Failed with unexpected error: ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n** FileKeyValueStore error check tests **\n\n', function (t) {

	t.throws(
		function () {
			new FileKeyValueStore();
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.throws(
		function () {
			new FileKeyValueStore({ dir: keyValStorePath });
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options.path should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.end();
});
