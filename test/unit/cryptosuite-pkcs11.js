/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const testutil = require('./util.js');
const Client = require('fabric-client');
const PKCS11 = require('fabric-client/lib/impl/bccsp_pkcs11.js');

test('\n\n** bccsp_pkcs11 tests **\n\n', (t) => {
	testutil.resetDefaults();

	t.throws(
		() => {
			new PKCS11();
		},
		/keySize must be specified/,
		'Checking: keySize must be specified'
	);
	t.throws(
		() => {
			new PKCS11(222);
		},
		/only 256 or 384 bits key sizes are supported/,
		'Checking: only 256 or 384 bits key sizes are supported'
	);
	t.throws(
		() => {
			new PKCS11(256);
		},
		/PKCS11 library path must be specified/,
		'Checking: PKCS11 key size is specified and valid'
	);
	const opts = {lib: '/temp'};
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 slot must be specified/,
		'Checking: PKCS11 lib must be specified'
	);
	opts.slot = 'a';
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 slot number invalid/,
		'Checking: PKCS11 slot number invalid:' + opts.slot
	);
	opts.slot = 2.1;
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 slot number invalid/,
		'Checking: PKCS11 slot number invalid:' + opts.slot
	);
	opts.slot = 2;
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 slot must be set to a number'
	);
	opts.pin = 7;
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 PIN must be set to a string'
	);

	// getting the missing file or image means the same thing to these tests
	// that we have gotten a good respond to the parameter and the failure is
	// after that check, so that parameter that is being tested is valid
	const checkError = (error, msg) => {
		const error_msg = error.toString();
		if (error_msg.indexOf('no suitable image found') > -1 || error_msg.indexOf('No such file or directory') > -1
            || error_msg.includes('image not found')) {
			t.pass(msg);
		} else {
			t.fail(msg + ' failed with ::' + error_msg);
		}
	};

	opts.pin = 'pin';
	let testing = 'Checking: for valid PIN';
	try {
		new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	opts.usertype = 'a';
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	opts.usertype = 2;
	testing = 'Checking: for valid usertype';
	try {
		new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	opts.readwrite = 'not';
	t.throws(
		() => {
			new PKCS11(256, 'sha2', opts);
		},
		/readwrite setting must be "true" or "false"/,
		'Checking: for valid readwrite'
	);
	opts.readwrite = false;
	testing = 'Checking: for valid readwrite';
	try {
		new PKCS11(256, 'sha2', opts);
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	Client.setConfigSetting('crypto-pkcs11-lib', '/temp');
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/PKCS11 slot must be specified/,
		'Checking: PKCS11 lib must be specified'
	);
	Client.setConfigSetting('crypto-pkcs11-slot', 2);
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/PKCS11 PIN must be set/,
		'Checking: PKCS11 slot must be set to a number'
	);
	Client.setConfigSetting('crypto-pkcs11-pin', 'PIN');
	testing = 'Checking: for valid PIN in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	Client.setConfigSetting('crypto-pkcs11-usertype', 'not');
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	Client.setConfigSetting('crypto-pkcs11-usertype', 1.2);
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/usertype number invalid/,
		'Checking: for valid usertype'
	);
	Client.setConfigSetting('crypto-pkcs11-usertype', 2);
	testing = 'Checking: for valid usertype in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	Client.setConfigSetting('crypto-pkcs11-usertype', '2');
	testing = 'Checking: for valid usertype in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	Client.setConfigSetting('crypto-pkcs11-readwrite', 99);
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/readwrite setting must be a boolean value/,
		'Checking: for valid readwrite'
	);
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'not');
	t.throws(
		() => {
			new PKCS11(256, 'sha2');
		},
		/readwrite setting must be "true" or "false"/,
		'Checking: for valid readwrite'
	);
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'false');
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'true');
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'False');
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', 'True');
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', false);
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}
	Client.setConfigSetting('crypto-pkcs11-readwrite', true);
	testing = 'Checking: for valid readwrite in config';
	try {
		new PKCS11(256, 'sha2');
		t.fail(testing);
	} catch (error) {
		checkError(error, testing);
	}

	t.end();
});
