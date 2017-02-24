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
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var eputil = require('./eventutil.js');

var client = new hfc();
var chain_id = 'testchainid';
var chain = client.newChain(chain_id);

var chaincode_id = 'events_unit_test';
var chaincode_version = 'v0';
var request = null;
var nonce = null;
var the_user = null;
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
	(steps.indexOf('step1') > -1 || steps.indexOf('step2') > -1 || steps.indexOf('step3') > -1 || steps.indexOf('step4') > -1 ))
	useSteps = true;
logger.info('Found steps: %s', steps);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('Test chaincode instantiate with event, transaction invocation with chaincode event, and query number of chaincode events', (t) => {
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
				the_user = admin;
				request = eputil.createRequest(chain, the_user, chaincode_id, '', '');
				request.chaincodePath = 'github.com/events_cc';
				request.chaincodeVersion = chaincode_version;
				return chain.sendInstallProposal(request);
			},
			(err) => {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}).then((results) => {
				if ( eputil.checkProposal(results)) {
					request = eputil.createRequest(chain, the_user, chaincode_id, 'init', []);
					request.chaincodePath = 'github.com/events_cc';
					request.chaincodeVersion = chaincode_version;
					return chain.sendInstantiateProposal(request);
				} else {
					return Promise.reject('bad install proposal:' + results);
				}
			},
			(err) => {
				t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((results) => {
				var tmo = 50000;
				return Promise.all([eputil.registerTxEvent(eh, request.txId.toString(), tmo),
					eputil.sendTransaction(chain, results)]);
			},
			(err) => {
				t.fail('Failed sending deployment proposal: ' + err);
				t.end();
			}).then((results) => {
				t.pass('Successfully deployed chaincode.');
				if (steps.length === 1 && steps[0] === 'step1') {
					t.end();
				}
			},
			(err) => {
				t.fail('Failed deployment due to error: ' + err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step2') >= 0) {
			promise = promise.then((admin) => {
				logger.info('Executing step2');
				if(the_user === null) {
					the_user = admin;
				}
				request = eputil.createRequest(chain, the_user, chaincode_id, 'invoke', ['invoke', 'SEVERE']);
				return chain.sendTransactionProposal(request);
			}).then((results) => {
				var tmo = 20000;
				return Promise.all([eputil.registerCCEvent(eh, chaincode_id.toString(), '^evtsender*', tmo),
					eputil.sendTransaction(chain, results)
				]);
			},
			(err) => {
				t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}).then((results) => {
				t.pass('Successfully recieved chaincode event.');
				if (steps.length === 1 && steps[0] === 'step2') {
					t.end();
				}
			},
			(err) => {
				t.fail('Failed to recieved chaincode event: ' + err);
				t.end();
			});
		}

		if (!useSteps || steps.indexOf('step3') >= 0) {
			promise = promise.then((admin) => {
				logger.info('Executing step3');
				if(the_user === null) {
					the_user = admin;
				}
				request = eputil.createRequest(chain, the_user, chaincode_id, 'invoke', ['query']);
				return chain.queryByChaincode(request);
			},
			(err) => {
				t.fail('Failed to get transaction notification within the timeout period');
				t.end();
			}).then((response_payloads) => {
				for (let i = 0; i < response_payloads.length; i++) {
					t.equal(response_payloads[i].toString('utf8'), '1', 'checking query results are number of events generated');
				}
				if (steps.length === 1 && steps[0] === 'step3') {
					t.end();
				}
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

		if (!useSteps || steps.indexOf('step4') >= 0) {
			logger.info('Executing step5');
			// Test invalid transaction
			// create 2 invoke requests in quick succession that modify
			// the same state variable which should cause one invoke to
			// be invalid
			var req1 = null;
			var req2 = null;
			promise = promise.then((admin) => {
				if(the_user === null) {
					the_user = admin;
				}
				req1 = eputil.createRequest(chain, the_user, chaincode_id, 'invoke', ['invoke', 'SEVERE']);
				req2 = eputil.createRequest(chain, the_user, chaincode_id, 'invoke', ['invoke', 'SEVERE']);
				return Promise.all([chain.sendTransactionProposal(req1),
					chain.sendTransactionProposal(req2)]);
			}).then(([results1, results2]) => {
				var tmo = 20000;
				return Promise.all([eputil.registerTxEvent(eh, req1.txId.toString(), tmo),
					eputil.registerTxEvent(eh, req2.txId.toString(), tmo),
					eputil.sendTransaction(chain, results1),
					eputil.sendTransaction(chain, results2)
				]);

			}).then(([regResult1, regResult2, sendResult1, sendResult2]) => {
				t.fail('Failed to generate an invalid transaction');
				t.end();
			},
			(err) => {
				t.equal(err, 'invalid', 'Expecting a rejected promise from the 2nd transaction should be invalid');
				t.end();
			});
		}
	});
});
