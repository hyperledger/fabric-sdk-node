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

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('../../unit/util.js');

test('\n\n***** End-to-end flow: instantiate chaincode *****\n\n', async (t) => {
	try {
		const result = await e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_PATH, 'v0', 'golang', false, false, t);
		if (result) {
			t.pass('Successfully instantiated chaincode on the channel');
			await testUtil.sleep(5000);
			logger.debug('Successfully slept 5s to wait for chaincode instantiate to be completed and committed in all peers');
		} else {
			t.fail('Failed to instantiate chaincode ');
		}
	} catch (err) {
		t.fail('Test failed due to reasons. ' + err.stack ? err.stack : err);
	}
	t.end();

});

