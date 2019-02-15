/**
 * Copyright 2016-2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const _policiesProto = require('fabric-protos').common;
const Policy = require('fabric-client/lib/Policy.js');

const chai = require('chai');
chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

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

describe.only('policies.proto', () => {

	it('should be able to decode a Policy', () => {
		const policy = Policy.buildPolicy([], CRAZY_SPEC);
		const env = _policiesProto.SignaturePolicyEnvelope.decode(policy);

		// Check the decoded versions
		env.rule.n_out_of.getN().should.equal(2);
		env.rule.n_out_of.getRules().length.should.equal(2);
		env.rule.n_out_of.rules[0].n_out_of.getN().should.equal(1);
		env.rule.n_out_of.rules[0].n_out_of.getRules().length.should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getN().should.equal(1);
		env.rule.n_out_of.rules[1].n_out_of.getRules().length.should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[0].n_out_of.getN().should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[0].n_out_of.getRules().length.should.equal(3);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getN().should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules().length.should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules()[0].signed_by.should.equal(2);
		env.rule.n_out_of.rules[1].n_out_of.getRules()[1].n_out_of.getRules()[1].n_out_of.getN().should.equal(1);
	});
});
