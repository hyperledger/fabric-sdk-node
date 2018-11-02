/**
 * Copyright 2016 IBM All Rights Reserved.
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
const chaincodeId = testUtil.NODE_END2END.chaincodeId;
const version = 'v1';

test('\n\n***** Node-Chaincode U P G R A D E flow: chaincode install *****\n\n', (t) => {
	e2eUtils.installChaincode('org1', testUtil.NODE_CHAINCODE_UPGRADE_PATH, null, version, 'node', t, true)
		.then(() => {
			t.pass('Successfully installed chaincode in peers of organization "org1"');
			return e2eUtils.installChaincode('org2', testUtil.NODE_CHAINCODE_UPGRADE_PATH, null, version, 'node', t, true);
		}, (err) => {
			t.fail('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			t.pass('Successfully installed chaincode in peers of organization "org2"');
			t.end();
		}, (err) => {
			t.fail('Failed to install chaincode in peers of organization "org2". ' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n***** Node-Chaincode U P G R A D E flow: upgrade chaincode *****\n\n', (t) => {
	e2eUtils.instantiateChaincode('org1', testUtil.NODE_CHAINCODE_UPGRADE_PATH, version, 'node', true, true, t)
		.then((result) => {
			if (result) {
				t.pass('Successfully upgrade chaincode on the channel');
				t.end();
			} else {
				t.fail('Failed to upgrade chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to upgrade chaincode on the channel' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n***** Node-Chaincode U P G R A D E flow: invoke transaction to move money *****\n\n', (t) => {
	const fcn = 'move';
	const args = ['a', 'b', '100'];
	const expectedResult = 'move succeed';
	e2eUtils.invokeChaincode('org2', 'v1', chaincodeId, t, false, fcn, args, expectedResult)
		.then((result) => {
			if (result) {
				t.pass('Successfully invoke transaction chaincode on the channel');
				t.end();
			} else {
				t.fail('Failed to invoke transaction chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to invoke transaction chaincode on the channel' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n***** Node-Chaincode U P G R A D E flow: query chaincode *****\n\n', (t) => {
	const fcn = 'query';
	const args = ['b'];
	const expectedResult = '410';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	e2eUtils.queryChaincode('org2', 'v1', targets, fcn, args, expectedResult, chaincodeId, t)
		.then((result) => {
			if (result) {
				t.pass('Successfully query chaincode on the channel');
				t.end();
			} else {
				t.fail('Failed to query chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to query chaincode on the channel' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n***** Node-Chaincode TransientMap Support in Proposals *****\n\n', (t) => {
	const transient = {
		'test': Buffer.from('dummyValue') // string <-> byte[]
	};
	const fcn = 'query';
	const args = ['b'];
	const expectedResult = '410';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	e2eUtils.queryChaincode('org2', 'v1', targets, fcn, args, expectedResult, chaincodeId, t, transient)
		.then((result) => {
			if (result) {
				t.pass('Successfully verified transient map values');
				t.end();
			} else {
				t.fail('Failed to test transientMap support');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to query chaincode on the channel' + err.stack ? err.stack : err);
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
			t.end();
		});
});
