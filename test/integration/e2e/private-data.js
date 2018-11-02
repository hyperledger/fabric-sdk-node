/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end tests for the private data feature.i
// Install and instantiate a chaincode with private data.
// Invokes and queries chaincode for private data.
// Prerequisite: a chaincode reading/writing private data, install-channel.js and join-channels.js
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E private-data');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('../../unit/util.js');

const version = 'v0';
const chaincodeId = testUtil.END2END.chaincodeIdPrivateData;
const chaincodePath = testUtil.CHAINCODE_PATH_PRIVATE_DATA;
const metadataPath = testUtil.METADATA_PATH_PRIVATE_DATA;

test('\n\n***** End-to-end flow: private data *****\n\n', async (t) => {
	testUtil.setupChaincodeDeploy();

	try {
		// In all calls below, 'org1' or 'org2' is used to enroll/create admin user from the corresponding org.
		// It has no impact to the target peers in the calls.
		// Unless specific targets are passed in, SDK client will automatically find the corresponding targets.

		await e2eUtils.installChaincodeWithId('org1', chaincodeId, chaincodePath, metadataPath, version, 'golang', t, true);
		t.pass('Successfully installed chaincode ' + chaincodePath + ' in peers of organization "org1"');

		await e2eUtils.installChaincodeWithId('org2', chaincodeId, chaincodePath, metadataPath, version, 'golang', t, true);
		t.pass('Successfully installed chaincode ' + chaincodePath + ' in peers of organization "org2"');

		let result = await e2eUtils.instantiateChaincodeWithId('org1', chaincodeId, chaincodePath, 'v0', 'golang', false, false, t);
		if (result) {
			t.pass('Successfully instantiated chaincode ' + chaincodePath + ' on the channel');
			await e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to instantiate chaincode ' + chaincodePath + ' on the channel');
			t.end();
		}

		let fcn = 'setPrivateData';
		let args = ['name1', 'blue', '35', 'tom', '99'];
		let expectedResult = 'set private data';

		result = await e2eUtils.invokeChaincode('org1', 'v0', chaincodeId, t, false, fcn, args, expectedResult);
		if (result) {
			t.pass('Successfully invoke transaction chaincode ' + chaincodePath + ' on channel');
			await e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to invoke transaction chaincode ' + chaincodePath + ' on channel');
			t.end();
		}

		// Pass empty targets - SDK will find the query peers
		// This is because 'queryDetail' function reads private data stored in both org1 peers and org2 peers
		let targets = [];
		fcn = 'queryDetail';
		args = ['name1'];
		expectedResult = '{"docType":"detailCol","name":"name1","color":"blue","size":35,"owner":"tom"}';

		result = await e2eUtils.queryChaincode('org2', 'v0', targets, fcn, args, expectedResult, chaincodeId, t);
		if (result) {
			t.pass('Successfully query private data in detailCol from chaincode ' + chaincodePath + ' on channel');
		} else {
			t.fail('Failed to query private data in detailCol from chaincode ' + chaincodePath + ' on channel');
			t.end();
		}

		// Pass specific peer from org1 as targets
		// This is because 'querySensitive' function reads private data that are only stored in org1 peers
		targets = ['localhost:7051'];
		fcn = 'querySensitive';
		args = ['name1'];
		expectedResult = '{"docType":"sensitiveCol","name":"name1","price":99}';
		result = await e2eUtils.queryChaincode('org1', 'v0', targets, fcn, args, expectedResult, chaincodeId, t);
		if (result) {
			t.pass('Successfully query private data in sensitiveCol from chaincode ' + chaincodePath + ' on channel');
		} else {
			t.fail('Failed to query private data in sensitiveCol from chaincode ' + chaincodePath + ' on channel');
			t.end();
		}

		// Pass specific peer from org2
		// The corresponding private data are stored in org1 peers, but not in org2 peers, so expected result is ''
		targets = ['localhost:8051'];
		expectedResult = new Error('Failed to get private state for name1');
		await e2eUtils.queryChaincode('org1', 'v0', targets, fcn, args, expectedResult, chaincodeId, t);
		t.pass('Got error object from peers which did not store private data in a collection based on policy.');

		t.end();
	} catch (err) {
		logger.error(err);
		t.fail('Failed to test private data end-to-end due to error: ' + err.stack ? err.stack : err);
		t.end();
	}
});
