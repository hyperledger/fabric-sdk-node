/**
 * Copyright 2017 London Stock Exchange All Rights Reserved.
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

'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var log4js = require('log4js');
var logger = log4js.getLogger('events-test');

var path = require('path');

var hfc = require('fabric-client');
hfc.setLogger(logger);

var util = require('util');
var testUtil = require('./util.js');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var eputil = require('./eventutil.js');

var client = new hfc();
var chain = client.newChain('testChain-events-test');

var chaincode_id = 'events_unit_test';
var chain_id = 'testchainid';
var tx_id = null;
var nonce = null;
var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var steps = [];
if (process.argv.length > 2) {
	for (let i = 2; i < process.argv.length; i++) {
		steps.push(process.argv[i]);
	}
}
var useSteps = false;
if (steps.length > 0 &&
	(steps.indexOf('step1') > -1 || steps.indexOf('step2') > -1 || steps.indexOf('step3') > -1))
	useSteps = true;
logger.info('Found steps: %s', steps);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('Test chaincode deploy with event, transaction invocation with chaincode event, and query number of chaincode events', (t) => {
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		var promise = testUtil.getSubmitter(client, t);

		// setup event hub to get notified when transactions are committed
		var eh = new EventHub();
		eh.setPeerAddr('grpc://localhost:7053');
		eh.connect();

		// override t.end function so it'll always disconnect the event hub
		t.end = ((context, eventhub, f) => {
			return function() {
				if (eventhub && eventhub.isconnected()) {
					logger.info('Disconnecting the event hub');
					eventhub.disconnect();
				}

				f.apply(context, arguments);
			};
		})(t, eh, t.end);

		if (!useSteps || steps.indexOf('step1') >= 0) {
			logger.info('Executing step1');
			promise = promise.then((admin) => {
				t.pass('Successfully enrolled user \'admin\'');
				tx_id = utils.buildTransactionID({
					length: 12
				});
				nonce = utils.getNonce();

				// send proposal to endorser
				var request = {
					chaincodePath: 'github.com/events_cc',
					chaincodeId: chaincode_id,
					fcn: 'init',
					args: [],
					chainId: chain_id,
					txId: tx_id,
					nonce: nonce
				};

				return chain.sendDeploymentProposal(request);
			},
			(err) => {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}).then((results) => {
				var proposalResponses = results[0];
				var proposal = results[1];
				var header = results[2];
				var all_good = true;
				for (var i in proposalResponses) {
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
					var reginfo = {
						type: 'TX',
						txid: tx_id.toString()
					};
					return eputil.triggerEvent(eh, reginfo, 50000, function() {
						return chain.sendTransaction(request);
					});
				} else {
					t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((results) => {
				if (steps.length === 1 && steps[0] === 'step1') {
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step2') >= 0) {
			promise = promise.then((data) => {
				logger.info('Executing step2');

				tx_id = utils.buildTransactionID({
					length: 12
				});
				nonce = utils.getNonce();
				// send proposal to endorser
				var request = {
					chaincodeId: chaincode_id,
					fcn: 'invoke',
					args: ['invoke', 'SEVERE'],
					chainId: chain_id,
					txId: tx_id.toString(),
					nonce: nonce
				};
				return chain.sendTransactionProposal(request);
			}).then((results) => {
				var proposalResponses = results[0];
				var proposal = results[1];
				var header = results[2];

				var all_good = true;
				for (var i in proposalResponses) {
					let one_good = false;
					if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
						one_good = true;
						logger.info('invoke proposal was good');
					} else {
						logger.error('invoke proposal was bad');
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
					var reginfo = {
						type: 'CHAINCODE',
						chaincodeID: chaincode_id.toString(),
						eventNameRegex: '^evtsender*'
					};
					return eputil.triggerEvent(eh, reginfo, 25000, function() {
						return chain.sendTransaction(request);
					});
				} else {
					t.fail('Failed to obtain transaction endorsements. Error code: ' + results);
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((results) => {
				if (steps.length === 1 && steps[0] === 'step2') {
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to order the transaction due to error: ' + err.stack ? err.stack : err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step3') >= 0) {
			promise = promise.then((data) => {
				logger.info('Executing step3');

				// send query
				var request = {
					targets: [peer0, peer1],
					chaincodeId: chaincode_id,
					chainId: chain_id,
					txId: utils.buildTransactionID(),
					nonce: utils.getNonce(),
					fcn: 'invoke',
					args: ['query']
				};
				return chain.queryByChaincode(request);
			},
			(err) => {
				t.fail('Failed to get transaction notification within the timeout period');
				t.end();
			}).then((response_payloads) => {
				for (let i = 0; i < response_payloads.length; i++) {
					t.equal(response_payloads[i].toString('utf8'), '1', 'checking query results are number of events generated');
				}
				t.end();
			},
			(err) => {
				t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
			).catch((err) => {
				t.fail('Failed to end to end test with error:' + err.stack ? err.stack : err);
				t.end();
			});
		}
	});
});
