/*
 Copyright 2018 Zhao Chaoyi, All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const tape = require('tape');
const tapePromise = require('tape-promise').default;
const test = tapePromise(tape);
const { checkPolicy } = require('fabric-client/lib/Policy');

test('Test Policy.checkPolicy()', async (t) => {
	let policy;

	t.throws(()=> {
		checkPolicy(policy);
	},
	/Missing Required Param "policy"/,
	'checkPolicy should throw error if missing param "policy"');

	policy = {
		policy: {}
	};
	t.throws(()=> {
		checkPolicy(policy);
	},
	/Invalid policy, missing the "identities" property/,
	'checkPolicy should throw error if missing property "identities"');

	policy = {
		policy: {},
		identities: {},
	};
	t.throws(()=> {
		checkPolicy(policy);
	},
	/Invalid policy, the "identities" property must be an array/,
	'checkPolicy should throw error if property "identities" is not an array');

	policy = {
		identities: [],
	};
	t.throws(()=> {
		checkPolicy(policy);
	},
	/Invalid policy, missing the "policy" property/,
	'checkPolicy should throw error if missing property "policy"');

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
	t.doesNotThrow(()=>{
		checkPolicy(policy);
	}, 'checkPolicy should not throw error for a valid policy');
});