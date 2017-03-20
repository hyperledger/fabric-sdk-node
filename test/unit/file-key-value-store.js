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
testUtil.resetDefaults();

var keyValStorePath = path.join(getUserHome(), 'kvsTemp');
//Note: unix relative path does not start with '/'
//windows relative path starts with '/'
var keyValStorePath1 = 'tmp/keyValStore1';
var keyValStorePath2 = '/tmp/keyValStore2';
var keyValStorePath3 = '/tmp/keyValStore3';
var keyValStorePath4 = '/tmp/keyValStore4';
var keyValStorePath5 = '/tmp/keyValStore5';
var keyValStorePath6 = '/tmp/keyValStore6';
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';
var store1 = '';
var store2 = '';
var store3 = '';
var store4 = '';

test('\n\n ** FileKeyValueStore - read and write test **\n\n', function (t) {
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

			t.end();
		},
		// Log the rejection reason
		function (reason) {
			t.fail('FileKeyValueStore read and write test: Failed getValue, reason: ' + reason);
			t.end();
		}
	).catch(
		function (err) {
			t.fail('FileKeyValueStore read and write test, err: ' + err);
			t.end();
		}
	);
});

test('\n\n ** FileKeyValueStore - constructor setValue getValue test store1 **\n\n', function (t) {
	cleanupFileKeyValueStore(keyValStorePath1);
	cleanupFileKeyValueStore(keyValStorePath2);

	var promise1 = new FileKeyValueStore({ path: getRelativePath(keyValStorePath1) })
	.then(
		function(store) {
			var exists = testUtil.existsSync(getAbsolutePath(keyValStorePath1));
			if (exists)
				t.pass('FileKeyValueStore constructor test:  Successfully created new directory');
			else
				t.fail('FileKeyValueStore constructor test:  Failed to create new directory: ' + keyValStorePath1);

			store1 = store;
			return store.setValue(testKey, testValue);
		}
	).then(
		function (result) {
			t.pass('FileKeyValueStore store1 setValue test:  Successfully set value');
			if (result == testValue) {
				t.pass('FileKeyValueStore store1 setValue test store1');
			} else {
				t.fail('FileKeyValueStore store1 setValue test store1, result '+result+' does not match testValue '+testValue);
				t.end();
			}
			return store1.getValue(testKey);
		}
	).then(
		function (val) {
			if (val != testValue)
				t.fail('FileKeyValueStore read and write test store1: get value ' + val + ' does not equal testValue of ' + testValue);
			else
				t.pass('FileKeyValueStore read and write test store1: Successfully retrieved value');

			t.end();
		}
	).catch (
		function(err) {
			t.fail('FileKeyValueStore store1 setValue test store1, caught err: ' + err);
			t.end();
		}
	);
});

test('\n\n ** FileKeyValueStore - constructor setValue getValue test store2 **\n\n', function (t) {
	cleanupFileKeyValueStore(keyValStorePath2);

	var promise2 = new FileKeyValueStore({ path: getRelativePath(keyValStorePath2) })
	.then(
		function(store) {
			var exists = testUtil.existsSync(getAbsolutePath(keyValStorePath2));
			if (exists)
				t.pass('FileKeyValueStore constructor test store2:  Successfully created new directory');
			else
				t.fail('FileKeyValueStore constructor test store2:  Failed to create new directory: ' + keyValStorePath2);

			store2 = store;
			return store.setValue(testKey, testValue);
		}
	).then(
		function (result) {
			t.pass('FileKeyValueStore store2 setValue test:  Successfully set value');
			if (result == testValue) {
				t.pass('FileKeyValueStore store2 setValue test store2');
			} else {
				t.fail('FileKeyValueStore store2 setValue test store2, result '+result+' does not match testValue '+testValue);
				t.end();
			}
			return store2.getValue(testKey);
		}
	).then(
		function (val) {
			if (val != testValue)
				t.fail('FileKeyValueStore read and write test store2: get value ' + val + ' does not equal testValue of ' + testValue);
			else
				t.pass('FileKeyValueStore read and write test store2: Successfully retrieved value');

			t.end();
		}
	).catch (
		// Log the rejection reason
		function (reason) {
			t.fail('FileKeyValueStore store2 setValue test store2, reason: ' + reason);
			t.end();
		}
	);
});

test('\n\n** FileKeyValueStore error check tests **\n\n', function (t) {

	t.throws(
		function () {
			store3 = new FileKeyValueStore();
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.throws(
		function () {
			store3 = new FileKeyValueStore({ dir: getRelativePath(keyValStorePath3) });
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options.path should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	cleanupFileKeyValueStore(keyValStorePath3);
	var promise3 = new FileKeyValueStore({ path: getRelativePath(keyValStorePath3) })
	.then(
		function(store) {
			store3 = store;
			return store.setValue(testKey, testValue);
		})
	.then(
		function (result) {
			t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Successfully set value');

			var exists = testUtil.existsSync(getAbsolutePath(keyValStorePath3));
			if (exists) {
				t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Verified the file for key ' + testKey + ' does exist');
				cleanupFileKeyValueStore(keyValStorePath3);
				exists = testUtil.existsSync(getAbsolutePath(keyValStorePath3));
				t.comment('FileKeyValueStore error check tests:  Delete store & getValue test. Deleted store, exists: ' + exists);
				return store3.getValue(testKey);
			} else {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. Failed to create file for key ' + testKey);
				t.end();
			}
		})
	.then(
		// Log the fulfillment value
		function (val) {
			if (val === null) {
				t.pass('FileKeyValueStore error check tests:  Delete store & getValue test. getValue is null');
			} else {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue successfully retrieved value: ' + val);
			}

			cleanupFileKeyValueStore(keyValStorePath4);
			return new FileKeyValueStore({ path: getRelativePath(keyValStorePath4) });
		},
		function (reason) {
			t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue caught unexpected error: ' + reason);
		}
	)
	.then(
		function (store) {
			store4 = store;
			cleanupFileKeyValueStore(keyValStorePath4);
			var exists = testUtil.existsSync(getAbsolutePath(keyValStorePath4));
			t.comment('FileKeyValueStore error check tests:  Delete store & setValue test. Deleted store, exists: ' + exists);
			return store4.setValue(testKey, testValue);
		})
	.then(
		function (result) {
			t.fail('FileKeyValueStore error check tests:  Delete store & setValue test.  Successfully set value but should have failed.');
			t.end();
		},
		function (reason) {
			t.pass('FileKeyValueStore error check tests:  Delete store & setValue test.  Failed to set value as expected: ' + reason);
			t.end();
		})
	.catch(
		function (err) {
			t.fail('Failed with unexpected error: ' + err.stack ? err.stack : err);
			t.end();
		});
});

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function cleanupFileKeyValueStore(keyValStorePath) {
	var absPath = getAbsolutePath(keyValStorePath);
	var exists = testUtil.existsSync(absPath);
	if (exists) {
		fs.removeSync(absPath);
	}
}

// prepend absolute path where this test is running, then join to the relative path
function getAbsolutePath(dir) {
	return path.join(process.cwd(), getRelativePath(dir));
}

// get relative file path for either Unix or Windows
// unix relative path does not start with '/'
// windows relative path starts with '/'
function getRelativePath(dir /*string*/) {
	if (/^win/.test(process.platform)) {
		if (!(dir.toString().substr(0, 1) === '/')) dir = '/' + dir;
		dir = path.resolve(dir);
		dir = dir.replace(/([A-Z]:[\\\/]).*?/gi, '');
		return dir;
	} else {
		if (dir.toString().substr(0, 1) === '/') dir = dir.substr(1);
		return dir;
	}
}
