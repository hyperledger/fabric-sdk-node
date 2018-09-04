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

const chaincodes = [{name: 'example',version: 'v2'}];
const ledger_height = {low: 4, high: 0, unsigned: true};

const discovery_plan = {
	msps: {
		OrdererMSP: {
			id: 'OrdererMSP',
			orgs: [ ],
			rootCerts: pem,
			intermediateCerts: '',
			admins: pem,
			tls_intermediate_certs: ''
		},
		Org2MSP: {
			id: org2[0],
			orgs: [ ],
			rootCerts: pem,
			intermediateCerts: '',
			admins: pem,
			tls_intermediate_certs: ''
		},
		Org1MSP: {
			id: org1[0],
			orgs: [ ],
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
	endorsement_plans: {
		example: {
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
						{mspid: org3[0], endpoint: org3[3], ledger_height, chaincodes, name: org3[3]}
					]
				}
			},
			layouts: [{G0: 1, G1: 1},{G3: 3, G1: 1}]
		}
	}
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
		channel.initialize({discover:true});
	} catch(error) {
		// we will get an error
	}
	const handler = channel._endorsement_handler;
	if(handler && handler.endorse) {
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
	t.equals(map_test_array[test_array[0]], test_array[0], 'Check that internal method _create_map is working');
	t.equals(map_test_array[test_array[1]], test_array[1], 'Check that internal method _create_map is working');
	t.equals(map_test_array[test_array[2]], test_array[2], 'Check that internal method _create_map is working');

	const preferred = handler._create_map([org3[3]]);
	const remove = handler._create_map([org2[1]]);

	handler._modify_groups(preferred, remove, discovery_plan.endorsement_plans['example']);
	t.equal(discovery_plan.endorsement_plans['example'].groups['G1'].peers.length, 1, 'Checking that one peer was removed');
	t.equal(discovery_plan.endorsement_plans['example'].groups['G3'].peers[0].name, org3[3], 'Checking that peer was moved to top of list');

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
	const proposal = Channel._buildSignedProposal(request, 'handlert', client);

	try {
		await handler._endorse(discovery_plan.endorsement_plans['example'], request, proposal);
	} catch(error) {
		if(error instanceof Error) {
			t.fail('Should have received endorsment array');
		} if(Array.isArray(error)) {
			t.pass('So far so good');
		} else {
			t.fail('Unknown endorsement results returned');
		}
	}

	if(temp) Client.setConfigSetting('endorsement-handler-path', temp);
	t.end();
});



async function errorChecker(t, handler, parameters, error_text) {
	try {
		await handler.endorse(parameters);
	} catch(error) {
		if(error.toString().indexOf(error_text)) {
			t.pass('Check for :' + error_text);
		} else {
			t.fail('Check for :' + error_text);
		}
	}
}
