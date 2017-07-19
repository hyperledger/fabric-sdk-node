/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var e2eUtils = require('./e2eUtils.js');
var testUtil = require('../../unit/util.js');

test('\n\n***** U P G R A D E flow: chaincode install *****\n\n', (t) => {
	testUtil.setupChaincodeDeploy();

	e2eUtils.installChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH, 'v1', t, true)
	.then(() => {
		t.pass('Successfully installed chaincode in peers of organization "org1"');
		return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_UPGRADE_PATH, 'v1', t, true);
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

test('\n\n***** U P G R A D E flow: upgrade chaincode *****\n\n', (t) => {
	e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH, 'v1', true, t)
	.then((result) => {
		if(result){
			t.pass('Successfully upgrade chaincode on the channel');
			t.end();
		}
		else {
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

test('\n\n***** U P G R A D E flow: invoke transaction to move money *****\n\n', (t) => {
	e2eUtils.invokeChaincode('org2', 'v1', t)
	.then((result) => {
		if(result){
			t.pass('Successfully invoke transaction chaincode on the channel');
			t.end();
		}
		else {
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

test('\n\n***** U P G R A D E flow: query chaincode *****\n\n', (t) => {
	e2eUtils.queryChaincode('org2', 'v1', '410', t)
	.then((result) => {
		if(result){
			t.pass('Successfully query chaincode on the channel');
			t.end();
		}
		else {
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

test('\n\n***** TransientMap Support in Proposals *****\n\n', (t) => {
	var transient = {
		'test': Buffer.from('dummyValue') // string <-> byte[]
	};
	e2eUtils.queryChaincode('org2', 'v1', '410', t, transient)
	.then((result) => {
		if(result){
			t.pass('Successfully verified transient map values');
			t.end();
		}
		else {
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
