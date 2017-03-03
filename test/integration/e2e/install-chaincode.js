/**
 * Copyright 2017 IBM All Rights Reserved.
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

var path = require('path');
var util = require('util');

var hfc = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var testUtil = require('../../unit/util.js');

var logger = utils.getLogger('install-chaincode');

var e2e = testUtil.END2END;
hfc.addConfigFile(path.join(__dirname, './config.json'));
var ORGS = hfc.getConfigSetting('test-network');

var tx_id = null;
var nonce = null;
var the_user = null;

testUtil.setupChaincodeDeploy();

test('\n\n***** End-to-end flow: chaincode install *****\n\n', (t) => {
	installChaincode('org1', t)
	.then(() => {
		t.pass('Successfully installed chaincode in peers of organization "org1"');
		return installChaincode('org2', t);
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

function installChaincode(org, t) {
	var client = new hfc();
	var chain = client.newChain(testUtil.END2END.channel);
	chain.addOrderer(new Orderer(ORGS.orderer));

	var orgName = ORGS[org].name;

	var targets = [];
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				let peer = new Peer(ORGS[org][key].requests);
				targets.push(peer);
				chain.addPeer(peer);
			}
		}
	}

	return hfc.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		the_user.mspImpl._id = ORGS[org].mspid;

		nonce = utils.getNonce();
		tx_id = chain.buildTransactionID(nonce, the_user);

		// send proposal to endorser
		var request = {
			targets: targets,
			chaincodePath: testUtil.CHAINCODE_PATH,
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: e2e.chaincodeVersion,
			txId: tx_id,
			nonce: nonce
		};

		return chain.sendInstallProposal(request);
	},
	(err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);
	}).then((results) => {
		var proposalResponses = results[0];

		var proposal = results[1];
		var header   = results[2];
		var all_good = true;
		for(var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				one_good = true;
				logger.info('install proposal was good');
			} else {
				logger.error('install proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
		} else {
			t.fail('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	},
	(err) => {
		t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	});
}