/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const {CryptoSuite, Key, Signer} = require('..');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);
const sinon = require('sinon');

const digest = Buffer.from('hello world!');
const opts = {
	hashingFunction: sinon.stub()
};

describe('Signer', () => {

	let signer;
	let mockPrivateKey;
	let mockPublicKey;
	let mockCryptoSuite;

	beforeEach(() => {
		mockPrivateKey = sinon.createStubInstance(Key);
		mockPublicKey = sinon.createStubInstance(Key);
		mockPrivateKey.getPublicKey.returns(mockPublicKey);
		mockCryptoSuite = sinon.createStubInstance(CryptoSuite);
		signer = new Signer(mockCryptoSuite, mockPrivateKey);
	});

	describe('#constructor', () => {

		it('should throw if no crypto suite', () => {
			(() => {
				new Signer(null, mockPrivateKey);
			}).should.throw(/Missing required parameter "cryptoSuite"/);
		});

		it('should throw if no MSP ID', () => {
			(() => {
				new Signer(mockCryptoSuite, null);
			}).should.throw(/Missing required parameter "key" for private key/);
		});

	});

	describe('#getPublicKey', () => {

		it('should return the public key', () => {
			signer.getPublicKey().should.equal(mockPublicKey);
		});

	});

	describe('#sign', () => {

		it('should handle a successful sign by the crypto suite', async () => {
			mockCryptoSuite.sign.withArgs(mockPrivateKey, digest, opts).resolves();
			await signer.sign(digest, opts);
			mockCryptoSuite.sign.should.have.been.calledOnceWithExactly(mockPrivateKey, digest, opts);
		});

		it('should handle an unsuccessful sign by the crypto suite', async () => {
			mockCryptoSuite.sign.withArgs(mockPrivateKey, digest, opts).rejects(new Error('such error'));
			await signer.sign(digest, opts).should.be.rejectedWith(/such error/);
		});

	});

});