/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');
const {checkPolicy, buildSignaturePolicy} = require('../lib/Policy');
let {buildPrincipal} = require('../lib/Policy');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('Policy', () => {

	describe('#EndorsementPolicy.buildPolicy', () => {

		let PolicyRewire;
		const setVersionStub = sinon.stub();
		const setRuleStub = sinon.stub();
		const setIdentitiesStub = sinon.stub();
		const toBufferStub = sinon.stub().returns({test: 'response'});

		const MockSignaturePolicyEnvelope = sinon.stub();
		MockSignaturePolicyEnvelope.prototype.setVersion = setVersionStub;
		MockSignaturePolicyEnvelope.prototype.setRule = setRuleStub;
		MockSignaturePolicyEnvelope.prototype.setIdentities = setIdentitiesStub;
		MockSignaturePolicyEnvelope.prototype.toBuffer = toBufferStub;

		const setRoleStub = sinon.stub();
		const setMspIdentifierStub = sinon.stub();
		const MockRole = sinon.stub();
		MockRole.prototype.setRole = setRoleStub;
		MockRole.prototype.setMspIdentifier = setMspIdentifierStub;

		const MockNOutOfStub = sinon.stub();
		MockNOutOfStub.prototype.setN = sinon.stub();
		MockNOutOfStub.prototype.setRules = sinon.stub();

		const MockSignaturePolicy = sinon.stub();
		MockSignaturePolicy.prototype.getName = sinon.stub().returns('MockSignaturePolicy');
		const setStub = sinon.stub();
		MockSignaturePolicy.prototype.set = setStub;
		MockSignaturePolicy.NOutOf = MockNOutOfStub;

		const MockPolicyProto = sinon.stub();
		MockPolicyProto.SignaturePolicyEnvelope = MockSignaturePolicyEnvelope;
		MockPolicyProto.SignaturePolicy = MockSignaturePolicy;
		MockPolicyProto.Role = MockRole;

		const policy = {
			identities: [{
				role: {
					name: 'member',
					mspId: 'Org1MSP'
				}
			}
			],
			policy: {
				'signed-by': 0
			}
		};

		beforeEach(() => {
			PolicyRewire = rewire('../lib/Policy');
			PolicyRewire.__set__('_policiesProto', MockPolicyProto);
		});

		afterEach(() => {
			setVersionStub.resetHistory();
			setRuleStub.resetHistory();
			setIdentitiesStub.resetHistory();
			toBufferStub.resetHistory();
		});

		it('should throw if no policy provided and no valid msps', () => {
			(() => {
				PolicyRewire.buildPolicy([], undefined);
			}).should.throw(/Verifying MSPs not found in the channel object/);
		});

		it('should create and set a one of any policy if no policy provided', () => {
			PolicyRewire.buildPolicy(['geoff'], undefined);

			// Set SignaturePolicy
			sinon.assert.calledTwice(setStub);
			const firstCall = setStub.getCall(0).args;
			const secondCall = setStub.getCall(1).args;
			firstCall[0].should.be.equal('signed_by');
			firstCall[1].should.be.equal(0);

			secondCall[0].should.be.equal('n_out_of');

			// Set version
			sinon.assert.calledOnce(setVersionStub);
			sinon.assert.calledWith(setVersionStub, 0);

			// Set rule with that created
			sinon.assert.calledOnce(setRuleStub);
			let args = setRuleStub.getCall(0).args;
			args[0].getName().should.be.equal('MockSignaturePolicy');

			// Set identities Array
			sinon.assert.calledOnce(setIdentitiesStub);
			args = setIdentitiesStub.getCall(0).args;
			args[0][0].principal_classification.should.be.equal(0);

			// Sent to buffer
			sinon.assert.calledOnce(toBufferStub);
		});

		it('should use the policy if provided', () => {
			PolicyRewire.buildPolicy([], policy);

			// Set version
			sinon.assert.calledOnce(setVersionStub);
			sinon.assert.calledWith(setVersionStub, 0);

			// Set rule
			sinon.assert.calledOnce(setRuleStub);
			let args = setRuleStub.getCall(0).args;
			args[0].getName().should.be.equal('MockSignaturePolicy');

			// Set identities Array
			sinon.assert.calledOnce(setIdentitiesStub);
			args = setIdentitiesStub.getCall(0).args;
			args[0][0].principal_classification.should.be.equal(0);


			// Sent to buffer
			sinon.assert.calledOnce(toBufferStub);
		});

	});

	describe('#buildPrincipal', () => {

		let PolicyRewire;

		const MockMSPPrincipal = sinon.stub();
		MockMSPPrincipal.prototype.setPrincipalClassification = sinon.stub();
		MockMSPPrincipal.prototype.setPrincipal = sinon.stub();
		MockMSPPrincipal.Classification = sinon.stub();
		MockMSPPrincipal.Classification.ROLE = sinon.stub();
		MockMSPPrincipal.Classification.ROLE.returns('asd');

		const MockPeerRole = sinon.stub().returns('PEER');
		const MockMemberRole = sinon.stub().returns('MEMBER');
		const MockAdminRole = sinon.stub().returns('ADMIN');

		const MockMSPRoleType = sinon.stub();
		MockMSPRoleType.PEER = MockPeerRole;
		MockMSPRoleType.MEMBER = MockMemberRole;
		MockMSPRoleType.ADMIN = MockAdminRole;

		const setRoleStub = sinon.stub();
		const setMspIdentifierStub = sinon.stub();
		const toBufferStub = sinon.stub();
		const MockMSPRole = sinon.stub();
		MockMSPRole.prototype.setRole = setRoleStub;
		MockMSPRole.prototype.setMspIdentifier = setMspIdentifierStub;
		MockMSPRole.prototype.toBuffer = toBufferStub;
		MockMSPRole.MSPRoleType = MockMSPRoleType;

		const MockMspProto = sinon.stub();
		MockMspProto.MSPRole = MockMSPRole;
		MockMspProto.MSPPrincipal = MockMSPPrincipal;

		beforeEach(() => {
			PolicyRewire = rewire('../lib/Policy');
			PolicyRewire.__set__('_mspPrProto', MockMspProto);
		});

		afterEach(() => {
			MockMSPRole.resetHistory();
			setRoleStub.resetHistory();
		});

		it('should throw if the identity type is unknown', () => {
			(() => {
				buildPrincipal({'role': 'penguin'});
			}).should.throw(/Invalid role name found/);
		});

		it('should throw if the identity type is unimplemented', () => {
			(() => {
				buildPrincipal({'organization-unit': 'my organization-unit'});
			}).should.throw(/NOT IMPLEMENTED/);
		});

		it('should throw if invalid role name passed', () => {
			(() => {
				buildPrincipal({'role': {name: 'penguin', mspId: 20}});
			}).should.throw(/Invalid role name found/);
		});

		it('should throw if invalid mspid passed', () => {
			(() => {
				buildPrincipal({'role': {name: 'peer', mspId: 20}});
			}).should.throw(/Invalid mspid found/);
		});

		it('should throw if no mspid passed', () => {
			(() => {
				buildPrincipal({'role': {name: 'peer', mspId: null}});
			}).should.throw(/Invalid mspid found/);
		});

		it('should set the role to peer if peer role', () => {

			buildPrincipal = PolicyRewire.__get__('buildPrincipal');
			buildPrincipal({'role': {name: 'peer', mspId: 'my_mspId'}});

			sinon.assert.calledOnce(setRoleStub);
			sinon.assert.calledWith(setRoleStub, MockPeerRole);
		});

		it('should set the role to member if member role', () => {

			buildPrincipal = PolicyRewire.__get__('buildPrincipal');
			buildPrincipal({'role': {name: 'member', mspId: 'my_mspId'}});

			sinon.assert.calledOnce(setRoleStub);
			sinon.assert.calledWith(setRoleStub, MockMemberRole);
		});

		it('should set the role to admin if admin role', () => {

			buildPrincipal = PolicyRewire.__get__('buildPrincipal');
			buildPrincipal({'role': {name: 'admin', mspId: 'my_mspId'}});

			sinon.assert.calledOnce(setRoleStub);
			sinon.assert.calledWith(setRoleStub, MockAdminRole);
		});
	});

	describe('#getIdentityType', () => {
		const RewirePolicy = rewire('../lib/Policy');
		const getIdentityType = RewirePolicy.__get__('getIdentityType');

		it('should throw no identity type', () => {
			(() => {
				getIdentityType({});
			}).should.throw(/Invalid identity type found/);
		});

		it('should throw if an invalid identity type', () => {
			(() => {
				getIdentityType({'invalid': true});
			}).should.throw(/Invalid identity type found: must be one of role, organization-unit or identity, but found invalid/);
		});

		it('should return role type', () => {
			const result = getIdentityType({'role': 'my role'});
			result.should.equal('role');
		});

		it('should return organisation type', () => {
			const result = getIdentityType({'organization-unit': 'my organization-unit'});
			result.should.equal('organization-unit');
		});

		it('should return identity type', () => {
			const result = getIdentityType({'identity': 'my identity'});
			result.should.equal('identity');
		});
	});

	describe('#getPolicyType', () => {
		const RewirePolicy = rewire('../lib/Policy');
		const getPolicy = RewirePolicy.__get__('getPolicyType');

		it('should throw if invalid type found', () => {
			(() => {
				getPolicy({'two-of': true});
			}).should.throw(/Invalid policy type found/);
		});

		it('should throw if invalid type found', () => {
			(() => {
				getPolicy({'geoff': true});
			}).should.throw(/Invalid policy type found/);
		});

		it('should return "signed-by" if that is the policy type', () => {
			const myType = getPolicy({'signed-by': true});
			myType.should.be.equal('signed-by');
		});

		it('should return "n-of" if that is the policy type', () => {
			const myType = getPolicy({'3-of': true});
			myType.should.be.equal('3-of');
		});
	});

	describe('#parsePolicy', () => {
		const RewirePolicy = rewire('../lib/Policy');
		const parsePolicy = RewirePolicy.__get__('parsePolicy');

		it('should return a signiture policy with the type "signedby" set if that policy type', () => {

			const policy = {
				'signed-by': 0
			};

			const result = parsePolicy(policy);

			result.Type.should.equal('signed_by');
			result.signed_by.should.equal(0);
			should.not.exist(result.n_out_of);
		});

		it('should return a signiture policy with the type "n_out_of" set if that policy type', () => {

			const policy = {
				'1-of': [
					{
						'signed-by': 0
					}
				]
			};

			const result = parsePolicy(policy);

			result.Type.should.equal('n_out_of');
			result.signed_by.should.equal(0);
			result.n_out_of.n.should.equal(1);
			result.n_out_of.rules[0].Type.should.equal('signed_by');
			result.n_out_of.rules[0].signed_by.should.equal(0);

		});

	});

	describe('#buildSignaturePolicy', () => {

		it('should return signed by if that policy type', () => {
			const policy = {
				'signed-by': 0
			};

			const result = buildSignaturePolicy(policy);
			result.should.deep.equal({signed_by: 0});
		});

		it('should recursively build if n-of detected', () => {
			const policy = {
				'1-of': [
					{
						'signed-by': 0
					}
				]
			};

			const expected = {
				n_out_of: {
					n: 1,
					rules: [
						{
							signed_by: 0
						}
					]
				}
			};

			const result = buildSignaturePolicy(policy);
			result.should.deep.equal(expected);
		});
	});

	describe('#checkPolicy', () => {

		it('should throw if missing a passed parameter', () => {
			(() => {
				checkPolicy();
			}).should.throw(/Missing Required Param "policy"/);
		});

		it('should throw if passed parameter is null', () => {
			(() => {
				checkPolicy(null);
			}).should.throw(/Missing Required Param "policy"/);
		});

		it('should throw if passed parameter is undefined', () => {
			(() => {
				checkPolicy(undefined);
			}).should.throw(/Missing Required Param "policy"/);
		});

		it('should throw if passed parameter policy.identities is missing', () => {
			(() => {
				checkPolicy({name: 'nothing'});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.identities is null', () => {
			(() => {
				checkPolicy({identities: null});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.identities is undefined', () => {
			(() => {
				checkPolicy({identities: undefined});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.identities is an empty string', () => {
			(() => {
				checkPolicy({identities: ''});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.identities is an empty object', () => {
			(() => {
				checkPolicy({identities: {}});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.identities is not an array', () => {
			(() => {
				checkPolicy({identities: {name: 'something'}});
			}).should.throw(/Invalid policy, the "identities" property must be an array/);
		});

		it('should throw if passed parameter policy.policy is missing', () => {
			(() => {
				checkPolicy({identities: true});
			}).should.throw(/Invalid policy, missing the "identities" property/);
		});

		it('should throw if passed parameter policy.policy is null', () => {
			(() => {
				const identities = [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}];
				checkPolicy({identities: identities, policy: null});
			}).should.throw(/Invalid policy, missing the "policy" property/);
		});

		it('should throw if passed parameter policy.policy is undefined', () => {
			(() => {
				const identities = [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}];
				checkPolicy({identities: identities, policy: undefined});
			}).should.throw(/Invalid policy, missing the "policy" property/);
		});

		it('should throw if passed parameter policy.policy is an empty object', () => {
			(() => {
				const identities = [{
					role: {
						name: 'member',
						mspId: 'Org1MSP'
					}
				}];
				checkPolicy({identities: identities, policy: {}});
			}).should.throw(/Invalid policy, missing the "policy" property/);
		});

		it('should not throw if passed a valid policy', () => {
			(() => {
				const policy = {
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

				checkPolicy(policy);
			}).should.not.throw();
		});

	});

});
