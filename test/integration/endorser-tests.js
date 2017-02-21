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
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var log4js = require('log4js');
var logger = log4js.getLogger('E2E');
logger.setLevel('DEBUG');

var Client = require('fabric-client');
Client.setLogger(logger);
var Peer = require('fabric-client/lib/Peer');
var copService = require('fabric-ca-client');
var util = require('util');
var fs = require('fs');
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');

var keyValStorePath = testUtil.KVS;
var chaincode_id = 'end2end';
var chaincode_version = 'endorser-v0';
var chain_id = 'testchainid';
var tx_id = null;
var nonce = null;
var the_user = null;

testUtil.setupChaincodeDeploy();

//
// Run the endorser good tests
//
test('\n\n** TEST ** endorse chaincode install good test', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new Client();
	var chain = client.newChain('testChain', client);

	Client.newDefaultKeyValueStore({
		path: keyValStorePath
	}).
	then( function (store) {
		client.setStateStore(store);

		// use this test suite to go the "loadFromConfig" path that loads the
		// pre-provisioned private key and cert from an MSP config directory
		testUtil.getSubmitter(client, t, true)
		.then(
			function(admin) {
				if (!!admin)
					t.pass('Successfully enrolled user \'admin\'');
				else {
					t.fail('Failed to obtain enrolled user \'admin\'');
					t.end();
				}

				chain.addPeer(new Peer('grpc://localhost:7051'));
				chain.addPeer(new Peer('grpc://localhost:7056'));

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
					return Promise.resolve(all_good);
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
			})
			.then(function(all_good) {
				// send proposal to endorser
				nonce = utils.getNonce();
				tx_id = chain.buildTransactionID(nonce, the_user);

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
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			})
			.then(function(data) {
				if (Array.isArray(data) && data.length === 3) {
					let response = data[0];

					if (response[0] && response[0].response && response[0].response.status === 200) {
						t.pass('Successfully obtained endorsement.');
					} else {
						t.fail('Failed to obtain endorsement. Error response: ' + response[0]);
					}
				} else {
					t.fail('Invalid response data. Must be an array carrying proposal response, the original proposal payload and header');
				}

				t.end();
			},
			function(err) {
				t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('Failed to obtain a legimiate transaction submitter. ' + err.stack ? err.stack : err);
				t.end();
			}
		);
	}).catch(
		function(err) {
			t.fail('Failed to send instantiate proposal. ' + err.stack ? err.stack : err);
			t.end();
		}
	);
});

function rmdir(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function(file, index) {
			var curPath = path + '/' + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				rmdir(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}
