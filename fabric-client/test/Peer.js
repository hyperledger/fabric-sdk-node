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
/* eslint-disable no-useless-call */

const rewire = require('rewire');
const PeerRewire = rewire('../lib/Peer');
const Peer = require('../lib/Peer');

const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Peer', () => {

	describe('#constructor', () => {

		it('should not permit creation with a non-valid url', () => {
			(() => {
				new Peer('xxx');
			}).should.throw(/Invalid protocol/);
		});

		it('should not permit creation without an url', () => {
			(() => {
				new Peer();
			}).should.throw(/Parameter "url" must be a string, not undefined/);
		});
	});

	describe('#close', () => {
		it('should call close on the endorser client if it exists', () => {
			const obj = new Peer('grpc://host:2700');

			const mockClose = sinon.stub();
			const mockPC = sinon.stub();
			mockPC.close = mockClose;

			// replace with the mock item
			obj._endorserClient = mockPC;

			// call
			obj.close();

			// assert
			sinon.assert.called(mockClose);
		});

		it('should call close on the discovery client if it exists', () => {
			const obj = new Peer('grpc://host:2700');

			const mockClose = sinon.stub();
			const mockPC = sinon.stub();
			mockPC.close = mockClose;

			// replace with the mock item
			obj._discoveryClient = mockPC;

			// call
			obj.close();

			// assert
			sinon.assert.called(mockClose);
		});
	});

	describe('#sendProposal', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should log function entry', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			const obj = new PeerRewire('grpc://host:2700');

			// this will throw, but we can still check method entry
			obj.sendProposal()
				.then(() => {
					sinon.assert.fail();
				})
				.catch(() => {
					sinon.assert.called(debugStub);
					debugStub.getCall(1).args.should.deep.equal(['%s - Start ----%s %s', 'sendProposal', 'host:2700', 'grpc://host:2700']);
				});
		});

		it('should reject if no proposal', async () => {
			const obj = new Peer('grpc://host:2700');
			await obj.sendProposal().should.be.rejectedWith(/Missing proposal to send to peer/);
		});

		it('should reject on timeout', async () => {
			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}

			const endorserClient = sinon.stub();
			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver', 0).should.be.rejectedWith(/REQUEST_TIMEOUT/);
		});

		it('should log and reject Error object on proposal response error string', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			function Fake(params, callback) {
				callback.call(null, 'i_am_an_error');
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver').should.be.rejectedWith(/i_am_an_error/);
			sinon.assert.calledWith(debugStub, '%s - Received proposal response from: %s status: %s');
		});

		it('should reject Error object on proposal response error object', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			function Fake(params, callback) {
				callback.call(null, new Error('FORCED_ERROR'));
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver').should.be.rejectedWith(/FORCED_ERROR/);
			sinon.assert.calledWith(debugStub, '%s - Received proposal response from: %s status: %s');
		});

		it('should log and reject on undefined proposal response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			function Fake(params, callback) {
				callback.call(null, null, null);
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver').should.be.rejectedWith(/GRPC client got a null or undefined response from the peer/);
			sinon.assert.calledWith(errorStub, '%s - rejecting with:%s');
		});

		it('should log and reject on invalid proposal response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');
			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			function Fake(params, callback) {
				callback.call(null, null, {data: 'invalid'});
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver').should.be.rejectedWith(/GRPC client failed to get a proper response from the peer/);
			sinon.assert.calledWith(debugStub, '%s - Received proposal response from peer "%s": status - %s');
			sinon.assert.calledWith(errorStub, '%s - rejecting with:%s');
		});

		it('should log and reject on proposal response error status greater than or equal to 400', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			function Fake(params, callback) {
				callback.call(null, null, {response: {status: 400, message: 'fail_string'}});
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			await obj.sendProposal('deliver').should.be.rejectedWith(/fail_string/);
			sinon.assert.calledWith(debugStub, '%s - Received proposal response from peer "%s": status - %s');
		});

		it('should resolve on valid proposal response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const endorserClient = sinon.stub();

			const myResponse = {response: {status: 399, message: 'passed_values'}};
			function Fake(params, callback) {
				callback.call(null, null, myResponse);
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			const response = await obj.sendProposal('deliver');
			response.should.deep.equal(myResponse);
			response.peer.name.should.equal('host:2700');
			response.peer.url.should.equal('grpc://host:2700');
			sinon.assert.calledWith(debugStub, '%s - Received proposal response from peer "%s": status - %s');
		});

		it('should mark errors from chaincode as proposal response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			PeerRewire.__set__('logger', FakeLogger);
			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());
			const endorserClient = sinon.stub();

			const myResponse = {response: {status: 500, message: 'some error'}};
			function Fake(params, callback) {
				callback.call(null, null, myResponse);
			}

			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			try {
				await obj.sendProposal('deliver');
				should.fail();
			} catch (err) {
				err.isProposalResponse.should.be.true;
				err.status.should.equal(500);
				err.message.should.equal('some error');
				err.peer.name.should.equal('host:2700');
				err.peer.url.should.equal('grpc://host:2700');
			}
		});

		it('should not mark errors as proposal response if not a proposal response', async () => {
			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}

			const endorserClient = sinon.stub();
			endorserClient.processProposal = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._endorserClient = endorserClient;

			try {
				await obj.sendProposal('deliver', 0);
				should.fail();
			} catch (error) {
				should.equal(error.isProposalResponse, undefined);
			}
		});



	});

	describe('#sendDiscovery', () => {
		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should log on entry', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			const obj = new PeerRewire('grpc://host:2700');

			// this will throw, but we can still check method entry
			obj.sendDiscovery()
				.then(() => {
					sinon.assert.fail();
				})
				.catch(() => {
					sinon.assert.called(debugStub);
					debugStub.getCall(1).args.should.deep.equal(['%s - Start', 'sendDiscovery']);
				});
		});

		it('should reject if no request to send', async () => {
			const obj = new Peer('grpc://host:2700');
			await obj.sendDiscovery().should.be.rejectedWith(/Missing request to send to peer discovery service/);
		});

		it('should log and reject on timeout', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}

			const discoveryClient = sinon.stub();
			discoveryClient.discover = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._discoveryClient = discoveryClient;

			await obj.sendDiscovery('deliver', 0).should.be.rejectedWith(/REQUEST_TIMEOUT/);
			sinon.assert.calledWith(errorStub, '%s - timed out after:%s');
		});

		it('should log and reject Error object on discover Response error string', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				callback.call(null, 'i_am_an_error');
			}

			const discoveryClient = sinon.stub();
			discoveryClient.discover = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._discoveryClient = discoveryClient;

			await obj.sendDiscovery('deliver').should.be.rejectedWith(/i_am_an_error/);
			sinon.assert.calledWith(debugStub, '%s - Received discovery response from: %s status: %s');
		});

		it('should log and reject Error object on discover Response error object', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				callback.call(null, new Error('FORCED_ERROR'));
			}

			const discoveryClient = sinon.stub();
			discoveryClient.discover = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._discoveryClient = discoveryClient;

			await obj.sendDiscovery('deliver').should.be.rejectedWith(/FORCED_ERROR/);
			sinon.assert.calledWith(debugStub, '%s - Received discovery response from: %s status: %s');
		});

		it('should log and reject Error object on null response from discovery', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');

			PeerRewire.__set__('logger', FakeLogger);

			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			function Fake(params, callback) {
				callback.call(null, null, null);
			}

			const discoveryClient = sinon.stub();
			discoveryClient.discover = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._discoveryClient = discoveryClient;

			await obj.sendDiscovery('deliver').should.be.rejectedWith(/GRPC client failed to get a proper response from the peer/);
			sinon.assert.calledWith(errorStub, '%s - rejecting with:%s');
		});

		it('should log and resolve on good response from discover', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PeerRewire.__set__('logger', FakeLogger);
			PeerRewire.__set__('Peer.prototype.waitForReady', sinon.stub().resolves());

			const myResponse = {me: 'valid'};
			function Fake(params, callback) {
				callback.call(null, null, myResponse);
			}

			const discoveryClient = sinon.stub();
			discoveryClient.discover = sinon.stub().callsFake(Fake);

			const obj = new PeerRewire('grpc://host:2700');
			obj._discoveryClient = discoveryClient;

			const response = await obj.sendDiscovery('deliver');
			response.should.deep.equal(myResponse);
			response.peer.name.should.equal('host:2700');
			response.peer.url.should.equal('grpc://host:2700');

			sinon.assert.calledWith(debugStub, '%s - Received discovery response from peer "%s"');
		});

	});

	describe('#toString', () => {

		it('should return a string representation of the object', () => {
			const obj = new Peer('grpc://host:2700');
			obj.toString().should.equal('Peer:{url:grpc://host:2700}');
		});
	});
});
