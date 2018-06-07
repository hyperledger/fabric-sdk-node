/*
 Copyright 2018 Zhao Chaoyi, All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const tape = require('tape');
const tapePromise = require('tape-promise').default;
const test = tapePromise(tape);
const CollectionConfig = require('fabric-client/lib/SideDB');

test('Test SideDB.checkCollectionConfig()', async (t) => {
	let config = {};
	let policy = {
		identities: [{
			role: {
				name: 'member',
				mspId: 'Org1MSP'
			}
		},
		{
			role: {
				name: 'member',
				mspId: 'Org2MSP'
			}
		}
		],
		policy: {
			'1-of': [
				{
					'signed-by': 0
				},
				{
					'signed-by': 1
				}
			]
		}
	};

	// method buildCollectionConfigPackage
	t.throws(()=>{
		CollectionConfig.buildCollectionConfigPackage();
	},
	/Expect collections config of type Array/,
	'Checking buildCollectionConfigPackage:: Expect collections config of type Array');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfigPackage([]);
	},
	/Expect collections config of type Array/,
	'Checking buildCollectionConfigPackage:: Expect collections config of type Array');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfigPackage({});
	},
	/Expect collections config of type Array/,
	'Checking buildCollectionConfigPackage:: Expect collections config of type Array');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfigPackage([{}]);
	},
	/CollectionConfig Requires Param "name" of type string/,
	'Checking buildCollectionConfigPackage:: CollectionConfig Requires Param "name" of type string');

	// method  buildCollectionConfig
	t.throws(()=>{
		CollectionConfig.buildCollectionConfig();
	},
	/Cannot destructure property `name` of 'undefined' or 'null'/,
	'Checking buildCollectionConfig:: null input');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfig([]);
	},
	/CollectionConfig Requires Param "name" of type string/,
	'Checking buildCollectionConfig:: array input');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfig({});
	},
	/CollectionConfig Requires Param "name" of type string/,
	'Checking buildCollectionConfig:: empty object input');
	t.throws(()=>{
		CollectionConfig.buildCollectionConfig([{}]);
	},
	/CollectionConfig Requires Param "name" of type string/,
	'Checking buildCollectionConfig:: array with empty object input');

	// method checkCollectionConfig
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "name" of type string, found undefined\(type: undefined\)/,
	'checkCollectionConfig checkCollectionConfig:: collectionConfig without name should throw error');

	config = {
		name: 'test'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/Missing Requires Param "policy"/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without config should throw error');

	config = {
		name: 'test',
		policy: policy
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "maxPeerCount" of type number, found undefined\(type: undefined\)/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without maxPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: '0'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "maxPeerCount" of type number, found "0"\(type: string\)/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid maxPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 0,
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "requiredPeerCount" of type number, found undefined\(type: undefined\)/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without requiredPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: '100'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "requiredPeerCount" of type number, found "100"\(type: string\)/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid requiredPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '-19998766'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: -1
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: 'abcdef'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" of type unsigned int64, found "abcdef"\(type: string\)/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '28446744073709551615'
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: 18446744073709551615
	};
	t.throws(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/,
	'checkCollectionConfig checkCollectionConfig::collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '18446744073709551615'
	};
	t.doesNotThrow(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	'checkCollectionConfig checkCollectionConfig::collectionConfig with valid config should not throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: 0
	};
	t.doesNotThrow(()=>{
		CollectionConfig.checkCollectionConfig(config);
	},
	'checkCollectionConfig checkCollectionConfig::collectionConfig with valid config should not throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '0'
	};
	t.doesNotThrow(()=>{
		const col_config = CollectionConfig.checkCollectionConfig(config);
	},
	'checkCollectionConfig checkCollectionConfig::check blocktolive as string of 0');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100
	};
	t.doesNotThrow(()=>{
		const col_config = CollectionConfig.checkCollectionConfig(config);
		t.equal(col_config.blockToLive, 0, 'Check that blockToLive will be defaulted as 0');
	},
	'checkCollectionConfig checkCollectionConfig::check blocktolive not entered will be returned as 0');
});
