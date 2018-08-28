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
const chaincodeId = 'example_java';
const version = 'v1';

test('\n\n***** Java-Chaincode U P G R A D E flow: chaincode install *****\n\n', async (t) => {
	try {
		await e2eUtils.installChaincodeWithId('org1', chaincodeId, testUtil.JAVA_CHAINCODE_UPGRADE_PATH, null, version, 'java', t, true);
		t.pass('Successfully installed java chaincode in peers of organization "org1"');
		await e2eUtils.installChaincodeWithId('org2', chaincodeId, testUtil.JAVA_CHAINCODE_UPGRADE_PATH, null, version, 'java', t, true);
		t.pass('Successfully installed java chaincode in peers of organization "org2"');
	} catch(err) {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
	}
	t.end();
});

test('\n\n***** Java-Chaincode U P G R A D E flow: instantiate chaincode *****\n\n', async (t) => {
	try {
		await e2eUtils.instantiateChaincodeWithId('org1', chaincodeId, testUtil.JAVA_CHAINCODE_UPGRADE_PATH, version, 'java', true, false, t);
		t.pass('Successfully instantiated upgraded chaincode on the channel');
	} catch(err) {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
	}
	t.end();
});

test('\n\n***** Java-Chaincode U P G R A D E flow: invoke transaction to move *****\n\n', async (t) => {
	const fcn = 'move';
	const args = ['b', 'a','100'];
	const expectedResult = 'move succeed';
	try {
		await e2eUtils.invokeChaincode('org2', version, chaincodeId, t, false, fcn, args, expectedResult);
		t.pass('Successfully invoked transaction on upgraded chaincode');
	} catch(err) {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
	}
	t.end();
});

test('\n\n***** Java-Chaincode U P G R A D E flow: query chaincode *****\n\n', async (t) => {
	const fcn = 'query';
	const args = ['a'];
	const expectedResult = '110';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	try {
		await e2eUtils.queryChaincode('org2', version, targets, fcn, args, expectedResult, chaincodeId, t);
		t.pass('Successfully queried on upgraded chaincode');
	} catch(err) {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
	}
	t.end();
});

test('\n\n***** Java-Chaincode TransientMap Support in Proposals *****\n\n', async (t) => {
	const transient = {
		'key': Buffer.from('value') // string <-> byte[]
	};
	const fcn = 'testTransient';
	const args = ['key'];
	const expectedResult = 'value';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	try {
		await e2eUtils.queryChaincode('org2', version, targets, fcn, args, expectedResult, chaincodeId, t, transient);
		t.pass('Successfully verified transient map values');
	} catch(err) {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
	}
	t.end();
});
