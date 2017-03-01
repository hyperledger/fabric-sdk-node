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
process.env.HFC_LOGGING = '{"debug": "console"}';
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');

var hfc = require('fabric-client');

var util = require('util');
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var logger = utils.getLogger('GET CONFIG');


// Get the proto bufs
var grpc = require('grpc');
var _eventsProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/events.proto').protos;
var _commonProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
var _conigtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;
var _ccTransProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/transaction.proto').protos;
var _transProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/transaction.proto').protos;
var _responseProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/proposal_response.proto').protos;
var _ccProposalProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/proposal.proto').protos;
var _ccEventProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/peer/chaincodeevent.proto').protos;

var client = new hfc();
// IMPORTANT ------>>>>> MUST RUN new-chain.js FIRST
var chain_id = 'foo';
var chain = client.newChain(chain_id);

var webUser = null;
var tx_id = null;
var nonce = null;
var peer0 = new Peer('grpc://localhost:7051'),
	peer1 = new Peer('grpc://localhost:7056');

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.info('Found query: %s', querys);

testUtil.setupChaincodeDeploy();

chain.addOrderer(new Orderer('grpc://localhost:7050'));
chain.addPeer(peer0);
chain.addPeer(peer1);

test('  ---->>>>> get config <<<<<-----', function(t) {
	hfc.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then( function (store) {
		client.setStateStore(store);
		testUtil.getSubmitter(client, t)
			.then(
				function(admin) {
					t.pass('Successfully enrolled user ' + admin);
					webUser = admin;
					// use default primary peer
					// send query
					logger.debug('will initialize the chain');
					return chain.initialize();
				},
				function(err) {
					t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function(result) {
					t.pass('Chain was successfully initialized');
					var orgs = chain.getOrganizationUnits();
					logger.debug(' Got the following orgs back %j', orgs);
					t.equals(orgs.length, 1, 'Checking the that we got back the right number of orgs');
					t.equals(orgs[0].id, 'DEFAULT', 'Checking the org name');
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
