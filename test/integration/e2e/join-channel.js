/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var util = require('util');
var path = require('path');

var hfc = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');

var testUtil = require('../../unit/util.js');

var the_user = null;
var tx_id = null;
var nonce = null;

var logger = utils.getLogger('join-channel');

hfc.addConfigFile(path.join(__dirname, './config.json'));
var ORGS = hfc.getConfigSetting('test-network');

//
//Attempt to send a request to the orderer with the sendCreateChain method
//
test('\n\n***** End-to-end flow: join channel *****\n\n', function(t) {
	joinChannel('org1', t)
	.then(() => {
		t.pass(util.format('Successfully joined peers in organization "%s" to the channel', ORGS['org1'].name));
		joinChannel('org2', t);
	}, (err) => {
		t.fail(util.format('Failed to join peers in organization "%s" to the channel', ORGS['org1'].name));
		t.end();
	})
	.then(() => {
		t.pass(util.format('Successfully joined peers in organization "%s" to the channel', ORGS['org2'].name));
		t.end();
	}, (err) => {
		t.fail(util.format('Failed to join peers in organization "%s" to the channel', ORGS['org2'].name));
		t.end();
	})
	.catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});

function joinChannel(org, t) {
	t.comment(util.format('Calling peers in organization "%s" to join the channel'));

	//
	// Create and configure the test chain
	//
	var client = new hfc();
	var chain = client.newChain(testUtil.END2END.channel);
	chain.addOrderer(new Orderer(ORGS.orderer));

	var orgName = ORGS[org].name;

	var targets = [];
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				targets.push(new Peer(ORGS[org][key].requests));
			}
		}
	}

	return hfc.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	})
	.then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	})
	.then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		//FIXME: temporary fix until mspid is configured into Chain
		the_user.mspImpl._id = ORGS[org].mspid;

		nonce = utils.getNonce();
		tx_id = chain.buildTransactionID(nonce, the_user);
		var request = {
			targets : targets,
			txId : 	tx_id,
			nonce : nonce
		};
		return chain.joinChannel(request);
	}, (err) => {
		t.fail('Failed to enroll user \'admin\' due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to enroll user \'admin\' due to error: ' + err.stack ? err.stack : err);
	})
	.then((results) => {
		logger.info(util.format('Join Channel R E S P O N S E : %j', results));

		if(results[0] && results[0].response && results[0].response.status == 200)
			t.pass('Successfully joined channel.');
		else {
			t.fail(' Failed to join channel');
			throw new Error('Failed to join channel');
		}
	}, (err) => {
		t.fail('Failed to join channel due to error: ' + err.stack ? err.stack : err);
	});
}