/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const {Utils} = require('..');
const path = require('path');
const CryptoSuite_ECDSA_AES = require('../lib/impl/CryptoSuite_ECDSA_AES');
const testUtils = require('./TestUtils');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');

const should = chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('Utils', () => {

	describe('#newCryptoSuite', () => {

		beforeEach(() => {
			testUtils.setCryptoConfigSettings();
		});

		it('should return a default instance of CryptoSuite_ECDSA_AES with the correct properties', () => {
			const defaultCryptoSuite = Utils.newCryptoSuite();
			defaultCryptoSuite.should.be.an.instanceOf(CryptoSuite_ECDSA_AES);
			defaultCryptoSuite._keySize.should.equal(256);
			should.exist(defaultCryptoSuite._ecdsaCurve);
			should.exist(defaultCryptoSuite._ecdsa);
		});

		it('should return an instance of CryptoSuite_ECDSA_AES with the correct keysize', () => {
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384, algorithm: 'EC'});
			cryptoSuite.should.be.an.instanceOf(CryptoSuite_ECDSA_AES);
			cryptoSuite._keySize.should.equal(384);
		});

		it('should return an instance of CryptoSuite_ECDSA_AES with the correct keysize', () => {
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384});
			cryptoSuite.should.be.an.instanceOf(CryptoSuite_ECDSA_AES);
			cryptoSuite._keySize.should.equal(384);
		});

		it('should return an instance of CryptoSuite_ECDSA_AES with the default keysize', () => {
			const cryptoSuite = Utils.newCryptoSuite({algorithm: 'EC'});
			cryptoSuite.should.be.an.instanceOf(CryptoSuite_ECDSA_AES);
			cryptoSuite._keySize.should.equal(256);
		});

		it('should throw an error when an illegal key size is given', () => {
			(() => {
				Utils.newCryptoSuite({keysize: 123});
			}).should.throw(/Illegal key size/);
		});

		it('should throw an error when using HSM and a fake library path', () => {
			Utils.setConfigSetting('crypto-hsm', true);
			Utils.setConfigSetting('crypto-suite-hsm', {'EC': 'fabric-common/lib/impl/bccsp_pkcs11.js'});
			const fakePath = path.join('some', 'fake', 'path');
			(() => {
				Utils.newCryptoSuite({lib: fakePath, slot: 0, pin: '1234'});
			}).should.throw(fakePath);
		});
		it('should throw an error when using HSM and no library path is given', () => {
			Utils.setConfigSetting('crypto-hsm', true);
			Utils.setConfigSetting('crypto-suite-hsm', {'EC': 'fabric-common/lib/impl/bccsp_pkcs11.js'});
			(() => {
				Utils.newCryptoSuite({keysize: 384, algorithm: 'EC'});
			}).should.throw(/PKCS11 library path must be specified/);
		});

		it('should throw an error when an illegal hashing algorithm has been set', () => {
			Utils.setConfigSetting('crypto-hash-algo', 19745);
			(() => {
				Utils.newCryptoSuite({});
			}).should.throw(/Unsupported hash algorithm/);
		});

		it('should throw an error when an unsupported hashing algorithm has been set', () => {
			Utils.setConfigSetting('crypto-hash-algo', '12345');
			(() => {
				Utils.newCryptoSuite({});
			}).should.throw(/Unsupported hash algorithm and key size pair/);
		});

		it('should throw an error when an incorrect hashing algorithm is specified', () => {
			(() => {
				Utils.newCryptoSuite({algorithm: 'cake'});
			}).should.throw(/Desired CryptoSuite module not found supporting algorithm/);
		});

	});

});
