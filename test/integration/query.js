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
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var EventHub = require('fabric-client/lib/EventHub.js');

var client = new hfc();
var chain_id = testUtil.END2END.channel;
var chain = client.newChain(chain_id);
hfc.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
var ORGS = hfc.getConfigSetting('test-network');
var org = 'org1';
var orgName = ORGS[org].name;

var e2e = testUtil.END2END;

var the_user = null;
var tx_id = null;

var nonce = null;

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.info('Found query: %s', querys);

// Second test in query.js has optional parameters; have they been specified?
var queryParameters = false;    // false = do all queries; true = do some queries
if (querys.length > 0 ) {
	// Parameters detected; are these query parameters or gulp parameters?
	if ((querys.indexOf('GetBlockByNumber') > -1) ||
		(querys.indexOf('GetTransactionByID') > -1) ||
		(querys.indexOf('GetChainInfo') > -1) ||
		(querys.indexOf('GetBlockByHash') > -1) ||
		(querys.indexOf('GetInstalledChaincodes') > -1) ||
		(querys.indexOf('GetInstantiatedChaincodes') > -1) ||
		(querys.indexOf('GetChannels') > -1)) {
		queryParameters = true;  // at least one query parameter specified
	}
}

testUtil.setupChaincodeDeploy();

var caRootsPath = ORGS.orderer.tls_cacerts;
let data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
let caroots = Buffer.from(data).toString();

chain.addOrderer(
	new Orderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname']
		}
	)
);
data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org].peer1['tls_cacerts']));
var peer0 = new Peer(
	ORGS[org].peer1.requests,
	{
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': ORGS[org].peer1['server-hostname']
	});
var peer1 = new Peer(
	ORGS[org].peer2.requests,
	{
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': ORGS[org].peer2['server-hostname']
	});

chain.addPeer(peer0);
chain.addPeer(peer1);

test('  ---->>>>> Query chain working <<<<<-----', function(t) {
	return hfc.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then( function (store) {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;
		// read the config block from the orderer for the chain
		// and initialize the verify MSPs based on the participating
		// organizations
		return chain.initialize();
	}).then((success) => {
		t.pass('Successfully initialized chain');
		// use default primary peer
		// send query
		return chain.queryBlock(0);
	}).then((block) => {
		logger.info(' Chain getBlock() returned block number=%s',block.header.number);
		t.equal(block.header.number.toString(),'0','checking query results are correct that we got zero block back');
		t.equal(block.data.data[0].payload.data.config.channel_group.groups.Orderer.groups.OrdererMSP.values.MSP.config.name,'OrdererMSP','checking query results are correct that we got the correct orderer MSP name');
		logger.info('%j',block);
		return chain.queryBlock(1);
	}).then((block) => {
		logger.info(' Chain getBlock() returned block number=%s',block.header.number);
		t.equal(block.header.number.toString(),'1','checking query results are correct that we got a transaction block back');
		t.equal(block.data.data[0].payload.data.actions[0].payload.action.endorsements[0].endorser.Mspid,'Org1MSP','checking query results are correct that we got a transaction block back with correct endorsement MSP id');
		logger.info('%j',block);
		chain.setPrimaryPeer(peer0);

		tx_id = utils.getConfigSetting('E2E_TX_ID', 'notfound');
		logger.info('getConfigSetting("E2E_TX_ID") = %s', tx_id);
		if (tx_id === 'notfound') {
			t.comment('   Did you set the E2E_TX_ID environment variable after running invoke-transaction.js ?');
			throw new Error('Could not get tx_id from ConfigSetting "E2E_TX_ID"');
		} else {
			t.pass('Got tx_id from ConfigSetting "E2E_TX_ID"');
			// send query
			return chain.queryTransaction(tx_id); //assumes the end-to-end has run first
		}
	}).then((processed_transaction) => {
		// set to be able to decode grpc objects
		var grpc = require('grpc');
		var commonProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
		var transProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/transaction.proto').protos;
		logger.info(' Chain queryTransaction() returned processed tranaction is valid='+processed_transaction.validationCode);
		t.equals(transProto.TxValidationCode.VALID,processed_transaction.validationCode,'got back ProcessedTransaction that is a valid transaction');

		try {
			var payload = commonProto.Payload.decode(processed_transaction.transactionEnvelope.payload);
			var channel_header = commonProto.ChannelHeader.decode(payload.header.channel_header);
			logger.debug(' Chain queryTransaction - transaction ID :: %s:', channel_header.tx_id);
		}
		catch(err) {
			logger.error(err);
			throw new Error(err.stack ? err.stack : err);
		}

		chain.setPrimaryPeer(peer1);
		// send query
		return chain.queryInfo();
	}).then((blockchainInfo) => {
		t.pass('got back blockchain info ');
		logger.info(' Chain queryInfo() returned block height='+blockchainInfo.height);
		logger.info(' Chain queryInfo() returned block previousBlockHash='+blockchainInfo.previousBlockHash);
		logger.info(' Chain queryInfo() returned block currentBlockHash='+blockchainInfo.currentBlockHash);
		var block_hash = blockchainInfo.currentBlockHash;
		chain.setPrimaryPeer(peer0);
		// send query
		return chain.queryBlockByHash(block_hash);
	}).then((block) => {
		logger.info(' Chain queryBlockByHash() returned block number=%s',block.header.number);
		t.pass('got back block number '+ block.header.number);
		t.end();
	}).catch((err) => {
		t.comment('Failed \'Query chain working\' with error:');
		throw new Error(err.stack ? err.stack : err);
	});
});

test('  ---->>>>> Query chain failing: GetBlockByNumber <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetBlockByNumber') >= 0) {
		logger.info('Executing GetBlockByNumber');

		return hfc.newDefaultKeyValueStore({
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
				return chain.queryBlock(9999999); //should not find it
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

test('  ---->>>>> Query chain failing: GetTransactionByID <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetTransactionByID') >= 0) {
		return hfc.newDefaultKeyValueStore({
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
				return chain.queryTransaction('99999'); //assumes the end-to-end has run first
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

test('  ---->>>>> Query chain failing: GetChainInfo <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetChainInfo') >= 0) {

		return hfc.newDefaultKeyValueStore({
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
				chain._name = 'dummy';
				return chain.queryInfo();
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response_payloads) {
				t.fail('Should not have found chain info');
				t.end();
			},
			function(err) {
				t.pass(util.format('Did not find chain info : %j', err));
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

test('  ---->>>>> Query chain failing: GetBlockByHash <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetBlockByHash') >= 0) {
		return hfc.newDefaultKeyValueStore({
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
				chain._name = chain_id; //put it back
				return chain.queryBlockByHash(Buffer.from('dummy'));
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
		return hfc.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then( function (store) {
			client.setStateStore(store);
			return testUtil.getSubmitter(client, t, org);
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
				t.comment('<<< installed chaincodes >>>');
				let found = false;

				for (let i=0; i<response.chaincodes.length; i++) {
					t.comment('name: '+response.chaincodes[i].name+
					', version: '+response.chaincodes[i].version+
					', path: '+response.chaincodes[i].path);

					if (response.chaincodes[i].name === e2e.chaincodeId
						&& response.chaincodes[i].version === e2e.chaincodeVersion
						&& response.chaincodes[i].path === testUtil.CHAINCODE_PATH) {
						found = true;
					}
					t.end();
				}
				if (found) {
					t.pass('queryInstalledChaincodes - found match for e2e');
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
		return hfc.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)
		}).then( function (store) {
			client.setStateStore(store);

			return testUtil.getSubmitter(client, t, org);
		}).then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send query
				return chain.queryInstantiatedChaincodes();
			},
			function(err) {
				t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(response) {
				t.comment('<<< instantiated chaincodes >>>');
				let found = false;
				for (let i=0; i<response.chaincodes.length; i++) {
					t.comment('name: '+response.chaincodes[i].name+
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
		return hfc.newDefaultKeyValueStore({
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
				t.comment('<<< channels >>>');
				for (let i=0; i<response.channels.length; i++) {
					t.comment('channel id: '+response.channels[i].channel_id);
				}
				if (response.channels[0].channel_id === chain_id) {
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
