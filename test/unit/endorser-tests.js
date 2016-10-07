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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var hfc = require('../..');
var util = require('util');
var fs = require('fs');

var keyValStorePath = '/tmp/keyValStore';

//
// Run the endorser test
//
test('endorser test', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = hfc.newChain('testChain');
	var expect = '';
	var found = '';
	var webUser;

	chain.setKeyValueStore(hfc.newKeyValueStore({
		path: keyValStorePath
	}));

	chain.setMemberServicesUrl('grpc://localhost:7054');

	chain.enroll('admin', 'Xurw3yU9zI0l')
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');

			// send proposal to endorser
			var request = {
				endorserUrl: 'grpc://localhost:7051',
				chaincodePath: 'github.com/chaincode_example02',
				fcn: 'init',
				args: ['a', '100', 'b', '200']
			};

			return admin.sendDeploymentProposal(request);
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(status) {
			if (status === 200) {
				t.pass('Successfully obtained endorsement.');
			} else {
				t.fail('Failed to obtain endorsement. Error code: ' + status);
			}

			t.end();
		},
		function(err) {
			t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	).catch(
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
