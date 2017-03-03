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

var chaincode_id = 'end2end';
var chaincode_version = 'v0';
var chain_id = 'testchainid';

var client = new hfc();
var chain = client.newChain(chain_id);

var tx_id = null;
var nonce = null;
var the_user = null;
var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var steps = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		steps.push(process.argv[i]);
	}
}
var useSteps = false;
if (steps.length > 0 &&
	(steps.indexOf('step1') > -1 || steps.indexOf('step2') > -1 || steps.indexOf('step3') > -1 || steps.indexOf('step4') > -1))
	useSteps = true;
logger.info('Found steps: %s', steps, 'useSteps: '+useSteps);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('End-to-end flow of chaincode install, instantiate, transaction invocation, and query', (t) => {

	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		var promise = testUtil.getSubmitter(client, t);

		// setup event hub for peer0 to get notified when transactions are committed
		var eh1 = new EventHub();
		eh1.setPeerAddr('grpc://localhost:7053');
		eh1.connect();

		// setup event hub or peer1 to get notified when transactions are committed
		var eh2 = new EventHub();
		eh2.setPeerAddr('grpc://localhost:7058');
		eh2.connect();

		// override t.end function so it'll always disconnect the event hub
		t.end = ((context, eventhubs, f) => {
			return function() {
				for(var key in eventhubs) {
					var eventhub = eventhubs[key];
					if (eventhub && eventhub.isconnected()) {
						logger.info('Disconnecting the event hub');
						eventhub.disconnect();
					}
				}

				f.apply(context, arguments);
			};
		})(t, [eh1, eh2], t.end);

		if (!useSteps || steps.indexOf('step1') >= 0) {
			logger.info('Executing step1');

			promise = promise.then((admin) => {
				t.pass('Successfully enrolled user \'admin\'');
				the_user = admin;

				nonce = utils.getNonce();
				tx_id = chain.buildTransactionID(nonce, the_user);

				// send proposal to endorser
				var request = {
					chaincodePath: testUtil.CHAINCODE_PATH,
					chaincodeId: chaincode_id,
					chaincodeVersion: chaincode_version,
					txId: tx_id,
					nonce: nonce
				};

				return chain.sendInstallProposal(request);

			},
			(err) => {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
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
					if (useSteps) {
						t.end();
					}
				} else {
					t.fail('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step2') >= 0) {
			logger.info('Executing step2');
			promise = promise.then((admin) => {
				t.pass('Successfully enrolled user \'admin\'');
				if(the_user === null) {
					the_user = admin;
				}
				nonce = utils.getNonce();
				tx_id = chain.buildTransactionID(nonce, the_user);

				// send proposal to endorser
				var request = {
					chaincodePath: testUtil.CHAINCODE_PATH,
					chaincodeId: chaincode_id,
					chaincodeVersion: chaincode_version,
					fcn: 'init',
					args: ['a', '100', 'b', '200'],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};

				return chain.sendInstantiateProposal(request);

			},
			(err) => {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}).then((results) => {
				var proposalResponses = results[0];

				var proposal = results[1];
				var header   = results[2];
				var all_good = true;
				for(var i in proposalResponses) {
					let one_good = false;
					if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
						one_good = true;
						logger.info('instantiate proposal was good');
					} else {
						logger.error('instantiate proposal was bad');
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

					// set the transaction listener and set a timeout of 30sec
					// if the transaction did not get committed within the timeout period,
					// fail the test
					var deployId = tx_id.toString();
					var txPromise1 = new Promise((resolve, reject) => {
						let handle = setTimeout(reject, 30000);

						eh1.registerTxEvent(deployId.toString(), (tx, code) => {
							t.pass('The chaincode deploy transaction has been committed on this '+ peer0);
							clearTimeout(handle);
							eh1.unregisterTxEvent(deployId);

							if (code !== 'VALID') {
								t.pass('The chaincode deploy transaction was valid');
								reject();
							} else {
								t.pass('The chaincode deploy transaction was not valid code='+code);
								resolve();
							}
						});
					});
					var txPromise2 = new Promise((resolve, reject) => {
						let handle = setTimeout(reject, 30000);

						eh2.registerTxEvent(deployId.toString(), (tx, code) => {
							t.pass('The chaincode deploy transaction has been committed on this '+ peer1);
							clearTimeout(handle);
							eh2.unregisterTxEvent(deployId);

							if (code !== 'VALID') {
								reject();
							} else {
								resolve();
							}
						});
					});

					var sendPromise = chain.sendTransaction(request);
					return Promise.all([sendPromise, txPromise1, txPromise2]).then((results) => {
						if (!useSteps) {
							logger.debug(' event promise all complete');
						} else if (steps.length === 1 && steps[0] === 'step3') {
							logger.debug(' event promise all complete and testing complete');
							t.end();
						}
						return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
					}).catch((err) => {
						t.fail('Failed to send instantiate transaction and get notifications within the timeout period. ');
						t.end();
					});

				} else {
					t.fail('Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...');
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((response) => {
				if (response.status === 'SUCCESS') {
					t.pass('Successfully sent instantiate transaction to the orderer.');
				} else {
					t.fail('Failed to order the instantiate endorsement. Error code: ' + response.status);
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send instantiate due to error: ' + err.stack ? err.stack : err);
				t.end();
			});
		}


		if (!useSteps || steps.indexOf('step3') >= 0) {
			promise = promise.then((admin) => {
				logger.info('Executing step3');
				if(the_user === null) {
					the_user = admin;
				}
				nonce = Buffer.from('12');//hard coded this so that we have a known transaction id that may be queried later
//				nonce = utils.getNonce();

				tx_id = chain.buildTransactionID(nonce, the_user);

				// send proposal to endorser
				var request = {
					chaincodeId : chaincode_id,
					chaincodeVersion : chaincode_version,
					fcn: 'invoke',
					args: ['move', 'a', 'b','100'],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};
				return chain.sendTransactionProposal(request);
			}).then((results) => {
				var all_good = false;
				if (results) {
					var proposalResponses = results[0];
					var proposal = results[1];
					var header   = results[2];

					all_good = true;
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
				}
				if (all_good) {
					t.pass('Successfully obtained transaction endorsements.'); // + JSON.stringify(proposalResponses));
					var request = {
						proposalResponses: proposalResponses,
						proposal: proposal,
						header: header
					};

					var txId = tx_id.toString();
					var txPromise1 = new Promise((resolve, reject) => {
						let handle = setTimeout(reject, 30000);

						eh1.registerTxEvent(txId.toString(), (tx, code) => {
							t.pass('The chaincode invoke move transaction has been successfully committed on this '+ peer0);
							clearTimeout(handle);
							eh1.unregisterTxEvent(txId);

							if (code !== 'VALID') {
								reject();
							} else {
								resolve();
							}
						});
					});
					var txPromise2 = new Promise((resolve, reject) => {
						let handle = setTimeout(reject, 30000);

						eh2.registerTxEvent(txId.toString(), (tx, code) => {
							t.pass('The chaincode invoke move transaction has been successfully committed on this '+ peer1);
							clearTimeout(handle);
							eh2.unregisterTxEvent(txId);

							if (code !== 'VALID') {
								t.pass('The chaincode invoke transaction was valid');
								reject();
							} else {
								t.pass('The chaincode invoke transaction was not valid code='+code);
								resolve();
							}
						});
					});

					var sendPromise = chain.sendTransaction(request);

					return Promise.all([sendPromise, txPromise1, txPromise2]).then((results) => {
						if (!useSteps) {
							logger.debug(' event promise all complete');
						} else if (steps.length === 1 && steps[0] === 'step3') {
							logger.debug(' event promise all complete and testing complete');
							t.end();
						}
						return results[0];
					}).catch((err) => {
						t.fail('Failed to send invoke transaction and get notifications within the timeout period. ');
						t.end();
					});
				} else {
					t.fail('Failed to obtain transaction endorsements. Error code: '
						+ (results ? results : 'Results are null'));
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((response) => {
				if (response && response.status === 'SUCCESS') {
					t.pass('Successfully ordered endorsement transaction.');
				} else {
					t.fail('Failed to order the endorsement of the transaction. Error code: ' + response.status);
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step4') >= 0) {
			promise = promise.then((admin) => {
				logger.info('Executing step4');
				if(the_user === null) {
					the_user = admin;
				}
				nonce = utils.getNonce();
				tx_id = chain.buildTransactionID(nonce, the_user);

				// send query
				var request = {
					targets: [peer0, peer1],
					chaincodeId : chaincode_id,
					chaincodeVersion : chaincode_version,
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce,
					fcn: 'invoke',
					args: ['query','b']
				};
				return chain.queryByChaincode(request);
			},
			(err) => {
				t.comment('Failed to get transaction notification within the timeout period. exiting...');
				t.fail('Error: ' + err.stack ? err.stack : err );
				t.end();
			}).then((response_payloads) => {
				if (response_payloads) {
					for(let i = 0; i < response_payloads.length; i++) {
						t.equal(response_payloads[i].toString('utf8'),'300','checking query results are correct that user b has 300 now after the move');
					}
					t.end();
				} else {
					t.fail('response_payloads is null');
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).catch((err) => {
				t.fail('Failed to end to end test with error:' + err.stack ? err.stack : err);
				t.end();
			});
		}
	});
	t.end();
});
