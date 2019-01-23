/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const {CryptoSuite, HashPrimitives, SigningIdentity, Key, Signer} = require('..');
const fs = require('fs');
const path = require('path');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);
const sinon = require('sinon');

const certificateAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'cert.pem'));
const certificateAsBuffer = Buffer.from(certificateAsPEM);
const certificateAsHex = certificateAsBuffer.toString('hex');
const mspId = 'Org1MSP';
const message = Buffer.from('hello world!');

describe('SigningIdentity', () => {

	let signingIdentity;
	let mockPublicKey;
	let mockCryptoSuite;
	let mockSigner;

	beforeEach(() => {
		mockPublicKey = sinon.createStubInstance(Key);
		mockCryptoSuite = sinon.createStubInstance(CryptoSuite);
		mockSigner = sinon.createStubInstance(Signer);
		signingIdentity = new SigningIdentity(certificateAsHex, mockPublicKey, mspId, mockCryptoSuite, mockSigner);
	});

	describe('#constructor', () => {

		it('should throw if no certificate', () => {
			(() => {
				new SigningIdentity(null, mockPublicKey, mspId, mockCryptoSuite, mockSigner);
			}).should.throw(/Missing required parameter "certificate"./);
		});

		it('should throw if no public key', () => {
			(() => {
				new SigningIdentity(certificateAsHex, null, mspId, mockCryptoSuite, mockSigner);
			}).should.throw(/Missing required parameter "publicKey"./);
		});

		it('should throw if no MSP ID', () => {
			(() => {
				new SigningIdentity(certificateAsHex, mockPublicKey, null, mockCryptoSuite, mockSigner);
			}).should.throw(/Missing required parameter "mspId"./);
		});

		it('should throw if no crypto suite', () => {
			(() => {
				new SigningIdentity(certificateAsHex, mockPublicKey, mspId, null, mockSigner);
			}).should.throw(/Missing required parameter "cryptoSuite"./);
		});

		it('should throw if no signer', () => {
			(() => {
				new SigningIdentity(certificateAsHex, mockPublicKey, mspId, mockCryptoSuite, null);
			}).should.throw(/Missing required parameter "signer"./);
		});

	});

	describe('#sign', () => {

		it('should throw if options specified, but hash function specified is not a function', () => {
			(() => {
				signingIdentity.sign(message, {hashFunction: 'lulz not a function'});
			}).should.throw(/The "hashFunction" field must be a function/);
		});

		it('should handle a successful sign by the signer using the default hash function', async () => {
			const digest = HashPrimitives.SHA2_256(message);
			const hashFunction = sinon.stub();
			hashFunction.withArgs(message).returns(digest);
			mockCryptoSuite.hash = hashFunction;
			mockSigner.sign.withArgs(digest, null).resolves();
			await signingIdentity.sign(message);
			mockSigner.sign.should.have.been.calledOnceWithExactly(sinon.match((buffer) => {
				return buffer.toString('hex') === digest;
			}), null);
		});

		it('should handle a successful sign by the signer using the specified hash function', async () => {
			const digest = HashPrimitives.SHA2_256(message);
			const hashFunction = sinon.stub();
			hashFunction.withArgs(message).returns(digest);
			mockSigner.sign.resolves();
			await signingIdentity.sign(message, {hashFunction});
			mockSigner.sign.should.have.been.calledOnceWithExactly(sinon.match((buffer) => {
				return buffer.toString('hex') === digest;
			}), null);
		});

		it('should handle an unsuccessful sign by the signer', async () => {
			const digest = HashPrimitives.SHA2_256(message);
			const hashFunction = sinon.stub();
			hashFunction.withArgs(message).returns(digest);
			mockSigner.sign.rejects(new Error('such error'));
			await signingIdentity.sign(message, {hashFunction}).should.have.been.rejectedWith(/such error/);
		});

	});

});