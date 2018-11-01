/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const e2eUtils = require('../e2e/e2eUtils.js');
const testUtil = require('../../unit/util.js');

test('\n\n***** Java-Chaincode End-to-end flow: instantiate chaincode *****\n\n', async (t) => {
	const chaincode_id = 'example_java';
	const version = 'v0';
	try {
		await e2eUtils.instantiateChaincodeWithId('org1', chaincode_id, testUtil.JAVA_CHAINCODE_PATH, version, 'java', false, false, t);
		t.pass('Successfully instantiated java chaincode on the channel');
		await testUtil.sleep(5000);
	} catch (err) {
		t.fail('Failed to instantiate java chaincode ' + err.stack ? err.stack : err);
		t.end();
	}
});
