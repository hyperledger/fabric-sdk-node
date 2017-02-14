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
var rewire = require('rewire');

// use rewire to load the module to get access to the private functions to test
var ChainModule = rewire('../../fabric-client/lib/Chain.js');
var tar = require('tar-fs');
var gunzip = require('gunzip-maybe');
var fs = require('fs-extra');

var hfc = require('fabric-client');
var testutil = require('./util.js');
var Peer = require('fabric-client/lib/Peer.js');
var Chain = require('fabric-client/lib/Chain.js');
var Orderer = require('fabric-client/lib/Orderer.js');

var _chain = null;
var chainName = 'testChain';
var Client = hfc;
var client = new Client();

testutil.resetDefaults();

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
			_chain.setDevMode(true);
		},
		null,
		'checking the set of DevMode'
	);
	t.equal(_chain.isDevMode(), true, 'checking DevMode');
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

	_chain.setConsensusType('SOMETYPE');
	t.equal(_chain.getConsensusType(), 'SOMETYPE', 'Chain tests: checking set and get Consensus type');
	t.throws(
		function () {
			_chain.setInitialEpoch(-1);
		},
		/^Error: initial epoch must be a positive integer/,
		'Chain tests: checking that epoch should be positive integer when input is negative.'
	);
	t.throws(
		function () {
			_chain.setInitialEpoch(1.1);
		},
		/^Error: initial epoch must be a positive integer/,
		'Chain tests: checking that epoch should be positive integer when input is float.'
	);
	t.throws(
		function () {
			_chain.setInitialEpoch('a');
		},
		/^Error: initial epoch must be a positive integer/,
		'Chain tests: checking that epoch should be positive integer when input is char.'
	);
	t.doesNotThrow(
		function () {
			_chain.setInitialEpoch(3);
		},
		null,
		'checking the chain setInitialEpoch()'
	);
	t.equal(_chain.getInitialEpoch(), 3, 'Chain tests: checking set and get initial epoch');
	t.throws(
		function () {
			_chain.setInitialMaxMessageCount(-1);
		},
		/^Error: initial maximum message count must be a positive integer/,
		'Chain tests: checking that max message count should be positive integer when input is negative.'
	);
	t.throws(
		function () {
			_chain.setInitialMaxMessageCount(1.1);
		},
		/^Error: initial maximum message count must be a positive integer/,
		'Chain tests: checking that max message count should be positive integer when input is float.'
	);
	t.throws(
		function () {
			_chain.setInitialMaxMessageCount('a');
		},
		/^Error: initial maximum message count must be a positive integer/,
		'Chain tests: checking that max message count should be positive integer when input is char.'
	);
	t.doesNotThrow(
		function () {
			_chain.setInitialMaxMessageCount(30);
		},
		null,
		'Chain tests: checking the chain setInitialMaxMessageCount()'
	);
	t.equal(_chain.getInitialMaxMessageCount(), 30, 'Chain tests: checking set and get initial max message count');

	t.throws(
		function () {
			_chain.setInitialAbsoluteMaxBytes(-1);
		},
		/^Error: initial absolute maximum bytes must be a positive integer/,
		'Chain tests: checking that absolute max bytes should be positive integer when input is negative.'
	);
	t.throws(
		function () {
			_chain.setInitialAbsoluteMaxBytes(1.1);
		},
		/^Error: initial absolute maximum bytes must be a positive integer/,
		'Chain tests: checking that absolute max bytes should be positive integer when input is float.'
	);
	t.throws(
		function () {
			_chain.setInitialAbsoluteMaxBytes('a');
		},
		/^Error: initial absolute maximum bytes must be a positive integer/,
		'Chain tests: checking that absolute max bytes should be positive integer when input is char.'
	);

	var initialAbsoluteMaxBytes = _chain.getInitialAbsoluteMaxBytes();
	t.equal(initialAbsoluteMaxBytes, 0xA00000,
			'Chain tests: check absolute maximum bytes default value');
	_chain.setInitialAbsoluteMaxBytes(0);
	t.equal(_chain.getInitialAbsoluteMaxBytes(), 0, 'Chain tests: set max ab bytes to zero');
	t.doesNotThrow(
		function () {
			_chain.setInitialAbsoluteMaxBytes(0x9fFFFF);
		},
		null,
		'Chain tests: setInitialAbsoluteMaxBytes()'
	);
	t.equal(_chain.getInitialAbsoluteMaxBytes(), initialAbsoluteMaxBytes - 1,
		    'Chain tests: checking set and get initial maximum absolute bytes');

	var  initialPreferredMaxBytes = _chain.getInitialPreferredMaxBytes();
	t.throws(
		function () {
			_chain.setInitialPreferredMaxBytes(-1);
		},
		/^Error: initial preferred maximum bytes must be a positive integer/,
		'Chain tests: checking that preferred max bytes should be positive integer when input is negative.'
	);
	t.throws(
		function () {
			_chain.setInitialPreferredMaxBytes(1.1);
		},
		/^Error: initial preferred maximum bytes must be a positive integer/,
		'Chain tests: checking that preferred max bytes should be positive integer when input is float.'
	);
	t.throws(
		function () {
			_chain.setInitialPreferredMaxBytes('a');
		},
		/^Error: initial preferred maximum bytes must be a positive integer/,
		'Chain tests: checking that preferred max bytes should be positive integer when input is char.'
	);
	t.equal(initialPreferredMaxBytes, 0xA00000,
			'Chain tests: check initial preferred maximum bytes default value');
	_chain.setInitialPreferredMaxBytes(0);
	t.equal(_chain.getInitialPreferredMaxBytes(), 0, 'Chain tests: set initial preferred maximum bytes to zero');
	t.doesNotThrow(
		function () {
			_chain.setInitialPreferredMaxBytes(0x9fFFFF);
		},
		null,
		'Chain tests: setInitialPreferredMaxBytes()'
	);
	t.equal(_chain.getInitialPreferredMaxBytes(), initialPreferredMaxBytes - 1,
		    'Chain tests: checking set and get initial maximum preferred bytes');

	t.doesNotThrow(
		function () {
			_chain.setInitialTransactionId('abcde');
		},
		null,
		'checking the chain setInitialTransactionId()'
	);
	t.equal(_chain.getInitialTransactionId(), 'abcde', 'Chain tests: checking set and get initial transaction id');
	var test_chain = new Chain('someTestChain', client);
	test_chain.initializeChain().then(
		function (response) {
			t.fail('Chain tests: orderer should have been required');
		},
		function (error) {
			if(!error) {
				t.fail('Should be getting an error back');
			}
			else {
				t.equals(error.toString(),'Error: no primary orderer defined','Chain tests: orederer is required when initializing');
			}
		}
	);
	var test_chain2 = new Chain('someTestChain2', {_userContext : {} });
	test_chain2.addOrderer(new Orderer('grpc://somehost.com:1234'));
	test_chain2.initializeChain().then(
		function (response) {
			t.fail('Chain tests: transaction should have been required');
		},
		function (error) {
			if(!error) {
				t.fail('Should be getting an error back');
			}
			else {
				t.equals(error.toString(),'Error: Initial transaction id is not defined','Chain tests: transaction id is required when initializing');
			}
		}
	);
	var client3 = new Client();
	var test_chain3 = new Chain('someTestChain3', client3);
	test_chain3.addOrderer(new Orderer('grpc://somehost.com:1234'));
	test_chain3.initializeChain().then(function(response){
		t.fail('Chain tests: no user defined should, throw error, response '+response);
	},function(error){
		if (error && error.message && error.message === 'no user defined')
			t.pass('Chain tests: no user defined, should throw error');
		else t.fail('Chain tests: no user defined, should have thrown error "no user defined"');
	});

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

test('\n\n** Chain packageChaincode tests **\n\n', function(t) {
	var packageChaincode = ChainModule.__get__('packageChaincode');
	t.equal(typeof packageChaincode, 'function', 'The rewired module should return the private function here');

	packageChaincode(true, 'blah')
	.then((data) => {
		t.equal(data, null, 'Chain.packageChaincode() should return null for dev mode');
		return packageChaincode(false, {});
	}).then(() => {
		t.fail('Chain.packageChaincode() should have rejected a call that does not have the valid request argument');
	}).catch((err) => {
		t.equal(err.message, 'Missing chaincodePath parameter in Deployment proposal request', 'Chain.packageChaincode() argument validation');

		testutil.setupChaincodeDeploy();

		return packageChaincode(false, {
			chaincodePath: testutil.CHAINCODE_PATH,
			chaincodeId: 'testChaincodeId'
		});
	}).then((data) => {
		var tmpFile = '/tmp/test-deploy-copy.tar.gz';
		var destDir = '/tmp/test-deploy-copy-tar-gz';
		fs.writeFileSync(tmpFile, data);
		fs.removeSync(destDir);
		var pipe = fs.createReadStream(tmpFile).pipe(gunzip()).pipe(tar.extract(destDir));

		pipe.on('close', function() {
			var checkPath = path.join(destDir, 'src', 'github.com', 'example_cc');
			t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Chain.packageChaincode() has the "src/github.com/example_cc" folder');
		});
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
	});

	t.end();
});

test('\n\n ** Chain sendDeploymentProposal() tests **\n\n', function (t) {
	var c = new Chain('does not matter', client);
	var peer = new Peer('grpc://localhost:7051');
	c.addPeer(peer);

	var p1 = c.sendDeploymentProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodeId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		chainId: 'blah',
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "chaincodePath" parameter');
	}).catch(function (err) {
		if (err.message.indexOf('Missing chaincodePath parameter in Deployment proposal request') >= 0) {
			t.pass('Successfully caught missing chaincodePath error');
		} else {
			t.fail('Failed to catch the missing chaincodePath error. Error: ' + err.stack ? err.stack : err);
		}
	});

	var p2 = c.sendDeploymentProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
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

	var p3 = c.sendDeploymentProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
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
	var p4 = c.sendDeploymentProposal({
		chaincodePath: 'blah',
		chaincodeId: 'blah',
		chainId: 'blah',
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: 'blah',
		nonce: 'blah'
	}).then(function () {
		t.fail('Should not have been able to resolve the promise because of missing "peer" objects on chain');
	}).catch(function (err) {
		var msg = 'Missing peer objects in Deployment proposal chain';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Successfully caught error: '+msg);
		} else {
			t.fail('Failed to catch error: '+msg+'. Error: ' + err.stack ? err.stack : err);
		}
	});

	c.addPeer(peer);
	var p5 = c.sendDeploymentProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
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

	var p6 = c.sendDeploymentProposal({
		targets: [new Peer('grpc://localhost:7051')],
		chaincodePath: 'blah',
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

	var p7 = c.sendDeploymentProposal().then(function () {
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
			t.fail('Chain sendDeploymentProposal() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
		);

	t.end();
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
		var msg = 'Missing peer objects in Transaction proposal chain';
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
		if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
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

	t.end();
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
		var msg = 'Missing peer objects in Transaction proposal chain';
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
		if (err.message.indexOf('Missing input request object on the proposal request') >= 0) {
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
			t.fail('Client queryByChaincode() tests, Promise.all: '+err.stack ? err.stack : err);
			t.end();
		}
		);

	t.end();
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
		if (err.message.indexOf('Missing "proposalResponse" parameter in transaction request') >= 0) {
			t.pass('Successfully caught missing proposalResponse error');
		} else {
			t.fail('Failed to catch the missing proposalResponse error. Error: ' + err.stack ? err.stack : err);
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

	t.end();
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
					t.end();
				}
				else {
					t.fail('Failed to retieve the updated orderer URL from the chain');
					t.end();
				}
			}
			catch(err2) {
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
