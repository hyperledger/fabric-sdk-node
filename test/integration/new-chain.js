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
var hfc = require('fabric-client');
var util = require('util');
var fs = require('fs');
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var User = require('fabric-client/lib/User.js');
var Peer = require('fabric-client/lib/Peer.js');

var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var keyValStorePath = testUtil.KVS;
var the_user = null;
var tx_id = null;
var nonce = null;
//
//Orderer via member send chain create
//
//Attempt to send a request to the orderer with the sendCreateChain method - fail
//  missing order or invalid order
//
test('\n\n** TEST ** new chain using chain.createChannel() method with good orderer address', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new hfc();
	var chain = client.newChain('foo');
	chain.addOrderer(new Orderer('grpc://localhost:7050'));
	chain.addPeer(peer0);
	chain.addPeer(peer1);

	hfc.newDefaultKeyValueStore({path: testUtil.KVS}
	)
	.then(
		function (store) {
			client.setStateStore(store);
			return testUtil.getSubmitter(client, t);
		}
	)
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');
			the_user = admin;
			// readin the envelope to send to the orderer
			return readFile('./test/fixtures/foo.tx');
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	)
	.then(
		function(data) {
			t.pass('Successfully read file');
			//console.log('envelope contents ::'+JSON.stringify(data));
			var request = {
				envelope : data
			};
			// send to orderer
			return chain.createChannel(request);
		},
		function(err) {
			t.fail('Failed to read file :: ' + err);
			t.end();
		}
	)
	.then(
		function(response) {
			if (response && response.status === 'SUCCESS') {
				t.pass('Successfully created the channel.');
				return sleep(5000);
			} else {
				t.fail('Failed to create the channel. ');
				t.end();
			}
		},
		function(err) {
			t.pass('Failed to initialize the channel: ' + err.stack ? err.stack : err);
			t.end();
		}
	)
	.then(
		function(nothing) {
			t.pass('Successfully waited to make sure new channel was created.');
			nonce = utils.getNonce();
			tx_id = chain.buildTransactionID(nonce, the_user);
			var request = {
				targets : [peer0, peer1],
				txId : 	tx_id,
				nonce : nonce
			};
			return chain.joinChannel(request);
		},
		function(err) {
			t.pass('Failed to sleep due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	)
	.then(
		function(response) {
			console.log(' Join Channel R E S P O N S E ::'+ JSON.stringify(response));
			t.pass('Successfully joined channel.');
			t.end();
		},
		function(err) {
			t.fail('Failed to join channel due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	)
	.catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});


//
//Orderer via member send chain create
//
//Attempt to send a request to the orderer with the sendCreateChain method - fail
// fail due to chain already exist
//
test('\n\n** TEST ** new chain - chain.createChannel() fail due to already exist', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new hfc();
	var chain = client.newChain('testChain2');
	chain.setInitialTransactionId('1234');
	chain.addOrderer(new Orderer('grpc://localhost:7050'));

	hfc.newDefaultKeyValueStore({path: testUtil.KVS}
	)
	.then(
		function (store) {
			client.setStateStore(store);
			return testUtil.getSubmitter(client, t);
		}
	)
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');
			the_user = admin;
			// readin the envelope to send to the orderer
			return readFile('./test/fixtures/foo.tx');
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	)
	.then(
		function(data) {
			t.pass('Successfully read file');
			//console.log('envelope contents ::'+JSON.stringify(data));
			var request = {
				envelope : data
			};
			// send to orderer
			return chain.createChannel(request);
		},
		function(err) {
			t.fail('Failed to read file :: ' + err);
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

function readFile(path) {
	return new Promise(function(resolve, reject) {
		fs.readFile(path, function(err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
