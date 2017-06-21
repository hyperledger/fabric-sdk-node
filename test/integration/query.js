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

// This is an end to end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario

// IMPORTANT ------>>>>> MUST RUN e2e.js FIRST
// AND set environment variables indicated in the comments
// at the end of the invoke-transaction run.

'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('query');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var util = require('util');
var fs = require('fs');

var testUtil = require('../unit/util.js');
var Client = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');

var client = new Client();
var channel_id = testUtil.END2END.channel;
var channel = client.newChannel(channel_id);

var org = 'org1';
var orgName;

var e2e = testUtil.END2END;
var ORGS, peer0;

var the_user = null;
var tx_id = null;

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.debug('Found query: %s', querys);

// Second test in query.js has optional parameters; have they been specified?
var queryParameters = false;    // false = do all queries; true = do some queries
if (querys.length > 0 ) {
	// Parameters detected; are these query parameters or gulp parameters?
	if ((querys.indexOf('GetBlockByNumber') > -1) ||
		(querys.indexOf('GetTransactionByID') > -1) ||
		(querys.indexOf('GetChannelInfo') > -1) ||
		(querys.indexOf('GetBlockByHash') > -1) ||
		(querys.indexOf('GetInstalledChaincodes') > -1) ||
		(querys.indexOf('GetInstantiatedChaincodes') > -1) ||
		(querys.indexOf('GetChannels') > -1)) {
		queryParameters = true;  // at least one query parameter specified
	}
}

var data;

test('  ---->>>>> Query channel working <<<<<-----', function(t) {
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	orgName = ORGS[org].name;
	var caRootsPath = ORGS.orderer.tls_cacerts;
	data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));

	let caroots = Buffer.from(data).toString();

	channel.addOrderer(
		new Orderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org].peer1['tls_cacerts']));
	peer0 = new Peer(
		ORGS[org].peer1.requests,
		{
			pem: Buffer.from(data).toString(),
			'ssl-target-name-override': ORGS[org].peer1['server-hostname']
		});
	data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS['org2'].peer1['tls_cacerts']));
	var peer1 = new Peer(
		ORGS['org2'].peer1.requests,
		{
			pem: Buffer.from(data).toString(),
			'ssl-target-name-override': ORGS['org2'].peer1['server-hostname']
		});

	channel.addPeer(peer0);
	channel.addPeer(peer1);

	utils.setConfigSetting('key-value-store','fabric-client/lib/impl/FileKeyValueStore.js');
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then( function (store) {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		// read the config block from the orderer for the channel
		// and initialize the verify MSPs based on the participating
		// organizations
		return channel.initialize();
	}).then((success) => {
		t.pass('Successfully initialized channel');
		// use default primary peer
		// send query
		return channel.queryBlock(0);
	}).then((block) => {
		logger.debug(' Channel getBlock() returned block number=%s',block.header.number);
		t.equal(block.header.number.toString(),'0','checking query results are correct that we got zero block back');
		t.equal(block.data.data[0].payload.data.config.channel_group.groups.Orderer.groups.OrdererMSP.values.MSP.value.config.name,'OrdererMSP','checking query results are correct that we got the correct orderer MSP name');
		t.equal(block.data.data[0].payload.data.config.channel_group.groups.Application.groups.Org2MSP.policies.Writers.policy.type,'SIGNATURE','checking query results are correct that we got the correct policy type');
		t.equal(block.data.data[0].payload.data.config.channel_group.groups.Application.policies.Writers.policy.policy.rule,'ANY','checking query results are correct that we got the correct policy rule');
		t.equal(block.data.data[0].payload.data.config.channel_group.policies.Admins.mod_policy,'Admins','checking query results are correct that we got the correct mod policy name');
		return channel.queryBlock(1);
	}).then((block) => {
		logger.debug(' Channel getBlock() returned block number=%s',block.header.number);
		t.equal(block.header.number.toString(),'1','checking query results are correct that we got a transaction block back');
		t.equal(block.data.data[0].payload.data.actions[0].payload.action.endorsements[0].endorser.Mspid,'Org1MSP','checking query results are correct that we got a transaction block back with correct endorsement MSP id');

		tx_id = utils.getConfigSetting('E2E_TX_ID', 'notfound');
		logger.debug('getConfigSetting("E2E_TX_ID") = %s', tx_id);
		if (tx_id === 'notfound') {
			logger.error('   Did you set the E2E_TX_ID environment variable after running invoke-transaction.js ?');
			throw new Error('Could not get tx_id from ConfigSetting "E2E_TX_ID"');
		} else {
			t.pass('Got tx_id from ConfigSetting "E2E_TX_ID"');
			// send query
			return channel.queryTransaction(tx_id, peer0); //assumes the end-to-end has run first
		}
	}).then((processed_transaction) => {
		t.equals('mychannel', processed_transaction.transactionEnvelope.payload.header.channel_header.channel_id,
			'test for header channel name');
		t.equals('Org2MSP', processed_transaction.transactionEnvelope.payload.header.signature_header.creator.Mspid,
			'test for header channel mspid in identity');
		t.equals('Org1MSP', processed_transaction.transactionEnvelope.payload.data.actions['0']
			.payload.action.endorsements['0'].endorser.Mspid,
			'test for endorser mspid in identity');
		t.equals('Org2MSP', processed_transaction.transactionEnvelope.payload.data.actions['0'].header.creator.Mspid,
			'test for creator mspid in identity');
		t.equals(200, processed_transaction.transactionEnvelope.payload.data.actions['0'].payload.action
			.proposal_response_payload.extension.response.status,
			'test for transation status');
		t.equals(0, processed_transaction.transactionEnvelope.payload.data.actions['0']
			.payload.action.proposal_response_payload.extension.results.data_model,
			'test for data model value');
		t.equals('a', processed_transaction.transactionEnvelope.payload.data.actions['0']
			.payload.action.proposal_response_payload.extension.results.ns_rwset['0']
			.rwset.writes['0'].key,
			'test for write set key value');
		t.equals('2', processed_transaction.transactionEnvelope.payload.data.actions['0']
			.payload.action.proposal_response_payload.extension.results.ns_rwset['0']
			.rwset.reads[1].version.block_num.toString(),
			'test for read set block num');

		// the "target peer" must be a peer in the same org as the app
		// which in this case is "peer0"
		// send query
		return channel.queryInfo(peer0);
	}).then((blockchainInfo) => {
		t.pass('got back blockchain info ');
		logger.debug(' Channel queryInfo() returned block height='+blockchainInfo.height);
		logger.debug(' Channel queryInfo() returned block previousBlockHash='+blockchainInfo.previousBlockHash);
		logger.debug(' Channel queryInfo() returned block currentBlockHash='+blockchainInfo.currentBlockHash);
		var block_hash = blockchainInfo.currentBlockHash;
		// send query
		return channel.queryBlockByHash(block_hash, peer0);
	}).then((block) => {
		logger.debug(' Channel queryBlockByHash() returned block number=%s',block.header.number);
		t.pass('got back block number '+ block.header.number);
		t.end();
	}).catch((err) => {
		throw new Error(err.stack ? err.stack : err);
	});
});

test('  ---->>>>> Query channel failing: GetBlockByNumber <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetBlockByNumber') >= 0) {

		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then(
			function(store) {
				client.setStateStore(store);
				return testUtil.getSubmitter(client, t, org);
			}
		).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				the_user = admin;
				// send query
				return channel.queryBlock(9999999); //should not find it
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response_payloads) {
				t.fail('Should not have found a block');
				t.end();
			},
			function(err) {
				t.pass(util.format('Did not find a block with this number : %j', err));
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to query with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query channel failing: GetTransactionByID <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetTransactionByID') >= 0) {
		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then(
			function(store) {
				client.setStateStore(store);
				return testUtil.getSubmitter(client, t, org);
			}
		).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				if(admin) the_user = admin;
				// send query
				return channel.queryTransaction('99999'); //assumes the end-to-end has run first
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response_payloads) {
				t.fail('Should not have found a transaction with this ID');
				t.end();
			},
			function(err) {
				t.pass('Did not find a transaction ::' + err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to query with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query channel failing: GetChannelInfo <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetChannelInfo') >= 0) {

		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then(
			function(store) {
				client.setStateStore(store);
				return testUtil.getSubmitter(client, t, org);
			}
		).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				if(admin) the_user = admin;
				// send query
				channel._name = 'dummy';
				return channel.queryInfo();
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response_payloads) {
				t.fail('Should not have found channel info');
				t.end();
			},
			function(err) {
				t.pass(util.format('Did not find channel info : %j', err));
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to query with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query channel failing: GetBlockByHash <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetBlockByHash') >= 0) {
		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then(
			function (store) {
				client.setStateStore(store);
				return testUtil.getSubmitter(client, t, org);
			}
		).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				if(admin) the_user = admin;
				// send query
				channel._name = channel_id; //put it back
				return channel.queryBlockByHash(Buffer.from('dummy'));
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response_payloads) {
				t.fail('Should not have found block data');
				t.end();
			},
			function(err) {
				t.pass(util.format('Did not find block data : %j', err));
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to query with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query Installed Chaincodes working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetInstalledChaincodes') >= 0) {
		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then( function (store) {
			client.setStateStore(store);

			// get the peer org's admin required to query installed chaincodes
			return testUtil.getSubmitter(client, t, true /* get peer org admin */, org);
		}).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send query
				return client.queryInstalledChaincodes(peer0);
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response) {
				logger.debug('<<< installed chaincodes >>>');
				let found = false;

				for (let i=0; i<response.chaincodes.length; i++) {
					logger.debug('name: '+response.chaincodes[i].name+
					', version: '+response.chaincodes[i].version+
					', path: '+response.chaincodes[i].path);

					if (response.chaincodes[i].name === e2e.chaincodeId
						&& response.chaincodes[i].version === e2e.chaincodeVersion
						&& response.chaincodes[i].path === testUtil.CHAINCODE_PATH) {
						found = true;
					}
				}
				if (found) {
					t.pass('queryInstalledChaincodes - found match for e2e');
					t.end();
				} else {
					t.fail('queryInstalledChaincodes - did not find match for e2e');
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send queryInstalledChaincodes due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to queryInstalledChaincodes with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query Instantiated Chaincodes working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetInstantiatedChaincodes') >= 0) {
		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then( function (store) {
			client.setStateStore(store);

			// get the peer org's admin required to query instantiated chaincodes
			return testUtil.getSubmitter(client, t, true /* get peer org admin */, org);
		}).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send query
				return channel.queryInstantiatedChaincodes();
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response) {
				logger.debug('<<< instantiated chaincodes >>>');
				let found = false;
				for (let i=0; i<response.chaincodes.length; i++) {
					logger.debug('name: '+response.chaincodes[i].name+
					', version: '+response.chaincodes[i].version+
					', path: '+response.chaincodes[i].path);

					if (response.chaincodes[i].name === e2e.chaincodeId
						&& response.chaincodes[i].version === 'v1'
						&& response.chaincodes[i].path === testUtil.CHAINCODE_UPGRADE_PATH) {
						found = true;
					}
				}
				if (found) {
					t.pass('queryInstantiatedChaincodes - found match for e2e');
					t.end();
				} else {
					t.fail('queryInstantiatedChaincodes - did not find match for e2e');
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send queryInstantiatedChaincodes due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to queryInstantiatedChaincodes with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});

test('  ---->>>>> Query Channels working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetChannels') >= 0) {
		return Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then( function (store) {
			client.setStateStore(store);

			return testUtil.getSubmitter(client, t, org);
		}).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				the_user = admin;

				// send query
				return client.queryChannels(peer0);
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response) {
				logger.debug('<<< channels >>>');
				for (let i=0; i<response.channels.length; i++) {
					logger.debug('channel id: '+response.channels[i].channel_id);
				}
				if (response.channels[0].channel_id === channel_id) {
					t.pass('queryChannels matches e2e');
					t.end();
				} else {
					t.fail('queryChannels does not match e2e');
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send queryChannels due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to queryChannels with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	} else t.end();
});
