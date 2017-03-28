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
var gunzip = require('gunzip-maybe');
var fs = require('fs-extra');
var grpc = require('grpc');
var _policiesProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/policies.proto').common;
var _mspPrProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/msp_principal.proto').common;

var hfc = require('fabric-client');
var testutil = require('./util.js');
var Peer = require('fabric-client/lib/Peer.js');
var Chain = require('fabric-client/lib/Chain.js');
var Packager = require('fabric-client/lib/Packager.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var MSP = require('fabric-client/lib/msp/msp.js');
var MSPManager = require('fabric-client/lib/msp/msp-manager.js');
var idModule = require('fabric-client/lib/msp/identity.js');
var SigningIdentity = idModule.SigningIdentity;

var _chain = null;
var chainName = 'testChain';
var Client = hfc;
var client = new Client();

testutil.resetDefaults();
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('chain');

// Chain tests /////////////
test('\n\n ** Chain - constructor test **\n\n', function (t) {
	_chain = new Chain(chainName, client);
	if (_chain.getName() === chainName)
		t.pass('Chain constructor test: getName successful');
	else t.fail('Chain constructor test: getName not successful');

	t.throws(
		function () {
			_chain = new Chain(null, client);
		},
		/^Error: Failed to create Chain. Missing requirement "name" parameter./,
		'Chain constructor tests: Missing name parameter'
	);

	t.throws(
		function () {
			_chain = new Chain(chainName, null);
		},
		/^Error: Failed to create Chain. Missing requirement "clientContext" parameter./,
		'Chain constructor tests: Missing clientContext parameter'
	);

	t.end();
});

test('\n\n ** Chain - method tests **\n\n', function (t) {
	t.equal(_chain.isSecurityEnabled(), true, 'checking security setting');
	t.doesNotThrow(
		function () {
			_chain.setPreFetchMode(true);
		},
		null,
		'checking the set of prefetchMode'
	);
	t.equal(_chain.isPreFetchMode(), true, 'checking prefetchMode');
	t.doesNotThrow(
		function () {
			_chain.setTCertBatchSize(123);
		},
		null,
		'checking the set of TCertBatchSize'
	);
	t.equal(_chain.getTCertBatchSize(), 123, 'checking getTCertBatchSize');
	t.doesNotThrow(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_chain.addOrderer(orderer);
		},
		null,
		'checking the chain addOrderer()'
	);
	t.equal(_chain.getOrderers()[0].toString(), ' Orderer : {url:grpc://somehost.com:1234}', 'checking chain getOrderers()');
	t.throws(
		function () {
			var orderer = new Orderer('grpc://somehost.com:1234');
			_chain.addOrderer(orderer);
		},
		/^DuplicateOrderer: Orderer with URL/,
		'Chain tests: checking that orderer already exists.'
	);
	t.equal(_chain.toString(), '{"name":"testChain","orderers":" Orderer : {url:grpc://somehost.com:1234}|"}', 'checking chain toString');
	t.notEquals(_chain.getMSPManager(),null,'checking the chain getMSPManager()');
	t.doesNotThrow(
		function () {
			var msp_manager = new MSPManager();
			_chain.setMSPManager(msp_manager);
		},
		null,
		'checking the chain setMSPManager()'
	);
	t.notEquals(_chain.getOrganizationUnits(),null,'checking the chain getOrganizationUnits()');
	t.end();
});

test('\n\n **  Chain query tests', function(t) {
	var peer = new Peer('grpc://localhost:7051');
	_chain.addPeer(peer);
	var test_peer = new Peer('grpc://localhost:7051');
	t.throws(
		function () {
			_chain.setPrimaryPeer(test_peer);
		},
		/^Error: The primary peer must be on this chain\'s peer list/,
		'Not able to set a primary peer even if has the same addresss'
	);
	t.doesNotThrow(
		function () {
			_chain.setPrimaryPeer(peer);
		},
		null,
		'Able to set a primary peer as long as same peer'
	);
	test_peer = new Peer('grpc://localhost:7099');
	t.throws(
		function () {
			_chain.setPrimaryPeer(test_peer);
		},
		/^Error: The primary peer must be on this chain\'s peer list/,
		'Not Able to set a primary peer when not on the list'
	);
	t.throws(
		function () {
			_chain.setPrimaryPeer();
		},
		/^Error: The primary peer must be on this chain\'s peer list/,
		'Not Able to set a primary peer to a null peer'
	);

	_chain.queryBlockByHash()
		.then(
			function(results) {
				t.fail('Error: Blockhash bytes are required');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Blockhash bytes are required';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _chain.queryTransaction();
			}
		).then(
			function(results) {
				t.fail('Error: Transaction id is required');
				t.end();
			},
			function(err) {
				t.pass(err);
				return _chain.queryBlock('a');
			}
		).then(
			function(results) {
				t.fail('Error: block id must be integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a postive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _chain.queryBlock();
			}
		).then(
			function(results) {
				t.fail('Error: block id is required');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a postive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _chain.queryBlock(-1);
			}
		).then(
			function(results) {
				t.fail('Error: block id must be postive integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a postive integer';
				if(err.toString() == errMessage) t.pass(errMessage);
				else t.fail(errMessage);
				return _chain.queryBlock(10.5);
			}
		).then(
			function(results) {
				t.fail('Error: block id must be integer');
				t.end();
			},
			function(err) {
				var errMessage = 'Error: Block number must be a postive integer';
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

test('\n\n ** Chain addPeer() duplicate tests **\n\n', function (t) {
	var chain_duplicate = new Chain('chain_duplicate', client);
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
			chain_duplicate.addPeer(_peer);
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
	if (chain_duplicate.getPeers().length == expected) {
		t.pass('Duplicate peer not added to the chain(' + expected +
		' expected | ' + chain_duplicate.getPeers().length + ' found)');
	}
	else {
		t.fail('Failed to detect duplicate peer (' + expected +
		' expected | ' + chain_duplicate.getPeers().length + ' found)');
	}
	t.end();
});

test('\n\n ** Chain joinChannel() tests **\n\n', function (t) {
	var c = new Chain('joinChannel', client);
	var orderer = new Orderer('grpc://localhost:7050');

	var p1 = c.joinChannel({}
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

	var p5 = c.joinChannel({targets: 'targets' , txId : 'txId' }
	).then(function () {
		t.fail('Should not have been able to resolve the promise because of nonce request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing nonce') >= 0) {
			t.pass('Successfully caught missing nonce request error');
		} else {
			t.fail('Failed to catch the missing nonce request error. Error: ');
			logger.error(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p5])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain joinChannel() tests, Promise.all: ');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n** Packager tests **\n\n', function(t) {
	Packager.package('blah','',true)
	.then((data) => {
		t.equal(data, null, 'Chain.packageChaincode() should return null for dev mode');
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
		t.comment('Verify byte data begin');
		var tmpFile = '/tmp/test-deploy-copy.tar.gz';
		var destDir = '/tmp/test-deploy-copy-tar-gz';
		fs.writeFileSync(tmpFile, data);
		fs.removeSync(destDir);
		var pipe = fs.createReadStream(tmpFile).pipe(gunzip()).pipe(tar.extract(destDir));

		pipe.on('close', function() {
			var checkPath = path.join(destDir, 'src', 'github.com', 'example_cc');
			t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/github.com/example_cc" folder');
			t.comment('Verify byte data on close');
		});
		t.comment('Verify byte data end');
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

test('\n\n ** Chain _buildDefaultEndorsementPolicy() tests **\n\n', function (t) {
	var c = new Chain('does not matter', client);

	t.throws(
		() => {
			c._buildEndorsementPolicy();
		},
		/Verifying MSPs not found in the chain object, make sure "intialize\(\)" is called first/,
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
		'Checking that after initializing the chain with dummy msps and msp manager, _buildEndorsementPolicy() can be called without error'
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

test('\n\n ** Chain sendInstantiateProposal() tests **\n\n', function (t) {
	var c = new Chain('does not matter', client);
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
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

	var p2 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chainId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chainId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chainId error');
		} else {
			t.fail('Failed to catch the missing chainId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p3 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeVersion: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
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
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on chain');
	}).catch(function (err) {
		var msg = 'Missing peer objects in Instantiate proposal';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.addPeer(peer);
	var p5 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "txId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "txId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing txId error');
		} else {
			t.fail('Failed to catch the missing txId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p6 = c.sendInstantiateProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chaincodeVersion: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "nonce" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "nonce" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing nonce error');
		} else {
			t.fail('Failed to catch the missing nonce error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p7 = c.sendInstantiateProposal().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p6, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain sendInstantiateProposal() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Chain sendTransactionProposal() tests **\n\n', function (t) {
	var c = new Chain('does not matter', client);
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.sendTransactionProposal({
		chaincodeId : 'blah',
		fcn: 'invoke',
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
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

	var p2 = c.sendTransactionProposal({
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chainId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chainId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chainId error');
		} else {
			t.fail('Failed to catch the missing chainId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p3 = c.sendTransactionProposal({
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
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
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on chain');
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
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "txId" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "txId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing txId error');
		} else {
			t.fail('Failed to catch the missing txId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p6 = c.sendTransactionProposal({
		chaincodeId: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "nonce" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "nonce" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing nonce error');
		} else {
			t.fail('Failed to catch the missing nonce error. Error: ' + err.stack ? err.stack : err);
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

	Promise.all([p1, p2, p3, p4, p5, p6, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain sendTransactionProposal() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Client queryByChaincode() tests **\n\n', function (t) {
	var c = client.newChain('any chain goes');
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.queryByChaincode({
		chaincodeId : 'blah',
		fcn: 'invoke',
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
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

	var p2 = c.queryByChaincode({
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chainId" parameter in queryByChaincode');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chainId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chainId error');
		} else {
			t.fail('Failed to catch the queryByChaincode missing chainId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p3 = c.queryByChaincode({
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodeId" parameter in queryByChaincode');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "chaincodeId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodeId error');
		} else {
			t.fail('Failed to catch the queryByChaincode missing chaincodeId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.removePeer(peer);
	var p4 = c.queryByChaincode({
		chaincodeId: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peers" on chain in queryByChaincode');
	}).catch(function (err) {
		var msg = 'Missing peer objects in Transaction proposal';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch queryByChaincode error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.addPeer(peer);
	var p5 = c.queryByChaincode({
		chaincodeId: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "txId" parameter in queryByChaincode');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "txId" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing txId error');
		} else {
			t.fail('Failed to catch the queryByChaincode missing txId error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p6 = c.queryByChaincode({
		chaincodeId: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "nonce" parameter in queryByChaincode');
	}).catch(function (err) {
		if (err.message.indexOf('Missing "nonce" parameter in the proposal request') >= 0) {
			t.pass('Successfully caught missing nonce error');
		} else {
			t.fail('Failed to catch the queryByChaincode missing nonce error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p7 = c.queryByChaincode().then(function () {
		t.fail('Should not have been able to resolve the promise because of missing request parameter in queryByChaincode');
	}).catch(function (err) {
		if (err.message.indexOf('Missing request object for this transaction proposal') >= 0) {
			t.pass('Successfully caught missing request error');
		} else {
			t.fail('Failed to catch the queryByChaincode missing request error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4, p5, p6, p7])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Client queryByChaincode() tests, Promise.all: ');
			logger.error(err.stack ? err.stack : err);
			t.end();
		}
	);
});

test('\n\n ** Chain sendTransaction() tests **\n\n', function (t) {
	let o = _chain.getOrderers();
	for (let i = 0; i < o.length; i++) {
		_chain.removeOrderer(o[i]);
	}
	var p1 = _chain.sendTransaction()
		.then(function () {
			t.fail('Should not have been able to resolve the promise because of missing parameters');
		}, function (err) {
			if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
				t.pass('Successfully caught missing request error');
			} else {
				t.fail('Failed to catch the missing request error. Error: ' + err.stack ? err.stack : err);
			}
		});

	var p2 = _chain.sendTransaction({
		proposal: 'blah',
		header: 'blah'
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

	var p3 = _chain.sendTransaction({
		proposalResponses: 'blah',
		header: 'blah'
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

	var p4 = _chain.sendTransaction({
		proposalResponses: 'blah',
		proposal: 'blah'
	})
	.then(function () {
		t.fail('Should not have been able to resolve the promise because of missing parameters');
	}, function (err) {
		if (err.message.indexOf('Missing "header" parameter in transaction request') >= 0) {
			t.pass('Successfully caught missing header error');
		} else {
			t.fail('Failed to catch the missing header error. Error: ' + err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4])
	.then(
		function (data) {
			t.end();
		}
	).catch(
		function (err) {
			t.fail('Chain sendTransaction() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
	);
});

//
// Orderer via chain setOrderer/getOrderer
//
// Set the orderer URL through the chain setOrderer method. Verify that the
// orderer URL was set correctly through the getOrderer method. Repeat the
// process by updating the orderer URL to a different address.
//
test('\n\n** TEST ** orderer via chain setOrderer/getOrderer', function(t) {
	//
	// Create and configure the test chain
	//
	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	hfc.newDefaultKeyValueStore({
		path: testutil.KVS
	})
	.then ( function (store) {
		client.setStateStore(store);

		var chain = client.newChain('testChain-orderer-member');
		try {
			var orderer = new Orderer('grpc://localhost:7050');
			chain.addOrderer(orderer);
			t.pass('Successfully set the new orderer URL');

			var orderers = chain.getOrderers();
			if(orderers !== null && orderers.length > 0 && orderers[0].getUrl() === 'grpc://localhost:7050') {
				t.pass('Successfully retrieved the new orderer URL from the chain');
			}
			else {
				t.fail('Failed to retieve the new orderer URL from the chain');
				t.end();
			}

			try {
				var orderer2 = new Orderer('grpc://localhost:5152');
				chain.addOrderer(orderer2);
				t.pass('Successfully updated the orderer URL');

				var orderers = chain.getOrderers();
				if(orderers !== null && orderers.length > 0 && orderers[1].getUrl() === 'grpc://localhost:5152') {
					t.pass('Successfully retrieved the upated orderer URL from the chain');
				}
				else {
					t.fail('Failed to retieve the updated orderer URL from the chain');
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
// Orderer via chain set/get bad address
//
// Set the orderer URL to a bad address through the chain setOrderer method.
// Verify that an error is reported when trying to set a bad address.
//
test('\n\n** TEST ** orderer via chain set/get bad address', function(t) {
	//
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-orderer-member1');

	t.throws(
		function() {
			var order_address = 'xxx';
			chain.addOrderer(new Orderer(order_address));
		},
		/InvalidProtocol: Invalid protocol: undefined/,
		'Test setting a bad orderer address'
	);

	t.throws(
		function() {
			chain.addOrderer(new Orderer());
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
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-compareProposal');

	t.throws(
		function() {
			chain.compareProposalResponseResults();
		},
		/Error: Missing proposal responses/,
		'Test compareProposalResponseResults with empty parameter'
	);

	t.throws(
		function() {
			chain.compareProposalResponseResults({});
		},
		/Error: Parameter must be an array of ProposalRespone Objects/,
		'Test compareProposalResponseResults with an object parameter'
	);

	t.throws(
		function() {
			chain.compareProposalResponseResults([]);
		},
		/Error: Parameter proposal responses does not contain a PorposalResponse/,
		'Test compareProposalResponseResults with an empty array parameter'
	);

	t.throws(
		function() {
			chain.compareProposalResponseResults([{}]);
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
	// Create and configure the test chain
	//
	var chain = client.newChain('testChain-compareProposal2');

	t.throws(
		function() {
			chain.verifyProposalResponse();
		},
		/Error: Missing proposal response/,
		'Test verifyProposalResponse with empty parameter'
	);

	t.throws(
		function() {
			chain.verifyProposalResponse({});
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an object parameter'
	);

	t.throws(
		function() {
			chain.verifyProposalResponse([]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an empty array parameter'
	);

	t.throws(
		function() {
			chain.verifyProposalResponse([{}]);
		},
		/Error: Parameter must be a ProposalResponse Object/,
		'Test verifyProposalResponse with an array without the correct endorsements parameter'
	);
	t.end();
});
