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
/* eslint-disable no-throw-literal */
'use strict';

const rewire = require('rewire');
const Orderer = require('../lib/Orderer');
const OrdererRewire = rewire('../lib/Orderer');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const Writable = require('stream').Writable;
const util = require('util');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');

describe('Orderer', () => {

	describe('#constructor', () => {

		it('should not permit creation with a non-valid url', () => {
			(() => {
				new Orderer('xxx');
			}).should.throw(/Invalid protocol/);
		});

		it('should not permit creation without an url', () => {
			(() => {
				new Orderer();
			}).should.throw(/Parameter "url" must be a string, not undefined/);
		});

	});

	describe('#close', () => {

		it('should call close on the orderer client', () => {
			const obj = new Orderer('grpc://host:2700');

			const mockClose = sinon.stub();
			const mockOC = sinon.stub();
			mockOC.close = mockClose;

			// replace with the mock item
			obj._ordererClient = mockOC;

			// call
			obj.close();

			// assert
			sinon.assert.called(mockClose);
		});

		it('should not call close on the orderer client', () => {
			const obj = new Orderer('grpc://host:2700');
			obj._ordererClient = null;

			const mockClose = sinon.stub();
			const mockOC = sinon.stub();
			mockOC.close = mockClose;
			obj.close();

			// assert
			sinon.assert.notCalled(mockClose);
		});
	});

	describe('#sendBroadcast', () => {

		let revert;

		beforeEach(() => {
			revert = [];
		});

		afterEach(() => {
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should reject a Promise if envelope does not exist', async () => {
			const obj = new Orderer('grpc://host:2700');
			await obj.sendBroadcast().should.be.rejectedWith(/Missing data - Nothing to broadcast/);
		});

		it('should log and reject on error during `waitForReady`', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().rejects(new Error('waitForReady fail'))));
			const obj = new OrdererRewire('grpc://host:2700');
			await obj.sendBroadcast('broadcast').should.be.rejectedWith(/waitForReady fail/);
			sinon.assert.calledWith(errorStub, 'Orderer %s has an error %s ');
		});

		it('should log and reject a Promise on timeout', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			const response = new EventEmitter({objectMode: true});
			response.write = sinon.stub();
			response.end = sinon.stub();

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({info: 'inform'}, 1).should.be.rejectedWith(/REQUEST_TIMEOUT/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast - timed out after:%s');
		});

		it('should log and reject if there is an invalid response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			const response = new PassThrough({objectMode: true});
			response.cancel = sinon.stub();
			response.write({invalid: 'response'});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast('hello').should.be.rejectedWith(/SYSTEM_ERROR/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast ERROR - reject with invalid response from the orderer');
		});
		it('should log and reject if there is an error in the response with no error code', async () => {

			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				// Force the failure
				callback(new Error('FORCED_ERROR'));
			};

			const response = new Writer({objectMode: true});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/FORCED_ERROR/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast - on error: %j');
		});

		it('should log and reject if there is an error in the response with a non-matched error code', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				// Force the failure
				const myErr = new Error('FORCED_ERROR');
				myErr.code = 101;
				callback(myErr);
			};

			const response = new Writer({objectMode: true});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/FORCED_ERROR/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast - on error: %j');
		});

		it('should log and reject if there is an error in the response with a matched error code', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = new Error('ForcedError');
				myErr.code = 14;
				callback(myErr);
			};

			const response = new Writer({objectMode: true});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/SERVICE_UNAVAILABLE/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast - on error: %j');
		});

		it('should log and reject if there is an object error in the response with a matched error code', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = {};
				myErr.code = 14;
				callback(myErr);
			};

			const response = new Writer({objectMode: true});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejectedWith(/SERVICE_UNAVAILABLE/);
			sinon.assert.calledWith(errorStub, 'sendBroadcast - on error: %j');
		});

		it('should log and reject if there is an object error in the response without a matched error code', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				const myErr = {};
				myErr.code = 500;
				callback(myErr);
			};

			const response = new Writer({objectMode: true});

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.rejected;
			sinon.assert.calledWith(errorStub, 'sendBroadcast - on error: %j');
		});

		it('should resolve if there is a valid response', async () => {

			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const broadcastStub = sinon.stub();

			const response = new PassThrough({objectMode: true});
			response.setEncoding = function () { };
			response.cancel = sinon.stub();

			broadcastStub.broadcast = sinon.stub().returns(response);
			obj._ordererClient = broadcastStub;

			await obj.sendBroadcast({status: 'SUCCESS', info: 'my info'}).should.be.eventually.deep.equal({status: 'SUCCESS', info: 'my info'});
		});

	});

	describe('#sendDeliver', () => {

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

		it('should reject a Promise if envelope does not exist', async () => {
			const obj = new Orderer('grpc://host:2700');
			await obj.sendDeliver().should.be.rejectedWith(/Missing data - Nothing to deliver/);
		});

		it('should reject on error during `waitForReady`', async () => {
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().rejects(new Error('waitForReady fail'))));
			const obj = new OrdererRewire('grpc://host:2700');
			await obj.sendDeliver('deliver').should.be.rejectedWith(/waitForReady fail/);
		});

		it('should log and reject on error during `deliver`', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');
			obj._request_timeout = 0;

			const deliverStub = sinon.stub();
			deliverStub.deliver = sinon.stub().throws(new Error('FORCED_ERROR'));
			obj._ordererClient = deliverStub;

			await obj.sendDeliver('deliver').should.be.rejectedWith(/FORCED_ERROR/);
			sinon.assert.called(errorStub);
		});

		it('should reject a Promise on timeout', async () => {
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');
			obj._request_timeout = 0;

			const deliverStub = sinon.stub();

			const response = new EventEmitter({objectMode: true});
			response.write = sinon.stub();
			response.end = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver('deliver').should.be.rejectedWith(/REQUEST_TIMEOUT/);
		});

		it('should log and reject a Promise on if no `Type` within response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			const response = new PassThrough({objectMode: true});
			response.write({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}});
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({status: 'SUCCESS'}).should.be.rejectedWith(/SYSTEM_ERROR/);
			sinon.assert.calledWith(errorStub, 'sendDeliver ERROR - reject with invalid response from the orderer');
		});

		it('should log and reject a Promise on if no `SUCCESS` within status response', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			const response = new PassThrough({objectMode: true});
			response.write({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}});
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({status: 'FAIL', Type: 'status'}).should.be.rejectedWith(/Invalid results returned ::FAIL/);
			sinon.assert.calledWith(errorStub, 'sendDeliver - rejecting - status:%s');
		});

		it('should reject if there is an error in the response with a non-matched error code', async () => {

			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Create a Writer to throw a specific error
			util.inherits(Writer, Writable);

			function Writer(opt) {
				Writable.call(this, opt);
			}

			Writer.prototype._write = function(data, encoding, callback) {
				// Force the failure
				const myErr = new Error('FORCED_ERROR');
				myErr.code = 101;
				callback(myErr);
			};

			const response = new Writer({objectMode: true});

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({status: 'SUCCESS', Type: 'status'}).should.be.rejectedWith(/FORCED_ERROR/);
		});

		it('should reject if there is an error in the response with a no error code and disconnect', async () => {
			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				obj._sendDeliverConnect = true;
				response.emit('error', {message : 'FORCED_ERROR'});
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}}).should.be.rejectedWith(/FORCED_ERROR/);

		});

		it('should reject if there is an error in the response with a non-matched error code and disconnect', async () => {
			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				obj._sendDeliverConnect = true;
				response.emit('error', {code: 141, message : 'FORCED_ERROR'});
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}}).should.be.rejectedWith(/FORCED_ERROR/);

		});

		it('should log and reject if there is an error in the response with a matched error code and disconnect', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				obj._sendDeliverConnect = true;
				response.emit('error', {code: 14});
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}}).should.be.rejectedWith(/SERVICE_UNAVAILABLE/);
			sinon.assert.calledWith(errorStub, 'sendDeliver - on error code 14: %j');
		});

		it('should log and reject if there is an error in the response with a matched error code and disconnect if returned error is an Error object', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				obj._sendDeliverConnect = true;
				const error = new Error();
				error.code = 14;
				response.emit('error', error);
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}}).should.be.rejectedWith(/SERVICE_UNAVAILABLE/);
			sinon.assert.calledWith(errorStub, 'sendDeliver - on error code 14: %j');
		});

		it('should log and reject if string error is thrown', async() => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};
			const errorStub = sinon.stub(FakeLogger, 'error');
			revert.push(OrdererRewire.__set__('logger', FakeLogger));
			revert.push(OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves()));
			const obj = new OrdererRewire('grpc://host:2700');
			obj._ordererClient.deliver = () => {
				throw 'Fake Error';
			};

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}}).should.be.rejectedWith();
			sinon.assert.called(errorStub);
		});

		it('should log on status updates', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			OrdererRewire.__set__('logger', FakeLogger);

			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				obj._sendDeliverConnect = true;
				response.emit('status', 'status update');
				response.emit('data', {Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}});
				response.emit('data', {status: 'SUCCESS', Type: 'status'});
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			await obj.sendDeliver({Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}});

			debugStub.getCall(2).args.should.deep.equal(['sendDeliver - on status:%j', 'status update']);

		});

		it('should deal with `block` and `status` response types ', async () => {
			OrdererRewire.__set__('Orderer.prototype.waitForReady', sinon.stub().resolves());
			const obj = new OrdererRewire('grpc://host:2700');

			const deliverStub = sinon.stub();

			// Passthrough
			const response = new PassThrough({objectMode: true});

			const bob = function() {
				response.emit('data', {Type: 'block', block: {data: {data: 'data'}, header: {number: 1, previous_hash: 'prev', data_hash: 'hash'}, metadata: {metadata: 'data'}}});
				response.emit('data', {status: 'SUCCESS', Type: 'status'});
			};

			const sResponse = sandbox.stub(PassThrough.prototype, 'write');
			sResponse.callThrough();
			sResponse.onCall(0).callsFake(bob);
			response.write = sResponse;
			response.cancel = sinon.stub();

			deliverStub.deliver = sinon.stub().returns(response);
			obj._ordererClient = deliverStub;

			const result = await obj.sendDeliver('all the fake');

			should.exist(result.data.data[0]);
			result.data.data[0].toBase64().should.equal('data');

			should.exist(result.header);
			result.header.number.toString().should.equal('1');
			result.header.data_hash.toBase64().should.equal('hash');
			result.header.previous_hash.toBase64().should.equal('prev');

			should.exist(result.metadata);
			result.metadata.metadata[0].toBase64().should.equal('data');
		});
	});

	describe('#toString', () => {

		it('should return a printable representation of the object', () => {
			const obj = new Orderer('grpc://host:2700');
			obj.toString().should.equal('Orderer:{url:grpc://host:2700}');
		});
	});

});
