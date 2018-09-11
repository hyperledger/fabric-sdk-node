/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);
var e2eUtils = require('../e2e/e2eUtils.js');
var testUtils = require('../../unit/util');

test('\n\n***** Java-Chaincode End-to-end flow: query chaincode *****\n\n', async (t) => {
	const chaincode_id = 'example_java';
	const version = 'v0';

	const fcn = 'query';
	const args = ['b'];
	let expectedResult = '300';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	try {
		let result = await e2eUtils.queryChaincode('org2', version, targets, fcn, args, expectedResult, chaincode_id, t);
		if(result){
			t.pass('Successfully query java chaincode on the channel');
		}
		else {
			t.fail('Failed to query java chaincode ');
		}
	} catch(err) {
		t.fail('Failed to query java chaincode on the channel. ' + err.stack ? err.stack : err);
	}

	try {
		expectedResult = new Error('throwError: an error occurred');
		let result = await e2eUtils.queryChaincode('org2', version, targets, 'throwError', args, expectedResult, chaincode_id, t);
		if(result){
			t.pass('Sucessfully handled error from a query on java chaincode');
		}
		else {
			t.fail('Failed to query java chaincode ');
		}
	} catch(err) {
		t.fail('Failed to query java chaincode on the channel. ' + err.stack ? err.stack : err);
	}
	t.end();
});
