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

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
utils.setConfigSetting('hfc-logging', '{"debug":"console"}');
var logger = utils.getLogger('marbles');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var http = require('http');

var hfc = require('fabric-client');
var util = require('util');
var testUtil = require('./util.js');

var chain = hfc.newChain('testChain-e2e');
var webUser;
var chaincode_id = 'marblescc';
var chain_id = '**TEST_CHAINID**';
var tx_id = null;
var nonce = null;

var steps = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		steps.push(process.argv[i]);
	}
}
logger.info('Found steps: %s', steps);

testUtil.setupChaincodeDeploy();

chain.setKeyValueStore(hfc.newKeyValueStore({
	path: testUtil.KVS
}));

chain.setOrderer('grpc://localhost:7050');

test('End-to-end flow of chaincode instantiate, transaction invocation, and query', function(t) {
	var promise = testUtil.getSubmitter(chain, t);

	if (steps.length === 0 || steps.indexOf('step1') >= 0) {
		logger.info('Executing step1');

		promise = promise.then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				webUser = admin;
				tx_id = hfc.buildTransactionID({length:12});
				nonce = hfc.getNonce();

				// send proposal to endorser
				var request = {
					targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
					chaincodePath: testUtil.CHAINCODE_MARBLES_PATH,
					chaincodeId: chaincode_id,
					fcn: 'init',
					args: ['1'],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};

				return admin.sendInstantiateProposal(request);
			},
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}
		).then(
			function(results) {
				var proposalResponses = results[0];
				var proposal = results[1];
				var header = results[2];
				if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
					t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
					return webUser.sendTransaction({
						proposalResponses: proposalResponses,
						proposal: proposal,
						header: header
					});
				} else {
					t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		);

		if (steps.length === 0) {
			// this is called without steps parameter in order to execute all steps
			// in sequence, will needs to sleep for 20sec here
			promise = promise.then(
				function(response) {
					if (response.Status === 'SUCCESS') {
						t.pass('Successfully ordered instantiate endorsement.');
						console.log(' need to wait now for the committer to catch up');
						return sleep(20000);
					} else {
						t.fail('Failed to order the transaction. Error code: ' + response.status);
						t.end();
					}

				},
				function(err) {
					t.fail('Failed to order the transaction due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			);
		} else if (steps.length === 1 && steps[0] === 'step1') {
			promise = promise.then(
				function() {
					t.end();
				}
			);
		}
	}

	if (steps.length === 0 || steps.indexOf('step2') >= 0) {
		promise = promise.then(
			function(data) {
				logger.info('Executing step2');

				// we may get to this point from the sleep() call above
				// or from skipping step1 altogether. if coming directly
				// to this step then "data" will be the webUser
				if (typeof data !== 'undefined' && data !== null) {
					webUser = data;
				}

				return Promise.resolve();
			}
		).then(
			function() {
				tx_id = hfc.buildTransactionID({length:12});
				nonce = hfc.getNonce();
				// send proposal to endorser
				var request = {
					targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
					chaincodeId : chaincode_id,
					fcn: 'init_marble',
					args: ['marble1','blue','35','tom'],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};
				return webUser.sendTransactionProposal(request);
			},
			function(err) {
				t.fail('Failed to wait due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(results) {
				var proposalResponses = results[0];
				var proposal = results[1];
				var header = results[2];
				if (proposalResponses[0].response && proposalResponses[0].response.status && proposalResponses[0].response.status === 200) {
					t.pass('Successfully obtained transaction endorsement to create marbles.' + JSON.stringify(proposalResponses));
					return webUser.sendTransaction({
						proposalResponses: proposalResponses,
						proposal: proposal,
						header: header
					});
				} else if (proposalResponses[0] instanceof Error) {
					if (proposalResponses[0].message && proposalResponses[0].message.indexOf('This marble arleady exists') >= 0) {
						t.pass('Marble already exists, continue');
						return Promise.resolve({Status: 'SUCCESS'});
					} else {
						t.fail('Proposal response contained errors. Error: ' + proposalResponses[0]);
						t.end();
					}
				} else {
					t.fail('Failed to obtain transaction endorsement to create marbles. Error code: ' + proposalResponses[0].response.status);
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send transaction proposal to create marbles due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		);

		if (steps.length === 0) {
			// this is called without steps parameter in order to execute all steps
			// in sequence, will needs to sleep for 20sec here
			promise = promise.then(
				function(response) {
					if (response.Status === 'SUCCESS') {
						t.pass('Successfully ordered endorsement transaction.');
						console.log(' need to wait now for the committer to catch up');
						return sleep(20000);
					} else {
						t.fail('Failed to order the transaction. Error code: ' + response.status);
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to send transaction to the orderer due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			);
		} else if (steps.length >= 1 && steps[steps.length - 1] === 'step2') {
			promise = promise.then(
				function() {
					t.end();
				}
			);
		}
	}

	if (steps.length === 0 || steps.indexOf('step3') >= 0) {
		promise = promise.then(
			function(data) {
				logger.info('Executing step3');

				// we may get to this point from the sleep() call above
				// or from skipping step1 altogether. if coming directly
				// to this step then "data" will be the webUser
				if (typeof data !== 'undefined' && data !== null) {
					webUser = data;
				}

				return Promise.resolve();
			}
		).then(
			function() {
				tx_id = hfc.buildTransactionID({length:12});
				nonce = hfc.getNonce();
				// send proposal to endorser
				var request = {
					targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
					chaincodeId : chaincode_id,
					fcn: 'set_owner',
					args: ['marble1','jerry'],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};
				return webUser.sendTransactionProposal(request);
			},
			function(err) {
				t.fail('Failed to wait due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).then(
			function(results) {
				var proposalResponses = results[0];
				var proposal = results[1];
				var header = results[2];
				if (proposalResponses[0].response.status === 200) {
					t.pass('Successfully obtained transaction endorsement to set owner.' + JSON.stringify(proposalResponses));
					return webUser.sendTransaction({
						proposalResponses: proposalResponses,
						proposal: proposal,
						header: header
					});
				} else {
					t.fail('Failed to obtain transaction endorsement to set owner. Error code: ' + status);
					t.end();
				}
			},
			function(err) {
				t.fail('Failed to send transaction proposal for setting owner due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		);

		if (steps.length === 0) {
			// this is called without steps parameter in order to execute all steps
			// in sequence, will needs to sleep for 20sec here
			promise = promise.then(
				function(response) {
					if (response.Status === 'SUCCESS') {
						t.pass('Successfully ordered transaction to set owner.');
						console.log(' need to wait now for the committer to catch up');
						return sleep(20000);
					} else {
						t.fail('Failed to order the transaction to set owner. Error code: ' + response.status);
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to send transaction to set owner due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			);
		 } else if (steps.length >= 1 && steps[steps.length - 1] === 'step3') {
			promise = promise.then(
				function() {
					t.end();
				}
			);
		}
	}

	if (steps.length === 0 || steps.indexOf('step4') >= 0) {
		promise = promise.then(
			function() {
				var options = {
					hostname: 'localhost',
					port: 5984,
					path: '/system/_find',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				};

				var query = JSON.stringify({
					'selector' : {
						'docType': 'Marble',
						'owner': 'jerry'
					}
				});

				var post_req = http.request(options, function(res) {
					res.setEncoding('utf8');
					var raw = '';
					res.on('data', function (chunk) {
						raw += chunk;
					}).on('error', function(e) {
						t.fail('Could not query for marble owner. Error: ' + e);
						t.end();
					}).on('end', function() {
						var json = JSON.parse(raw);
						if (json.docs && Array.isArray(json.docs) && json.docs[0].owner === 'jerry') {
							t.pass('Successfully queries marble owned by "jerry"');
							t.end();
						} else {
							t.fail('Did not understand the response from query. raw data: ' + raw);
							t.end();
						}
					});
				});

				// post the data
				post_req.write(query);
				post_req.end();
			},
			function(err) {
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to end to end test Marbles with error:' + err.stack ? err.stack : err);
				t.end();
			}
		);
	}
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}