/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);

const IdentityContext = rewire('../lib/IdentityContext');
const Client = require('../lib/Client');
const User = require('../lib/User');
const TestUtils = require('./TestUtils');

describe('IdentityContext', () => {
	TestUtils.setCryptoConfigSettings();
	const client = new Client('myclient');
	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	let idx;

	beforeEach(async () => {
		idx = new IdentityContext(user, client);
	});

	describe('#constructor', () => {
		it('should require a user', () => {
			(() => {
				new IdentityContext();
			}).should.throw('Missing user parameter');
		});
		it('should require a Client', () => {
			(() => {
				new IdentityContext(user);
			}).should.throw('Missing client parameter');
		});
		it('should create', () => {
			const i2 = new IdentityContext(user, client);
			i2.type.should.equal('IdentityContext');
			i2.name.should.equal('user');
		});
	});

	describe('#calculateTransactionId', () => {
		it('should calculate txid and nonce', () => {
			should.not.exist(idx.nonce);
			should.not.exist(idx.transactionId);
			idx.calculateTransactionId();
			should.exist(idx.nonce);
			should.exist(idx.transactionId);
		});

		it('should return new identity context', () => {
			const result = idx.calculateTransactionId();
			result.should.be.an.instanceof(IdentityContext).that.does.not.equal(idx);
		});

		it('result should have same serialized identity', () => {
			const actual = idx.calculateTransactionId().serializeIdentity();

			const expected = idx.serializeIdentity();
			actual.should.deep.equal(expected);
		});

		it('result should have matching transaction ID and nonce', () => {
			const result = idx.calculateTransactionId();
			result.transactionId.should.equal(idx.transactionId);
			result.nonce.should.equal(idx.nonce);
		});
	});

	describe('#serializeIdentity', () => {
		it('should serializeIdentity', () => {
			const serializedIdentity = idx.serializeIdentity();
			should.exist(serializedIdentity);
		});
	});

	describe('#sign', () => {
		it('should require a payload', () => {
			(() => {
				idx.sign();
			}).should.throw('Missing payload parameter');
		});
		it('should serializeIdentity', () => {
			const signature = idx.sign(Buffer.from('payload'));
			should.exist(signature);
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = idx.toString();
			should.equal(string, 'IdentityContext: { user: user, transactionId: null, nonce:null}');
		});
	});
});
