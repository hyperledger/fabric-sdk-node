/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const chai = require('chai');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);

const User = rewire('../lib/User');
const Pkcs11EcdsaKey = require('../lib/impl/ecdsa/pkcs11_key');
const CryptoSuite_PKCS11 = require('../lib/impl/bccsp_pkcs11');

const TestUtils = require('./TestUtils');
const {Utils} = require('..');

describe('User', () => {
	TestUtils.setCryptoConfigSettings();
	const cert = TestUtils.certificateAsPEM;
	const key = TestUtils.keyAsPEM;

	describe('#constructor', () => {
		it('should work using a string', () => {
			const user = new User('user');
			user._name.should.be.equal('user');
		});
		it('should work using a config with name', () => {
			const user = new User({
				name: 'user'
			});
			user._name.should.be.equal('user');
		});
		it('should work using a config with enrollment and roles', () => {
			const user = new User({
				enrollmentID: 'user',
				roles: ['role1', 'role2']
			});
			user._name.should.be.equal('user');
			user._roles.should.be.deep.equal(['role1', 'role2']);
		});
	});

	describe('#setters and getters', () => {
		it('should run', () => {
			const user = new User('user');
			const name = user.getName();
			name.should.be.equal('user');
			user.setRoles(['a', 'b']);
			const roles = user.getRoles();
			roles.should.be.deep.equal(['a', 'b']);
			user.setAffiliation('af');
			const af = user.getAffiliation();
			af.should.be.equal('af');
			user.setSigningIdentity('id');
			const id = user.getIdentity();
			id.should.be.equal('id');
			const sid = user.getSigningIdentity();
			sid.should.be.equal('id');
			user.setCryptoSuite('cs');
			const cs = user.getCryptoSuite();
			cs.should.be.equal('cs');
		});
	});

	describe('#setEnrollment', () => {
		it('should require a private key', async () => {
			const user = new User('user');
			await user.setEnrollment().should.be.rejectedWith(/Invalid parameter. Must have a valid private key./);
		});
		it('should require a certificate', async () => {
			const user = new User('user');
			await user.setEnrollment(key).should.be.rejectedWith(/Invalid parameter. Must have a valid certificate./);
		});
		it('should require a mspid', async () => {
			const user = new User('user');
			await user.setEnrollment(key, cert).should.be.rejectedWith(/Invalid parameter. Must have a valid mspId./);
		});
		it('should require a mspid', async () => {
			const user = new User('user');
			await user.setEnrollment(key, cert, 'mspid');
			user._mspId.should.be.equal('mspid');
		});
		it('handle pkcs11 key', async () => {
			const user = new User('user');
			const cryptoSuite = sinon.createStubInstance(CryptoSuite_PKCS11);
			user.setCryptoSuite(cryptoSuite);
			const keyAttr = {
				ski: Buffer.from('2000', 'hex'),
				ecpt: Buffer.from('4000', 'hex'),
				pub: Buffer.from('6000', 'hex'),
				priv: Buffer.from('8000', 'hex')
			};
			const pkey = new Pkcs11EcdsaKey(keyAttr, 256);
			await user.setEnrollment(pkey, cert, 'mspid');
			user._mspId.should.be.equal('mspid');
			user._identity._publicKey._ecpt.toString('hex').should.be.equal('4000');
		});
	});

	describe('#isEnrolled', () => {
		it('should return true', () => {
			const user = User.createUser('user', 'password', 'mspid', cert, key);
			const ise = user.isEnrolled();
			ise.should.be.true;
		});
		it('should return false', () => {
			const user = new User('user');
			const ise = user.isEnrolled();
			ise.should.be.false;
		});
	});

	describe('#fromString', () => {
		it('should require a chaincodeId', async () => {
			const user = User.createUser('user', 'password', 'mspid', cert, key);
			const string = user.toString();
			const f_user = new User('fake');
			await f_user.fromString(string).should.be.rejectedWith(/name mismatch:/);
		});
		// it('should build user from other user string', async () => {
		// 	const user = User.createUser('user', 'password', 'mspid', cert, key);
		// 	const string = user.toString();
		// 	const f_user = new User('user');
		// 	f_user.fromString(string, true);
		// 	await f_user._name.should.be.equal('user');
		// });

		it('should throw an error when the private key is missing from a user enrollment object', async () => {
			const testUserEnrollment = {
				'name': 'admin2',
				'mspid': 'test',
				'roles': null,
				'affiliation': '',
				'enrollmentSecret': '',
				'enrollment': {
					'signingIdentity': '0e67f7fa577fd76e487ea3b660e1a3ff15320dbc95e396d8b0ff616c87f8c81a',
					'identity': {
						'certificate': TestUtils.TEST_KEY_PRIVATE_CERT_PEM
					}
				}
			};
			// manufacture an error condition where the private key does not exist for the SKI, and only the public key does
			const cryptoSuite = Utils.newCryptoSuite();
			const keyStore = Utils.newCryptoKeyStore();
			cryptoSuite.setCryptoKeyStore(keyStore);
			await cryptoSuite.importKey(cert);

			await keyStore.setValue(`${testUserEnrollment.enrollment.signingIdentity}-priv`, undefined);

			const user = new User('admin2');
			user.setCryptoSuite(cryptoSuite);
			const enrollmentString = JSON.stringify(testUserEnrollment);
			await user.fromString(enrollmentString).should.be.rejectedWith(/Private key missing from key store/);

		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const user = new User('user');
			const string = user.toString();
			should.equal(string,
				'{"name":"user","mspid":"","roles":null,"affiliation":"","enrollmentSecret":"","enrollment":{}}');
		});
	});
});
