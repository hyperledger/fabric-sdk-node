/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E install-chaincode');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtil = require('../../unit/util.js');
const version = 'v0';

test('\n\n***** Network End-to-end flow: chaincode install *****\n\n', (t) => {
	e2eUtils.installChaincodeWithId('org1', testUtil.NETWORK_END2END.chaincodeId, testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true)
		.then(() => {
			t.pass('Successfully installed chaincode in peers of organization "org1"');
			return e2eUtils.installChaincodeWithId('org2', testUtil.NETWORK_END2END.chaincodeId, testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
		}, (err) => {
			t.fail('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
			logger.error('Failed to install chaincode in peers of organization "org1". ');
			return e2eUtils.installChaincodeWithId('org2', testUtil.NETWORK_END2END.chaincodeId, testUtil.NODE_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
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
