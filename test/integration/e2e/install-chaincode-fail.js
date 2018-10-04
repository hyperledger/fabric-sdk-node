/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E install-chaincode-fail');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('../../unit/util.js');

test('\n\n***** End-to-end flow: chaincode install *****\n\n', (t) => {
	testUtil.setupChaincodeDeploy();

	e2eUtils.installChaincode('org1', testUtil.CHAINCODE_PATH, null, 'v0', 'golang', t, false)
		.then(() => {
			t.fail('Successfully installed chaincode in peers of organization "org1"');
			return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_PATH, null, 'v0', 'golang', t, false);
		}, (err) => {
			t.pass('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
			logger.error('Failed to install chaincode in peers of organization "org1". ');
			return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_PATH, null, 'v0', 'golang', t, false);
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
