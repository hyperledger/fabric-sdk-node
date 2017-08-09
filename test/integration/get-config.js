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

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('get-config');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var util = require('util');

var Client = require('fabric-client');
var testUtil = require('../unit/util.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');

// Get the proto bufs
var grpc = require('grpc');
var _eventsProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/events.proto').protos;
var _commonProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
var _conigtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;
var _ccTransProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/transaction.proto').protos;
var _responseProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/proposal_response.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/proposal.proto').protos;
var _ccEventProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/chaincode_event.proto').protos;

var client = new Client();
// IMPORTANT ------>>>>> MUST RUN e2e/create-channel.js FIRST
var channel = client.newChannel(testUtil.END2END.channel);
var ORGS;

var the_user = null;

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.info('Found query: %s', querys);

test('  ---->>>>> get config <<<<<-----', function(t) {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();

	channel.addOrderer(
		new Orderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	var org = 'org1';
	var orgName = ORGS[org].name;
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org][key]['tls_cacerts']));
				let peer = new Peer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					});
				channel.addPeer(peer);
			}
		}
	}

	Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then( function (store) {
		client.setStateStore(store);
		var cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
		client.setCryptoSuite(cryptoSuite);

		testUtil.getSubmitter(client, t, org)
			.then(
				function(admin) {
					t.pass('Successfully enrolled user');
					the_user = admin;

					// use default primary peer
					// send query
					logger.debug('will initialize the channel');
					return channel.initialize();
				},
				function(err) {
					t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(result) {
					t.pass('channel was successfully initialized');
					let orgs = channel.getOrganizations();
					logger.debug(' Got the following orgs back %j', orgs);
					t.equals(orgs.length, 2, 'Checking the that we got back the right number of orgs');
					if(orgs[0].id.indexOf('Or') == 0) {
						t.pass('Found the org name '+ orgs[0].id);
					}
					else {
						t.fail('Did not find the org name of \'org\' :: found ' + orgs[0].id);
					}
					t.end();
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
	});
});
