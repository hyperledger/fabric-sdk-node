/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('../../unit/util.js');

const chaincodeId = testUtil.END2END.chaincodeIdPrivateData;

test('getCollectionsConfig from peer', async (t) => {
	const targets = [];  // empty array, meaning client will discover the peers
	try {
		const results = await e2eUtils.getCollectionsConfig(t, 'org1', chaincodeId, targets);
		if (results) {
			t.pass('Successfully query collections config');
		}
		else {
			t.fail('Failed to query collections config');
			t.end();
		}
		t.equal(results.length, 2, 'should exists two collections');

		t.equal(results[0].type, 'static_collection_config');
		t.equal(results[0].name, 'detailCol');
		t.equal(results[0].required_peer_count, 1);
		t.equal(results[0].maximum_peer_count, 1);
		t.equal(results[0].block_to_live, 100);
		t.deepEqual(results[0].policy.identities, [{ msp_identifier: 'Org1MSP', role: 'MEMBER' }, { msp_identifier: 'Org2MSP', role: 'MEMBER' }]);

		t.equal(results[1].type, 'static_collection_config');
		t.equal(results[1].name, 'sensitiveCol');
		t.equal(results[1].required_peer_count, 0);
		t.equal(results[1].maximum_peer_count, 1);
		t.equal(results[1].block_to_live, 100);
		t.deepEqual(results[1].policy.identities, [{ msp_identifier: 'Org1MSP', role: 'MEMBER' }]);
		t.end();
	} catch (err) {
		t.fail('Failed to query chaincode on the channel. ' + err.stack ? err.stack : err);
	}
});
