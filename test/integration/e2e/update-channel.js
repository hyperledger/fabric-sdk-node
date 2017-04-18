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

var util = require('util');
var fs = require('fs');
var path = require('path');
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var e2eUtils = require('./e2eUtils.js');
var testUtil = require('../../unit/util.js');
var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('End to End');

var the_user = null;

Client.addConfigFile(path.join(__dirname, './config.json'));
var ORGS = Client.getConfigSetting('test-network');


test('\n\n***** U P D A T E C H A N N E L flow: update channel *****\n\n', (t) => {
	//
	// Create and configure the test chain
	//
	var channel_name = 'mychannel';
	var client = new Client();

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();

	var orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname']
		}
	);


	var TWO_ORG_MEMBERS_AND_ADMIN = [{
		role: {
			name: 'member',
			mspId: 'Org1MSP'
		}
	}, {
		role: {
			name: 'member',
			mspId: 'Org2MSP'
		}
	}, {
		role: {
			name: 'admin',
			mspId: 'Org1MSP'
		}
	}];

	var ONE_OF_TWO_ORG_MEMBER = {
		identities: TWO_ORG_MEMBERS_AND_ADMIN,
		policy: {
			'1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
		}
	};

	var ACCEPT_ALL = {
		identities: [],
		policy: {
			'0-of': []
		}
	};

	var test_input = {
		channel : {
			name : channel_name,
			settings : {
				'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : '99m',	'preferred-max-bytes' : '512k'},
				'batch-timeout' : '10s',
				'hashing-algorithm' : 'SHA256',
				'consensus-type' : 'solo',
				'creation-policy' : 'AcceptAllPolicy'
			},
			policies : {
				Readers : {threshold : 'ANY'},
				Writers : {threshold : 'ANY'},
				Admins  : {threshold : 'ANY'},
				AcceptAllPolicy : {signature : ACCEPT_ALL}
			},
			orderers : {
				organizations : [{
					mspid : 'OrdererMSP',
					policies : {
						Readers : {signature : ACCEPT_ALL},
						Writers : {signature : ACCEPT_ALL},
						Admins  : {signature : ACCEPT_ALL}
					},
					'end-points' : ['orderer0:7050']
				}],
				policies : {
					Readers : {threshold : 'ANY'},
					Writers : {threshold : 'ANY'},
					Admins  : {threshold : 'ANY'},
					AcceptAllPolicy : {signature : ACCEPT_ALL},
					BlockValidation : {threshold : 'ANY' , sub_policy : 'Writers'}
				}
			},
			peers : {
				organizations : [{
					mspid : 'Org1MSP',
					'anchor-peers' : ['peer0:7051', 'peer1:7056'],
					policies : {
						Readers : {signature : ACCEPT_ALL},
						Writers : {signature : ACCEPT_ALL},
						Admins  : {signature : ACCEPT_ALL}
					}
				},{
					mspid : 'Org2MSP',
					'anchor-peers' : ['peer2:8051', 'peer3:8056'],
					policies : {
						Readers : {signature : ACCEPT_ALL},
						Writers : {signature : ACCEPT_ALL},
						Admins  : {signature : ACCEPT_ALL}
					}
				}],
				policies : {
					Readers : {threshold : 'ANY'},
					Writers : {threshold : 'ANY'},
					Admins  : {threshold : 'ANY'}
				},
			}
		}
	};

	var signatures = [];

	// Acting as a client in org1 when creating the channel
	var org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(org)
	}).then((store) => {
		client.setStateStore(store);

		return testUtil.getSubmitter(client, t, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		client.addMSP( e2eUtils.loadMSPConfig('Org2MSP', '../../fixtures/channel/crypto-config/peerOrganizations/org2.example.com/msp/'));
		t.pass('only have to add in the new msps, existing MSPs will be read from the channel');

		var chain = client.newChain(channel_name);
		chain.addOrderer(orderer);

		// have the SDK build the config update object
		return client.buildChannelConfigUpdate(test_input, chain);
	}).then((config_update) => {
		t.pass('Successfully built config update for the update channel action');

		// sign the config
		var signature = client.signChannelConfig(config_update);
		t.pass('Successfully signed config update');

		// collect all signatures
		signatures.push(signature);

		// build up the update request
		let nonce = utils.getNonce();
		let tx_id = Client.buildTransactionID(nonce, the_user);
		var request = {
			config : config_update,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id,
			nonce : nonce
		};

		// send to update request to orderer
		return client.updateChannel(request);
	})
	.then((result) => {
		logger.debug(' response ::%j',result);
		t.pass('Successfully update the channel.');
		if(result.status && result.status === 'SUCCESS') {
			return e2eUtils.sleep(20000);
		} else {
			t.fail('Failed to update the channel. ');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to update the channel: ' + err.stack ? err.stack : err);
		t.end();
	})
	.then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created.');
		t.end();
	}, (err) => {
		t.fail('Failed to sleep due to error: ' + err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n***** U P D A T E C H A N N E L  flow: invoke transaction to move money *****', (t) => {
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

test('\n\n***** U P D A T E C H A N N E L  flow: query chaincode *****', (t) => {
	e2eUtils.queryChaincode('org2', 'v1', '520', t)
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
