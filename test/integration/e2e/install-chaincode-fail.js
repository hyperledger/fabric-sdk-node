/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E install-chaincode-fail');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var e2eUtils = require('./e2eUtils.js');
var testUtil = require('../../unit/util.js');

test('\n\n***** End-to-end flow: chaincode install *****\n\n', (t) => {
	testUtil.setupChaincodeDeploy();

	e2eUtils.installChaincode('org1', testUtil.CHAINCODE_PATH, 'v0', t, false)
	.then(() => {
		t.fail('Successfully installed chaincode in peers of organization "org1"');
		return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_PATH, 'v0', t, false);
	}, (err) => {
		t.pass('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
		logger.error('Failed to install chaincode in peers of organization "org1". ');
		return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_PATH, 'v0', t, false);
	}).then(() => {
		t.fail('Successfully installed chaincode in peers of organization "org2"');
		t.end();
	}, (err) => {
		t.pass('Failed to install chaincode in peers of organization "org2". ' + err.stack ? err.stack : err);
		logger.error('Failed to install chaincode in peers of organization "org2". ');
		t.end();
	}).catch((err) => {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
		t.end();
	});
});