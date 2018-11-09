/**
 * Copyright 2016-2017 IBM All Rights Reserved.
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

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const Long = require('long');

const Client = require('fabric-client');
const Channel = require('fabric-client/lib/Channel.js');
const TestUtil = require('./util.js');

const pem = '-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n';
const org1 = [
	'Org1MSP',
	'peer1.org1.example.com:7001',
	'peer2.org1.example.com:7002'
];
const org2 = [
	'Org2MSP',
	'peer1.org2.example.com:8001',
	'peer2.org2.example.com:8002'
];
const org3 = [
	'Org3MSP',
	'peer1.org3.example.com:9001',
	'peer2.org3.example.com:9002',
	'peer3.org3.example.com:9003'
];

const chaincodes = [{name: 'example', version: 'v2'}];
const ledger_height = Long.fromValue(100);
const smaller = Long.fromValue(10);

const discovery_plan = {
	msps: {
		OrdererMSP: {
			id: 'OrdererMSP',
			orgs: [],
			rootCerts: pem,
			intermediateCerts: '',
			admins: pem,
			tls_intermediate_certs: ''
		},
		Org2MSP: {
			id: org2[0],
			orgs: [],
			rootCerts: pem,
			intermediateCerts: '',
			admins: pem,
			tls_intermediate_certs: ''
		},
		Org1MSP: {
			id: org1[0],
			orgs: [],
			rootCerts: pem,
			intermediateCerts: '',
			admins: pem,
			tls_intermediate_certs: ''
		},
	},
	orderers: {
		OrdererMSP: {endpoints: [{host: 'orderer.example.com', port: 7150, name: 'orderer.example.com'}]}
	},
	peers_by_org: {
		Org1MSP: {
			peers: [
				{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
				{mspid: org1[0], endpoint: org1[2], ledger_height, chaincodes, name: org1[2]}
			]
		},
		Org2MSP: {
			peers: [
				{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
				{mspid: org2[0], endpoint: org2[2], ledger_height, chaincodes, name: org2[2]}
			]
		},
		Org3MSP: {
			peers: [
				{mspid: org3[0], endpoint: org3[1], ledger_height, chaincodes, name: org3[1]},
				{mspid: org3[0], endpoint: org3[2], ledger_height, chaincodes, name: org3[2]},
				{mspid: org3[0], endpoint: org3[3], ledger_height, chaincodes, name: org3[3]}
			]
		}
	},
	endorsement_plans: [{
		plan_id: 'example',
		groups: {
			G0: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledger_height, chaincodes, name: org1[2]}
				]
			},
			G1: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledger_height, chaincodes, name: org2[2]}
				]
			},
			G3: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
					{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
					{mspid: org3[0], endpoint: org3[1], ledger_height, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledger_height, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledger_height: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{G0: 1, G1: 1}, {G3: 3, G1: 1}]
	}]
};


test('\n\n ** DiscoveryEndorsementHandler - test **\n\n', async (t) => {

	const temp = Client.getConfigSetting('endorsement-handler');
	Client.setConfigSetting('endorsement-handler', 'fabric-client/lib/impl/DiscoveryEndorsementHandler.js');

	const client = new Client();
	const store = await Client.newDefaultKeyValueStore({path: TestUtil.storePathForOrg('org1')});
	client.setStateStore(store);
	await TestUtil.setAdmin(client, 'org1');
	const channel = client.newChannel('handlertest');
	try {
		const results = await channel.initialize({discover:true});
		if (results) {
			t.fail('This call should have failed');
		}
	} catch (error) {
		t.pass('This should fail ::' + error.toString());
	}
	const handler = channel._endorsement_handler;
	if (handler && handler.endorse) {
		t.pass('Able to have the channel create the handler');
	} else {
		t.fail('Channel was not able to create the handler');
		t.end();
		return;
	}
	let parameters = null;
	await errorChecker(t, handler, parameters, 'Missing all');
	parameters = {};
	await errorChecker(t, handler, parameters, 'Missing "request"');
	parameters.request = {};
	await errorChecker(t, handler, parameters, 'Missing "signed_proposal"');
	parameters.signed_proposal = {};
	await errorChecker(t, handler, parameters, 'Missing "chaincodeId"');
	parameters.request.chaincodeId = 'somename';
	await errorChecker(t, handler, parameters, 'Missing "txId"');
	parameters.request.txId = 'someid';
	await errorChecker(t, handler, parameters, 'Missing "args"');

	const test_array = ['a', 'b', 'c'];
	const map_test_array = handler._create_map(test_array);
	t.deepEquals(map_test_array.get('a'), test_array[0], 'Check that internal method _create_map is working');
	t.deepEquals(map_test_array.get('b'), test_array[1], 'Check that internal method _create_map is working');
	t.deepEquals(map_test_array.get('c'), test_array[2], 'Check that internal method _create_map is working');

	const peers = discovery_plan.endorsement_plans[0].groups.G3.peers;

	// test for ignoring
	let ignored = handler._create_map([peers[0].endpoint]);
	let required = handler._create_map();
	let preferred = handler._create_map();
	let ignored_orgs = handler._create_map();
	let required_orgs = handler._create_map();
	let preferred_orgs = handler._create_map();
	let removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 4, 'Check that the list is the right size');
	t.deepEquals(peers[1], removed_list[0], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing all ignored peers');

	// test for requiring
	ignored = handler._create_map();
	required = handler._create_map([peers[1].endpoint]);
	ignored_orgs = handler._create_map();
	required_orgs = handler._create_map();
	removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 1, 'Check that the list is the right size');
	t.deepEquals(peers[1], removed_list[0], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing all non required peers');

	// test for ignoring and requiring
	ignored = handler._create_map([peers[0].endpoint]);
	required = handler._create_map([peers[1].endpoint]);
	ignored_orgs = handler._create_map();
	required_orgs = handler._create_map();
	removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 1, 'Check that the list is the right size');
	t.deepEquals(peers[1], removed_list[0], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing all ignored peers and non required peers');

	// test for ignoring orgs
	ignored = handler._create_map();
	required = handler._create_map();
	ignored_orgs = handler._create_map(['Org3MSP']);
	required_orgs = {};
	removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 2, 'Check that the list is the right size');
	t.deepEquals(peers[0], removed_list[0], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing all ignored organizations');

	// test for requiring orgs
	ignored = handler._create_map();
	required = handler._create_map([peers[1].endpoint]);
	ignored_orgs = handler._create_map();
	required_orgs = handler._create_map(['Org3MSP', 'Org1MSP']);
	removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 5, 'Check that the list is the right size');
	t.deepEquals(peers[1], removed_list[1], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing non required organizations and non required peers');

	// test for requiring orgs
	ignored = handler._create_map();
	required = handler._create_map();
	ignored_orgs = handler._create_map();
	required_orgs = handler._create_map(['Org3MSP', 'Org1MSP']);
	removed_list = handler._removePeers(ignored, ignored_orgs, required, required_orgs, peers);
	t.equals(removed_list.length, 4, 'Check that the list is the right size');
	t.deepEquals(peers[0], removed_list[0], 'Checking that the removed list has the correct first peer');
	t.pass('Successfully check removing non required organizations');

	const test_array_objects = [{a: 0, b: 0}, {a: 1, b: 1}, {a: 2, b: 2}, {a: 3, b: 3}, {a: 4, b: 4}];
	const randoms = handler._getRandom(test_array_objects);
	const check_array = [false, false, false, false, false];
	for (const random of randoms) {
		t.pass(' found random "a" value:' + random.a);
		check_array[random.a] = true;
	}
	let found_all = true;
	for (const check of check_array) {
		found_all = found_all & check;
	}
	t.ok(found_all, 'Check that all array objects were found in the randomized list');

	const unsorted = [
		{name:'a', ledger_height: Long.fromValue(90)},
		{name:'b', ledger_height: Long.fromValue(99)},
		{name:'c', ledger_height: Long.fromValue(92)},
		{name:'d', ledger_height: Long.fromValue(100)},
		{name:'e', ledger_height: Long.fromValue(97)},
		{name:'f', ledger_height: Long.fromValue(98)},
		{name:'g', ledger_height: Long.fromValue(91)},
		{name:'h', ledger_height: Long.fromValue(93)}
	];

	const highest = handler._findHighest(unsorted);
	t.equals(highest.toNumber(), 100, 'Check that highest ledger height was found');

	const sorted = handler._sortPeerList('ledgerHeight', unsorted);
	t.pass('Successfully sorted the list');
	t.equals(sorted[0].name, 'd', 'Check that the correct item is on the sorted list');
	t.equals(sorted[1].name, 'b', 'Check that the correct item is on the sorted list');
	t.equals(sorted[2].name, 'f', 'Check that the correct item is on the sorted list');
	t.equals(sorted[3].name, 'e', 'Check that the correct item is on the sorted list');
	t.equals(sorted[4].name, 'h', 'Check that the correct item is on the sorted list');
	t.equals(sorted[5].name, 'c', 'Check that the correct item is on the sorted list');
	t.equals(sorted[6].name, 'g', 'Check that the correct item is on the sorted list');
	t.equals(sorted[7].name, 'a', 'Check that the correct item is on the sorted list');

	preferred = handler._create_map([peers[1].endpoint]);
	preferred_orgs = handler._create_map(['Org3MSP']);
	const preferred_height_gap = Long.fromValue(10);
	const list = handler._splitList(preferred, preferred_orgs, preferred_height_gap, highest, peers);
	t.equals(list.priority[0].name, 'peer1.org2.example.com:8001', 'Checking the peer in the list');
	t.equals(list.priority[1].name, 'peer1.org3.example.com:9001', 'Checking the peer in the list');
	t.equals(list.priority[2].name, 'peer2.org3.example.com:9002', 'Checking the peer in the list');
	t.equals(list.non_priority[0].name, 'peer1.org1.example.com:7001', 'Checking the peer in the list');
	t.equals(list.non_priority[1].name, 'peer3.org3.example.com:9003', 'Checking the peer in the list');
	t.pass('Successfully split the list into priority and non priority');


	required = handler._create_map();
	ignored_orgs = handler._create_map();
	required_orgs = handler._create_map();
	preferred_orgs = handler._create_map();
	preferred = handler._create_map([org3[2]]);
	ignored = handler._create_map([org2[1]]);
	handler._modify_groups(required, preferred, ignored, required_orgs, preferred_orgs, ignored_orgs,
		preferred_height_gap, 'random', discovery_plan.endorsement_plans[0]);
	t.equal(discovery_plan.endorsement_plans[0].groups.G1.peers.length, 1, 'Checking that one peer was removed');
	t.equal(discovery_plan.endorsement_plans[0].groups.G3.peers[0].name, org3[2], 'Checking that this peer was moved to the top of the list');

	channel.addPeer(client.newPeer('grpcs://' + org1[1], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org1[2], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org2[1], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org2[2], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org3[1], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org3[2], {pem}));
	channel.addPeer(client.newPeer('grpcs://' + org3[3], {pem}));

	const txId = client.newTransactionID();
	const request = {
		args: [],
		chaincodeId: 'example',
		txId: txId
	};
	const proposal = Channel._buildSignedProposal(request, 'handler-test', client);

	try {
		await handler._endorse(discovery_plan.endorsement_plans[0], request, proposal);
		t.fail('Failed to get error');
	} catch (error) {
		if (error instanceof Error) {
			t.pass('Successfully received an endorsement error ' + error);
			if (error.endorsements) {
				for (const endorsement of error.endorsements) {
					if (endorsement instanceof Error) {
						t.pass(' Found error ::' + endorsement.toString());
					} else {
						t.pass(' Found an endorsement ::' + endorsement.success);
					}
				}
			}
		} else {
			t.fail('Unknown endorsement results returned');
		}
	}

	t.pass('Successfully completed sending and receiving timeouts on all peers');

	request.requiredOrgs = ['NotFound'];
	try {
		await handler._endorse(discovery_plan.endorsement_plans[0], request, proposal);
		t.fail('Failed to get error');
	} catch (error) {
		if (error instanceof Error) {
			t.pass('Successfully received an endorsement error ' + error);
			if (error.endorsements) {
				for (const endorsement of error.endorsements) {
					if (endorsement instanceof Error) {
						t.pass(' Found error ::' + endorsement.toString());
					} else {
						t.pass(' Found an endorsement ::' + endorsement.success);
					}
				}
			}
		} else {
			t.fail('Unknown endorsement results returned');
		}
	}

	if (temp) {
		Client.setConfigSetting('endorsement-handler-path', temp);
	}
	t.end();
});



async function errorChecker(t, handler, parameters, error_text) {
	try {
		await handler.endorse(parameters);
	} catch (error) {
		if (error.toString().indexOf(error_text)) {
			t.pass('Check for :' + error_text);
		} else {
			t.fail('Check for :' + error_text);
		}
	}
}
