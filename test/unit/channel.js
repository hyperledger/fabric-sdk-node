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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var tar = require('tar-fs');
var path = require('path');
var gunzip = require('gunzip-maybe');
var fs = require('fs-extra');
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
var Packager = require('fabric-client/lib/Packager.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var User = require('fabric-client/lib/User.js');
var MSP = require('fabric-client/lib/msp/msp.js');
var MSPManager = require('fabric-client/lib/msp/msp-manager.js');
var idModule = require('fabric-client/lib/msp/identity.js');
var SigningIdentity = idModule.SigningIdentity;

var _channel = null;
var channelName = 'testChannel';
var client = new Client();

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('channel');

// Channel tests /////////////
test('\n\n ** Channel - constructor test **\n\n', function (t) {
	testutil.resetDefaults();

	_channel = new Channel(channelName, client);
	if (_channel.getName() === channelName)
		t.pass('Channel constructor test: getName successful');
	else t.fail('Channel constructor test: getName not successful');

	t.throws(
		function () {
			_channel = new Channel(null, client);
		},
		/^Error: Failed to create Channel. Missing requirement "name" parameter./,
		'Channel constructor tests: Missing name parameter'
	);

	t.throws(
		function () {
			_channel = new Channel(channelName, null);
		},
		/^Error: Failed to create Channel. Missing requirement "clientContext" parameter./,
		'Channel constructor tests: Missing clientContext parameter'
	);

	t.end();
});

test('\n\n ** Channel - method tests **\n\n', function (t) {
	t.doesNotThrow(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_channel.addOrderer(orderer);
		},
		null,
		'checking the channel addOrderer()'
	);
	t.equal(_channel.getOrderers()[0].toString(), ' Orderer : {url:grpc://somehost.com:1234}', 'checking channel getOrderers()');
	t.throws(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_channel.addOrderer(orderer);
		},
		/^DuplicateOrderer: Orderer with URL/,
		'Channel tests: checking that orderer already exists.'
	);
	t.equal(_channel.toString(), '{"name":"testChannel","orderers":" Orderer : {url:grpc://somehost.com:1234}|"}', 'checking channel toString');
	t.notEquals(_channel.getMSPManager(),null,'checking the channel getMSPManager()');
	t.doesNotThrow(
		function () {
			var msp_manager = new MSPManager();
			_channel.setMSPManager(msp_manager);
		},
		null,
		'checking the channel setMSPManager()'
	);
	t.notEquals(_channel.getOrganizations(),null,'checking the channel getOrganizations()');
	t.end();
});

test('\n\n **  Channel query target parameter tests', function(t) {
	var msg = '"target" parameter not specified and no peers are set on Channel';
	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'));
		},
		/^Error: "target" parameter not specified and no peers are set on Channel./,
		'Channel tests, queryBlockByHash: "target" parameter not specified and no peers are set on Channel.'
	);

	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'), [new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryBlockByHash: checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryBlockByHash(Buffer.from('12345'), new Peer('grpc://localhost:7051'));
		},
		/^[Error: Missing userContext parameter]/,
		'Channel tests, queryBlockByHash: good target, checking for Missing userContext parameter.'
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
			_channel.queryBlock(123, [new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryBlock: checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryTransaction('abc', [new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryTransaction: checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.throws(
		function () {
			_channel.queryInstantiatedChaincodes([new Peer('grpc://localhost:7051')]);
		},
		/^Error: "target" parameter is an array, but should be a singular peer object/,
		'Channel tests, queryInstantiatedChaincodes: checking for "target" parameter is an array, but should be a singular peer object.'
	);

	t.end();
});

test('\n\n **  Channel query tests', function(t) {
	var peer = new Peer('grpc://localhost:7051');
	_channel.addPeer(peer);

	_channel.queryBlockByHash()
		.then(
			function(results) {
				t.fail('Error: Blockhash bytes are required');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Blockhash bytes are required';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _channel.queryTransaction();
			}
		).then(
			function(results) {
				t.fail('Error: Transaction id is required');
				t.end();
			},
			function(err) {
				t.pass(err);
				return _channel.queryBlock('a');
			}
		).then(
			function(results) {
				t.fail('Error: block id must be integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a positive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _channel.queryBlock();
			}
		).then(
			function(results) {
				t.fail('Error: block id is required');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a positive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _channel.queryBlock(-1);
			}
		).then(
			function(results) {
				t.fail('Error: block id must be postive integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a positive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _channel.queryBlock(10.5);
			}
		).then(
			function(results) {
				t.fail('Error: block id must be integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a positive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				t.end();
			}
		).catch(
			function(err) {
				t.fail('should not have gotten the catch ' + err);
				t.end();
			}
		);
});

test('\n\n ** Channel addPeer() duplicate tests **\n\n', function (t) {
	var channel_duplicate = new Channel('channel_duplicate', client);
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
			if (err.name != 'DuplicatePeer'){
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
	t.end();
});

test('\n\n ** Channel joinChannel() tests **\n\n', function (t) {
	var c = new Channel('joinChannel', client);
	var orderer = new Orderer('grpc://localhost:7050');

	var p1 = c.getGenesisBlock({}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of orderer missing');
	}).catch(function (err) {
		if (err.message.indexOf('Missing orderer') >= 0) {
			t.pass('Successfully caught missing orderer error');
		} else {
			t.fail('Failed to catch the missing orderer error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	c.addOrderer(orderer);

	var p2 = c.joinChannel(
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing all') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var p3 = c.joinChannel({}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of targets request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing targets') >= 0) {
			t.pass('Successfully caught missing targets request error');
		} else {
			t.fail('Failed to catch the missing targets request error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var p4 = c.joinChannel({targets: 'targets'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of txId request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing txId') >= 0) {
			t.pass('Successfully caught missing txId request error');
		} else {
			t.fail('Failed to catch the missing txId request error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var p4a = c.getGenesisBlock({targets: 'targets'}
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of txId request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing txId') >= 0) {
			t.pass('Successfully caught missing txId request error');
		} else {
			t.fail('Failed to catch the missing txId request error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p4a])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel joinChannel() tests, Promise.all: ');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n** Packager tests **\n\n', function(t) {
	Packager.package('blah','',true)
	.then((data) => {
		t.equal(data, null, 'Channel.packageChaincode() should return null for dev mode');
		return Packager.package(null,'',false);
	}).then(() => {
		t.fail('Packager.package() should have rejected a call that does not have chaincodePath parameter');
		t.end();
	},
	(err) => {
		var msg = 'Missing chaincodePath parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Should throw error: '+msg);
		} else {
			t.fail(err.message+' should be '+msg);
			t.end();
		}

		testutil.setupChaincodeDeploy();
		return Packager.package(testutil.CHAINCODE_PATH,'',false);
	}).then((data) => {
		var tmpFile = path.join(testutil.getTempDir(), 'test-deploy-copy.tar.gz');
		var destDir = path.join(testutil.getTempDir(), 'test-deploy-copy-tar-gz');
		fs.writeFileSync(tmpFile, data);
		fs.removeSync(destDir);
		var pipe = fs.createReadStream(tmpFile).pipe(gunzip()).pipe(tar.extract(destDir));

		pipe.on('close', function() {
			var checkPath = path.join(destDir, 'src', 'github.com', 'example_cc');
			t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/github.com/example_cc" folder');
		});
		t.end();
	}).catch((err) => {
		t.fail('Caught error in Package.package tests');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

var TWO_ORG_MEMBERS_AND_ADMIN = [{
	role: {
		name: 'member',
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
	var c = new Channel('does not matter', client);

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

	t.equal(typeof env.getPolicy().get('n_out_of'), 'object', 'Checking decoded default policy has an "n_out_of" policy');
	t.equal(env.getPolicy().get('n_out_of').getN(), 1, 'Checking decoded default policy has an "n_out_of" policy with N = 1');

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: null});
		},
		/Invalid policy, missing the "identities" property/,
		'Checking policy spec: must have identities'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: {}});
		},
		/Invalid policy, the "identities" property must be an array/,
		'Checking policy spec: identities must be an array'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: []});
		},
		/Invalid policy, missing the "policy" property/,
		'Checking policy spec: must have "policy"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: [{dummy: 'value', dummer: 'value'}], policy: {}});
		},
		/Invalid identity type found: must be one of role, organization-unit or identity, but found dummy,dummer/,
		'Checking policy spec: each identity must be "role", "organization-unit" or "identity"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: [{role: 'value'}], policy: {}});
		},
		/Invalid role name found: must be one of "member" or "admin", but found/,
		'Checking policy spec: value identity type "role" must have valid "name" value'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: [{'organization-unit': 'value'}], policy: {}});
		},
		/NOT IMPLEMENTED/,
		'Checking policy spec: value identity type "organization-unit"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: [{identity: 'value'}], policy: {}});
		},
		/NOT IMPLEMENTED/,
		'Checking policy spec: value identity type "identity"'
	);

	t.throws(
		() => {
			c._buildEndorsementPolicy({identities: [{role: {name: 'member', mspId: 'value'}}], policy: {dummy: 'value'}});
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

	t.equals(env.policy['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of"');
	t.equals(env.policy['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(TWO_OF_TWO_ORG_MEMBER);
		},
		null,
		'Building successfully from valid policy spec TWO_OF_TWO_ORG_MEMBER'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.policy['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.policy['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(ONE_OF_TWO_ORG_MEMBER_AND_ADMIN);
		},
		null,
		'Building successfully from valid policy spec ONE_OF_TWO_ORG_MEMBER_AND_ADMIN'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.policy['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.policy['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.policy['n_out_of'].policies[0]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[0]['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['signed_by'], 2, 'Checking decoded custom policy has "signed-by: 2" inside the "2 out of"');

	t.doesNotThrow(
		() => {
			policy = c._buildEndorsementPolicy(CRAZY_SPEC);
		},
		null,
		'Building successfully from valid policy spec CRAZY_SPEC'
	);

	env = _policiesProto.SignaturePolicyEnvelope.decode(policy);
	t.equals(env.policy['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of"');
	t.equals(env.policy['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies');
	t.equals(env.policy['n_out_of'].policies[0]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[0]['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has two target policies inside the "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[0]['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[0]['n_out_of'].getPolicies().length, 3, 'Checking decoded custom policy has 3 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[1]['n_out_of'].getN(), 2, 'Checking decoded custom policy has "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[1]['n_out_of'].getPolicies().length, 2, 'Checking decoded custom policy has 2 target policies for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[1]['n_out_of'].getPolicies()[0]['signed_by'], 2, 'Checking decoded custom policy has "signed-by: 2" for "2 out of " inside "1 out of" inside the "2 out of"');
	t.equals(env.policy['n_out_of'].policies[1]['n_out_of'].getPolicies()[1]['n_out_of'].getPolicies()[1]['n_out_of'].getN(), 1, 'Checking decoded custom policy has "1 out of" inside "2 out of " inside "1 out of" inside the "2 out of"');

	t.end();
});

test('\n\n ** Channel sendInstantiateProposal() tests **\n\n', function (t) {
	var c = new Channel('does not matter', client);
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeVersion" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeVersion" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeVersion error');
		} else {
			t.fail('Failed to catch the missing chaincodeVersion error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	var p3 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeVersion: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.removePeer(peer);
	var p4 = c.sendInstantiateProposal({
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on channel');
	}).catch(function (err) {
		var msg = 'Missing peer objects in Instantiate proposal';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.addPeer(peer);
	var p7 = c.sendInstantiateProposal().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p3, p4, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel sendInstantiateProposal() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Channel sendTransactionProposal() tests **\n\n', function (t) {
	var c = new Channel('does not matter', client);
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.sendTransactionProposal({
		chaincodeId : 'blah',
		fcn: 'invoke',
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "args" parameter');
	}).catch(function (err) {
		var msg = 'Missing "args" in Transaction proposal request';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p3 = c.sendTransactionProposal({
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.removePeer(peer);
	var p4 = c.sendTransactionProposal({
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on channel');
	}).catch(function (err) {
		var msg = 'Missing peer objects in Transaction proposal';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.addPeer(peer);
	var p5 = c.sendTransactionProposal({
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200']
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "txId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "txId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing txId error');
		} else {
			t.fail('Failed to catch the missing txId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p7 = c.sendTransactionProposal().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing request object for this transaction proposal') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p3, p4, p5, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel sendTransactionProposal() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Channel queryByChaincode() tests **\n\n', function (t) {
	var TEST_CERT_PEM = require('./user.js').TEST_CERT_PEM;
	var member = new User('admin');

	// do some setup for following test
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	Client.newDefaultKeyValueStore({
		path: testutil.KVS
	}).then ( function (store) {
		client.setStateStore(store);
		var cryptoUtils = utils.newCryptoSuite();
		return cryptoUtils.generateKey({ephemeral : true});
	}).then( function (key) {
		// the private key and cert don't match, but it's ok, the code doesn't check
		return member.setEnrollment(key, TEST_CERT_PEM, 'DEFAULT');
	}).then( function () {
		client.setUserContext(member, true);
		var channel = client.newChannel('any channel goes');
		var peer = client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);

		var p1 = channel.queryByChaincode({
			chaincodeId : 'blah',
			fcn: 'invoke'
		}).then(function () {
			t.fail('Should not have been able to resolve the promise because of missing "args" parameter in queryByChaincode');
		}).catch(function (err) {
			var msg = 'Missing "args" in Transaction proposal request';
			if (err.message.indexOf(msg) >= 0 ) {
				t.pass('Successfully caught error: '+msg);
			} else {
				t.fail('Failed to catch queryByChaincode error: '+msg+'. Error: ' + err.stack ? err.stack : err);
			}
		});

		var p3 = channel.queryByChaincode({
			fcn: 'init',
			args: ['a', '100', 'b', '200']
		}).then(function () {
			t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter in queryByChaincode');
		}).catch(function (err) {
			if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
				t.pass('Successfully caught missing chaincodeId error');
			} else {
				t.fail('Failed to catch the queryByChaincode missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
			}
		});

		channel.removePeer(peer);
		var p4 = channel.queryByChaincode({
			chaincodeId: 'blah',
			fcn: 'init',
			args: ['a', '100', 'b', '200']
		}).then(function () {
			t.fail('Should not have been able to resolve the promise because of missing "peers" on channel in queryByChaincode');
		}).catch(function (err) {
			var msg = 'Missing peer objects in Transaction proposal';
			if (err.message.indexOf(msg) >= 0) {
				t.pass('Successfully caught error: '+msg);
			} else {
				t.fail('Failed to catch queryByChaincode error: '+msg+'. Error: ' + err.stack ? err.stack : err);
			}
		});

		channel.addPeer(peer);

		var p7 = channel.queryByChaincode().then(function () {
			t.fail('Should not have been able to resolve the promise because of missing request parameter in queryByChaincode');
		}).catch(function (err) {
			if (err.message.indexOf('Missing request object for this queryByChaincode') >= 0) {
				t.pass('Successfully caught missing request error');
			} else {
				t.fail('Failed to catch the queryByChaincode missing request error. Error: ' + err.stack ? err.stack : err);
			}
		});

		Promise.all([p1, p3, p4, p7])
		.then(
			function (data) {
				t.pass('all test done');
				t.end();
			}
		).catch(
			function (err) {
				t.fail('Channel queryByChaincode() tests, Promise.all: ');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);
	}).catch(
		function (err) {
			t.fail('Channel queryByChaincode() failed ');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);

});

test('\n\n ** Channel sendTransaction() tests **\n\n', function (t) {
	let o = _channel.getOrderers();
	for (let i = 0; i < o.length; i++) {
		_channel.removeOrderer(o[i]);
	}
	var p1 = _channel.sendTransaction()
		.then(function () {
			t.fail('Should not have been able to resolve the promise because of missing parameters');
		}, function (err) {
			if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
				t.pass('Successfully caught missing request error');
			} else {
				t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
			}
		});

	var p2 = _channel.sendTransaction({
		proposal: 'blah'
	})
	.then(function () {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	}, function (err) {
		if (err.message.indexOf('Missing "proposalResponses" parameter in transaction request') >= 0) {
			t.pass('Successfully caught missing proposalResponses error');
		} else {
			t.fail('Failed to catch the missing proposalResponses error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p3 = _channel.sendTransaction({
		proposalResponses: 'blah'
	})
	.then(function () {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	}, function (err) {
		if (err.message.indexOf('Missing "proposal" parameter in transaction request') >= 0) {
			t.pass('Successfully caught missing proposal error');
		} else {
			t.fail('Failed to catch the missing proposal error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p4 = _channel.sendTransaction({
		proposal: 'blah',
		proposalResponses: {response : { status : 500}}
	})
	.then(function () {
		t.fail('Should not have been able to resolve the promise because of missing endorsement');
	}, function (err) {
		if (err.message.indexOf('no valid endorsements found') >= 0) {
			t.pass('Successfully caught missing endorsement error');
		} else {
			t.fail('Failed to catch the missing endorsement error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Channel sendTransaction() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

//
// Orderer via channel setOrderer/getOrderer
//
// Set the orderer URL through the channel setOrderer method. Verify that the
// orderer URL was set correctly through the getOrderer method. Repeat the
// process by updating the orderer URL to a different address.
//
test('\n\n** TEST ** orderer via channel setOrderer/getOrderer', function(t) {
	//
	// Create and configure the test channel
	//
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	Client.newDefaultKeyValueStore({
		path: testutil.KVS
	})
	.then ( function (store) {
		client.setStateStore(store);

		var channel = client.newChannel('testChannel-orderer-member');
		try {
			var orderer = new Orderer('grpc://localhost:7050');
			channel.addOrderer(orderer);
			t.pass('Successfully set the new orderer URL');

			var orderers = channel.getOrderers();
			if(orderers !== null && orderers.length > 0 && orderers[0].getUrl() === 'grpc://localhost:7050') {
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

				var orderers = channel.getOrderers();
				if(orderers !== null && orderers.length > 0 && orderers[1].getUrl() === 'grpc://localhost:5152') {
					t.pass('Successfully retrieved the upated orderer URL from the channel');
				}
				else {
					t.fail('Failed to retieve the updated orderer URL from the channel');
				}

				t.end();
			} catch(err2) {
				t.fail('Failed to update the order URL ' + err2);
				t.end();
			}
		}
		catch(err) {
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
test('\n\n** TEST ** orderer via channel set/get bad address', function(t) {
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testChannel-orderer-member1');

	t.throws(
		function() {
			var order_address = 'xxx';
			channel.addOrderer(new Orderer(order_address));
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Test setting a bad orderer address'
	);

	t.throws(
		function() {
			channel.addOrderer(new Orderer());
		},
		/TypeError: Parameter "url" must be a string, not undefined/,
		'Test setting an empty orderer address'
	);

	t.end();
});

//Verify the verify compareProposalResponseResults method.
//
test('\n\n** TEST ** verify compareProposalResponseResults', function(t) {
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testChannel-compareProposal');

	t.throws(
		function() {
			channel.compareProposalResponseResults();
		},
		/Error: Missing proposal responses/,
		'Test compareProposalResponseResults with empty parameter'
	);

	t.throws(
		function() {
			channel.compareProposalResponseResults({});
		},
		/Error: Parameter must be an array of ProposalRespone Objects/,
		'Test compareProposalResponseResults with an object parameter'
	);

	t.throws(
		function() {
			channel.compareProposalResponseResults([]);
		},
		/Error: Parameter proposal responses does not contain a PorposalResponse/,
		'Test compareProposalResponseResults with an empty array parameter'
	);

	t.throws(
		function() {
			channel.compareProposalResponseResults([{}]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test compareProposalResponseResults with an array without the correct endorsements parameter'
	);
	t.end();
});

//Verify the verify verifyProposalResponse method.
//
test('\n\n** TEST ** verify verifyProposalResponse', function(t) {
	//
	// Create and configure the test channel
	//
	var channel = client.newChannel('testChannel-compareProposal2');

	t.throws(
		function() {
			channel.verifyProposalResponse();
		},
		/Error: Missing proposal response/,
		'Test verifyProposalResponse with empty parameter'
	);

	t.throws(
		function() {
			channel.verifyProposalResponse({});
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an object parameter'
	);

	t.throws(
		function() {
			channel.verifyProposalResponse([]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an empty array parameter'
	);

	t.throws(
		function() {
			channel.verifyProposalResponse([{}]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an array without the correct endorsements parameter'
	);
	t.end();
});

test('\n\n*** Test per-call timeout support ***\n', function(t) {
	let sandbox = sinon.sandbox.create();
	let stub = sandbox.stub(Peer.prototype, 'sendProposal');
	sandbox.stub(Policy, 'buildPolicy').returns(Buffer.from('dummyPolicy'));

	// stub out the calls that requires getting MSPs from the orderer, or
	// a valid user context
	let clientUtils = Channel.__get__('clientUtils');
	sandbox.stub(clientUtils, 'buildHeader').returns(Buffer.from('dummyHeader'));
	sandbox.stub(clientUtils, 'buildProposal').returns(Buffer.from('dummyProposal'));
	sandbox.stub(clientUtils, 'signProposal').returns(Buffer.from('dummyProposal'));
	client._userContext = {
		getIdentity: function() { return ''; },
		getSigningIdentity: function() { return ''; }
	};

	let c = new Channel('does not matter', client);

	let p = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051'), new Peer('grpc://localhost:7052')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'v0',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: {
			getTransactionID: function() { return '1234567'; },
			getNonce: function() { return Buffer.from('dummyNonce'); } }
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

