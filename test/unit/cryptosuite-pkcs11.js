/**
 * Copyright 2018 IBM All Rights Reserved.
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
var nconf = require('nconf');
var test = _test(tape);
var testutil = require('./util.js');
var Client = require('fabric-client');
var PKCS11 = require('fabric-client/lib/impl/bccsp_pkcs11.js');
var Config = require('fabric-client/lib/Config.js');

test('\n\n** bccsp_pkcs11 tests **\n\n', (t) => {
	testutil.resetDefaults();

	t.throws(
		function () {
			let pkcss11 = new PKCS11();
		},
		/keySize must be specified/,
		'Checking: keySize must be specified'
	);
	t.throws(
		function () {
			let pkcss11 = new PKCS11(222);
		},
		/only 256 or 384 bits key sizes are supported/,
		'Checking: only 256 or 384 bits key sizes are supported'
	);
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256);
		},
		/PKCS11 library path must be specified/,
		'Checking: PKCS11 key size is specified and valid'
	);
	let opts = {lib: '/temp'};
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 slot must be specified/,
		'Checking: PKCS11 lib must be specified'
	);
	opts.slot = 'a';
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 slot number invalid/,
		'Checking: PKCS11 slot number invalid'
	);
	opts.slot = 2;
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 slot must be set to a number'
	);
	opts.pin = 7;
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 PIN must be set to a string'
	);

	// getting the missing file or image means the same thing to these tests
	// that we have gotten a good respond to the parameter and the failure is
	// after that check, so that parameter that is being tested is valid
	let checkError = function(error, msg) {
		let error_msg = error.toString();
		if(error_msg.indexOf('no suitable image found') > -1 || error_msg.indexOf('No such file or directory') > -1
			||error_msg.includes('image not found')) {
			t.pass(msg);
		} else {
			t.fail(msg + ' failed with ::' + error_msg);
		}
	};

	opts.pin = 'pin';
	let testing = 'Checking: for valid PIN';
	try {
		let pkcss11 = new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	opts.usertype = 'a';
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	opts.usertype = 2;
	testing = 'Checking: for valid usertype';
	try {
		let pkcss11 = new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	opts.readwrite = 'not';
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2', opts);
		},
		/readwrite setting must be "true" or "false"/,
		'Checking: for valid readwrite'
	);
	opts.readwrite = false;
	testing = 'Checking: for valid readwrite';
	try {
		let pkcss11 = new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	Client.setConfigSetting('crypto-pkcs11-lib', '/temp');
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/PKCS11 slot must be specified/,
		'Checking: PKCS11 lib must be specified'
	);
	Client.setConfigSetting('crypto-pkcs11-slot', 2);
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 slot must be set to a number'
	);
	Client.setConfigSetting('crypto-pkcs11-pin', 'PIN');
	testing = 'Checking: for valid PIN in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	Client.setConfigSetting('crypto-pkcs11-usertype', 'not');
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	Client.setConfigSetting('crypto-pkcs11-usertype', 1.2);
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	Client.setConfigSetting('crypto-pkcs11-usertype', 2);
	testing = 'Checking: for valid usertype in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	Client.setConfigSetting('crypto-pkcs11-usertype', '2');
	testing = 'Checking: for valid usertype in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	Client.setConfigSetting('crypto-pkcs11-readwrite', 99);
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/readwrite setting must be a boolean value/,
		'Checking: for valid readwrite'
	);
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'not');
	t.throws(
		function () {
			let pkcss11 = new PKCS11(256, 'sha2');
		},
		/readwrite setting must be "true" or "false"/,
		'Checking: for valid readwrite'
	);
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'false');
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'true');
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'False');
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'True');
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', false);
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', true);
	testing = 'Checking: for valid readwrite in config';
	try {
		let pkcss11 = new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch(error) {
		checkError(error,testing);
	}

	t.end();
});
