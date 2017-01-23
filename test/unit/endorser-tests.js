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

var Client = require('hfc');
var Peer = require('hfc/lib/Peer');
var copService = require('hfc-cop');
var util = require('util');
var fs = require('fs');
var testUtil = require('./util.js');
var utils = require('hfc/lib/utils.js');

var keyValStorePath = testUtil.KVS;

testUtil.setupChaincodeDeploy();

//
// Run the endorser good tests
//
test('\n\n** TEST ** endorse chaincode deployment good test', function(t) {
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
				// send proposal to endorser
				var request = {
					chaincodePath: testUtil.CHAINCODE_PATH,
					chaincodeId: 'endorser_test',
					fcn: 'init',
					args: ['a', '100', 'b', '200'],
					chainId: 'test_chainid',
					txId: 'blah',
					nonce: utils.getNonce()
				};

				return chain.sendDeploymentProposal(request);
			},
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}
		).then(
			function(data) {
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
				t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
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
			t.fail('Failed to send deployment proposal. ' + err.stack ? err.stack : err);
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
