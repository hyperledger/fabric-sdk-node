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
					nonce = Buffer.from('12');//hard coded to be the same as end-to-end.js, this transaction will only exist if
					                          // end-to-end runs first
					tx_id = chain.buildTransactionID(nonce, webUser);
					// send query
					return chain.queryTransaction(tx_id); //assumes the end-to-end has run first
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(transaction) {
					t.pass('got back ProcessedTransaction that is was a valid transaction='+transaction.valid); // + JSON.stringify(response_payloads));
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
					t.pass('got back block number '+ block.header.number);
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
		var queryAttempts = 0;  // number of queries attempted in this test
		if (!queryParameters || querys.indexOf('GetBlockByNumber') >= 0) {
			queryAttempts++;
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

		if (!queryParameters || querys.indexOf('GetTransactionByID') >= 0) {
			queryAttempts++;
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

		if (!queryParameters || querys.indexOf('GetChainInfo') >= 0) {
			queryAttempts++;
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

		if (!queryParameters || querys.indexOf('GetBlockByHash') >= 0) {
			queryAttempts++;
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
		};
		if (queryAttempts == 0) {  				// No query attempts based on querys value
			t.pass('No queries were attempted!!!');  // therefore, no one issued t.end() yet
			t.end();
		};
	});
});

test('  ---->>>>> Query Installed Chaincodes working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetInstalledChaincodes') >= 0) {
		hfc.newDefaultKeyValueStore({
			path: testUtil.KVS
		}).then( function (store) {
			client.setStateStore(store);
			testUtil.getSubmitter(client, t)
				.then(
					function(admin) {
						t.pass('Successfully enrolled user ' + admin);
						// send query
						return chain.queryInstalledChaincodes(peer0);
					},
					function(err) {
						t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
						t.end();
					}
				).then(
					function(response) {
						t.comment('<<< installed chaincodes >>>');
						for (let i=0; i<response.chaincodes.length; i++) {
							t.comment('name: '+response.chaincodes[i].name+
							', version: '+response.chaincodes[i].version+
							', path: '+response.chaincodes[i].path);
						}
						if (response.chaincodes[0].name === 'end2end' && response.chaincodes[0].version === 'v0' && response.chaincodes[0].path === 'github.com/example_cc') {
							t.pass('queryInstalledChaincodes matches end2end');
							t.end();
						} else {
							t.fail('queryInstalledChaincodes does not match end2end');
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
		});
	} else t.end();
});

test('  ---->>>>> Query Instantiated Chaincodes working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetInstantiatedChaincodes') >= 0) {
		hfc.newDefaultKeyValueStore({
			path: testUtil.KVS
		}).then( function (store) {
			client.setStateStore(store);
			testUtil.getSubmitter(client, t)
				.then(
					function(admin) {
						t.pass('Successfully enrolled user ' + admin);
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
						for (let i=0; i<response.chaincodes.length; i++) {
							t.comment('name: '+response.chaincodes[i].name+
							', version: '+response.chaincodes[i].version+
							', path: '+response.chaincodes[i].path);
						}
						if (response.chaincodes[0].name === 'end2end' && response.chaincodes[0].version === 'v0' && response.chaincodes[0].path === 'github.com/example_cc') {
							t.pass('queryInstantiatedChaincodes matches end2end');
							t.end();
						} else {
							t.fail('queryInstantiatedChaincodes does not match end2end');
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
		});
	} else t.end();
});

test('  ---->>>>> Query Channels working <<<<<-----', function(t) {
	if (!queryParameters || querys.indexOf('GetChannels') >= 0) {
		hfc.newDefaultKeyValueStore({
			path: testUtil.KVS
		}).then( function (store) {
			client.setStateStore(store);
			testUtil.getSubmitter(client, t)
				.then(
					function(admin) {
						t.pass('Successfully enrolled user ' + admin);
						// send query
						return chain.queryChannels(peer0);
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
						if (response.channels[0].channel_id === 'testchainid') {
							t.pass('queryChannels matches end2end');
							t.end();
						} else {
							t.fail('queryChannels does not match end2end');
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
		});
	} else t.end();
});