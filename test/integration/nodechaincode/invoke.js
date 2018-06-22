/**
 * Copyright 2017 IBM All Rights Reserved.
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
var chaincodeId = testUtils.NODE_END2END.chaincodeId;

test('\n\n***** Node-Chaincode End-to-end flow: invoke transaction to move money *****\n\n', (t) => {
	const fcn = 'move';
	const args = ['a', 'b','100'];
	const expectedResult = 'move succeed';
	e2eUtils.invokeChaincode('org2', 'v0', chaincodeId, t, false/*useStore*/, fcn, args, expectedResult)
		.then((result) => {
			if(result){
				t.pass('Successfully invoke transaction chaincode on channel');
				return sleep(5000);
			}
			else {
				t.fail('Failed to invoke transaction chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
