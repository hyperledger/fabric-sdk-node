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

var test = require('tape');
var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;
var utils = require('../../lib/utils.js');

var grpc = require('grpc');
var _fabricProto = grpc.load('../../lib/protos/fabric.proto').protos;
var _chaincodeProto = grpc.load('../../lib/protos/chaincode.proto').protos;

// FileKeyValueStore tests /////////////
var FileKeyValueStore = require('../../lib/impl/FileKeyValueStore.js');

var keyValStorePath = path.join(getUserHome(), 'kvsTemp');
var testKey = 'keyValFileStoreName';
var testValue = 'secretKeyValue';
// End: FileKeyValueStore tests ////////

// Chain tests /////////////
// var Chain = require('../../lib/Chain.js');
// var chainName = 'testChain';

// End: Chain tests ////////

// Peer tests ////////
// var Peer = require('../../lib/Peer.js');
// var EventEmitter = require('events');
// End: Peer tests ////////


//
// Run the FileKeyValueStore test
//
test('FileKeyValueStore read and write test', function(t) {
	// clean up
	fs.existsSync(keyValStorePath, (exists) => {
		if (exists) {
			execSync('rm -rf ' + keyValStorePath);
		}
	});

	var store = new FileKeyValueStore({
		path: keyValStorePath
	});

	fs.exists(keyValStorePath, (exists) => {
		if (exists)
			t.pass('Successfully created new directory for testValueStore');
		else {
			t.fail('Failed to create new directory: ' + keyValStorePath);
			t.end();
		}
	});

	store.setValue(testKey, testValue)
	.then(function(result) {
		if (result) {
			t.pass('Successfully set value');
		
			fs.exists(path.join(keyValStorePath, testKey), (exists) => {
				if (exists)
					t.pass('Verified the file for key ' + testKey + ' does exist');
				else {
					t.fail('Failed to create file for key ' + testKey);
					t.end();
				}
			});
		} else {
			t.fail('Failed to set value');
			t.end();
		}
	});
	
	store.getValue(testKey)
	.then(
		// Log the fulfillment value
		function(val) {
			if (val != testValue) {
				t.fail(val + ' does not equal testValue of ' + testValue);
				t.end();
			} else 
				t.pass('Successfully retrieved value');
		})
	.catch(
		// Log the rejection reason
		function(reason) {
			t.fail(reason);
		});

	t.end();
});

// test('Chain test', function(t) {
//     var chain = new Chain(chainName);

//     t.end();
// });

// test('Peer test', function(t) {
//     var peer = new Peer('grpc://localhost:7051');

//     var emitter = new EventEmitter();
//     emitter.on('submitted', function(data) {
//         t.pass('Successfully submitted transaction. ' + data);
//         t.end();
//     });
//     emitter.on('error', function(err) {
//         t.fail('ERROR! ' + err);
//         t.end();
//     });

//     peer.sendTransaction(
//         newDevModeDeployTransaction({
//             chaincodeName: 'mycc',
//             fcn: 'init',
//             args: ['a', '100', 'b', '200']
//         }), 
//         emitter);
// });

function getUserHome() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

/**
 * request: {
 *      chaincodeName: string,
 *      fcn: string,
 *      args: string[],
 * }
 */
function newDevModeDeployTransaction(request) {

	var tx = new _fabricProto.Transaction();
	tx.setType(_fabricProto.Transaction.Type.CHAINCODE_DEPLOY);

	// Set the chaincodeID
	var chaincodeID = new _chaincodeProto.ChaincodeID();
	chaincodeID.setName(request.chaincodeName);
	tx.setChaincodeID(chaincodeID.toBuffer());

	// Construct the ChaincodeSpec
	var chaincodeSpec = new _chaincodeProto.ChaincodeSpec();
	// Set Type -- GOLANG is the only chaincode language supported at this time
	chaincodeSpec.setType(_chaincodeProto.ChaincodeSpec.Type.GOLANG);
	// Set chaincodeID
	chaincodeSpec.setChaincodeID(chaincodeID);
	// Set ctorMsg
	var chaincodeInput = new _chaincodeProto.ChaincodeInput();
	chaincodeInput.setArgs(prepend(request.fcn, request.args));
	chaincodeSpec.setCtorMsg(chaincodeInput);

	// Construct the ChaincodeDeploymentSpec (i.e. the payload)
	var chaincodeDeploymentSpec = new _chaincodeProto.ChaincodeDeploymentSpec();
	chaincodeDeploymentSpec.setChaincodeSpec(chaincodeSpec);
	tx.setPayload(chaincodeDeploymentSpec.toBuffer());

	// Set the transaction UUID
	tx.setTxid(request.chaincodeName);

	// Set the transaction timestamp
	tx.setTimestamp(utils.GenerateTimestamp());

	tx.setConfidentialityLevel(_fabricProto.ConfidentialityLevel.PUBLIC);

	return {
		pb: tx, 
		chaincodeID: request.chaincodeName
	};
}

function prepend(item, list) {
	var l = list.slice();
	l.unshift(item);
	return l.map(function(x) { 
		return new Buffer(x);
	});
}
