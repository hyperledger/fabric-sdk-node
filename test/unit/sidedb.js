/*
 Copyright 2018 Zhao Chaoyi, All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const tape = require('tape');
const tapePromise = require('tape-promise').default;
const test = tapePromise(tape);
const { checkCollectionConfig } = require('fabric-client/lib/SideDB');

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

	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "name" of type string, found undefined\(type: undefined\)/,
	'collectionConfig without name should throw error');

	config = {
		name: 'test'
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/Missing Requires Param "policy"/,
	'collectionConfig without config should throw error');

	config = {
		name: 'test',
		policy: policy
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "maxPeerCount" of type number, found undefined\(type: undefined\)/,
	'collectionConfig without maxPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: '0'
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "maxPeerCount" of type number, found "0"\(type: string\)/,
	'collectionConfig without valid maxPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 0,
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "requiredPeerCount" of type number, found undefined\(type: undefined\)/,
	'collectionConfig without requiredPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: '100'
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "requiredPeerCount" of type number, found "100"\(type: string\)/,
	'collectionConfig without valid requiredPeerCount should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" of type unsigned int64, found undefined\(type: undefined\)/,
	'collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" of type unsigned int64, found undefined\(type: undefined\)/,
	'collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: 'abcdef'
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" of type unsigned int64, found "abcdef"\(type: string\)/,
	'collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '28446744073709551615'
	};
	t.throws(()=>{
		checkCollectionConfig(config);
	},
	/CollectionConfig Requires Param "blockToLive" of type unsigned int64, found "28446744073709551615"\(type: string\)/,
	'collectionConfig without valid blockToLive should throw error');

	config = {
		name: 'test',
		policy: policy,
		maxPeerCount: 123,
		requiredPeerCount: 100,
		blockToLive: '18446744073709551615'
	};
	t.doesNotThrow(()=>{
		checkCollectionConfig(config);
	},
	'collectionConfig with valid config should not throw error');
});