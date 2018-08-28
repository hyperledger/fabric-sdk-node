/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtil = require('../../unit/util.js');

test('\n\n***** Java-Chaincode End-to-end flow: chaincode install *****\n\n', async (t) => {
	const chaincode_id = 'example_java';
	const version = 'v0';

	try {
		await e2eUtils.installChaincodeWithId('org1', chaincode_id, testUtil.JAVA_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'java', t, true);
		t.pass('Successfully installed java chaincode in peers of organization "org1"');

		await e2eUtils.installChaincodeWithId('org2', chaincode_id, testUtil.JAVA_CHAINCODE_PATH, testUtil.METADATA_PATH, version, 'java', t, true);
		t.pass('Successfully installed java chaincode in peers of organization "org2"');
	} catch(err) {
		t.fail('Java chaincode install Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
		t.end();
	}
});
