/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E install-chaincode');

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var e2eUtils = require('../e2e/e2eUtils.js');
var testUtil = require('../../unit/util.js');
var version = 'v0';

test('\n\n***** Node-Chaincode End-to-end flow: chaincode install *****\n\n', (t) => {
	e2eUtils.installChaincode('org1', testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true)
		.then(() => {
			t.pass('Successfully installed chaincode in peers of organization "org1"');
			return e2eUtils.installChaincode('org2', testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
		}, (err) => {
			t.fail('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
			logger.error('Failed to install chaincode in peers of organization "org1". ');
			return e2eUtils.installChaincode('org2', testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
		}).then(() => {
			t.pass('Successfully installed chaincode in peers of organization "org2"');
			t.end();
		}, (err) => {
			t.fail('Failed to install chaincode in peers of organization "org2". ' + err.stack ? err.stack : err);
			logger.error('Failed to install chaincode in peers of organization "org2". ');
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});
