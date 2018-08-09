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
const TransactionID = require('../lib/TransactionID');
const TransactionIDRewire = rewire('../lib/TransactionID');

const Identity = require('../lib/msp/identity').Identity;
const User = require('../lib/User');
const Utils = require('../lib/utils');

require('chai').should();
const sinon = require('sinon');

describe('TransactionID', () => {

	let revert;
	let bufferSpy;
	let utilsMock;
	const nonceBuffer = Buffer.from('myNonce');

	beforeEach(() => {
		bufferSpy = sinon.spy(Buffer, 'concat');
		utilsMock = sinon.stub(Utils, 'getNonce').returns(nonceBuffer);
		revert = [];
	});

	afterEach(() => {
		bufferSpy.restore();
		utilsMock.restore();
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
	});

	describe('#constructor', () => {

		it('should throw if missing Identity parameter', async () => {
			(() => {
				new TransactionID();
			}).should.throw(/Missing userContext or signing identity parameter/);
		});

		it('should set signer to be SigningIdentity if passed Identity parameter is of class User', () => {

			const signingIdentity = sinon.createStubInstance(Identity);
			const bufferResponse = Buffer.from('serializeMyID');
			signingIdentity.serialize = sinon.stub().returns(bufferResponse);

			const signer = new User('bob');
			signer._signingIdentity = signingIdentity;

			new TransactionID(signer);

			sinon.assert.calledOnce(bufferSpy);
			const args = bufferSpy.getCall(0).args;
			args[0][1].should.equal(bufferResponse);

		});

		it('should set signer to be passed Identity parameter is not of class User', () => {
			const signer = sinon.createStubInstance(User);

			signer.getSigningIdentity = sinon.stub().returns('MyID');
			const bufferResponse = Buffer.from('serializeMyNewID');
			signer.serialize = sinon.stub().returns(bufferResponse);

			new TransactionID(signer);

			sinon.assert.notCalled(signer.getSigningIdentity);
			sinon.assert.calledOnce(bufferSpy);
			const args = bufferSpy.getCall(0).args;
			args[0][1].should.equal(bufferResponse);

		});

		it('should set nonce from the sdkutils', () => {
			const signer = sinon.createStubInstance(User);
			revert.push(TransactionIDRewire.__set__('utils', utilsMock));

			signer.getSigningIdentity = sinon.stub().returns('MyID');
			const bufferResponse = Buffer.from('serializeMyNewID');
			signer.serialize = sinon.stub().returns(bufferResponse);

			new TransactionID(signer);
			sinon.assert.calledOnce(bufferSpy);
			const args = bufferSpy.getCall(0).args;
			args[0][0].should.equal(nonceBuffer);
		});

		it('should set admin to be true if the passed boolean value is true', () => {
			const signingIdentity = sinon.createStubInstance(Identity);
			const bufferResponse = Buffer.from('serializeMyID');
			signingIdentity.serialize = sinon.stub().returns(bufferResponse);

			const signer = new User('bob');
			signer._signingIdentity = signingIdentity;

			const myTransID = new TransactionID(signer, true);
			myTransID._admin.should.be.equal(true);
		});

		it('should set admin to be false if the passed boolean value is false', () => {
			const signingIdentity = sinon.createStubInstance(Identity);
			const bufferResponse = Buffer.from('serializeMyID');
			signingIdentity.serialize = sinon.stub().returns(bufferResponse);

			const signer = new User('bob');
			signer._signingIdentity = signingIdentity;

			const myTransID = new TransactionID(signer, false);
			myTransID._admin.should.be.equal(false);

		});
	});

	describe('#getTransactionID', () => {

		it('should return transactionId', () => {
			const signer = sinon.createStubInstance(User);
			revert.push(TransactionIDRewire.__set__('utils', utilsMock));

			signer.getSigningIdentity = sinon.stub().returns('MyID');
			const bufferResponse = Buffer.from('serializeMyNewID');
			signer.serialize = sinon.stub().returns(bufferResponse);

			const myTransID = new TransactionID(signer);

			myTransID.getTransactionID().should.be.equal('bb20c43d9dd1e4b5b62bf5be5cc23debf198c86a19c6adcb6c6c912337a35e39');
		});
	});


	describe('#getNonce', () => {

		it('should return _nonce', () => {
			const signer = sinon.createStubInstance(User);

			revert.push(TransactionIDRewire.__set__('utils', utilsMock));

			signer.getSigningIdentity = sinon.stub().returns('MyID');
			const bufferResponse = Buffer.from('serializeMyNewID');
			signer.serialize = sinon.stub().returns(bufferResponse);

			const myTransID = new TransactionID(signer);

			myTransID.getNonce().should.be.equal(nonceBuffer);
		});
	});

	describe('#isAdmin', () => {

		it('should return boolean true if admin', () => {
			const signingIdentity = sinon.createStubInstance(Identity);
			const bufferResponse = Buffer.from('serializeMyID');
			signingIdentity.serialize = sinon.stub().returns(bufferResponse);

			const signer = new User('bob');
			signer._signingIdentity = signingIdentity;

			const myTransID = new TransactionID(signer, true);
			myTransID.isAdmin().should.be.equal(true);
		});

		it('should return boolean false if not admin', () => {
			const signingIdentity = sinon.createStubInstance(Identity);
			const bufferResponse = Buffer.from('serializeMyID');
			signingIdentity.serialize = sinon.stub().returns(bufferResponse);

			const signer = new User('bob');
			signer._signingIdentity = signingIdentity;

			const myTransID = new TransactionID(signer, false);
			myTransID.isAdmin().should.be.equal(false);
		});
	});

});