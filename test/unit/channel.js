/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const sinon = require('sinon');
const rewire = require('rewire');
const _policiesProto = require('fabric-protos').common;
const _mspPrProto = require('fabric-protos').common;

const Client = require('fabric-client');
const testutil = require('./util.js');
const Peer = require('fabric-client/lib/Peer.js');
const Policy = require('fabric-client/lib/Policy.js');
const Channel = rewire('fabric-client/lib/Channel.js');
const Orderer = require('fabric-client/lib/Orderer.js');
const User = require('fabric-client/lib/User.js');
const MSP = require('fabric-client/lib/msp/msp.js');
const MSPManager = require('fabric-client/lib/msp/msp-manager.js');

const utils = require('fabric-client/lib/utils.js');

// Channel tests /////////////
test('\n\n ** Channel - constructor test **\n\n', (t) => {
	testutil.resetDefaults();
	let channelName;
	const client = new Client();
	let _channel;

	t.doesNotThrow(() => {
		utils.setConfigSetting('channel-name-regx-checker', null);
		channelName = 'testChannel';
		_channel = new Channel(channelName, client);
	}, 'Channel constructor tests: skip name pattern checking:0');
	t.doesNotThrow(() => {
		utils.setConfigSetting('channel-name-regx-checker', {
			pattern: '', flags: ''
		});
		channelName = 'testChannel';
		_channel = new Channel(channelName, client);
	}, 'Channel constructor tests: skip name pattern checking:1');

	channelName = 'testchannel';
	_channel = new Channel(channelName, client);
	if (_channel.getName() === channelName) {
		t.pass('Channel constructor test: getName successful');
	} else {
		t.fail('Channel constructor test: getName not successful');
	}
	testutil.resetDefaults();
	t.end();
});

const TWO_ORG_MEMBERS_AND_ADMIN = [{
	role: {
		name: 'peer',
		mspId: 'org1'
	}
}, {
	role: {
		name: 'member',
		mspId: 'org2'
	}
}, {
	role: {
		name: 'admin',
		mspId: 'masterOrg'
	}
}];

const ONE_OF_TWO_ORG_MEMBER = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'1-of': [{'signed-by': 0}, {'signed-by': 1}]
	}
};

const TWO_OF_TWO_ORG_MEMBER = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{'signed-by': 0}, {'signed-by': 1}]
	}
};

const ONE_OF_TWO_ORG_MEMBER_AND_ADMIN = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{
			'1-of': [{'signed-by': 0}, {'signed-by': 1}]
		}, {
			'signed-by': 2
		}]
	}
};

const CRAZY_SPEC = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{
			'1-of': [{
				'signed-by': 0
			}, {
				'1-of': [{'signed-by': 1}, {'signed-by': 2}]
			}]
		}, {
			'1-of': [{
				'2-of': [{'signed-by': 0}, {'signed-by': 1}, {'signed-by': 2}]
			}, {
				'2-of': [{'signed-by': 2}, {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}]
			}]
		}]
	}
};

test('\n\n ** Channel _buildDefaultEndorsementPolicy() tests **\n\n', (t) => {
	const client = new Client();
	const c = new Channel('does-not-matter', client);
	let policy;

	t.throws(
		() => {
			c._buildEndorsementPolicy();
		},
		/Verifying MSPs not found in the channel object, make sure "intialize\(\)" is called first/,
		'Checking that "initialize()" must be called before calling "instantiate()" that uses the endorsement policy'
	);

	// construct dummy msps and msp manager to test default policy construction
	const msp1 = new MSP({
		id: 'msp1',
		cryptoSuite: 'crypto1'
	});

	const msp2 = new MSP({
		id: 'msp2',
		cryptoSuite: 'crypto2'
	});

	const mspm = new MSPManager();
	mspm._msps = {
		'msp1': msp1,
		'msp2': msp2
	};

	c._msp_manager = mspm;
	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy();
		},
		'Checking that after initializing the channel with dummy msps and msp manager, _buildEndorsementPolicy() can be called without error'
	);

	t.equal(Buffer.isBuffer(policy), true, 'Checking default policy has an identities array');

	let env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equal(Array.isArray(env.identities), true, 'Checking decoded default policy has an "identities" array');
	t.equal(env.identities.length, 2, 'Checking decoded default policy has two array items');
	t.equal(env.identities[0].getPrincipalClassification(), _mspPrProto.MSPPrincipal.Classification.ROLE, 'Checking decoded default policy has a ROLE identity');

	t.equal(typeof env.getRule().get('n_out_of'), 'object', 'Checking decoded default policy has an "n_out_of" policy');
	t.equal(env.getRule().get('n_out_of').getN(), 1, 'Checking decoded default policy has an "n_out_of" policy with N = 1');

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: null});
		},
		/Invalid policy, missing the "identities" property/,
		'Checking policy spec: must have identities'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: {name: 'something'}});
		},
		/Invalid policy, the "identities" property must be an array/,
		'Checking policy spec: identities must be an array'
	);

	t.throws(
		() => {
			const identities = [{
				role: {
					name: 'member',
					mspId: 'Org1MSP'
				}
			}];
			c._buildEndorsementPolicy({identities: identities});
		},
		/Invalid policy, missing the "policy" property/,
		'Checking policy spec: must have "policy"'
	);

	t.throws(
		() => {
			policy = {
				identities: [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}
				],
				policy: {
					'1-of': [
						{
							'signed-by': 0
						}
					]
				}
			};
			c._buildEndorsementPolicy({identities: [{dummy: 'value', dummer: 'value'}], policy: policy});
		},
		/Invalid identity type found: must be one of role, organization-unit or identity, but found dummy,dummer/,
		'Checking policy spec: each identity must be "role", "organization-unit" or "identity"'
	);

	t.throws(
		() => {
			policy = {
				identities: [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}
				],
				policy: {
					'1-of': [
						{
							'signed-by': 0
						}
					]
				}
			};
			c._buildEndorsementPolicy({identities: [{role: 'value'}], policy: policy});
		},
		/Invalid role name found: must be one of "peer", "member" or "admin", but found/,
		'Checking policy spec: value identity type "role" must have valid "name" value'
	);

	t.throws(
		() => {
			policy = {
				identities: [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}
				],
				policy: {
					'1-of': [
						{
							'signed-by': 0
						}
					]
				}
			};
			c._buildEndorsementPolicy({identities: [{'organization-unit': 'value'}], policy: policy});
		},
		/NOT IMPLEMENTED/,
		'Checking policy spec: value identity type "organization-unit"'
	);

	t.throws(
		() => {
			policy = {
				identities: [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}
				],
				policy: {
					'1-of': [
						{
							'signed-by': 0
						}
					]
				}
			};
			c._buildEndorsementPolicy({identities: [{identity: 'value'}], policy: policy});
		},
		/NOT IMPLEMENTED/,
		'Checking policy spec: value identity type "identity"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({
				identities: [{role: {name: 'member', mspId: 'value'}}],
				policy: {dummy: 'value'}
			});
		},
		/Invalid policy type found: must be one of "n-of" or "signed-by" but found "dummy"/,
		'Checking policy spec: policy type must be "n-of" or "signed-by"'
	);

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(ONE_OF_TWO_ORG_MEMBER);
		},
		'Building successfully from valid policy spec ONE_OF_TWO_ORG_MEMBER'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.ok(Array.isArray(env.identities) &&
		env.identities.length === 3 &&
		env.identities[0].getPrincipalClassification() === _mspPrProto.MSPPrincipal.Classification.ROLE,
	'Checking decoded custom policy has two items'
	);

	t.equals(env.rule.n_out_of.getN(), 1, 'Checking decoded custom policy has "1 out of"');
	t.equals(env.rule.n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(TWO_OF_TWO_ORG_MEMBER);
		},
		'Building successfully from valid policy spec TWO_OF_TWO_ORG_MEMBER'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule.n_out_of.getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule.n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(ONE_OF_TWO_ORG_MEMBER_AND_ADMIN);
		},
		'Building successfully from valid policy spec ONE_OF_TWO_ORG_MEMBER_AND_ADMIN'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule.n_out_of.getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule.n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.rule.n_out_of.rules[0].n_out_of.getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[0].n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].signed_by, 2, 'Checking decoded custom policy has "signed-by: 2" inside the "2 out of"');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(CRAZY_SPEC);
		},
		'Building successfully from valid policy spec CRAZY_SPEC'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule.n_out_of.getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule.n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.rule.n_out_of.rules[0].n_out_of.getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[0].n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[0].n_out_of.getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[0].n_out_of.getRules().length, 3, 'Checking decoded custom policy has 3 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules().length, 2, 'Checking decoded custom policy has 2 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules()[0].signed_by, 2, 'Checking decoded custom policy has "signed-by: 2" for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules()[1].n_out_of.getN(), 1, 'Checking decoded custom policy has "1 out of" inside "2 out of " inside "1 out of" inside the "2 out of"');

	t.end();
});

test('\n\n ** Channel sendTransactionProposal() tests **\n\n', async (t) => {
	const client = new Client();
	const channel = new Channel('does-not-matter', client);
	channel._use_discovery = false;
	const peer = new Peer('grpc://localhost:7051');

	channel.addPeer(peer);

	await testutil.tapeAsyncThrow(t,
		async () => {
			await channel.sendTransactionProposal();
		},
		/Missing input request object on the proposal request/,
		'Channel tests, sendTransactionProposal(): Missing input request object on the proposal request'
	);

	await testutil.tapeAsyncThrow(t,
		async () => {
			await channel.sendTransactionProposal({
				chaincodeId: 'blah',
				fcn: 'invoke',
				txId: 'blah'
			});
		},
		/Missing "args" in Transaction/,
		'Channel tests, sendTransactionProposal(): Missing "args" in Transaction'
	);

	await testutil.tapeAsyncThrow(t,
		async () => {
			await channel.sendTransactionProposal({
				fcn: 'init',
				args: ['a', '100', 'b', '200'],
				txId: 'blah'
			});
		},
		/Missing "chaincodeId" parameter/,
		'Channel tests, sendTransactionProposal(): Missing "chaincodeId" parameter'
	);

	await testutil.tapeAsyncThrow(t,
		async () => {
			await channel.sendTransactionProposal({
				chaincodeId: 'blah',
				fcn: 'init',
				args: ['a', '100', 'b', '200']
			});
		},
		/Missing "txId" parameter in the proposal request/,
		'Channel tests, sendTransactionProposal(): Missing "txId" parameter in the proposal request'
	);

	t.end();
});


//
// Orderer via channel setOrderer/getOrderer
//
// Set the orderer URL through the channel setOrderer method. Verify that the
// orderer URL was set correctly through the getOrderer method. Repeat the
// process by updating the orderer URL to a different address.
//
test('\n\n** TEST ** orderer via channel setOrderer/getOrderer', (t) => {
	const client = new Client();
	//
	// Create and configure the test channel
	//
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	Client.newDefaultKeyValueStore({
		path: testutil.KVS
	}).then((store) => {
		client.setStateStore(store);

		const channel = client.newChannel('testchannel-orderer-member');
		try {
			const orderer = new Orderer('grpc://localhost:7050');
			channel.addOrderer(orderer);
			t.pass('Successfully set the new orderer URL');

			let orderers = channel.getOrderers();
			if (orderers !== null && orderers.length > 0 && orderers[0].getUrl() === 'grpc://localhost:7050') {
				t.pass('Successfully retrieved the new orderer URL from the channel');
			} else {
				t.fail('Failed to retieve the new orderer URL from the channel');
				t.end();
			}

			try {
				const orderer2 = new Orderer('grpc://localhost:5152');
				channel.addOrderer(orderer2);
				t.pass('Successfully updated the orderer URL');

				orderers = channel.getOrderers();
				if (orderers !== null && orderers.length > 0 && orderers[1].getUrl() === 'grpc://localhost:5152') {
					t.pass('Successfully retrieved the upated orderer URL from the channel');
				} else {
					t.fail('Failed to retieve the updated orderer URL from the channel');
				}

				for (let i = 0; i < orderers.length; i++) {
					channel.removeOrderer(orderers[i]);
					t.pass('Successfully removed orderer');
				}

				t.end();
			} catch (err2) {
				t.fail('Failed to update the order URL ' + err2);
				t.end();
			}
		} catch (err) {
			t.fail('Failed to set the new order URL ' + err);
			t.end();
		}
	});
});

test('\n\n*** Test per-call timeout support ***\n', (t) => {
	const client = new Client();
	const sandbox = sinon.sandbox.create();
	const stub = sandbox.stub(Peer.prototype, 'sendProposal');
	sandbox.stub(Policy, 'buildPolicy').returns(Buffer.from('dummyPolicy'));

	// stub out the calls that requires getting MSPs from the orderer, or
	// a valid user context
	const client_utils = Channel.__get__('client_utils');
	sandbox.stub(client_utils, 'buildHeader').returns(Buffer.from('dummyHeader'));
	sandbox.stub(client_utils, 'buildProposal').returns(Buffer.from('dummyProposal'));
	sandbox.stub(client_utils, 'signProposal').returns(Buffer.from('dummyProposal'));
	client._userContext = {
		getIdentity: () => '',
		getSigningIdentity: () => ''
	};

	const c = new Channel('does-not-matter', client);

	c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051'), new Peer('grpc://localhost:7052')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'v0',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: {
			getTransactionID: () => '1234567',
			isAdmin: () => false,
			getNonce: () => Buffer.from('dummyNonce')
		}
	}, 12345).then(() => {
		t.equal(stub.calledTwice, true, 'Peer.sendProposal() is called exactly twice');
		t.equal(stub.firstCall.args.length, 2, 'Peer.sendProposal() is called first time with exactly 2 arguments');
		t.equal(stub.firstCall.args[1], 12345, 'Peer.sendProposal() is called first time with a overriding timeout of 12345 (milliseconds)');
		t.equal(stub.secondCall.args.length, 2, 'Peer.sendProposal() is called 2nd time with exactly 2 arguments');
		t.equal(stub.secondCall.args[1], 12345, 'Peer.sendProposal() is called 2nd time with a overriding timeout of 12345 (milliseconds)');
		sandbox.restore();
		t.end();
	}).catch((err) => {
		t.fail('Failed to catch the missing chaincodeVersion error. Error: ' + err.stack ? err.stack : err);
		sandbox.restore();
		t.end();
	});
});

test('\n\n ** Channel Discovery tests **\n\n', async (t) => {
	const client = new Client();
	let channel;
	channel = new Channel('does-not-matter', client);
	channel._use_discovery = true;

	const peer = new Peer('grpc://localhost:9999');

	channel.addPeer(peer);

	await setMember(client);

	await testutil.tapeAsyncThrow(t,
		async () => {
			await channel.initialize({
				target: peer
			});
		},
		/deadline/,
		'Check Failed to connect before the deadline'
	);

	try {
		await channel.initialize({
			target: peer,
			endorsementHandler: 'fabric-client/lib/impl/DiscoveryEndorsementHandler.js',
			discover: false
		});
		t.fail('able to initialize channel with a good endorsement handler path');
	} catch (error) {
		if (error.message.includes('Failed to connect before the deadline')) {
			t.pass('Check Failed to initialize channel with good endorsement handler path');
		} else {
			t.fail('2 - Receive other failure ' + error.toString());
		}
	}

	try {
		await channel.initialize({
			target: peer,
			commitHandler: 'no.where'
		});
		t.fail('able to initialize channel with a bad commit handler path');
	} catch (error) {
		if (error.message.includes('Cannot find module')) {
			t.pass('Check Failed to initialize channel with bad commit handler path');
		} else {
			t.fail('1.2 - Receive other failure ' + error.toString());
		}
	}

	const handler_path_temp = client.getConfigSetting('endorsement-handler');
	try {
		client.setConfigSetting('endorsement-handler', 'bad.path');
		channel = client.newChannel('test-channel');
		await channel.initialize({discover:true});
		t.fail('able to create channel with a bad endorsement handler path');
	} catch (error) {
		if (error.message.includes('Cannot find module')) {
			t.pass('Check Failed to create channel with bad endorsement handler path');
		} else {
			t.fail('3 - Receive other failure ' + error.toString());
		}
	}

	try {
		channel._use_discovery = false;
		await channel.getDiscoveryResults();
	} catch (error) {
		if (error.message.includes('This Channel has not been initialized or not initialized with discovery support')) {
			t.pass('Check for:: This Channel has not been initialized or not initialized with discovery support');
		} else {
			t.fail('4 - Receive other failure ' + error.toString());
		}
	}

	try {
		channel._use_discovery = false;
		await channel.getEndorsementPlan();
	} catch (error) {
		if (error.message.includes('This Channel has not been initialized or not initialized with discovery support')) {
			t.pass('Check for:: This Channel has not been initialized or not initialized with discovery support');
		} else {
			t.fail('5 - Receive other failure ' + error.toString());
		}
	}

	try {
		channel._use_discovery = true;

		const chaincode = channel._buildDiscoveryChaincodeCall('somename');
		t.equals(chaincode.name, 'somename', 'checking that the name is correct');

		const endorsement_hint = channel._buildDiscoveryInterest('somechaincode');
		t.equals(endorsement_hint.chaincodes[0].name, 'somechaincode', 'checking that the name is correct');

		channel._discovery_interests.set(JSON.stringify(endorsement_hint), endorsement_hint);

		let added = channel._merge_hints(endorsement_hint);
		t.equal(added, false, 'Check that the new endorsement hint will not be added');

		const endorsement_hint_2 = channel._buildDiscoveryInterest('somechaincode2');
		added = channel._merge_hints(endorsement_hint_2);
		t.equal(added, true, 'Check that the new endorsement hint will be added');

		const plan_id_2 = JSON.stringify(endorsement_hint_2);
		const check_endorsement_hint_2 = channel._discovery_interests.get(plan_id_2);
		t.equals(check_endorsement_hint_2.chaincodes[0].name, 'somechaincode2', 'checking that the name is correct');

		channel._last_discover_timestamp = Date.now();
		channel._discovery_results = {endorsement_plans:[{plan_id: plan_id_2}]};

		const plan = await channel.getEndorsementPlan(endorsement_hint_2);
		t.equals(plan.plan_id, plan_id_2, 'Check the name of endorsement plan retrieved');

		const endorsement_hint_3 = channel._buildDiscoveryInterest('somechaincode3', ['collection1', 'collection2', 'collection3']);
		added = channel._merge_hints(endorsement_hint_3);
		t.equal(added, true, 'Check that the new endorsement hint will be added');

		const plan_id_3 = JSON.stringify(endorsement_hint_3);
		const check_endorsement_hint_3 = channel._discovery_interests.get(plan_id_3);
		t.equals(check_endorsement_hint_3.chaincodes[0].name, 'somechaincode3', 'checking that the name is correct');
		t.equals(check_endorsement_hint_3.chaincodes[0].collection_names[2], 'collection3', 'checking that the collection is correct');

		const proto_interest = channel._buildProtoChaincodeInterest(endorsement_hint_3);
		const proto_chaincodes = proto_interest.getChaincodes();
		const proto_chaincode = proto_chaincodes[0];
		t.equals(proto_chaincode.getName(), 'somechaincode3', 'Checking the protobuf name of the chaincode');
		const proto_collections = proto_chaincode.getCollectionNames();
		t.equals(proto_collections[2], 'collection3', 'Checking that the collection name is correct');

	} catch (error) {
		t.fail(error);
	}

	client.setConfigSetting('endorsement-handler', handler_path_temp);
	t.end();
});

test('\n\n ** Channel mspid tests **\n\n', (t) => {
	const connectionProfile = {
		name: 'test-network',
		version: '1.0',
		client: {
			organization: 'Org1'
		},
		organizations: {
			Org1: {
				mspid: 'Org1MSP'
			}
		}
	};
	const client = Client.loadFromConfig(connectionProfile);
	const channel = new Channel('does-not-matter', client);
	const peer1 = client.newPeer('grpc://localhost:7051');
	channel.addPeer(peer1, 'Org1MSP');
	const peer2 = client.newPeer('grpc://localhost:7052');
	channel.addPeer(peer2, 'Org2MSP');
	const peer3 = client.newPeer('grpc://localhost:7053');
	channel.addPeer(peer3);

	let peers = channel.getPeersForOrg();
	t.equals(peers.length, 2, 'Checking that the number of peers is correct for default org');
	t.equals(peers[0].getUrl(), 'grpc://localhost:7051', 'Checking that the peer is correct by organization name');
	t.equals(peers[1].getUrl(), 'grpc://localhost:7053', 'Checking that the peer is correct by organization name');

	peers = channel.getPeersForOrg('Org2MSP');
	t.equals(peers.length, 2, 'Checking that the number of peers is correct for default org');
	t.equals(peers[0].getUrl(), 'grpc://localhost:7052', 'Checking that the peer is correct by organization name');
	t.equals(peers[1].getUrl(), 'grpc://localhost:7053', 'Checking that the peer is correct by organization name');

	let channel_event_hubs = channel.getChannelEventHubsForOrg();
	t.equals(channel_event_hubs.length, 2, 'Checking that the number of channel_event_hubs is correct for default org');
	t.equals(channel_event_hubs[0].getPeerAddr(), 'localhost:7051', 'Checking that the channel_event_hubs is correct by organization name');
	t.equals(channel_event_hubs[1].getPeerAddr(), 'localhost:7053', 'Checking that the channel_event_hubs is correct by organization name');

	channel_event_hubs = channel.getChannelEventHubsForOrg('Org2MSP');
	t.equals(channel_event_hubs.length, 2, 'Checking that the number of channel_event_hubs is correct for default org');
	t.equals(channel_event_hubs[0].getPeerAddr(), 'localhost:7052', 'Checking that the channel_event_hubs is correct by organization name');
	t.equals(channel_event_hubs[1].getPeerAddr(), 'localhost:7053', 'Checking that the channel_event_hubs is correct by organization name');

	t.end();
});

async function setMember(client) {
	// do some setup for following test
	const member = new User('admin');
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	const store = await Client.newDefaultKeyValueStore({path: testutil.KVS});
	client.setStateStore(store);
	const cryptoUtils = utils.newCryptoSuite();
	const key = await cryptoUtils.generateKey({ephemeral: true});
	const cert = require('./constants.js').TEST_CERT_PEM;
	await member.setEnrollment(key, cert, 'DEFAULT');
	client.setUserContext(member, true);
}
