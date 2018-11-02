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
const testUtils = require('../../unit/util');

test('\n\n***** Java-Chaincode End-to-end flow: invoke transaction to move money *****\n\n', async (t) => {
	const chaincode_id = 'example_java';
	const version = 'v0';

	const fcn = 'move';
	const args = ['a', 'b', '100'];
	let expectedResult = 'move succeed';
	try {
		const result = await e2eUtils.invokeChaincode('org2', version, chaincode_id, t, false/* useStore*/, fcn, args, expectedResult);
		if (result) {
			t.pass('Successfully invoke transaction java chaincode on channel');
			await testUtils.sleep(5000);
		} else {
			t.fail('Failed to invoke transaction java chaincode ');
		}
	} catch (err) {
		t.fail('Failed to invoke transaction java chaincode on channel. ' + err.stack ? err.stack : err);
	}

	try {
		expectedResult = new Error('throwError: an error occurred');
		const result = await e2eUtils.invokeChaincode('org2', version, chaincode_id, t, false/* useStore*/, 'throwError', args, expectedResult);
		if (result) {
			t.pass('Successfully handled invocation errors from java chaincode');
		} else {
			t.fail('Failed to invoke transaction java chaincode ');
		}

	} catch (err) {
		t.fail('Failed to query java chaincode on the channel. ' + err.stack ? err.stack : err);
	}
	t.end();
});
