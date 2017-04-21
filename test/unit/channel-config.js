/**
 * Copyright 2017 IBM All Rights Reserved.
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

var tar = require('tar-fs');
var gunzip = require('gunzip-maybe');
var fs = require('fs-extra');
var grpc = require('grpc');

var Client = require('fabric-client');
var client = new Client();

var testutil = require('./util.js');
var ChannelConfig = rewire('fabric-client/lib/ChannelConfig.js');

testutil.resetDefaults();
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('config-envelope-test');

var grpc = require('grpc');
var commonProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
var configtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;

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

var ACCEPT_ALL = {
	identities: [],
	policy: {
		'0-of': []
	}
};

var test_input = {
	channel : {
		name : 'mychannel',
		consortium : 'test',
		settings : {
			'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : '99M',	'preferred-max-bytes' : '512K'},
			'batch-timeout' : '10s',
			'hashing-algorithm' : 'SHA256',
			'block-data-hashing-structure' : '2G',
			'consensus-type' : 'solo',
			'creation-policy' : 'admins',
		},
		policies : {
			readers : {threshold : 'ANY'},
			writers : {threshold : 'ALL'},
			admins  : {threshold : 'MAJORITY'},
			'accept-all' : {n_of_signature : ACCEPT_ALL}
		},
		orderers : {
			organizations : [{
				id : 'ordererMSP',
				msp : { mspid : 'ordererMSP'},
				policies : {
					readers : {n_of_signature : ONE_OF_TWO_ORG_MEMBER},
					writers : {n_of_signature : ONE_OF_TWO_ORG_MEMBER},
					admins  : {n_of_signature : ONE_OF_TWO_ORG_MEMBER}
				},
				'end-points' : ['orderer:7050'],
				'kafka-brokers' : ['orderer:8888']
			}],
			policies : {
				readers : {threshold : 'ANY'},
				writers : {threshold : 'ALL'},
				admins  : {threshold : 'MAJORITY'}
			}
		},
		peers : {
			organizations : [{
				id : 'org1MSP',
				msp : { mspid : 'org1MSP'},
				'anchor-peers' : ['host1:7051', 'host2:7056'],
				policies : {
					readers : {n_of_signature : ONE_OF_TWO_ORG_MEMBER},
					writers : {n_of_signature : ONE_OF_TWO_ORG_MEMBER},
					admins  : {n_of_signature : ONE_OF_TWO_ORG_MEMBER}
				}
			}],
			policies : {
				readers : {threshold : 'ANY'},
				writers : {threshold : 'ALL'},
				admins  : {threshold : 'MAJORITY'}
			},
		}
	}
};

var msps = new Map();
msps.set('ordererMSP',client.newMSP({rootCerts: [], admins: [], id: 'ordererMSP'}));
msps.set('org1MSP',client.newMSP({rootCerts: [], admins: [], id: 'org1MSP'}));
var channelConfig = new ChannelConfig(msps);


// error tests /////////////
test('\n\n ** ChannelConfig - parameter test **\n\n', function (t) {
	t.throws(
		function () {
			let channelConfig = new ChannelConfig();
		},
		/^Error: MSP definitions are required/,
		'checking MSP definitions are required'
	);

	t.throws(
		function () {
			channelConfig.build();
		},
		/^Error: Channel configuration definition object is required/,
		'Checking Channel configuration definition object is required'
	);

	t.throws(
		function () {
			channelConfig.build({});
		},
		/^Error: Channel configuration "channel" definition object is required/,
		'Checking Channel configuration "channel" definition object is required'
	);

	t.throws(
		function () {
			channelConfig.build({channel : { settings : {}, orderers : {}}});
		},
		/^Error: Channel configuration "peers" definition object is required/,
		'Checking Channel configuration "peers" definition object is required'
	);

	t.throws(
		function () {
			let test_input = { channel : {	name : 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo'},
				orderers : {organizations : []},
				peers : {}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Missing peers organizations array/,
		'Checking Missing peers organizations array'
	);

	t.throws(
		function () {
			let test_input = { channel : {  consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo'},
				orderers : {organizations : []},
				peers : {}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Channel configuration "name" setting is required/,
		'Checking Channel configuration "name" setting is required'
	);

	t.throws(
		function () {
			let test_input = { channel : {	name : 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo',},
				orderers : {organizations : [{id : 'ordererMSP', 'end-points' :['somehost:9090'], policies : { admins : { threshold : 'ALL'}}}]},
				peers : { organizations : [{id : 'org1MSP', 'anchor-peers' : ['host:port'], policies : { admins : { threshold : 'ALL'}}}]}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Organization org1MSP has an invalid anchor peer address ::host:port/,
		'Checking Organization org1MSP has an invalid anchor peer address ::host:port'
	);

	t.throws(
		function () {
			let test_input = { channel : { name: 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 10, 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo',},
				orderers : {organizations : [{id : 'ordererMSP', 'end-points' :['somehost:9090'], policies : { admins : { threshold : 'BAD'}}}]},
				peers : { organizations : [{id : 'org1MSP', 'anchor-peers' : ['host:8888'], policies : { admins : { threshold : 'BAD'}}}]},
				policies : { admins : { threshold : 'BAD'}}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Implicit Rule is not known ::BAD/,
		'Checking Implicit Rule is not known ::BAD'
	);
	t.throws(
		function () {
			let test_input = { channel : {	name : 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 'dd', 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo'},
				orderers : {organizations : [{id : 'ordererMSP'}]},
				peers : { organizations : [{id : 'org1MSP', 'anchor-peers' : ['host:port'], policies : { admins : { threshold : 'ALL'}}}]}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Setting max-message-count is not valid value :: dd/,
		'Checking Setting max-message-count is not valid value :: dd'
	);

	t.throws(
		function () {
			let test_input = { channel : {	name : 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : '10Z', 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo'},
				orderers : {organizations : [{id : 'ordererMSP'}]},
				peers : { organizations : [{id : 'org1MSP', 'anchor-peers' : ['host:port'], policies : { admins : { threshold : 'ALL'}}}]}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Setting max-message-count is not valid value :: 10Z/,
		'Checking Setting max-message-count is not valid value :: 10Z'
	);


	t.throws(
		function () {
			let test_input = { channel : {	name : 'mychannel', consortium : 'test',
				settings : {
					'batch-size' : {'max-message-count' : 'RRK', 'absolute-max-bytes' : 103809024,	'preferred-max-bytes' : 524288},
					'batch-timeout' : '10s',
					'hashing-algorithm' : 'SHA256',
					'block-data-hashing-structure' : 4294967295,
					'consensus-type' : 'solo'},
				orderers : {organizations : [{id : 'ordererMSP'}]},
				peers : { organizations : [{id : 'org1MSP', 'anchor-peers' : ['host:port'], policies : { admins : { threshold : 'ALL'}}}]}
			}};
			channelConfig.build(test_input);
		},
		/^Error: Setting max-message-count is not valid value :: RRK/,
		'Checking Setting max-message-count is not valid value :: RRK'
		);


	t.end();
});


test('\n\n ** ChannelConfig - MSP check **\n\n', function (t) {
	let client2 = new Client();

	t.throws(
		function () {
			var channelConfig = new ChannelConfig(new Map());
			channelConfig.build(test_input);
		},
		/^Error: MSP ordererMSP was not found/,
		'Checking MSP ordererMSP was not found'
	);
	t.end();
});

test('\n\n ** ChannelConfig - basic field check tests **\n\n', function (t) {
	t.doesNotThrow(
		function () {
			try {
				var channelConfig = new ChannelConfig(msps);
				var channelConfigUpdate = channelConfig.build(test_input);
				t.pass('No exceptions building on a good configuration');

				var chain = client.newChain('test');
				var results = chain.loadConfigUpdate(channelConfigUpdate.toBuffer());
				t.pass('No exceptions reloading the results of the build');

				logger.info(' results found ::%j',results);
				t.equals(results['anchor-peers'][0].host,'host1', 'Checking that we found anchor peer host1');
				t.equals(results['anchor-peers'][0].port,7051, 'Checking that we found anchor peer port');
				t.equals(results['anchor-peers'][1].host,'host2', 'Checking that we found anchor peer host2');
				t.equals(results['anchor-peers'][1].port,7056, 'Checking that we found anchor peer port');
				t.equals(results.orderers[0],'orderer:7050', 'Checking that we found orderer');
				t.equals(results['kafka-brokers'][0],'orderer:8888', 'Checking that we found kafka broker');
				t.equals(chain._msp_manager.getMSP('ordererMSP').getId(),'ordererMSP', 'Checking that the msp was loaded by the initialize');
				t.equals(chain._msp_manager.getMSP('org1MSP').getId(),'org1MSP', 'Checking that the msp was loaded by the initialize');
				t.equals(results.settings.ConsensusType.type, 'solo', 'Checking for consensus type setting');
				t.equals(results.settings.BatchSize.maxMessageCount, 10, 'Checking for BatchSize maxMessageCount setting');
				t.equals(results.settings.BatchSize.absoluteMaxBytes, 103809024, 'Checking for BatchSize absoluteMaxBytes setting');
				t.equals(results.settings.BatchSize.preferredMaxBytes, 524288, 'Checking for BatchSize preferredMaxBytes setting');
				t.equals(results.settings.HashingAlgorithm.name, 'SHA256', 'Checking for HashingAlgorithm setting');
				t.equals(results.settings.BlockDataHashingStructure.width, 2147483648, 'Checking for BlockDataHashingStructure setting');
			}
			catch(err) {
				logger.error('test -:: %s', err.stack ? err.stack : err);
				throw err;
			}
		},
		null,
		'checking basic input'
	);
	t.end();
});

test('\n\n** ChannelConfig - test convert() function **\n\n', function(t) {
	// use the special getter provided by rewire to get access to the module-scoped variable
	var convert = ChannelConfig.__get__('convert');

	t.equals(convert('123k'), 123 * 1024, 'convert 123k');
	t.equals(convert('123K'), 123 * 1024, 'convert 123M');
	t.equals(convert('123m'), 123 * 1024 * 1024, 'convert 123m');
	t.equals(convert('123m'), 123 * 1024 * 1024, 'convert 123M');
	t.equals(convert('123g'), 123 * 1024 * 1024 * 1024, 'convert 123g');
	t.equals(convert('123G'), 123 * 1024 * 1024 * 1024, 'convert 123G');
	t.end();
});
