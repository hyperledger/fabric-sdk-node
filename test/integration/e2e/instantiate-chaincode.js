/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E instantiate-chaincode');

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var e2eUtils = require('./e2eUtils.js');
var testUtil = require('../../unit/util.js');

test('\n\n***** End-to-end flow: instantiate chaincode *****\n\n', (t) => {
	e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_PATH, 'v0', 'golang', false, false, t)
	.then((result) => {
		if(result){
			t.pass('Successfully instantiated chaincode on the channel');

			return sleep(5000);
		}
		else {
			t.fail('Failed to instantiate chaincode ');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to instantiate chaincode on the channel. ' + err.stack ? err.stack : err);
		t.end();
	}).then(() => {
		logger.debug('Successfully slept 5s to wait for chaincode instantiate to be completed and committed in all peers');
		t.end();
	}).catch((err) => {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
