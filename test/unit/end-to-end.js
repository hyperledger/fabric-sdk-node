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

var log4js = require('log4js');
var logger = log4js.getLogger('E2E');
logger.setLevel('DEBUG');

var path = require('path');

var hfc = require('hfc');
hfc.setLogger(logger);

var util = require('util');
var testUtil = require('./util.js');
var utils = require('hfc/lib/utils.js');
var Peer = require('hfc/lib/Peer.js');
var Orderer = require('hfc/lib/Orderer.js');
var EventHub = require('hfc/lib/EventHub.js');

var client = new hfc();
var chain = client.newChain('testChain-e2e');

var webUser = null;
var chaincode_id = 'end2end';
var chain_id = 'test_chainid';
var tx_id = null;
var nonce = null;
var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var steps = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		steps.push(process.argv[i]);
	}
}
logger.info('Found steps: %s', steps);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('End-to-end flow of chaincode deploy, transaction invocation, and query', function(t) {
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then( function (store) {
		client.setStateStore(store);
		var promise = testUtil.getSubmitter(client, t);

		// setup event hub to get notified when transactions are committed
		var eh = new EventHub();
		eh.setPeerAddr('grpc://localhost:7053');
		eh.connect();

		// override t.end function so it'll always disconnect the event hub
		t.end = (function(context, eventhub, f) {
			return function() {
				if (eventhub && eventhub.isconnected()) {
					logger.info('Disconnecting the event hub');
					eventhub.disconnect();
				}

				f.apply(context, arguments);
			};
		})(t, eh, t.end);

		if (steps.length === 0 || steps.indexOf('step1') >= 0) {
			logger.info('Executing step1');
			promise = promise.then(
				function(admin) {
					t.pass('Successfully enrolled user \'admin\'');
					webUser = admin;
					tx_id = utils.buildTransactionID({length:12});
					nonce = utils.getNonce();

					// send proposal to endorser
					var request = {
						chaincodePath: testUtil.CHAINCODE_PATH,
						chaincodeId: chaincode_id,
						fcn: 'init',
						args: ['a', '100', 'b', '200'],
						chainId: chain_id,
						txId: tx_id,
						nonce: nonce,
						'dockerfile-contents' :
						'from hyperledger/fabric-ccenv\n' +
						'COPY . $GOPATH/src/build-chaincode/\n' +
						'WORKDIR $GOPATH\n\n' +
						'RUN go install build-chaincode && mv $GOPATH/bin/build-chaincode $GOPATH/bin/%s'
					};

					return chain.sendDeploymentProposal(request);
				},
				function(err) {
					t.fail('Failed to enroll user \'admin\'. ' + err);
					t.end();
				}
			).then(
				function(results) {
					var proposalResponses = results[0];
					//logger.debug('deploy proposalResponses:'+JSON.stringify(proposalResponses));
					var proposal = results[1];
					var header   = results[2];
					var all_good = true;
					for(var i in proposalResponses) {
						let one_good = false;
						if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
							one_good = true;
							logger.info('deploy proposal was good');
						} else {
							logger.error('deploy proposal was bad');
						}
						all_good = all_good & one_good;
					}
					if (all_good) {
						t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
						var request = {
							proposalResponses: proposalResponses,
							proposal: proposal,
							header: header
						};
						return chain.sendTransaction(request);
					} else {
						t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(response) {
					if (response.status === 'SUCCESS') {
						t.pass('Successfully sent deployment transaction to the orderer.');

						// set the transaction listener and set a timeout of 30sec
						// if the transaction did not get committed within the timeout period,
						// fail the test
						return new Promise((resolve, reject) => {
							var handle = setTimeout(reject, 30000);

							eh.registerTxEvent(tx_id.toString(), (tx) => {
								t.pass('The chaincode deploy transaction has been successfully committed');
								clearTimeout(handle);

								if (steps.length === 0) {
									// this is called without steps parameter in order to execute all steps
									// in sequence, just continue
									setTimeout(resolve, 2000);
								} else if (steps.length === 1 && steps[0] === 'step1') {
									t.end();
									resolve();
								}
							});
						});
					} else {
						t.fail('Failed to order the deployment endorsement. Error code: ' + response.status);
						t.end();
					}

				},
				function(err) {
					t.fail('Failed to send deployment e due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			);
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

					return;
				},
				function(err) {
					t.fail('Failed to get transaction notification within the timeout period');
					t.end();
				}
			).then(
				function() {
					tx_id = utils.buildTransactionID({length:12});
					nonce = utils.getNonce();
					// send proposal to endorser
					var request = {
						chaincodeId : chaincode_id,
						fcn: 'invoke',
						args: ['move', 'a', 'b','100'],
						chainId: chain_id,
						txId: tx_id,
						nonce: nonce
					};
					return chain.sendTransactionProposal(request);
				},
				function(err) {
					t.fail('Failed to wait due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(results) {
					var proposalResponses = results[0];
					var proposal = results[1];
					var header   = results[2];

					var all_good = true;
					for(var i in proposalResponses) {
						let one_good = false;
						if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
							one_good = true;
							logger.info('move proposal was good');
						} else {
							logger.error('move proposal was bad');
						}
						all_good = all_good & one_good;
					}
					if (all_good) {
						t.pass('Successfully obtained transaction endorsements.'); // + JSON.stringify(proposalResponses));
						var request = {
							proposalResponses: proposalResponses,
							proposal: proposal,
							header: header
						};
						return chain.sendTransaction(request);
					} else {
						t.fail('Failed to obtain transaction endorsements. Error code: ' + results);
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(response) {
					if (response.status === 'SUCCESS') {
						t.pass('Successfully ordered endorsement transaction.');

						return new Promise((resolve, reject) => {
							var handle = setTimeout(reject, 30000);

							eh.registerTxEvent(tx_id.toString(), (tx) => {
								t.pass('The chaincode deploy transaction has been successfully committed');
								clearTimeout(handle);

								if (steps.length === 0) {
									// this is called without steps parameter in order to execute all steps
									// in sequence, just continue
									setTimeout(resolve, 2000);
								} else if (steps.length === 1 && steps[0] === 'step2') {
									t.end();
									resolve();
								}
							});
						});
					} else {
						t.fail('Failed to order the endorsement of the transaction. Error code: ' + response.status);
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			);
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

					return;
				},
				function(err) {
					t.fail('Failed to get transaction notification within the timeout period');
					t.end();
				}
			).then(
				function() {
					// send query
					var request = {
						targets: [peer0, peer1],
						chaincodeId : chaincode_id,
						chainId: chain_id,
						txId: utils.buildTransactionID(),
						nonce: utils.getNonce(),
						fcn: 'invoke',
						args: ['query','b']
					};
					return chain.queryByChaincode(request);
				},
				function(err) {
					t.fail('Failed to wait-- error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(response_payloads) {
					for(let i = 0; i < response_payloads.length; i++) {
						t.equal(response_payloads[i].toString('utf8'),'300','checking query results are correct that user b has 300 now after the move');
					}
					t.end();
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to end to end test with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
		}
	});
});
