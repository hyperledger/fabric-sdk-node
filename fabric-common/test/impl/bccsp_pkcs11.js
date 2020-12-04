/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const PKCS11_Rewire = rewire('../../lib/impl/bccsp_pkcs11');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('CryptoSuite_PKCS11', () => {

	const sandbox = sinon.createSandbox();
	let utilsStub;
	let configStub;

	beforeEach(() => {
		configStub = sandbox.stub();
		configStub.withArgs('crypto-pkcs11-lib').returns('/temp');
		configStub.withArgs('crypto-pkcs11-slot').returns(2);
		configStub.withArgs('crypto-pkcs11-usertype').returns(2);
		configStub.withArgs('crypto-pkcs11-readwrite').returns('true');
		configStub.withArgs('crypto-pkcs11-pin').returns('pin');
		configStub.withArgs('crypto-hash-algo').returns('sha2');

		utilsStub = {
			getConfigSetting: configStub
		};
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should throw when no params are given', () => {
			(() => {
				new PKCS11_Rewire();
			}).should.throw(/keySize must be specified/);
		});

		it('should throw when unsupported bits key sizes are given', () => {
			(() => {
				new PKCS11_Rewire(222);
			}).should.throw(/only 256 or 384 bits key sizes are supported/);
		});

		it('should throw when no library path is given', () => {
			(() => {
				new PKCS11_Rewire(256);
			}).should.throw(/PKCS11 library path must be specified/);
		});

		it('should throw if pkcs11 slot not given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp'});
			}).should.throw(/PKCS11 slot must be specified/);
		});

		it('should throw if invalid [string] pkcs11 slot given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 'a'});
			}).should.throw(/PKCS11 slot number invalid/);
		});

		it('should throw if invalid [double] pkcs11 slot given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2.2});
			}).should.throw(/PKCS11 slot number invalid/);
		});

		it('should throw if pkcs11 slot PIN not given', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2});
			}).should.throw(/PKCS11 PIN must be set/);
		});

		it('should throw if pkcs11 slot PIN is not a string', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 7});
			}).should.throw(/PKCS11 PIN must be set/);
		});

		it('should throw if invalid usertype', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 'pin', usertype: 'invalid'});
			}).should.throw(/usertype number invalid/);
		});

		it('should throw if invalid readwrite', () => {
			(() => {
				new PKCS11_Rewire(256, 'sha2', {lib: '/temp', slot: 2, pin: 'pin', usertype: 2, readwrite: 'not'});
			}).should.throw(/readwrite setting must be "true" or "false"/);
		});

		it('should retrieve crypto-pkcs11-lib from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-lib');
		});

		it('should retrieve crypto-pkcs11-slot from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-slot');
		});

		it('should retrieve crypto-pkcs11-usertype from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-usertype');
		});

		it('should retrieve crypto-pkcs11-readwrite from config setting if no opts specified', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256, 'sha2');
			sinon.assert.calledWith(configStub, 'crypto-pkcs11-readwrite');
		});

		it('should retrieve crypto-hash-algo from config setting if not provided', () => {
			PKCS11_Rewire.__set__('utils', utilsStub);
			PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
			new PKCS11_Rewire(256);
			sinon.assert.calledWith(configStub, 'crypto-hash-algo');
		});
		describe('#getKeySize', () => {
			it('should run', () => {
				PKCS11_Rewire.__set__('utils', utilsStub);
				PKCS11_Rewire.prototype._pkcs11OpenSession = sandbox.stub();
				const key = new PKCS11_Rewire(256);
				key.getKeySize().should.be.equal(256);
			});
		});
	});
});
