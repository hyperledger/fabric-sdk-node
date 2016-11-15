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

var path = require('path');
var copService = require('hfc-cop/lib/FabricCOPImpl.js');
var User = require('hfc/lib/User.js');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';
module.exports.CHAINCODE_MARBLES_PATH = 'github.com/marbles_cc';

// directory for file based KeyValueStore
module.exports.KVS = '/tmp/hfc-test-kvs';

// temporarily set $GOPATH to the test fixture folder
module.exports.setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, '../fixtures');
};

function getSubmitter(username, password, client, t) {
	return client.getUserContext(username)
	.then(
		function(user) {
			if (user && user.isEnrolled()) {
				t.pass('Successfully loaded member from persistence');
				return Promise.resolve(user);
			} else {
				// need to enroll it with COP server
				var cop = new copService('http://localhost:8888');

				return cop.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then(
					function(enrollment) {
						t.pass('Successfully enrolled user \'' + username + '\'');

						var member = new User(username, client);
						member.setEnrollment(enrollment.key, enrollment.certificate);
						return client.setUserContext(member);
					}
				).catch(
					function(err) {
						t.fail('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
						t.end();
					}
				);
			}
		},
		function(err) {
			t.fail('Failed to obtain a member object for user. Error: ' + err.stack ? err.stack : err);
			t.end();
		}
	).catch(
		function(err) {
			Promise.reject(err);
		}
	);
}

module.exports.getSubmitter = function(client, test) {
	return getSubmitter('admin', 'adminpw', client, test);
};


