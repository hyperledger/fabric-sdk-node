/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
process.env.HFC_LOGGING = '{"debug": "console"}';
var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
var testUtil = require('./util.js');

var Orderer = require('hfc/lib/Orderer.js');
var User = require('hfc/lib/User.js');

var keyValStorePath = testUtil.KVS;
//
//Orderer via member send chain create
//
//Attempt to send a request to the orderer with the sendCreateChain method - fail
//  missing order or invalid order
//
test('\n\n** TEST ** new chain using chain.initializeChain() method with bad orderer address', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new hfc();
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	})
	.then( function (store) {
		client.setStateStore(store);
		var chain = client.newChain('testChain2');
		chain.setInitialTransactionId('1234');
		chain.addOrderer(new Orderer('grpc://localhost:9999'));

		testUtil.getSubmitter(client, t)
		.then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send to orderer
				return chain.initializeChain();
			},
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}
		)
		.then(
			function(response) {
				if (response) {
					t.fail('Successfully created chain.');
				} else {
					t.fail('Failed to order the chain create. Error code: ' + response.status);
				}
				t.end();
			},
			function(err) {
				t.pass('Failed to send transaction create due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		)
		.catch(function(err) {
			t.pass('Failed request. ' + err);
			t.end();
		});
	});
});

//
//Orderer via member send chain create
//
//Attempt to send a request to the orderer with the sendCreateChain method - good
//
test('\n\n** TEST ** new chain - chain.initializeChain() success', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new hfc();
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	})
	.then ( function (store) {
		client.setStateStore(store);
		var chain = client.newChain('testChain2');
		chain.setInitialTransactionId('1234');
		chain.addOrderer(new Orderer('grpc://localhost:7050'));

		testUtil.getSubmitter(client, t)
		.then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send to orderer
				return chain.initializeChain();
			},
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}
		)
		.then(
			function(response) {
				if (response && response.block) {
					t.pass('Successfully created chain.');
				} else {
					t.fail('Failed to order the chain create. Error code: ' + response.status);
				}
				t.end();
			},
			function(err) {
				t.fail('Failed to get the genesis block back due to error: ' + err.stack ? err.stack : err);
				t.end();
			}
		)
		.catch(function(err) {
			t.fail('Failed request. ' + err);
			t.end();
		});
	});
});

//
//Orderer via member send chain create
//
//Attempt to send a request to the orderer with the sendCreateChain method - fail
// fail due to chain already exist
//
test('\n\n** TEST ** new chain - chain.initializeChain() fail due to already exist', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new hfc();
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	})
	.then ( function (store) {
		client.setStateStore(store);
		var chain = client.newChain('testChain2');
		chain.setInitialTransactionId('1234');
		chain.addOrderer(new Orderer('grpc://localhost:7050'));

		testUtil.getSubmitter(client, t)
		.then(
			function(admin) {
				t.pass('Successfully enrolled user \'admin\'');
				// send to orderer
				return chain.initializeChain();
			},
			function(err) {
				t.fail('Failed to enroll user \'admin\'. ' + err);
				t.end();
			}
		)
		.then(
			function(response) {
				t.fail('Failed to get correct error. Response code: ' + response);
				t.end();
			},
			function(err) {
				t.pass('Got back failure error. Error code: ' + err);
				t.end();
			}
		)
		.catch(function(err) {
			t.pass('Failed request. ' + err);
			t.end();
		});
	});
});