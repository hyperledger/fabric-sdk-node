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

var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
var testUtil = require('./util.js');

var Orderer = require('hfc/lib/Orderer.js');
var Chain = require('hfc/lib/Chain.js');

var keyValStorePath = testUtil.KVS;

var client = new hfc();
client.setStateStore(hfc.newDefaultKeyValueStore({
	path: testUtil.KVS
}));

//
// Orderer via chain setOrderer/getOrderer
//
// Set the orderer URL through the chain setOrderer method. Verify that the
// orderer URL was set correctly through the getOrderer method. Repeat the
// process by updating the orderer URL to a different address.
//
test('\n\n** TEST ** orderer via chain setOrderer/getOrderer', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member');
	try {
		var orderer = new Orderer('grpc://localhost:7050');
		chain.addOrderer(orderer);
		t.pass('Successfully set the new orderer URL');

		var orderers = chain.getOrderers();
		if(orderers !== null && orderers.length > 0 && orderers[0].getUrl() === 'grpc://localhost:7050') {
			t.pass('Successfully retrieved the new orderer URL from the chain');
		}
		else {
			t.fail('Failed to retieve the new orderer URL from the chain');
			t.end();
		}

		try {
			var orderer2 = new Orderer('grpc://localhost:5152');
			chain.addOrderer(orderer2);
			t.pass('Successfully updated the orderer URL');

			var orderers = chain.getOrderers();
			if(orderers !== null && orderers.length > 0 && orderers[1].getUrl() === 'grpc://localhost:5152') {
				t.pass('Successfully retrieved the upated orderer URL from the chain');
				t.end();
			}
			else {
				t.fail('Failed to retieve the updated orderer URL from the chain');
				t.end();
			}
		}
		catch(err2) {
			t.fail('Failed to update the order URL ' + err2);
			t.end();
		}
	}
	catch(err) {
		t.fail('Failed to set the new order URL ' + err);
		t.end();
	}
});

//
// Orderer via chain set/get bad address
//
// Set the orderer URL to a bad address through the chain setOrderer method.
// Verify that an error is reported when trying to set a bad address.
//
test('\n\n** TEST ** orderer via chain set/get bad address', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member1');

	t.throws(
		function() {
			var order_address = 'xxx';
			chain.addOrderer(new Orderer(order_address));
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Test setting a bad orderer address'
	);

	t.throws(
		function() {
			chain.addOrderer(new Orderer());
		},
		/TypeError: Parameter 'url' must be a string/,
		'Test setting an empty orderer address'
	);

	t.end();
});

//
// Orderer via member missing orderer
//
// Attempt to send a request to the orderer with the sendTransaction method
// before the orderer URL was set. Verify that an error is reported when tying
// to send the request.
//
test('\n\n** TEST ** orderer via member missing orderer', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member2');

	testUtil.getSubmitter(client, t)
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');

			// send to orderer
			return chain.sendTransaction('data');
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(status) {
			console.log('Status: ' + status + ', type: (' + typeof status + ')');
			if (status === 0) {
				t.fail('Successfully submitted request, which is bad because the chain is missing orderers.');
			} else {
				t.pass('Successfully tested invalid submission due to missing orderers. Error code: ' + status);
			}

			t.end();
		},
		function(err) {
			console.log('Error: ' + err);
			t.pass('Successfully tested invalid submission due to missing orderers. Error code: ' + err);
			t.end();
		}
	).catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});

//
// Orderer via member null data
//
// Attempt to send a request to the orderer with the sendTransaction method
// with the data set to null. Verify that an error is reported when tying
// to send null data.
//
test('\n\n** TEST ** orderer via member null data', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member3');

	chain.addOrderer(new Orderer('grpc://localhost:7050'));

	testUtil.getSubmitter(client, t)
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');

			// send to orderer
			return chain.sendTransaction(null);
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(status) {
			if (status === 0) {
				t.fail('Successfully submitted request, which is bad because the submission was missing data');
				t.end();
			} else {
				t.pass('Successfully tested invalid submission due to null data. Error code: ' + status);

				return chain.sendTransaction('some non-null but still bad data');
			}
		},
		function(err) {
			t.pass('Failed to submit. Error code: ' + err);
			t.end();
		}
	).then(
		function(status) {
			if (status === 0) {
				t.fail('Successfully submitted request, which is bad because the submission was using bad data');
				t.end();
			} else {
				t.pass('Successfully tested invalid submission due to bad data. Error code: ' + status);
				t.end();
			}
		},
		function(err) {
			t.pass('Failed to submit. Error code: ' + err);
			t.end();
		}
	).catch(function(err) {
		t.pass('Failed request. ' + err);
		t.end();
	});
});

//
// Orderer via member bad orderer address
//
// Attempt to send a request to the orderer with the sendTransaction method
// with the orderer address set to a bad URL. Verify that an error is reported
// when tying to send the request.
//
test('\n\n** TEST ** orderer via member bad orderer address', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member4');

	// Set bad orderer address here
	chain.addOrderer(new Orderer('grpc://localhost:5199'));

	testUtil.getSubmitter(client, t)
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');

			// send to orderer
			return chain.sendTransaction('some data');
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(status) {
			console.log('Status: ' + status + ', type: (' + typeof status + ')');
			if (status === 0) {
				t.fail('Successfully submitted request, which is bad because the chain\'s orderer address is invalid');
			} else {
				t.pass('Successfully tested invalid submission due to the chain using orderers with bad addresses. Error code: ' + status);
			}
			t.end();
		},
		function(err) {
			t.pass('Failed to submit ::' + err);
			t.end();
		}
	).catch(function(err) {
		t.pass('Failed to submit orderer request. ' + err);
		t.end();
	});
});
