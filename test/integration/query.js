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
process.env.HFC_LOGGING = '{"debug": "console"}';
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var log4js = require('log4js');
var logger = log4js.getLogger('E2E');
logger.setLevel('DEBUG');

var path = require('path');

var hfc = require('fabric-client');
hfc.setLogger(logger);

var util = require('util');
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var EventHub = require('fabric-client/lib/EventHub.js');

var client = new hfc();
var chain_id = 'testchainid';
var chain = client.newChain(chain_id);

var webUser = null;
var chaincode_id = 'end2end'; // assumes end to end has run first and installed and instantiated this chain code
var tx_id = null;
var nonce = null;
var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.info('Found query: %s', querys);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('  ---->>>>> Query chain working <<<<<-----', function(t) {
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then( function (store) {
		client.setStateStore(store);
		testUtil.getSubmitter(client, t)
			.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					webUser = admin;
					// use default primary peer
					// send query
					return chain.queryBlock(0);
				},
				function(err) {
					t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(response) {
					t.equal(response.header.number.toString(),'0','checking query results are correct that we got zero block back');
					chain.setPrimaryPeer(peer0);
					// send query
					return chain.queryTransaction('5678'); //assumes the end-to-end has run first
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(transaction) {
					t.pass('got back transaction %j',transaction); // + JSON.stringify(response_payloads));
					chain.setPrimaryPeer(peer1);
					// send query
					return chain.queryInfo();
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(response) {
					t.pass('got back blockchain info '); // + JSON.stringify(response_payloads[i]));
					var block_hash = response.previousBlockHash;
					chain.setPrimaryPeer(peer0);
					// send query
					return chain.queryBlockByHash(block_hash);
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(block) {
					t.pass('got back block number %s', block.header.number);
					t.end();
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
	});
});

test('  ---->>>>> Query chain failing <<<<<-----', function(t) {
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then( function (store) {
		client.setStateStore(store);
		var promise = testUtil.getSubmitter(client, t);

		if (querys.length === 0 || querys.indexOf('GetBlockByNumber') >= 0) {
			logger.info('Executing GetBlockByNumber');
			promise = promise.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					webUser = admin;
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
					t.pass('Did not find a block with this number ::'+ err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
		}

		if (querys.length === 0 || querys.indexOf('GetTransactionByID') >= 0) {
			promise = promise.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					if(admin) webUser = admin;
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
		}

		if (querys.length === 0 || querys.indexOf('GetChainInfo') >= 0) {
			promise = promise.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					if(admin) webUser = admin;
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
					t.pass('Did not find chain info ::' + err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
		}

		if (querys.length === 0 || querys.indexOf('GetBlockByHash') >= 0) {
			promise = promise.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					if(admin) webUser = admin;
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
					t.pass('Did not find block data ::'+ err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
		}
	});
});
