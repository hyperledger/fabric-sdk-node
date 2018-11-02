/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const sinon = require('sinon');
const should = chai.should();
const rewire = require('rewire');

const Client = require('fabric-client');
const api = require('fabric-client/lib/api');
const User = require('fabric-client/lib/User');
const HSMWalletMixin = rewire('./../../../lib/impl/wallet/hsmwalletmixin');
const {KEYUTIL} = require('jsrsasign');

describe('HSMWalletMixin', () => {
	let revert;
	let sandbox;
	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('createIdentity', () => {
		it('should return the identity with the type, mspId and cert', () => {
			const certificate = 'somecert';
			const mspId = 'mspId';
			const identity = HSMWalletMixin.createIdentity('mspId', 'somecert');
			identity.should.deep.equal({type: 'HSMX509', mspId, certificate});
		});
	});

	describe('clearHSMCache', () => {
		it('should call HSMSuite.clear()', () => {
			const hsmSuite = new Map();
			sinon.stub(hsmSuite, 'clear');
			HSMWalletMixin.__set__('HSMSuite', hsmSuite);
			HSMWalletMixin.clearHSMCache();
			sinon.assert.calledWith(hsmSuite.clear);
		});
	});

	describe('closeDown', () => {
		it('should call close session and finalize every value in HSMSuite', () => {
			const hsmSuite = new Map();
			const suiteStub = {closeSession: sinon.stub(), finalize: sinon.stub()};
			sinon.stub(hsmSuite, 'values').returns([suiteStub, suiteStub]);
			HSMWalletMixin.__set__('HSMSuite', hsmSuite);
			HSMWalletMixin.closeDown();
			sinon.assert.calledTwice(suiteStub.closeSession);
			sinon.assert.calledTwice(suiteStub.finalize);
		});
	});

	describe('#constructor', () => {
		it('should set default hsm parameters and usertype', () => {
			const hsmWalletMixin = new HSMWalletMixin();
			const {library, slot, pin, usertype, cryptoSuite} = hsmWalletMixin;
			should.equal(library, null);
			should.equal(slot, null);
			should.equal(pin, null);
			should.equal(usertype, null);
			should.equal(cryptoSuite, null);
		});

		it('should set default hsm parameters and usertype', () => {
			const hsmWalletMixin = new HSMWalletMixin('somelib', 1, 'somepin', 'sometype');
			const {library, slot, pin, usertype, cryptoSuite} = hsmWalletMixin;
			should.equal(library, 'somelib');
			should.equal(slot, 1);
			should.equal(pin, 'somepin');
			should.equal(usertype, 'sometype');
			should.equal(cryptoSuite, null);
		});
	});

	describe('#getCryptoSuite', () => {
		let ClientStub;
		let cryptoSuiteStub;
		let keyStoreStub;
		let hsmWalletMixin;
		beforeEach(() => {
			cryptoSuiteStub = sinon.createStubInstance(api.CryptoSuite);
			keyStoreStub = sinon.createStubInstance(api.KeyValueStore);
			ClientStub = {
				newCryptoSuite: sandbox.stub().returns(cryptoSuiteStub),
				newCryptoKeyStore: sandbox.stub().returns(keyStoreStub)
			};
			revert.push(HSMWalletMixin.__set__('Client', ClientStub));
			hsmWalletMixin = new HSMWalletMixin('somelib', '0', 'pin', 'sometype');
		});

		it('should set and return the cryptoSuite if one is available', () => {
			const mapStub = {get: () => 'somecryptosuite'};
			revert.push(HSMWalletMixin.__set__('HSMSuite', mapStub));
			const cryptoSuite = hsmWalletMixin.getCryptoSuite();
			cryptoSuite.should.equal('somecryptosuite');
			hsmWalletMixin.cryptoSuite.should.equal('somecryptosuite');
		});

		it('should set and return a new cryptoSuite', () => {
			const cryptoSuite = hsmWalletMixin.getCryptoSuite();
			sinon.assert.called(ClientStub.newCryptoSuite);
			sinon.assert.calledWith(ClientStub.newCryptoSuite, {software: false, lib: 'somelib', slot: 0, pin: 'pin', usertype: 'sometype'});
			cryptoSuite.should.equal(cryptoSuiteStub);
			hsmWalletMixin.cryptoSuite.should.equal(cryptoSuiteStub);
		});
	});

	describe('#importIdentity', () => {
		const ecdsaKeyStub = function() {
			this.getSKI = () => 'ski';
		};
		let clientStub;
		let cryptoSuiteStub;
		let hsmWalletMixin;
		beforeEach(() => {
			revert.push(HSMWalletMixin.__set__('ecdsaKey', ecdsaKeyStub));
			sandbox.stub(KEYUTIL, 'getKey').returns('public key');
			revert.push(HSMWalletMixin.__set__('KEYUTIL', KEYUTIL));
			clientStub = sinon.createStubInstance(Client);
			cryptoSuiteStub = sinon.createStubInstance(api.CryptoSuite);
			cryptoSuiteStub.getKey.returns('private key');
			hsmWalletMixin = new HSMWalletMixin();
			hsmWalletMixin.cryptoSuite = cryptoSuiteStub;
		});

		it('should create a new identity', async () => {
			await hsmWalletMixin.importIdentity(clientStub, 'label', {certificate: 'somecert', mspId: 'mspId'});
			sinon.assert.calledWith(KEYUTIL.getKey, 'somecert');
			sinon.assert.calledWith(cryptoSuiteStub.getKey, Buffer.from('ski', 'hex'));
			sinon.assert.calledWith(clientStub.createUser, {username: 'label', mspid: 'mspId', cryptoContent: {privateKeyObj: 'private key', signedCertPEM: 'somecert'}});
		});
	});

	describe('#exportIdentity', () => {
		let userStub;
		let clientStub;
		let hsmWalletMixin;
		beforeEach(() => {
			userStub = sinon.createStubInstance(User);
			clientStub = sinon.createStubInstance(Client);
			hsmWalletMixin = new HSMWalletMixin();
		});

		it('should export an existing identity', async () => {
			clientStub.getUserContext.resolves(userStub);
			userStub.getIdentity.returns({_certificate: 'somecert'});
			userStub._mspId = 'mspId';
			const identity = await hsmWalletMixin.exportIdentity(clientStub, 'label');
			sinon.assert.called(userStub.getIdentity);
			identity.should.deep.equal({certificate: 'somecert', mspId: 'mspId', type: 'HSMX509'});
		});

		it('should return null if no identity is found', async () => {
			const identity = await hsmWalletMixin.exportIdentity(clientStub, 'label');
			should.equal(identity, null);
		});
	});

	describe('#getIdentityInfo', () => {
		let userStub;
		let clientStub;
		let hsmWalletMixin;
		beforeEach(() => {
			userStub = sinon.createStubInstance(User);
			clientStub = sinon.createStubInstance(Client);
			hsmWalletMixin = new HSMWalletMixin();
		});

		it('should return identity info', async () => {
			const pkStub = sandbox.stub().returns('ski');
			clientStub.getUserContext.resolves(userStub);
			userStub.getIdentity.returns({_publicKey: {getSKI: pkStub}});
			userStub._mspId = 'mspId';
			const info = await hsmWalletMixin.getIdentityInfo(clientStub, 'label');
			sinon.assert.called(userStub.getIdentity);
			info.should.deep.equal({label: 'label', mspId: 'mspId', identifier: 'ski'});
		});

		it('should return null if no identity is found', async () => {
			const info = await hsmWalletMixin.getIdentityInfo(clientStub, 'label');
			should.equal(info, null);
		});
	});
});
