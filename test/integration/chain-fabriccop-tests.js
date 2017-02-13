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

var hfc = require('fabric-client');
var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');

var utils = require('fabric-client/lib/utils.js');
var User = require('fabric-client/lib/User.js');
var Client = require('fabric-client/lib/Client.js');

var testUtil = require('./util.js');

var keyValStorePath = testUtil.KVS;

// this test uses the FabricCAClientImpl to enroll a user, and
// saves the enrollment materials into a key value store.
// then uses the Client class to load the member from the
// key value store
test('Attempt to use FabricCAServices',function(t){

	var client = new Client();

	utils.setConfigSetting('crypto-keysize', 256);

	hfc.newDefaultKeyValueStore({
		path: keyValStorePath
	})
	.then(
		function(kvs) {
			client.setStateStore(kvs);

			var copService = new FabricCAServices('http://localhost:7054');
			var member;
			copService.enroll({
				enrollmentID: 'admin',
				enrollmentSecret: 'adminpw'
			})
			.then(
				function(testUser) {
					t.pass('Successfully enrolled testUser with CA server');

					member = new User('testUser', client);
					return member.setEnrollment(testUser.key, testUser.certificate);
				},
				function(err) {
					t.fail('Failed to use returned private key and certificate to construct a user object. Error: ' + err);
					t.end();
				}
			).then(
				function() {
					return client.setUserContext(member);
				},
				function(err){
					t.fail('Failed to set user context to client instance. Error: ' + err);
					t.end();
				}
			).then(
				function(user) {
					if (user.getName() === 'testUser') {
						t.pass('Successfully loaded the user from key value store');
						t.end();
					}
				},
				function(err) {
					t.fail('Failed to load the user testUser from key value store. Error: ' + err);
					t.end();
				}
			);
		});
});
