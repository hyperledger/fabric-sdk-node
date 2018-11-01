/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E instantiate-chaincode');
logger.level = 'debug';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtil = require('../../unit/util.js');



test('\n\n***** Network End-to-end flow: instantiate chaincode *****\n\n', (t) => {
	e2eUtils.instantiateChaincodeWithId('org1', testUtil.NETWORK_END2END.chaincodeId, testUtil.NODE_CHAINCODE_PATH, 'v0', 'node', false, false, t)
		.then((result) => {
			if (result) {
				t.pass('Successfully instantiated chaincode on the channel');

				return testUtil.sleep(5000);
			} else {
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
