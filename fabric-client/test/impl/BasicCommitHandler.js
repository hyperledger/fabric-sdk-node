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
const BasicCommitHandler = rewire('../../lib/impl/BasicCommitHandler');
const Channel = require('../../lib/Channel');
const Orderer = require('../../lib/Orderer');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('BasicCommitHandler', () => {

	let revert;
	let FakeLogger;
	let debugStub;
	let errorStub;
	let channelStub;
	let handler;

	beforeEach(() => {
		revert = [];
		FakeLogger = {
			debug: () => {},
			error: () => {}
		};
		debugStub = sinon.stub(FakeLogger, 'debug');
		errorStub = sinon.stub(FakeLogger, 'error');
		revert.push(BasicCommitHandler.__set__('logger', FakeLogger));

		channelStub = sinon.createStubInstance(Channel);
		handler = new BasicCommitHandler(channelStub);
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sinon.restore();
	});

	describe('#constructor', () => {
		it('should set `_channel` with a passed parameter', () => {
			const basicCommitHandler = new BasicCommitHandler(channelStub);
			basicCommitHandler._channel.should.equal(channelStub);
		});
	});

	describe('#create', () => {
		it('should create an instance of a basic commit handler', () => {
			const basicCommitHandler = BasicCommitHandler.create(channelStub);
			basicCommitHandler._channel.should.equal(channelStub);
		});
	});

	describe('#initialize', () => {
		it('should log on entry', () => {
			handler.initialize();
			sinon.assert.calledWith(debugStub, 'initialize - start');
		});
	});

	describe('#commit', () => {

		let _commitStub;
		let ordererStub;
		let getConfigSettingStub;

		beforeEach(() => {
			getConfigSettingStub = sinon.stub().withArgs('request-timeout').returns(1000);
			revert.push(BasicCommitHandler.__set__('utils.getConfigSetting', getConfigSettingStub));
			_commitStub = sinon.stub();
			handler._commit = _commitStub;
			ordererStub = sinon.createStubInstance(Orderer);
			channelStub._getOrderer.returns(ordererStub);
		});

		it('should throw an error if not params given', async () => {
			await handler.commit()
				.should.be.rejectedWith(/Missing all required input parameters/);
			sinon.assert.calledWith(errorStub, 'Commit Handler error:Missing all required input parameters');
		});

		it('should throw an error if request not specified', async () => {
			await handler.commit({})
				.should.be.rejectedWith(/Missing "request" input parameter/);
		});

		it('should throw an error if signed_proposal not specified', async () => {
			await handler.commit({request: {}})
				.should.be.rejectedWith(/Missing "signed_envelope" input parameter/);
		});

		it('should log on debug message if getDiscoveryResults throw an error', async () => {
			channelStub.getDiscoveryResults.throws('dummy error');

			await handler.commit({request: {}, signed_envelope: 'envelope'});
			sinon.assert.calledWith(debugStub, '%s - no discovery results %s');
			sinon.assert.calledOnce(channelStub.getDiscoveryResults);
			sinon.assert.calledWith(_commitStub, 'envelope', 1000);
		});

		it('should call _commit', async () => {
			channelStub.getDiscoveryResults.returns('discovery results');

			await handler.commit({request: {}, signed_envelope: 'envelope'});
			sinon.assert.calledOnce(channelStub.getDiscoveryResults);
			sinon.assert.calledWith(_commitStub, 'envelope', 1000);
		});

		it('should throw an error if sendBroadcast fails', async () => {
			ordererStub.sendBroadcast.throws('dummy error');

			await handler.commit({request: {orderer: 'orderer.com'}, signed_envelope: 'envelope', timeout: 2000})
				.should.be.rejectedWith(/Failed to send to the orderer/);
			sinon.assert.calledWith(debugStub, '%s - using single orderer', 'commit');
			sinon.assert.calledWith(channelStub._getOrderer, 'orderer.com', 'endorsingPeer');
			sinon.assert.calledWith(ordererStub.sendBroadcast, 'envelope', 2000);
		});

		it('should return response if a message is broadcasted', async () => {
			ordererStub.sendBroadcast.returns('response');

			const response = await handler.commit({request: {orderer: 'orderer.com'}, signed_envelope: 'envelope', timeout: 2000});
			sinon.assert.calledWith(debugStub, '%s - using single orderer', 'commit');
			sinon.assert.calledWith(channelStub._getOrderer, 'orderer.com', 'endorsingPeer');
			sinon.assert.calledWith(ordererStub.sendBroadcast, 'envelope', 2000);
			response.should.equal('response');
		});

	});

	describe('#_commit', () => {

		let orderer1Stub;
		let orderer2Stub;
		let orderers;

		beforeEach(() => {
			orderer1Stub = sinon.createStubInstance(Orderer);
			orderer1Stub.getName.returns('Orderer1');
			orderer2Stub = sinon.createStubInstance(Orderer);
			orderer2Stub.getName.returns('Orderer2');
			orderers = [orderer1Stub, orderer2Stub];
		});

		it('should throw an error if no orderers assigned', async () => {
			channelStub.getOrderers = sinon.stub().returns(undefined);

			await handler._commit('envelope', 1000)
				.should.be.rejectedWith(/No orderers assigned to the channel/);
		});

		it('should return results if the first orderer returns SUCCESS', async () => {
			channelStub.getOrderers = sinon.stub().returns(orderers);
			orderer1Stub.sendBroadcast.returns({status: 'SUCCESS'});
			orderer2Stub.sendBroadcast.returns({status: 'SUCCESS'});

			const results = await handler._commit('envelope', 1000);
			debugStub.getCall(0).args.should.deep.equal(['%s - found %s orderers assigned to channel', '_commit', 2]);
			debugStub.getCall(1).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer1']);
			sinon.assert.calledWith(orderer1Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(2).args.should.deep.equal(['%s - Successfully sent transaction to the orderer %s', '_commit', 'Orderer1']);
			results.should.deep.equal({status: 'SUCCESS'});
		});

		it('should return results if the second orderer returns SUCCESS', async () => {
			channelStub.getOrderers = sinon.stub().returns(orderers);
			orderer1Stub.sendBroadcast.returns({status: 'ERROR'});
			orderer2Stub.sendBroadcast.returns({status: 'SUCCESS'});

			const results = await handler._commit('envelope', 1000);
			debugStub.getCall(0).args.should.deep.equal(['%s - found %s orderers assigned to channel', '_commit', 2]);
			debugStub.getCall(1).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer1']);
			sinon.assert.calledWith(orderer1Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(2).args.should.deep.equal(['%s - Failed to send transaction successfully to the orderer status:%s', '_commit', 'ERROR']);
			debugStub.getCall(3).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer1']);
			debugStub.getCall(4).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer2']);
			sinon.assert.calledWith(orderer2Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(5).args.should.deep.equal(['%s - Successfully sent transaction to the orderer %s', '_commit', 'Orderer2']);
			results.should.deep.equal({status: 'SUCCESS'});
		});

		it('should throw an error if all orderer returns an error', async () => {
			channelStub.getOrderers = sinon.stub().returns(orderers);
			orderer1Stub.sendBroadcast.returns({status: 'ERROR'});
			orderer2Stub.sendBroadcast.returns({status: 'ERROR'});

			await handler._commit('envelope', 1000)
				.should.be.rejectedWith(/Failed to send transaction successfully to the orderer status:ERROR/);
			debugStub.getCall(0).args.should.deep.equal(['%s - found %s orderers assigned to channel', '_commit', 2]);
			debugStub.getCall(1).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer1']);
			sinon.assert.calledWith(orderer1Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(2).args.should.deep.equal(['%s - Failed to send transaction successfully to the orderer status:%s', '_commit', 'ERROR']);
			debugStub.getCall(3).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer1']);
			debugStub.getCall(4).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer2']);
			sinon.assert.calledWith(orderer2Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(5).args.should.deep.equal(['%s - Failed to send transaction successfully to the orderer status:%s', '_commit', 'ERROR']);
			debugStub.getCall(6).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer2']);
		});

		it('should throw an error if all orderers return nothing', async () => {
			channelStub.getOrderers = sinon.stub().returns(orderers);
			orderer1Stub.sendBroadcast.returns();
			orderer2Stub.sendBroadcast.returns();

			await handler._commit('envelope', 1000)
				.should.be.rejectedWith(/Failed to send transaction to the orderer/);
			debugStub.getCall(0).args.should.deep.equal(['%s - found %s orderers assigned to channel', '_commit', 2]);
			debugStub.getCall(1).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer1']);
			sinon.assert.calledWith(orderer1Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(2).args.should.deep.equal(['%s - Failed to send transaction to the orderer %s', '_commit', 'Orderer1']);
			debugStub.getCall(3).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer1']);
			debugStub.getCall(4).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer2']);
			sinon.assert.calledWith(orderer2Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(5).args.should.deep.equal(['%s - Failed to send transaction to the orderer %s', '_commit', 'Orderer2']);
			debugStub.getCall(6).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer2']);
		});

		it('should throw an error if all orderers throw an exception error', async () => {
			channelStub.getOrderers = sinon.stub().returns(orderers);
			orderer1Stub.sendBroadcast.throws(new Error('dummy error'));
			orderer2Stub.sendBroadcast.throws(new Error('dummy error'));

			await handler._commit('envelope', 1000)
				.should.be.rejectedWith(/dummy error/);
			debugStub.getCall(0).args.should.deep.equal(['%s - found %s orderers assigned to channel', '_commit', 2]);
			debugStub.getCall(1).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer1']);
			sinon.assert.calledWith(orderer1Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(2).args.should.deep.equal(['%s - Caught: %s', '_commit', 'Error: dummy error']);
			debugStub.getCall(3).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer1']);
			debugStub.getCall(4).args.should.deep.equal(['%s - starting orderer %s', '_commit', 'Orderer2']);
			sinon.assert.calledWith(orderer2Stub.sendBroadcast, 'envelope', 1000);
			debugStub.getCall(5).args.should.deep.equal(['%s - Caught: %s', '_commit', 'Error: dummy error']);
			debugStub.getCall(6).args.should.deep.equal(['%s - finished orderer %s ', '_commit', 'Orderer2']);
		});
	});

});