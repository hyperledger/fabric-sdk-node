/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const e2eUtils = require('./e2eUtils.js');
const testUtils = require('../../unit/util');
const chaincodeId = testUtils.END2END.chaincodeId;

test('\n\n***** End-to-end flow: query chaincode *****\n\n', (t) => {
	const fcn = 'query';
	const args = ['b'];
	const expectedResult = '300';
	const targets = [];  // empty array, meaning client will discover the peers
	e2eUtils.queryChaincode('org2', 'v0', targets, fcn, args, expectedResult, chaincodeId, t)
		.then((result) => {
			if(result){
				t.pass('Successfully query chaincode on the channel');
				t.end();
			}
			else {
				t.fail('Failed to query chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to query chaincode on the channel. ' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});
