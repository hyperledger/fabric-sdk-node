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
const SideDB = require('../lib/SideDB');

require('chai').should();
const sinon = require('sinon');

describe('SideDB', () => {

	describe('#CollectionConfig.buildCollectionConfigPackage', () => {

		const sandbox = sinon.createSandbox();
		const SideDBRewire = rewire('../lib/SideDB');
		let revert;

		beforeEach(() => {
			revert = [];
		});

		afterEach(() => {
			sandbox.restore();
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should log error and throw if passed null', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			revert.push(SideDBRewire.__set__('logger', FakeLogger));

			(() => {
				SideDBRewire.buildCollectionConfigPackage();
			}).should.throw(/Expect collections config of type Array/);

			sinon.assert.calledWith(errorStub, 'Expect collections config of type Array, found %s');
		});

		it('should log and should throw if passed undefined', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			revert.push(SideDBRewire.__set__('logger', FakeLogger));

			(() => {
				SideDBRewire.buildCollectionConfigPackage(undefined);
			}).should.throw(/Expect collections config of type Array/);

			sinon.assert.calledWith(errorStub, 'Expect collections config of type Array, found %s');
		});

		it('should log and should throw if passed non-string or array object', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			revert.push(SideDBRewire.__set__('logger', FakeLogger));

			(() => {
				SideDBRewire.buildCollectionConfigPackage({});
			}).should.throw(/Expect collections config of type Array/);

			sinon.assert.calledWith(errorStub, 'Expect collections config of type Array, found %s');
		});

		it('should log and build a collectionConfigPackage from each config item if passed a string', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');
			const fileSyncStub = sandbox.stub().returns('[{"name": "call_one"}, {"name": "call_two"}]');
			const fsStub = sandbox.stub();
			fsStub.readFileSync = fileSyncStub;
			const buildStub = sandbox.stub().onFirstCall().returns({call: 'first_Call'});
			buildStub.onSecondCall().returns({call: 'second_Call'});

			const ccp = sandbox.stub();
			const proto = sandbox.stub();
			proto.CollectionConfigPackage = ccp;

			revert.push(SideDBRewire.__set__('logger', FakeLogger));
			revert.push(SideDBRewire.__set__('fs', fsStub));
			revert.push(SideDBRewire.__set__('_collectionProto', proto));
			SideDBRewire.buildCollectionConfig = buildStub;

			SideDBRewire.buildCollectionConfigPackage('myFileSource');

			// Check logging
			sinon.assert.calledWith(debugStub, 'Read CollectionsConfig From %s');

			// Check calling of readFile with correct
			sinon.assert.calledWith(fileSyncStub, 'myFileSource');

			// Check we are creating a ccp
			sinon.assert.calledWithNew(ccp);

			// Check creation is being called with expected items
			sinon.assert.calledWith(ccp, [{call: 'first_Call'}, {call: 'second_Call'}]);
		});

		it('should build a collectionConfigPackage from each config item if passed an Array', () => {

			const buildStub = sandbox.stub().onFirstCall().returns({call: 'first_Call'});
			buildStub.onSecondCall().returns({call: 'second_Call'});

			const ccp = sandbox.stub();
			const proto = sandbox.stub();
			proto.CollectionConfigPackage = ccp;

			revert.push(SideDBRewire.__set__('_collectionProto', proto));
			SideDBRewire.buildCollectionConfig = buildStub;

			SideDBRewire.buildCollectionConfigPackage([{name: 'call_one'}, {name: 'call_two'}]);

			// Check we are creating a ccp
			sinon.assert.calledWithNew(ccp);

			// Check creation is being called with expected items
			sinon.assert.calledWith(ccp, [{call: 'first_Call'}, {call: 'second_Call'}]);
		});
	});

	describe('#CollectionConfig.checkCollectionConfig', () => {

		const SideDBRewire = rewire('../lib/SideDB');
		const sandbox = sinon.createSandbox();
		let revert;

		beforeEach(() => {
			revert = [];
		});

		afterEach(() => {
			sandbox.restore();
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should throw if passed no parameters', () => {
			(() => {
				SideDB.checkCollectionConfig();
			}).should.throw(/Cannot destructure property/);
		});

		it('should throw if passed an empty object', () => {
			(() => {
				SideDB.checkCollectionConfig({});
			}).should.throw(/CollectionConfig Requires Param "name" of type string/);
		});

		it('should throw if passed collectionConfig.name does not exist', () => {
			(() => {
				SideDB.checkCollectionConfig({value: 'something'});
			}).should.throw(/CollectionConfig Requires Param "name" of type string/);
		});

		it('should throw if passed collectionConfig.name is not a string', () => {
			(() => {
				SideDB.checkCollectionConfig({name: true});
			}).should.throw(/CollectionConfig Requires Param "name" of type string/);
		});

		it('should throw if passed collectionConfig.policy does not exist', () => {
			(() => {
				SideDB.checkCollectionConfig({name: 'test'});
			}).should.throw(/Missing Required Param "policy"/);
		});

		it('should call `checkPolicy` on passed collectionConfig.policy', () => {
			const checkPolicyStub = sandbox.stub();
			const policy = sandbox.stub();
			policy.checkPolicy = checkPolicyStub;

			revert.push(SideDBRewire.__set__('Policy', policy));

			SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount:0, requiredPeerCount:0});

			// Check we are calling
			sinon.assert.called(checkPolicyStub);
		});

		it('should throw if passed collectionConfig.maxPeerCount is not provided', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy});
			}).should.throw(/CollectionConfig Requires Param "maxPeerCount" of type number/);
		});

		it('should throw if passed collectionConfig.maxPeerCount is not an integer', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				SideDBRewire.__set__('Policy', policy);
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 'elephant'});
			}).should.throw(/CollectionConfig Requires Param "maxPeerCount" of type number/);
		});

		it('should throw if passed collectionConfig.requiredPeerCount is not provided', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1});
			}).should.throw(/CollectionConfig Requires Param "requiredPeerCount" of type number/);
		});

		it('should throw if passed collectionConfig.requiredPeerCount is not an integer', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 'elephant'});
			}).should.throw(/CollectionConfig Requires Param "requiredPeerCount" of type number/);
		});

		it('should throw if passed collectionConfig.maxPeerCount<collectionConfig.requiredPeerCount', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 8});
			}).should.throw(/CollectionConfig Requires Param "maxPeerCount" bigger than "requiredPeerCount/);
		});

		it('should default `blockToLive` to be zero if not passed as a config item', () => {
			const checkPolicyStub = sandbox.stub();
			const policy = sandbox.stub();
			policy.checkPolicy = checkPolicyStub;

			revert.push(SideDBRewire.__set__('Policy', policy));

			const obj = SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 1});
			obj.blockToLive.should.equal(0);
		});

		it('should throw if passed collectionConfig.blockToLive is negative', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 1, blockToLive: -1});
			}).should.throw(/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/);
		});

		it('should throw if passed collectionConfig.blockToLive is not an integer string', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 1, blockToLive: 'elephant'});
			}).should.throw(/CollectionConfig Requires Param "blockToLive" of type unsigned int64/);
		});

		it('should throw if passed collectionConfig.blockToLive is not a valid unsigned int64 string', () => {
			(() => {
				const checkPolicyStub = sandbox.stub();
				const policy = sandbox.stub();
				policy.checkPolicy = checkPolicyStub;

				revert.push(SideDBRewire.__set__('Policy', policy));
				SideDBRewire.checkCollectionConfig({name: 'test', policy: policy, maxPeerCount: 1, requiredPeerCount: 1, blockToLive: '28446744073709551615'});
			}).should.throw(/CollectionConfig Requires Param "blockToLive" to be a valid unsigned int64/);
		});

		it('should return if passed a correct collectionConfig', () => {
			const checkPolicyStub = sandbox.stub();
			const Policy = sandbox.stub();
			Policy.checkPolicy = checkPolicyStub;

			revert.push(SideDBRewire.__set__('Policy', Policy));

			const obj = SideDBRewire.checkCollectionConfig({name: 'test', policy: {name: 'my_policy'}, maxPeerCount: 1, requiredPeerCount: 1, blockToLive: '18446744073709551615'});
			obj.name.should.equal('test');
			obj.policy.should.deep.equal({name: 'my_policy'});
			obj.maxPeerCount.should.equal(1);
			obj.requiredPeerCount.should.equal(1);
			obj.blockToLive.should.equal('18446744073709551615');
		});

	});

	describe('#CollectionConfig.buildCollectionConfig', () => {
		const SideDBRewire = rewire('../lib/SideDB');
		const sandbox = sinon.createSandbox();
		let revert;

		beforeEach(() => {
			revert = [];
		});

		afterEach(() => {
			sandbox.restore();
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should log and throw if passed no parameters', () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			(() => {
				revert.push(SideDBRewire.__set__('logger', FakeLogger));
				SideDBRewire.buildCollectionConfig();
			}).should.throw(/Cannot destructure property/);

			sinon.assert.called(errorStub);
		});

		it('should call `checkCollectionConfig` with passed parameters', () => {
			const policy = sandbox.stub();
			policy.buildPrincipal = sandbox.stub();
			policy.buildSignaturePolicy = sandbox.stub();

			revert.push(SideDBRewire.__set__('Policy', policy));

			const params = {name: 'test', policy: {identities: []}};
			const checkCollectionConfigStub = sandbox.stub().returns(params);
			SideDBRewire.checkCollectionConfig = checkCollectionConfigStub;

			SideDBRewire.buildCollectionConfig(params);

			sinon.assert.calledWith(checkCollectionConfigStub, params);
		});

		it('should build a principal for each passed identity', () => {
			const policy = sandbox.stub();
			const buildPrincipalStub = sandbox.stub();
			policy.buildPrincipal = buildPrincipalStub;
			policy.buildSignaturePolicy = sandbox.stub();

			revert.push(SideDBRewire.__set__('Policy', policy));

			const params = {name: 'test', policy: {identities: ['ID1', 'ID2']}};
			const checkCollectionConfigStub = sandbox.stub().returns(params);
			SideDBRewire.checkCollectionConfig = checkCollectionConfigStub;

			SideDBRewire.buildCollectionConfig(params);

			sinon.assert.calledWith(buildPrincipalStub, 'ID1');
			sinon.assert.calledWith(buildPrincipalStub, 'ID2');
		});

		it('should build and return a signaturePolicyEnvelope', () => {
			const policy = sandbox.stub();
			const buildPrincipalStub = sandbox.stub().returns('PRINCIPAL');
			policy.buildPrincipal = buildPrincipalStub;
			policy.buildSignaturePolicy = sandbox.stub();

			revert.push(SideDBRewire.__set__('Policy', policy));

			const params = {name: 'test', policy: {identities: ['ID1', 'ID2']}};
			const checkCollectionConfigStub = sandbox.stub().returns(params);
			SideDBRewire.checkCollectionConfig = checkCollectionConfigStub;

			const obj = SideDBRewire.buildCollectionConfig(params);
			obj.static_collection_config.name.should.equal('test');
			obj.static_collection_config.member_orgs_policy.signature_policy.identities.should.be.an('array').of.length(2);
			obj.static_collection_config.member_orgs_policy.signature_policy.identities.should.include('PRINCIPAL');
		});
	});

});