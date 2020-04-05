/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Utils} = require('../../');
const ECDSAKey = require('../../lib/impl/ecdsa/key');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
const testUtils = require('../TestUtils');
const elliptic = require('elliptic');
const Signature = require('elliptic/lib/elliptic/ec/signature.js');

chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('CryptoSuite_ECDSA_AES', () => {

	const curveName256String = 'secp256r1';
	const curveName384String = 'secp384r1';

	beforeEach(() => {
		testUtils.setCryptoConfigSettings();
	});

	describe('#generateEphemeralKey', () => {

		it('should generate an ephemeral key', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const ephemeralKey = cryptoSuite.generateEphemeralKey();
			ephemeralKey.should.be.an.instanceOf(ECDSAKey);
			ephemeralKey._key.type.should.equal('EC');
		});

	});

	describe('#generateKey', () => {

		it('should generate a public key with the correct curveName', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			const key = await cryptoSuite.generateKey();
			key.should.be.an.instanceOf(ECDSAKey);
			const curveName = key.getPublicKey()._key.curveName;
			curveName.should.equal(curveName256String);
		});

		it('should generate a public key with the correct curveName for non-default 384 keysize', async () => {
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384});
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			const key = await cryptoSuite.generateKey();
			const curveName = key.getPublicKey()._key.curveName;
			curveName.should.equal(curveName384String);
		});

		it('should generate an ephemeral key when specified', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			const key = await cryptoSuite.generateKey({ephemeral: true});
			key.should.be.an.instanceOf(ECDSAKey);
			const curveName = key.getPublicKey()._key.curveName;
			curveName.should.equal(curveName256String);
		});

		it('should throw an error when the cryptoKeyStore property has not been set', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			await cryptoSuite.generateKey().should.be.rejectedWith('generateKey requires CryptoKeyStore to be set.');
		});

	});

	describe('#createKeyFromRaw', () => {

		it('should generate a key from raw private key', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const privateKey = cryptoSuite.createKeyFromRaw(testUtils.keyAsPEM);
			privateKey.should.be.an.instanceOf(ECDSAKey);
			privateKey._key.type.should.equal('EC');
			privateKey._key.isPrivate.should.be.true;
		});

		it('should throw an error if the key cannot be parsed', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			(() => {
				cryptoSuite.createKeyFromRaw('wrongKey');
			}).should.throw(/Failed to parse key from PEM/);
		});

	});

	describe('#importKey', () => {

		it('should return a public key', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			const key = await cryptoSuite.importKey(testUtils.certificateAsPEM);
			key.isPrivate().should.equal(false);
			key.getSKI().should.equal(testUtils.TEST_PUBLIC_KEY_SKI);
		});

		it('should store the imported public key in the key store', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const keyStore = Utils.newCryptoKeyStore();
			cryptoSuite.setCryptoKeyStore(keyStore);
			await cryptoSuite.importKey(testUtils.certificateAsPEM);

			const cert = await keyStore.getValue('f7b61538c52260e83cf4f2693d11019f73e7495056c5b54f1e05bae80e9402a7-pub');
			cert.should.exist;
		});

		it('should return a private key', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			const key = await cryptoSuite.importKey(testUtils.keyAsPEM);
			key.isPrivate().should.equal(true);
			key.getSKI().should.equal(testUtils.TEST_PRIVATE_KEY_SKI);
		});

		it('should store the imported private key in the correct directory', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const keyStore = Utils.newCryptoKeyStore();
			cryptoSuite.setCryptoKeyStore(keyStore);
			await cryptoSuite.importKey(testUtils.keyAsPEM);

			const key = await keyStore.getValue('bced195e7aacb5705bbad45598535d2f41564953680c5cf696becbb2dfebf39c-priv');
			key.should.exist;
		});

		it('should throw an error when the cryptoKeyStore property has not been set', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			await cryptoSuite.importKey(testUtils.certificateAsPEM).should.be.rejectedWith('importKey requires CryptoKeyStore to be set.');
		});

	});

	describe('#getKey', () => {
		it('should throw an error when the cryptoKeyStore property has not been set', async () => {
			const cryptoSuite = Utils.newCryptoSuite();
			await cryptoSuite.getKey(testUtils.certificateAsPEM).should.be.rejectedWith('getKey requires CryptoKeyStore to be set.');
		});

	});

	describe('#hash', () => {

		it('should return a SHA2 256-bit hash signature for a string using default key size', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const hashString = cryptoSuite.hash(testUtils.TEST_MSG);
			hashString.should.equal(testUtils.HASH_MSG_SHA2_256);
		});

		it('should return a SHA2 256-bit hash signature for a long string using default key size', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			const hashString = cryptoSuite.hash(testUtils.TEST_LONG_MSG);
			hashString.should.equal(testUtils.HASH_LONG_MSG_SHA2_256);
		});

		it('should return a SHA2 384-bit hash signature for a string using a key size of 384', () => {
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384});
			const hashString = cryptoSuite.hash(testUtils.TEST_MSG);
			hashString.should.equal(testUtils.HASH_MSG_SHA2_384);
		});

		it('should return a SHA3 256-bit hash signature for a string using default key size', () => {
			Utils.setConfigSetting('crypto-hash-algo', 'SHA3');
			const cryptoSuite = Utils.newCryptoSuite();
			const hashString = cryptoSuite.hash(testUtils.TEST_MSG);
			hashString.should.equal(testUtils.HASH_MSG_SHA3_256);
		});

		it('should return a SHA3 256-bit hash signature for a long string using default key size', () => {
			Utils.setConfigSetting('crypto-hash-algo', 'sha3'); // lower case should be handled
			const cryptoSuite = Utils.newCryptoSuite();
			const hashString = cryptoSuite.hash(testUtils.TEST_LONG_MSG);
			hashString.should.equal(testUtils.HASH_LONG_MSG_SHA3_256);
		});

		it('should return a SHA3 384-bit hash signature for a string using a key size of 384', () => {
			Utils.setConfigSetting('crypto-hash-algo', 'SHA3');
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384});
			const hashString = cryptoSuite.hash(testUtils.TEST_MSG);
			hashString.should.equal(testUtils.HASH_MSG_SHA3_384);
		});

		it('should return a SHA3 384-bit hash signature for a long string using a key size of 384', () => {
			Utils.setConfigSetting('crypto-hash-algo', 'sha3'); // lower case should be handled
			const cryptoSuite = Utils.newCryptoSuite({keysize: 384});
			const hashString = cryptoSuite.hash(testUtils.TEST_LONG_MSG);
			hashString.should.equal(testUtils.HASH_LONG_MSG_SHA3_384);
		});

	});

	describe('#sign', () => {

		let cryptoSuite;
		let key;
		let hash;
		let signature;
		let halfOrder;
		const halfOrdersForCurve = {
			'secp256r1': elliptic.curves.p256.n.shrn(1),
			'secp384r1': elliptic.curves.p384.n.shrn(1)
		};

		beforeEach(async () => {
			cryptoSuite = Utils.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Utils.newCryptoKeyStore());
			key = await cryptoSuite.generateKey();
		});

		it('should return a signature of a string with a good s-value', async () => {
			hash = cryptoSuite.hash(testUtils.TEST_MSG);
			signature = cryptoSuite.sign(key, hash);
			halfOrder = halfOrdersForCurve[key._key.ecparams.name];
			const signatureObject = new Signature(signature);
			const bigNumberComparison = signatureObject.s.cmp(halfOrder);
			// Expect the generated signature object to have an S value below N/2
			bigNumberComparison.should.equal(-1);
		});

		it('should return a verifiable signature of a string using the given key', async () => {
			hash = cryptoSuite.hash(testUtils.TEST_MSG);
			signature = cryptoSuite.sign(key, hash);
			halfOrder = halfOrdersForCurve[key._key.ecparams.name];
			const publicKey = cryptoSuite._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
			const signatureBuffer = Buffer.from(signature);
			const verifyResults = publicKey.verify(hash, signatureBuffer);
			verifyResults.should.equal(true);
		});

		it('should return a signature of a long string with a good s-value', async () => {
			hash = cryptoSuite.hash(testUtils.TEST_LONG_MSG);
			signature = cryptoSuite.sign(key, hash);
			halfOrder = halfOrdersForCurve[key._key.ecparams.name];
			const signatureObject = new Signature(signature);
			const bigNumberComparison = signatureObject.s.cmp(halfOrder);
			// Expect the generated signature object to have an S value below N/2
			bigNumberComparison.should.equal(-1);
		});

		it('should return a verifiable signature of a long string using the given key', async () => {
			hash = cryptoSuite.hash(testUtils.TEST_LONG_MSG);
			signature = cryptoSuite.sign(key, hash);
			halfOrder = halfOrdersForCurve[key._key.ecparams.name];
			const publicKey = cryptoSuite._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
			const signatureBuffer = Buffer.from(signature);
			const verifyResults = publicKey.verify(hash, signatureBuffer);
			verifyResults.should.equal(true);
		});

		describe('errors', () => {
			it('should throw an error when a key is not defined', () => {
				cryptoSuite = Utils.newCryptoSuite();
				(() => {
					cryptoSuite.sign();
				}).should.throw(/A valid key is required to sign/);
			});

			it('should throw an error when a signing message is not defined', () => {
				cryptoSuite = Utils.newCryptoSuite();
				(() => {
					cryptoSuite.sign('dummy key');
				}).should.throw(/A valid message is required to sign/);
			});
		});
	});

	describe('#verify', () => {

		it('should throw an error when no key is specified', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			(() => {
				cryptoSuite.verify();
			}).should.throw(/A valid key is required to verify/);
		});

		it('should throw an error when no signature is specified', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			(() => {
				cryptoSuite.verify('dummy key');
			}).should.throw(/A valid signature is required to verify/);
		});

		it('should throw an error when no message is specified', () => {
			const cryptoSuite = Utils.newCryptoSuite();
			(() => {
				cryptoSuite.verify('dummy key', 'dummy signature');
			}).should.throw(/A valid message is required to verify/);
		});

	});
});
