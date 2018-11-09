/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('DISCOVERY');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const fs = require('fs');
const path = require('path');

const testUtil = require('../unit/util.js');

test('\n\n***** D I S C O V E R Y  *****\n\n', async (t) => {

	// this will use the connection profile to set up the client
	const client_org1 = await testUtil.getClientForOrg(t, 'org1');
	const client_org2 = await testUtil.getClientForOrg(t, 'org2');
	let channel_org1 = null;
	let channel_org2 = null;

	client_org1.setConfigSetting('initialize-with-discovery', true);

	const channel_name = 'discovery';
	const channel_path = path.join(__dirname, '../fixtures/channel/discovery.tx');
	const anchor_path = path.join(__dirname, '../fixtures/channel/discovery_anchor.tx');

	try {
		await createUpdateChannel(t, true, channel_path, channel_name, client_org1, client_org2); // create the channel
		await createUpdateChannel(t, false, anchor_path, channel_name, client_org1, client_org2); // set the anchor peer org1
		t.pass('***** Channel is created and anchor peer updated *****');
	} catch (error) {
		t.fail('Failed to create and update the channel');
	}

	let data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem'));
	let pem = Buffer.from(data).toString();
	const peer_org1 = client_org1.newPeer('grpcs://localhost:7051', {pem: pem, 'ssl-target-name-override': 'peer0.org1.example.com', name: 'peer0.org1.example.com'});

	data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tlscacerts/org2.example.com-cert.pem'));
	pem = Buffer.from(data).toString();
	const peer_org2 = client_org2.newPeer('grpcs://localhost:8051', {pem: pem, 'ssl-target-name-override': 'peer0.org2.example.com', name: 'peer0.org2.example.com'});

	data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
	pem = Buffer.from(data).toString();
	const orderer_org1 = client_org1.newOrderer('grpcs://localhost:7050', {pem: pem, 'ssl-target-name-override': 'orderer.example.com', name: 'orderer.example.com'});
	const orderer_org2 = client_org2.newOrderer('grpcs://localhost:7050', {pem: pem, 'ssl-target-name-override': 'orderer.example.com', name: 'orderer.example.com'});

	try {
		channel_org1 = await joinChannel(t, channel_name, peer_org1, orderer_org1, client_org1);
		channel_org2 = await joinChannel(t, channel_name, peer_org2, orderer_org2, client_org2);
		t.pass('***** Channel has been joined *****');
	} catch (error) {
		t.fail('Failed to join ');
	}

	const first_chaincode_name = 'first';
	const second_chaincode_name = 'second';
	const first_chaincode_ver = 'v10';
	const second_chaincode_ver = 'v10';

	try {
		await installChaincode(t, client_org1, channel_org1, peer_org1, first_chaincode_name, first_chaincode_ver);
		await installChaincode(t, client_org2, channel_org2, peer_org2, first_chaincode_name, first_chaincode_ver);

		await startChaincode(t, client_org1, channel_org1, orderer_org1, [peer_org1, peer_org2], first_chaincode_name, first_chaincode_ver);

		t.pass('***** First chaincode has been installed and started *****');
	} catch (error) {
		t.fail('Failed to start first chaincode ');
	}

	let q_results = {};
	try {
		q_results = await channel_org1.queryInstantiatedChaincodes(peer_org1, true);
	} catch (error) {
		t.fail(error.toString());
	}

	q_results.chaincodes.map((chaincode) => {
		t.pass('Found chaincode ' + chaincode.name);
	});

	// give discovery time to catchup
	await testUtil.sleep(5000);

	let results = await channel_org1._discover({
		target: peer_org1,
		interests: [{chaincodes: [{name:first_chaincode_name}]}],
		config: true
	});
	t.comment('Found first test information ::' + JSON.stringify(results));

	const ledger_height = 3;
	t.equals(results.msps.OrdererMSP.id, 'OrdererMSP', 'Checking MSP ID');
	t.equals(results.msps.Org1MSP.id, 'Org1MSP', 'Checking MSP ID');
	t.equals(results.msps.Org2MSP.id, 'Org2MSP', 'Checking MSP ID');
	t.equals(results.orderers.OrdererMSP.endpoints[0].host, 'orderer.example.com', 'Checking orderer host');
	t.equals(results.orderers.OrdererMSP.endpoints[0].port, 7050, 'Checking orderer port');
	t.equals(results.peers_by_org.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.peers_by_org.Org1MSP.peers[0].ledger_height.low, ledger_height, 'Checking peer ledger_height');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking peer chaincode name');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking peer chaincode version');
	if (results.endorsement_plans[0].groups.G0) {
		if (results.endorsement_plans[0].groups.G0.peers[0].endpoint.includes('example.com:')) {
			t.pass('Checking plan peer endpoint');
		} else {
			t.fail('Checking plan peer endpoint');
		}
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].ledger_height.low, ledger_height, 'Checking plan peer ledger_height');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking plan peer chaincode name');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking plan peer chaincode version');
		testLayoutQuantities(t, results.endorsement_plans[0].layouts);
	} else {
		t.fail('MISSING group results');
	}

	channel_org1.addPeer(peer_org1);
	// try with target name
	results = await channel_org1._discover({
		target: 'peer0.org1.example.com',
		interests: [{chaincodes: [{name:first_chaincode_name}]}],
		config: true
	});
	t.comment('Found second test information ::' + JSON.stringify(results));

	t.equals(results.msps.OrdererMSP.id, 'OrdererMSP', 'Checking MSP ID');
	t.equals(results.msps.Org1MSP.id, 'Org1MSP', 'Checking MSP ID');
	t.equals(results.msps.Org2MSP.id, 'Org2MSP', 'Checking MSP ID');
	t.equals(results.orderers.OrdererMSP.endpoints[0].host, 'orderer.example.com', 'Checking orderer host');
	t.equals(results.orderers.OrdererMSP.endpoints[0].port, 7050, 'Checking orderer port');
	t.equals(results.peers_by_org.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.peers_by_org.Org1MSP.peers[0].ledger_height.low, ledger_height, 'Checking peer ledger_height');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking peer chaincode name');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking peer chaincode version');
	if (results.endorsement_plans[0].groups.G0) {
		t.equals(results.endorsement_plans[0].chaincode, first_chaincode_name, 'Checking plan id');
		if (results.endorsement_plans[0].groups.G0.peers[0].endpoint.includes('example.com:')) {
			t.pass('Checking plan peer endpoint');
		} else {
			t.fail('Checking plan peer endpoint');
		}
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].ledger_height.low, ledger_height, 'Checking plan peer ledger_height');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking plan peer chaincode name');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking plan peer chaincode version');
		testLayoutQuantities(t, results.endorsement_plans[0].layouts);
	} else {
		t.fail('MISSING group results');
	}

	// try without the target specified
	results = await channel_org1._discover({
		interests: [{chaincodes: [{name:first_chaincode_name}]}],
		config: true
	});
	t.comment('Found third test information ::' + JSON.stringify(results));

	t.equals(results.msps.OrdererMSP.id, 'OrdererMSP', 'Checking MSP ID');
	t.equals(results.msps.Org1MSP.id, 'Org1MSP', 'Checking MSP ID');
	t.equals(results.msps.Org2MSP.id, 'Org2MSP', 'Checking MSP ID');
	t.equals(results.orderers.OrdererMSP.endpoints[0].host, 'orderer.example.com', 'Checking orderer host');
	t.equals(results.orderers.OrdererMSP.endpoints[0].port, 7050, 'Checking orderer port');
	t.equals(results.peers_by_org.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.peers_by_org.Org1MSP.peers[0].ledger_height.low, ledger_height, 'Checking peer ledger_height');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking peer chaincode name');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking peer chaincode version');
	if (results.endorsement_plans[0].groups.G0) {
		if (results.endorsement_plans[0].groups.G0.peers[0].endpoint.includes('example.com:')) {
			t.pass('Checking plan peer endpoint');
		} else {
			t.fail('Checking plan peer endpoint');
		}
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].ledger_height.low, ledger_height, 'Checking plan peer ledger_height');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].name, first_chaincode_name, 'Checking plan peer chaincode name');
		t.equals(results.endorsement_plans[0].groups.G0.peers[0].chaincodes[0].version, first_chaincode_ver, 'Checking plan peer chaincode version');
		testLayoutQuantities(t, results.endorsement_plans[0].layouts);
	} else {
		t.fail('MISSING group results');
	}

	// check that we are able to make a query for the local peers
	const queryPeerRequest = {
		target: peer_org1,
		useAdmin: true,
		asLocalhost: true
	};

	results = await client_org1.queryPeers(queryPeerRequest);

	t.comment('Found local peer information ::' + JSON.stringify(results));

	t.equals(results.local_peers.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking org1 peer endpoint');
	t.equals(results.local_peers.Org2MSP.peers[0].endpoint, 'peer0.org2.example.com:8051', 'Checking org2 peer endpoint');


	// clean up
	channel_org1.removePeer(peer_org1);
	channel_org1._use_discovery = false;

	t.equal(channel_org1.getPeers().length, 0, 'Checking that there are no peers assigned to the channel');
	t.equal(channel_org1.getOrderers().length, 0, 'Checking that there are no orderers assigned to the channel');

	const bad_orderer = client_org1.newOrderer('grpc://somebadhost:1000');
	channel_org1.addOrderer(bad_orderer); // will put this orderer first on the list

	// This will call the discovery under the covers and load the channel with msps, orderers, and peers
	results = await channel_org1.initialize({asLocalhost: true, discover: true, target: peer_org1});

	t.equal(channel_org1.getOrderers().length, 2, 'Checking that there are two orderers assigned to the channel');
	const msps = channel_org1.getMSPManager().getMSPs();
	t.equals(msps.Org1MSP._id, 'Org1MSP', 'Check that the MSP was loaded by initialize');

	// check orgs ... actually gets names from the msps loaded
	const orgs = channel_org1.getOrganizations();
	for (const index in orgs) {
		const org = orgs[index].id;
		if (org === 'Org1MSP' || org === 'Org2MSP' || org === 'OrdererMSP') {
			t.pass('Checking call to get organizations on the channel after using the discovery service for ' + org);
		} else {
			t.fail('Checking call to get organizations on the channel after using the discovery service for ' + org);
		}
	}

	t.equals(channel_org1.getOrderers()[1].getUrl(), 'grpcs://localhost:7050', 'Checking orderer url');
	t.equals(channel_org1.getPeers().length, 2, 'Checking number of found peers');

	q_results = await channel_org1.queryInstantiatedChaincodes(null, true);
	t.equals(q_results.chaincodes[0].name, first_chaincode_name, 'Checking able to query using a discovered peer');

	let request = {
		chaincodeId: first_chaincode_name,
		preferred: ['peer6.org1.example.com:7077'],
		ignored:['peer9.org2,example.com:8077']
	};
	let tx_id_string = await testUtil.invokeAsAdmin(t, client_org1, channel_org1, request);

	await testUtil.queryChannelAsAdmin(t, client_org1, channel_org1, tx_id_string, null, first_chaincode_name);

	const discovered_peers = channel_org1.getPeers();
	t.equals(discovered_peers.length, 2, 'Checking the size of discovered peers');

	const force_target_request = {
		chaincodeId: first_chaincode_name,
		target: 'peer0.org1.example.com'
	};
	await testUtil.invokeAsAdmin(t, client_org1, channel_org1, force_target_request);

	t.pass('***** Invokes and Queries complete *****');

	const tx_id = client_org1.newTransactionID(true);
	tx_id_string = tx_id.getTransactionID();
	request = {
		chaincodeId : 'first',
		fcn: 'move',
		args: ['a', 'b', '100'],
		txId: tx_id,
		endorsement_hint: {chaincodes: [{name: 'shouldNotFindMe'}]}
	};
	try {
		results = await channel_org1.sendTransactionProposal(request);
		t.fail('unknown chaincode should have failed to endorse');
	} catch (error) {
		if (error.toString().includes('No endorsement plan available')) {
			t.pass('Successfully got an error when the hint was not found ' + error);
		} else {
			t.fail('Should have gotten a not found message ::' + error);
		}
	}


	try {
		await installChaincode(t, client_org1, channel_org1, peer_org1, second_chaincode_name, second_chaincode_ver);
		await installChaincode(t, client_org2, channel_org2, peer_org2, second_chaincode_name, second_chaincode_ver);

		await startChaincode(t, client_org1, channel_org1, orderer_org1, [peer_org1, peer_org2], second_chaincode_name, second_chaincode_ver);

		t.pass('***** Second chaincode has been installed and started *****');
	} catch (error) {
		t.fail('Failed to start second chaincode ');
	}

	const cc2cc_request = {
		chaincodeId : first_chaincode_name,
		fcn: 'call',
		args: [second_chaincode_name, 'move', 'a', 'b', '100'],
		txId: client_org1.newTransactionID(true),
		endorsement_hint: {chaincodes: [{name: first_chaincode_name}, {name: second_chaincode_name}]}
	};
	try {
		results = await channel_org1.sendTransactionProposal(cc2cc_request);
		if (testUtil.checkGoodResults(t, results)) {
			t.pass('Successfully endorsed chaincode to chaincode');
		} else {
			t.fail('Failed to endorse using a chaincode to chaincode call');
		}
	} catch (error) {
		t.fail('Failed to have received a good chaincode to chaincode endorsement ::' + error);
	}

	const collections_request = {
		chaincodeId : first_chaincode_name,
		fcn: 'call',
		args: [second_chaincode_name, 'move', 'a', 'b', '100'],
		txId: client_org1.newTransactionID(true),
		endorsement_hint: {chaincodes: [
			{name: first_chaincode_name, collection_names: ['detailCol', 'sensitiveCol']},
			{name: second_chaincode_name, collection_names: ['detailCol', 'sensitiveCol']}
		]}
	};
	try {
		results = await channel_org1.sendTransactionProposal(collections_request);
		if (testUtil.checkGoodResults(t, results)) {
			t.pass('Successfully endorsed chaincode to chaincode with collections');
		} else {
			t.fail('Failed to endorse using a chaincode to chaincode call with collections');
		}
	} catch (error) {
		t.fail('Failed to have received a good chaincode to chaincode endorsement with collections::' + error);
	}

	t.pass('End discovery testing');
	t.end();
});

function testLayoutQuantities(t, layouts) {
	for (const layout of layouts) {
		if (layout.G0) {
			t.equals(layout.G0, 1, 'Checking layout quantities_by_group');
		} else if (layout.G1) {
			t.equals(layout.G1, 1, 'Checking layout quantities_by_group');
		} else {
			t.fail('Layout quantities_by_group not found');
		}
	}
}

async function installChaincode(t, client, channel, peer, chaincode_id, chaincode_ver) {
	const chaincode_path = path.resolve(__dirname, '../fixtures/src/node_cc/example_cc');

	try {
		// send proposal to endorser
		const request = {
			targets: [peer],
			chaincodePath: chaincode_path,
			metadataPath: null,
			chaincodeId: chaincode_id,
			chaincodeType: 'node',
			chaincodeVersion: chaincode_ver
		};

		const install_results = await client.installChaincode(request);
		if (install_results && !(install_results[0] instanceof Error)) {
			t.pass('Able to install chaincode ' + chaincode_id + ' on the peer');
		} else {
			t.failed('Chaincode not installed');
		}
	} catch (error) {
		logger.error(error);
		t.fail('Failed to install');
		throw Error('Failed install');
	}
}

async function startChaincode(t, client, channel, orderer, peers, chaincode_id, chaincode_ver) {

	try {
		const tx_id = client.newTransactionID(true);

		const policy = {
			identities: [
				{role: {name: 'member', mspId: 'Org1MSP'}},
				{role: {name: 'member', mspId: 'Org2MSP'}}
			],
			policy: {
				'1-of': [
					{'signed-by': 0},
					{'signed-by': 1}
				]
			}
		};

		// send proposal to endorser
		const proposal_request = {
			targets: peers,
			chaincodeId: chaincode_id,
			chaincodeVersion: chaincode_ver,
			fcn: 'init',
			args: ['a', '100', 'b', '200'],
			txId: tx_id,
			chaincodeType: 'node',
			// use this to demonstrate the following policy:
			// 'if signed by org1 admin, then that's the only signature required,
			// but if that signature is missing, then the policy can also be fulfilled
			// when members (non-admin) from both orgs signed'
			'endorsement-policy': policy,
			'collections-config': [
				{
					'name': 'detailCol',
					'policy': policy,
					'requiredPeerCount': 0,
					'maxPeerCount': 1,
					'blockToLive': 100
				},
				{
					'name': 'sensitiveCol',
					'policy': policy,
					'requiredPeerCount': 0,
					'maxPeerCount': 1,
					'blockToLive': 100
				}
			]
		};

		const proposal_results = await channel.sendInstantiateProposal(proposal_request, 10 * 60 * 1000);
		if (proposal_results[0][0].response.status === 200) {
			const commit_request = {
				orderer: orderer,
				proposalResponses: proposal_results[0],
				proposal: proposal_results[1],
				txId : tx_id
			};
			const commit_results = await channel.sendTransaction(commit_request);
			if (commit_results && commit_results.status === 'SUCCESS') {
				await testUtil.sleep(10000); // let the discovery catch up
				t.pass('Chaincode committed and running');
			} else {
				t.fail('Chaincode is not running');
			}
		}
	} catch (error) {
		logger.error(error);
	}
}

async function createUpdateChannel(t, create, file, channel_name, client_org1, client_org2) {
	// get the config envelope created by the configtx tool
	const envelope_bytes = fs.readFileSync(file);
	// Have the sdk get the config update object from the envelope.
	// the config update object is what is required to be signed by all
	// participating organizations
	const config = client_org1.extractChannelConfig(envelope_bytes);
	t.pass('Successfully extracted the config update from the configtx envelope');

	const signatures = [];
	// sign the config by the  admins
	const signature1 = client_org1.signChannelConfig(config);
	signatures.push(signature1);
	t.pass('Successfully signed config update for org1');
	const signature2 = client_org2.signChannelConfig(config);
	signatures.push(signature2);
	t.pass('Successfully signed config update for org2');
	// now we have enough signatures...

	// get an admin based transaction
	const tx_id = client_org1.newTransactionID(true);

	const request = {
		config: config,
		signatures : signatures,
		name : channel_name,
		orderer : 'orderer.example.com',
		txId  : tx_id
	};

	try {
		let results = null;
		let text = 'create';
		if (create) {
			results = await client_org1.createChannel(request);
		} else {
			text = 'update';
			results = await client_org1.updateChannel(request);
		}
		if (results.status === 'SUCCESS') {
			t.pass('Successfully ' + text + ' the channel.');
			await testUtil.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ' + results.status + ' :: ' + results.info);
			throw new Error('Failed to ' + text + ' the channel. ');
		}
	} catch (error) {
		logger.error('Discovery channel/update - catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Failed to create/update channel :' + error);
		throw Error('Failed to create/update the channel');
	}
}

async function joinChannel(t, channel_name, peer, orderer, client) {
	try {
		const channel = client.newChannel(channel_name);

		// get an admin based transaction
		let tx_id = client.newTransactionID(true);

		let request = {
			orderer: orderer,
			txId : 	tx_id
		};

		const genesis_block = await channel.getGenesisBlock(request);
		t.pass('Successfully got the genesis block');

		tx_id = client.newTransactionID(true);
		request = {
			targets: [peer],
			block : genesis_block,
			txId : 	tx_id
		};

		const join_results = await channel.joinChannel(request, 30000);
		if (join_results && join_results[0] && join_results[0].response && join_results[0].response.status === 200) {
			t.pass('Successfully joined channel on org');
		} else {
			t.fail('Failed to join channel on org');
			throw new Error('Failed to join channel on org');
		}

		return channel;
	} catch (error) {
		logger.error('Not able to join ' + error);
		t.fail('Failed to join ');
		throw Error('Failed to join');
	}
}
