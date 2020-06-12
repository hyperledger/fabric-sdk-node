/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const CryptoSuite = require('../lib/CryptoSuite');
const Identity = require('../lib/Identity');
const Key = require('../lib/Key');
const fabproto6 = require('fabric-protos');
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
const signature = Buffer.from('my signature!');

describe('Identity', () => {

	let identity;
	let mockPublicKey;
	let mockCryptoSuite;

	beforeEach(() => {
		mockPublicKey = sinon.createStubInstance(Key);
		mockCryptoSuite = sinon.createStubInstance(CryptoSuite);
		identity = new Identity(certificateAsHex, mockPublicKey, mspId, mockCryptoSuite);
	});

	describe('#constructor', () => {

		it('should throw if no certificate', () => {
			(() => {
				new Identity(null, mockPublicKey, mspId, mockCryptoSuite);
			}).should.throw(/Missing required parameter "certificate"./);
		});

		it('should throw if no MSP ID', () => {
			(() => {
				new Identity(certificateAsHex, mockPublicKey, null, mockCryptoSuite);
			}).should.throw(/Missing required parameter "mspId"./);
		});

	});

	describe('#getMSPId', () => {

		it('should return the MSP ID', () => {
			identity.getMSPId().should.equal(mspId);
		});

	});

	describe('#isValid', () => {

		it('should return true', () => {
			identity.isValid().should.be.true;
		});

	});

	describe('#getOrganizationUnits', () => {

		it('should return dunno!', () => {
			identity.getOrganizationUnits().should.equal('dunno!');
		});

	});

	describe('#verify', () => {

		it('should throw if no public key', () => {
			identity = new Identity(certificateAsHex, null, mspId, mockCryptoSuite);
			(() => {
				identity.verify(message, signature);
			}).should.throw(/Missing public key for this Identity/);
		});

		it('should throw if no public key', () => {
			identity = new Identity(certificateAsHex, mockPublicKey, mspId, null);
			(() => {
				identity.verify(message, signature);
			}).should.throw(/Missing cryptoSuite for this Identity/);
		});

		it('should handle a successful verify by the crypto suite', async () => {
			mockCryptoSuite.verify.withArgs(mockPublicKey, signature, message).resolves();
			await identity.verify(message, signature);
			mockCryptoSuite.verify.should.have.been.calledOnceWithExactly(mockPublicKey, signature, message);
		});

		it('should handle an unsuccessful verify by the crypto suite', async () => {
			mockCryptoSuite.verify.withArgs(mockPublicKey, signature, message).rejects(new Error('such error'));
			await identity.verify(message, signature).should.be.rejectedWith(/such error/);
		});

	});

	describe('#verifyAttributes', () => {

		it('should return true', () => {
			identity.verifyAttributes().should.be.true;
		});

	});

	describe('#serialize', () => {

		it('should serialize the identity to a buffer', () => {
			const buffer = identity.serialize();
			buffer.should.be.an.instanceOf(Buffer);
			const serializedIdentity = fabproto6.msp.SerializedIdentity.decode(buffer);
			serializedIdentity.mspid.should.equal(mspId);
			serializedIdentity.id_bytes.toString().should.equal(certificateAsHex);
		});

	});

});
