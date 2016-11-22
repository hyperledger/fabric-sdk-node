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

var path = require('path');

var hfc = require('../..');
var util = require('util');
var grpc = require('grpc');
var testUtil = require('./util.js');
var utils = require('../../lib/utils.js');

var chain = hfc.newChain('testChain-e2e');
var webUser;
var chaincode_id = 'marblescc';

testUtil.setupChaincodeDeploy();

// need to override the default key size 384 to match the member service backend
// otherwise the client will not be able to decrypt the enrollment challenge
utils.setConfigSetting('crypto-keysize', 256);

chain.setKeyValueStore(hfc.newKeyValueStore({
	path: testUtil.KVS
}));

chain.setMemberServicesUrl('grpc://localhost:7054');
chain.setOrderer('grpc://localhost:5151');

test('End-to-end flow of chaincode deploy, transaction invocation, and query', function(t) {
	chain.enroll('admin', 'Xurw3yU9zI0l')
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');
			webUser = admin;

			// send proposal to endorser
			var request = {
				targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
				chaincodePath: testUtil.CHAINCODE_MARBLES_PATH,
				chaincodeId: chaincode_id,
				fcn: 'init',
				args: ['1']
			};

			return admin.sendDeploymentProposal(request);
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(results) {
			var proposalResponses = results[0];
			var proposal = results[1];
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
				return webUser.sendTransaction(proposalResponses, proposal);
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
				if (response.Status === 'SUCCESS') {
					t.pass('Successfully ordered deployment endorsement.');
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
	).then(
		function() {
			// send proposal to endorser
			var request = {
				targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
				chaincodeId : chaincode_id,
				fcn: 'init_marble',
				args: ['marble1','blue','35','tom'],
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
			if (proposalResponses[0].response.status === 200) {
				t.pass('Successfully obtained transaction endorsement to create marbles.' + JSON.stringify(proposalResponses));
				return webUser.sendTransaction(proposalResponses, proposal);
			} else {
				t.fail('Failed to obtain transaction endorsement to create marbles. Error code: ' + status);
				t.end();
			}
		},
		function(err) {
			t.fail('Failed to send transaction proposal to create marbles due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	).then(
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
	).then(
		function() {
			// send proposal to endorser
			var request = {
				targets: [hfc.getPeer('grpc://localhost:7051'), hfc.getPeer('grpc://localhost:7056')],
				chaincodeId : chaincode_id,
				fcn: 'set_owner',
				args: ['marble1','jerry'],
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
			if (proposalResponses[0].response.status === 200) {
				t.pass('Successfully obtained transaction endorsement to set owner.' + JSON.stringify(proposalResponses));
				return webUser.sendTransaction(proposalResponses, proposal);
			} else {
				t.fail('Failed to obtain transaction endorsement to set owner. Error code: ' + status);
				t.end();
			}
		},
		function(err) {
			t.fail('Failed to send transaction proposal for setting owner due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	).then(
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
	).then(
		function() {
			t.end();
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
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

