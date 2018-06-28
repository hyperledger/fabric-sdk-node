/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var sinon = require('sinon');
var rewire = require('rewire');
var grpc = require('grpc');
var _policiesProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/policies.proto').common;
var _mspPrProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/msp/msp_principal.proto').common;

var Client = require('fabric-client');
var testutil = require('./util.js');
var Peer = require('fabric-client/lib/Peer.js');
var Policy = require('fabric-client/lib/Policy.js');
var Channel = rewire('fabric-client/lib/Channel.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var User = require('fabric-client/lib/User.js');
var MSP = require('fabric-client/lib/msp/msp.js');
var MSPManager = require('fabric-client/lib/msp/msp-manager.js');
var idModule = require('fabric-client/lib/msp/identity.js');
var SigningIdentity = idModule.SigningIdentity;

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('channel');

// Channel tests /////////////
test('\n\n ** Channel - constructor test **\n\n', (t) => {
	testutil.resetDefaults();
	let channelName;
	const client = new Client();
	let _channel;


	t.throws(() => {
		channelName = 'testChannel';
		_channel = new Channel(channelName, client);
	}, /channel name should match Regex/, 'Channel constructor tests: invalid name pattern');
	t.doesNotThrow(() => {
		utils.setConfigSetting('channel-name-regx-checker', null);
		channelName = 'testChannel';
		_channel = new Channel(channelName, client);
	}, undefined, 'Channel constructor tests: skip name pattern checking:0');
	t.doesNotThrow(() => {
		utils.setConfigSetting('channel-name-regx-checker', {
			pattern: '', flags: ''
		});
		channelName = 'testChannel';
		_channel = new Channel(channelName, client);
	}, undefined, 'Channel constructor tests: skip name pattern checking:1');

	t.throws(
		() => {
			_channel = new Channel(null, client);
		},
		/^Error: Failed to create Channel. Missing requirement "name" parameter./,
		'Channel constructor tests: Missing name parameter'
	);
	t.throws(
		() => {
			_channel = new Channel({}, client);
		},
		/^Error: Failed to create Channel. channel name should be a string/,
		'Channel constructor tests: Wrong name parameter'
	);

	t.throws(
		() => {
			_channel = new Channel(channelName, null);
		},
		/^Error: Failed to create Channel. Missing requirement "clientContext" parameter./,
		'Channel constructor tests: Missing clientContext parameter'
	);

	channelName = 'testchannel';
	_channel = new Channel(channelName, client);
	if (_channel.getName() === channelName)
		t.pass('Channel constructor test: getName successful');
	else t.fail('Channel constructor test: getName not successful');
	testutil.resetDefaults();
	t.end();
});

test('\n\n ** Channel - method tests **\n\n', function (t) {
	var client = new Client();
	var _channel = new Channel('testchannel', client);

	t.doesNotThrow(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_channel.close();
			_channel.addOrderer(orderer);
			_channel.getOrderer(orderer.getName());
			_channel.close();
		},
		null,
		'checking the channel addOrderer()'
	);
	t.doesNotThrow(
		function () {
			let peer = new Peer('grpc://somehost.com:1234');
			_channel.close();
			_channel.addPeer(peer, 'ANY');
			_channel.removePeer(peer);
			peer = new Peer('grpc://somehost.com:1234', {name: 'peer1'});
			_channel.addPeer(peer, 'OrgMSP');
			const cp = _channel.getChannelPeer('peer1');
			t.equals(cp.getName(), 'peer1', 'Checking channel peer getName');
			t.equals(cp.getMspid(), 'OrgMSP', 'Checking channel peer getMspid');
			cp.getUrl();
			cp.setRole('role', false);
			t.equals(cp.isInRole('role'), false, 'Checking isInRole');
			t.equals(cp.isInRole('unknown'), true, 'Checking isInRole');
			t.equals(cp.isInOrg('OrgMSP'), true, 'checking isInOrg');
			cp._mspid = 'org1';
			t.equals(cp.isInOrg('org2'), false, 'checking isInOrg');
			t.equals(cp.isInOrg('org1'), true, 'checking isInOrg');
			_channel.getChannelEventHub(peer.getName());
			_channel.close();
		},
		null,
		'checking the peer and channel peer methods'
	);
	t.throws(
		function () {
			const cp = _channel.getChannelPeer('peer1');
			t.equals(cp.isInRole(), true, 'Checking isInRole');
		},
		/Missing "role" parameter/,
		'checking Missing role parameter.'
	);
	t.equal(_channel.getOrderers()[0].toString(), 'Orderer:{url:grpc://somehost.com:1234}', 'checking channel getOrderers()');
	t.equal(_channel.getPeers()[0].toString(), 'Peer:{url:grpc://somehost.com:1234}', 'checking channel getPeers()');
	t.equal(_channel.getChannelPeers()[0].toString(), 'Peer:{url:grpc://somehost.com:1234}', 'checking channel getPeers()');
	let peer = _channel.getPeer('peer1');
	t.ok(peer, 'Check that peer was returned');
	t.equal(peer.toString(), 'Peer:{url:grpc://somehost.com:1234}', 'checking channel peer is the same one');
	peer = _channel.getChannelPeer('peer1');
	t.ok(peer, 'Check that peer was returned');
	t.equal(peer.toString(), 'Peer:{url:grpc://somehost.com:1234}', 'checking channel peer is the same one');
	t.throws(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_channel.addOrderer(orderer);
		},
		/^DuplicateOrderer: Orderer/,
		'Channel tests: checking that orderer already exists.'
	);
	let test_string = Buffer.from('{"name":"testchannel","orderers":["Orderer:{url:grpc://somehost.com:1234}"],"peers":["Peer:{url:grpc://somehost.com:1234}"]}');
	let channel_string = Buffer.from(_channel.toString());
	if (test_string.equals(channel_string)) {
		t.pass('Successfully tested Channel toString()');
	} else {
		t.fail('Failed Channel toString() test');
	}
	t.notEquals(_channel.getMSPManager(), null, 'checking the channel getMSPManager()');
	t.doesNotThrow(
		function () {
			var msp_manager = new MSPManager();
			_channel.setMSPManager(msp_manager);
		},
		null,
		'checking the channel setMSPManager()'
	);
	t.notEquals(_channel.getOrganizations(), null, 'checking the channel getOrganizations()');

	t.end();
});

test('\n\n **  Channel query target parameter tests', function (t) {
	var client = new Client();
	var _channel = new Channel('testchannel', client);

	t.throws(
		function () {
			_channel.queryBlockByHash();
		},
		/Blockhash bytes are required/,
		'Channel tests, queryBlockByHash(): checking for Blockhash bytes are required.'
	);

	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'));
		},
		/^Error: "target" parameter not specified and no peers are set on this Channel./,
		'Channel tests, queryBlockByHash(): "target" parameter not specified and no peers are set on Channel.'
	);

	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'), [new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryBlockByHash(): checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'), new Peer('grpc://localhost:7051'));
		},
		/^[Error: Missing userContext parameter]/,
		'Channel tests, queryBlockByHash(): good target, checking for Missing userContext parameter.'
	);

	t.throws(
		function () {
			_channel.queryInfo();
		},
		/^Error: "target" parameter not specified and no peers are set on this Channel./,
		'Channel tests, queryInfo(): "target" parameter not specified and no peers are set on Channel.'
	);

	t.throws(
		function () {
			_channel.queryInfo([new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryInfo: checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryBlock();
		},
		/Block number must be a positive integer/,
		'Channel tests, queryBlock(): Block number must be a positive integer with nothing specified'
	);

	t.throws(
		function () {
			_channel.queryBlock('abc');
		},
		/Block number must be a positive integer/,
		'Channel tests, queryBlock(): Block number must be a positive integer with "abc" specified'
	);

	t.throws(
		function () {
			_channel.queryBlock(1.1);
		},
		/Block number must be a positive integer/,
		'Channel tests, queryBlock(): Block number must be a positive integer with "1.1" specified'
	);

	t.throws(
		function () {
			_channel.queryBlock(-1);
		},
		/Block number must be a positive integer/,
		'Channel tests, queryBlock(): Block number must be a positive integer with "-1" specified'
	);

	t.throws(
		function () {
			_channel.queryBlock(123);
		},
		/^Error: "target" parameter not specified and no peers are set on this Channel./,
		'Channel tests, queryBlock(): "target" parameter not specified and no peers are set on Channel.'
	);

	t.throws(
		function () {
			_channel.queryBlock(123, [new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryBlock(): checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryTransaction();
		},
		/Missing "tx_id" parameter/,
		'Channel tests, queryTransaction(): checking for Missing "tx_id" parameter.'
	);

	t.throws(
		function () {
			_channel.queryTransaction('abc');
		},
		/"target" parameter not specified and no peers are set/,
		'Channel tests, queryTransaction(): "target" parameter not specified and no peers are set'
	);

	t.throws(
		function () {
			_channel.queryTransaction('abc', [new Peer('grpc://localhost:7051')]);
		},
		/target" parameter is an array/,
		'Channel tests, queryTransaction(): checking for "target" parameter is an array'
	);

	t.throws(
		function () {
			_channel.queryInstantiatedChaincodes();
		},
		/"target" parameter not specified and no peers are set/,
		'Channel tests, queryInstantiatedChaincodes(): checking for "target" parameter not specified and no peers are set'
	);

	t.throws(
		function () {
			_channel.queryInstantiatedChaincodes([new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryInstantiatedChaincodes(): checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.end();
});

test('\n\n ** Channel addPeer() duplicate tests **\n\n', function (t) {
	var client = new Client();
	var channel_duplicate = new Channel('channel-duplicate', client);
	var peers = [
		'grpc://localhost:7051',
		'grpc://localhost:7052',
		'grpc://localhost:7053',
		'grpc://localhost:7051'
	];

	var expected = peers.length - 1;

	peers.forEach(function (peer) {
		try {
			var _peer = new Peer(peer);
			channel_duplicate.addPeer(_peer);
		}
		catch (err) {
			if (err.name != 'DuplicatePeer') {
				t.fail('Unexpected error ' + err.toString());
			}
			else {
				t.pass('Expected error message "DuplicatePeer" thrown');
			}
		}
	});

	//check to see we have the correct number of peers
	if (channel_duplicate.getPeers().length == expected) {
		t.pass('Duplicate peer not added to the channel(' + expected +
			' expected | ' + channel_duplicate.getPeers().length + ' found)');
	}
	else {
		t.fail('Failed to detect duplicate peer (' + expected +
			' expected | ' + channel_duplicate.getPeers().length + ' found)');
	}

	t.doesNotThrow(
		function () {
			channel_duplicate.close();
		},
		null,
		'checking the channel close()'
	);

	t.end();
});

test('\n\n ** Channel joinChannel() tests **\n\n', function (t) {
	var client = new Client();
	var channel = new Channel('join-channel', client);

	t.throws(
		() => {
			channel.getGenesisBlock();
		},
		/Missing "orderer" request parameter/,
		'Checking getGenesisBlock(): Missing "orderer" request parameter'
	);

	t.throws(
		() => {
			channel.joinChannel();
		},
		/Missing all/,
		'Checking joinChannel(): Missing all'
	);

	t.throws(
		() => {
			channel.joinChannel({});
		},
		/Missing txId/,
		'Checking joinChannel(): Missing txId'
	);

	t.throws(
		() => {
			channel.joinChannel({ txId: 'txid' });
		},
		/Missing block input parameter/,
		'Checking joinChannel(): Missing block input parameter'
	);

	t.throws(
		() => {
			channel.joinChannel({ txId: 'txid', block: 'something' });
		},
		/"targets" parameter not specified and no peers are set on this Channel/,
		'Checking joinChannel(): "targets" parameter not specified and no peers are set on this Channel'
	);

	t.throws(
		() => {
			channel.joinChannel({ txId: 'txid', block: 'something', targets: [{}] });
		},
		/Target peer is not a valid peer object instance/,
		'Checking joinChannel(): Target peer is not a valid peer object instance'
	);

	t.throws(
		() => {
			channel.joinChannel({ txId: 'txid', block: 'something', targets: 'somename' });
		},
		/not assigned/,
		'Checking joinChannel(): not found'
	);

	t.end();
});

var TWO_ORG_MEMBERS_AND_ADMIN = [{
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

var ONE_OF_TWO_ORG_MEMBER = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
	}
};

var TWO_OF_TWO_ORG_MEMBER = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
	}
};

var ONE_OF_TWO_ORG_MEMBER_AND_ADMIN = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{
			'1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
		}, {
			'signed-by': 2
		}]
	}
};

var CRAZY_SPEC = {
	identities: TWO_ORG_MEMBERS_AND_ADMIN,
	policy: {
		'2-of': [{
			'1-of': [{
				'signed-by': 0
			}, {
				'1-of': [{ 'signed-by': 1 }, { 'signed-by': 2 }]
			}]
		}, {
			'1-of': [{
				'2-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }, { 'signed-by': 2 }]
			}, {
				'2-of': [{ 'signed-by': 2 }, { '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }] }]
			}]
		}]
	}
};

test('\n\n ** Channel _buildDefaultEndorsementPolicy() tests **\n\n', function (t) {
	var client = new Client();
	var c = new Channel('does-not-matter', client);

	t.throws(
		() => {
			c._buildEndorsementPolicy();
		},
		/Verifying MSPs not found in the channel object, make sure "intialize\(\)" is called first/,
		'Checking that "initialize()" must be called before calling "instantiate()" that uses the endorsement policy'
	);

	// construct dummy msps and msp manager to test default policy construction
	var msp1 = new MSP({
		id: 'msp1',
		cryptoSuite: 'crypto1'
	});

	var msp2 = new MSP({
		id: 'msp2',
		cryptoSuite: 'crypto2'
	});

	var mspm = new MSPManager();
	mspm._msps = {
		'msp1': msp1,
		'msp2': msp2
	};

	c._msp_manager = mspm;

	var policy;
	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy();
		},
		null,
		'Checking that after initializing the channel with dummy msps and msp manager, _buildEndorsementPolicy() can be called without error'
	);

	t.equal(Buffer.isBuffer(policy), true, 'Checking default policy has an identities array');

	var env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equal(Array.isArray(env.identities), true, 'Checking decoded default policy has an "identities" array');
	t.equal(env.identities.length, 2, 'Checking decoded default policy has two array items');
	t.equal(env.identities[0].getPrincipalClassification(), _mspPrProto.MSPPrincipal.Classification.ROLE, 'Checking decoded default policy has a ROLE identity');

	t.equal(typeof env.getRule().get('n_out_of'), 'object', 'Checking decoded default policy has an "n_out_of" policy');
	t.equal(env.getRule().get('n_out_of').getN(), 1, 'Checking decoded default policy has an "n_out_of" policy with N = 1');

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: null });
		},
		/Invalid policy, missing the "identities" property/,
		'Checking policy spec: must have identities'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: {} });
		},
		/Invalid policy, the "identities" property must be an array/,
		'Checking policy spec: identities must be an array'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: [] });
		},
		/Invalid policy, missing the "policy" property/,
		'Checking policy spec: must have "policy"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: [{ dummy: 'value', dummer: 'value' }], policy: {} });
		},
		/Invalid identity type found: must be one of role, organization-unit or identity, but found dummy,dummer/,
		'Checking policy spec: each identity must be "role", "organization-unit" or "identity"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: [{ role: 'value' }], policy: {} });
		},
		/Invalid role name found: must be one of "peer", "member" or "admin", but found/,
		'Checking policy spec: value identity type "role" must have valid "name" value'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: [{ 'organization-unit': 'value' }], policy: {} });
		},
		/NOT IMPLEMENTED/,
		'Checking policy spec: value identity type "organization-unit"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({ identities: [{ identity: 'value' }], policy: {} });
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
		null,
		'Building successfully from valid policy spec ONE_OF_TWO_ORG_MEMBER'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(Array.isArray(env.identities) &&
		env.identities.length === 3 &&
		env.identities[0].getPrincipalClassification() === _mspPrProto.MSPPrincipal.Classification.ROLE,
	true,
	'Checking decoded custom policy has two items'
	);

	t.equals(env.rule['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of"');
	t.equals(env.rule['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(TWO_OF_TWO_ORG_MEMBER);
		},
		null,
		'Building successfully from valid policy spec TWO_OF_TWO_ORG_MEMBER'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(ONE_OF_TWO_ORG_MEMBER_AND_ADMIN);
		},
		null,
		'Building successfully from valid policy spec ONE_OF_TWO_ORG_MEMBER_AND_ADMIN'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.rule['n_out_of'].rules[0]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[0]['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['signed_by'], 2, 'Checking decoded custom policy has "signed-by: 2" inside the "2 out of"');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(CRAZY_SPEC);
		},
		null,
		'Building successfully from valid policy spec CRAZY_SPEC'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.rule['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.rule['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.rule['n_out_of'].rules[0]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[0]['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[0]['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[0]['n_out_of'].getRules().length, 3, 'Checking decoded custom policy has 3 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[1]['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[1]['n_out_of'].getRules().length, 2, 'Checking decoded custom policy has 2 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[1]['n_out_of'].getRules()[0]['signed_by'], 2, 'Checking decoded custom policy has "signed-by: 2" for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.rule['n_out_of'].rules[1]['n_out_of'].getRules()[1]['n_out_of'].getRules()[1]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside "2 out of " inside "1 out of" inside the "2 out of"');

	t.end();
});

test('\n\n ** Channel sendTransactionProposal() tests **\n\n', function (t) {
	var client = new Client();
	var channel = new Channel('does-not-matter', client);
	channel._use_discovery = false;
	var peer = new Peer('grpc://localhost:7051');

	channel.addPeer(peer);

	t.throws(
		function () {
			channel.sendTransactionProposal();
		},
		/Missing input request object on the proposal request/,
		'Channel tests, sendTransactionProposal(): Missing input request object on the proposal request'
	);

	t.throws(
		function () {
			channel.sendTransactionProposal({
				chaincodeId: 'blah',
				fcn: 'invoke',
				txId: 'blah'
			});
		},
		/Missing "args" in Transaction/,
		'Channel tests, sendTransactionProposal(): Missing "args" in Transaction'
	);

	t.throws(
		function () {
			channel.sendTransactionProposal({
				fcn: 'init',
				args: ['a', '100', 'b', '200'],
				txId: 'blah'
			});
		},
		/Missing "chaincodeId" parameter/,
		'Channel tests, sendTransactionProposal(): Missing "chaincodeId" parameter'
	);

	t.throws(
		function () {
			channel.sendTransactionProposal({
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

test('\n\n ** Channel queryByChaincode() tests **\n\n', async function (t) {
	let client = new Client();
	var _channel = new Channel('testchannel', client);

	t.throws(
		function () {
			_channel.queryByChaincode();
		},
		/Missing request object for this queryByChaincode call/,
		'Channel tests, queryByChaincode(): Missing request object for this queryByChaincode call.'
	);

	t.throws(
		function () {
			_channel.queryByChaincode({});
		},
		/"targets" parameter not specified and no peers are set/,
		'Channel tests, queryByChaincode(): "targets" parameter not specified and no peers are set.'
	);

	client = new Client();
	await setMember(client);

	var channel = client.newChannel('any-channel-goes');
	var peer = client.newPeer('grpc://localhost:7051');
	channel.addPeer(peer);

	t.throws(
		function () {
			channel.queryByChaincode({
				chaincodeId: 'blah',
				fcn: 'invoke'
			});
		},
		/Missing "args" in Transaction/,
		'Channel tests, queryByChaincode(): Missing "args" in Transaction'
	);

	t.throws(
		function () {
			channel.queryByChaincode({
				fcn: 'init',
				args: ['a', '100', 'b', '200']
			});
		},
		/Missing "chaincodeId" parameter/,
		'Channel tests, queryByChaincode(): Missing "chaincodeId" parameter'
	);
	t.end();
});

test('\n\n ** Channel sendTransaction() tests **\n\n', function (t) {
	var client = new Client();
	var _channel = new Channel('testchannel', client);

	t.throws(
		function () {
			_channel.sendTransaction();
		},
		/Missing input request/,
		'Channel tests, sendTransaction: Missing request object.'
	);

	t.throws(
		function () {
			_channel.sendTransaction({ proposal: 'blah' });
		},
		/Missing "proposalResponses"/,
		'Channel tests, sendTransaction: Missing "proposalResponses" object.'
	);

	t.throws(
		function () {
			_channel.sendTransaction({ proposalResponses: 'blah' });
		},
		/Missing "proposal"/,
		'Channel tests, sendTransaction: Missing "proposal" object.'
	);

	t.throws(
		function () {
			_channel.sendTransaction({
				proposal: 'blah',
				proposalResponses: { response: { status: 500 } }
			});
		},
		/no valid endorsements found/,
		'Channel tests, sendTransaction: no valid endorsements found.'
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
test('\n\n** TEST ** orderer via channel setOrderer/getOrderer', function (t) {
	var client = new Client();
	//
	// Create and configure the test channel
	//
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	Client.newDefaultKeyValueStore({
		path: testutil.KVS
	})
		.then(function (store) {
			client.setStateStore(store);

			var channel = client.newChannel('testchannel-orderer-member');
			try {
				var orderer = new Orderer('grpc://localhost:7050');
				channel.addOrderer(orderer);
				t.pass('Successfully set the new orderer URL');

				let orderers = channel.getOrderers();
				if (orderers !== null && orderers.length > 0 && orderers[0].getUrl() === 'grpc://localhost:7050') {
					t.pass('Successfully retrieved the new orderer URL from the channel');
				}
				else {
					t.fail('Failed to retieve the new orderer URL from the channel');
					t.end();
				}

				try {
					var orderer2 = new Orderer('grpc://localhost:5152');
					channel.addOrderer(orderer2);
					t.pass('Successfully updated the orderer URL');

					orderers = channel.getOrderers();
					if (orderers !== null && orderers.length > 0 && orderers[1].getUrl() === 'grpc://localhost:5152') {
						t.pass('Successfully retrieved the upated orderer URL from the channel');
					}
					else {
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
			}
			catch (err) {
				t.fail('Failed to set the new order URL ' + err);
				t.end();
			}
		});
});

//
// Orderer via channel set/get bad address
//
// Set the orderer URL to a bad address through the channel setOrderer method.
// Verify that an error is reported when trying to set a bad address.
//
test('\n\n** TEST ** orderer via channel set/get bad address', function (t) {
	var client = new Client();
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testchannel-orderer-member1');

	t.throws(
		function () {
			var order_address = 'xxx';
			channel.addOrderer(new Orderer(order_address));
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Test setting a bad orderer address'
	);

	t.throws(
		function () {
			channel.addOrderer(new Orderer());
		},
		/TypeError: Parameter "url" must be a string, not undefined/,
		'Test setting an empty orderer address'
	);

	t.end();
});

//Verify the verify compareProposalResponseResults method.
//
test('\n\n** TEST ** verify compareProposalResponseResults', function (t) {
	var client = new Client();
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testchannel-compare-proposal');

	t.throws(
		function () {
			channel.compareProposalResponseResults();
		},
		/Error: Missing proposal responses/,
		'Test compareProposalResponseResults with empty parameter'
	);

	t.throws(
		function () {
			channel.compareProposalResponseResults({});
		},
		/Error: Parameter must be an array of ProposalRespone Objects/,
		'Test compareProposalResponseResults with an object parameter'
	);

	t.throws(
		function () {
			channel.compareProposalResponseResults([]);
		},
		/Error: Parameter proposal responses does not contain a PorposalResponse/,
		'Test compareProposalResponseResults with an empty array parameter'
	);

	t.throws(
		function () {
			channel.compareProposalResponseResults([{}]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test compareProposalResponseResults with an array without the correct endorsements parameter'
	);
	t.end();
});

//Verify the verify verifyProposalResponse method.
//
test('\n\n** TEST ** verify verifyProposalResponse', function (t) {
	var client = new Client();
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testchannel-compare-proposal2');

	t.throws(
		function () {
			channel.verifyProposalResponse();
		},
		/Error: Missing proposal response/,
		'Test verifyProposalResponse with empty parameter'
	);

	t.throws(
		function () {
			channel.verifyProposalResponse({});
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an object parameter'
	);

	t.throws(
		function () {
			channel.verifyProposalResponse([]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an empty array parameter'
	);

	t.throws(
		function () {
			channel.verifyProposalResponse([{}]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an array without the correct endorsements parameter'
	);
	t.end();
});

test('\n\n*** Test per-call timeout support ***\n', function (t) {
	var client = new Client();
	let sandbox = sinon.sandbox.create();
	let stub = sandbox.stub(Peer.prototype, 'sendProposal');
	sandbox.stub(Policy, 'buildPolicy').returns(Buffer.from('dummyPolicy'));

	// stub out the calls that requires getting MSPs from the orderer, or
	// a valid user context
	let client_utils = Channel.__get__('client_utils');
	sandbox.stub(client_utils, 'buildHeader').returns(Buffer.from('dummyHeader'));
	sandbox.stub(client_utils, 'buildProposal').returns(Buffer.from('dummyProposal'));
	sandbox.stub(client_utils, 'signProposal').returns(Buffer.from('dummyProposal'));
	client._userContext = {
		getIdentity: ()=>'',
		getSigningIdentity: ()=>''
	};

	let c = new Channel('does-not-matter', client);

	let p = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051'), new Peer('grpc://localhost:7052')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'v0',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: {
			getTransactionID: () =>'1234567',
			isAdmin: () =>false,
			getNonce: () =>Buffer.from('dummyNonce')
		}
	}, 12345).then(function () {
		t.equal(stub.calledTwice, true, 'Peer.sendProposal() is called exactly twice');
		t.equal(stub.firstCall.args.length, 2, 'Peer.sendProposal() is called first time with exactly 2 arguments');
		t.equal(stub.firstCall.args[1], 12345, 'Peer.sendProposal() is called first time with a overriding timeout of 12345 (milliseconds)');
		t.equal(stub.secondCall.args.length, 2, 'Peer.sendProposal() is called 2nd time with exactly 2 arguments');
		t.equal(stub.secondCall.args[1], 12345, 'Peer.sendProposal() is called 2nd time with a overriding timeout of 12345 (milliseconds)');
		sandbox.restore();
		t.end();
	}).catch(function (err) {
		t.fail('Failed to catch the missing chaincodeVersion error. Error: ' + err.stack ? err.stack : err);
		sandbox.restore();
		t.end();
	});
});

test('\n\n ** Channel Discover) tests **\n\n', async function (t) {
	const client = new Client();
	const channel = new Channel('does-not-matter', client);
	channel._use_discovery = true;
	t.throws(
		function () {
			channel.initialize();
		},
		/"target" parameter not specified and no peers are set on this Channel/,
		'Channel tests, sendTransactionProposal(): "target" parameter not specified and no peers are set on this Channeln'
	);


	var peer = new Peer('grpc://localhost:9999');

	channel.addPeer(peer);

	t.throws(
		function () {
			channel.initialize({
				target: peer
			});
		},
		/No identity has been assigned to this client/,
		'Channel tests, sendTransactionProposal(): No identity has been assigned to this client'
	);

	t.throws(
		function () {
			channel.initialize({
				discover: 'BAD'
			});
		},
		/Request parameter "discover" must be boolean/,
		'Channel tests, Request parameter "discover" must be boolean'
	);

	await setMember(client);

	try {
		await channel.initialize({
			target: peer
		});
	} catch(error) {
		if(error.message.includes('deadline')) {
			t.pass('Check Failed to connect before the deadline');
		} else {
			t.fail('Did not get Failed to connect before the deadline');
		}
	}

	try {
		await channel.initialize({
			target: peer,
			endorsementHandler: 'no.where'
		});
		t.fail('able to initialize channel with a bad endorsement handler path');
	} catch(error) {
		if(error.message.includes('Cannot find module')) {
			t.pass('Check Failed to initialize channel with bad endorsement handler path');
		} else {
			t.fail('Receive other failure '+ error.toString());
		}
	}

	const handler_path_temp = client.getConfigSetting('endorsement-handler');
	try {
		client.setConfigSetting('endorsement-handler', 'bad.path');
		client.newChannel('test-channel');
		t.fail('able to create channel with a bad endorsement handler path');
	} catch(error) {
		if(error.message.includes('Cannot find module')) {
			t.pass('Check Failed to create channel with bad endorsement handler path');
		} else {
			t.fail('Receive other failure '+ error.toString());
		}
	}
	client.setConfigSetting('endorsement-handler', handler_path_temp);

	t.end();
});

test('\n\n ** Channel _getOrderer tests **\n\n', function (t) {
	const client = new Client();
	const channel = new Channel('does-not-matter', client);


	t.throws(
		function () {
			channel._getOrderer();
		},
		/No Orderers assigned to this channel/,
		'Channel _getOrderer test: no params and no orderers assigned to channel'
	);

	t.throws(
		function () {
			channel._getOrderer('bad');
		},
		/Orderer bad not assigned to the channel/,
		'Channel _getOrderer test: using bad name and no orderers assigned to channel'
	);

	t.throws(
		function () {
			channel._getOrderer({});
		},
		/Orderer is not a valid orderer object instance/,
		'Channel _getOrderer test: using bad object and no orderers assigned to channel'
	);

	const orderer = new Orderer('grpc://somehost.com:1234');
	t.doesNotThrow(
		() => {
			const test_orderer = channel._getOrderer(orderer);
			t.equal(test_orderer.getName(), 'somehost.com:1234', 'Checking able to get correct name');
		},
		null,
		'Channel _getOrderer: checking able to find orderer by name'
	);

	channel.addOrderer(orderer);
	t.doesNotThrow(
		() => {
			channel._getOrderer('somehost.com:1234');
		},
		null,
		'Channel _getOrderer: checking able to find orderer by name'
	);

	t.doesNotThrow(
		() => {
			const test_orderer = channel._getOrderer();
			t.equal(test_orderer.getName(), 'somehost.com:1234', 'Checking able to get correct name');
		},
		null,
		'Channel _getOrderer: checking able to find orderer by name'
	);

	t.end();
});
test('\n\n ** Channel mspid tests **\n\n', function (t) {
	const client = new Client();
	client._mspid = 'Org1MSP';
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
	var member = new User('admin');
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	const store = await Client.newDefaultKeyValueStore({path: testutil.KVS});
	client.setStateStore(store);
	const cryptoUtils = utils.newCryptoSuite();
	const key = await cryptoUtils.generateKey({ ephemeral: true });
	var TEST_CERT_PEM = require('./user.js').TEST_CERT_PEM;
	await member.setEnrollment(key, TEST_CERT_PEM, 'DEFAULT');
	client.setUserContext(member, true);
}
