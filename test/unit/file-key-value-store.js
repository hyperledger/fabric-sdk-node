/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const testUtil = require('./util.js');
const fs = require('fs-extra');
const utils = require('fabric-client/lib/utils.js');

const FileKeyValueStore = require('fabric-client/lib/impl/FileKeyValueStore.js');

const keyValStorePath = path.join(testUtil.getTempDir(), 'kvsTemp');
const testKey = 'keyValFileStoreName';
const testValue = 'secretKeyValue';
let store1 = '';

test('\n\n ** FileKeyValueStore - read and write test **\n\n', (t) => {
	testUtil.resetDefaults();

	// clean up
	if (testUtil.existsSync(keyValStorePath)) {
		fs.removeSync(keyValStorePath);
	}
	utils.newKeyValueStore({
		path: keyValStorePath
	})
		.then(
			(store) => {
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
			(result) => {
				if (result === testValue) {
					t.pass('FileKeyValueStore read and write test: Successfully set value');
				} else {
					t.fail('FileKeyValueStore read and write test: set value ' + result + 'does not match testValue ' + testValue);
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
			(reason) => {
				t.fail('FileKeyValueStore read and write test: Failed to set value, reason: ' + reason);
				t.end();
			}
		).then(
		// Log the fulfillment value
			(val) => {
				if (val !== testValue) {
					t.fail('FileKeyValueStore read and write test: get value ' + val + ' does not equal testValue of ' + testValue);
				} else {
					t.pass('FileKeyValueStore read and write test: Successfully retrieved value');
				}

				// now test getValue() when the underlying directory get deleted
				fs.removeSync(keyValStorePath);
				return store1.getValue(testKey);
			},
			// Log the rejection reason
			(reason) => {
				t.fail('FileKeyValueStore read and write test: Failed getValue, reason: ' + reason);
				t.end();
			}
		).then(
		// Log the fulfillment value
			(val) => {
				if (val === null) {
					t.pass('FileKeyValueStore error check tests:  Delete store & getValue test. getValue() returns null as expected');
				} else {
					t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue() should not have returned value: ' + val);
				}

				return new FileKeyValueStore({path: keyValStorePath});
			},
			(reason) => {
				t.fail('FileKeyValueStore error check tests:  Delete store & getValue test. getValue caught unexpected error: ' + reason);
			}
		)
		.then(
			(store) => {
			// now test setValue() when the underlying directory get deleted
				fs.removeSync(keyValStorePath);
				return store.setValue(testKey, testValue);
			})
		.then(
			() => {
				t.fail('FileKeyValueStore error check tests:  Delete store & setValue test.  setValue() should have failed.');
				t.end();
			},
			(reason) => {
				t.pass('FileKeyValueStore error check tests:  Delete store & setValue test.  setValue() failed as expected: ' + reason);
				t.end();
			})
		.catch(
			(err) => {
				t.fail('Failed with unexpected error: ' + err.stack ? err.stack : err);
				t.end();
			});
});

test('\n\n** FileKeyValueStore error check tests **\n\n', (t) => {

	t.throws(
		() => {
			new FileKeyValueStore();
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.throws(
		() => {
			new FileKeyValueStore({dir: keyValStorePath});
		},
		/^Error: Must provide the path/,
		'FileKeyValueStore error check tests: new FileKeyValueStore with no options.path should throw ' +
		'"Must provide the path to the directory to hold files for the store."'
	);

	t.end();
});
