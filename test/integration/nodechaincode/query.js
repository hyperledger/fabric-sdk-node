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

test('\n\n***** Node-Chaincode End-to-end flow: query chaincode *****\n\n', (t) => {
	e2eUtils.queryChaincode('org2', 'v0', '300', chaincodeId, t)
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
