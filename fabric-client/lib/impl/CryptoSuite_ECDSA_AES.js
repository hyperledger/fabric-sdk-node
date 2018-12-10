/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

// requires
const api = require('../api.js');

const elliptic = require('elliptic');
const EC = elliptic.ec;
const jsrsa = require('jsrsasign');
const {KEYUTIL} = jsrsa;
const util = require('util');
const Signature = require('elliptic/lib/elliptic/ec/signature.js');

const hashPrimitives = require('../hash.js');
const utils = require('../utils');
const ECDSAKey = require('./ecdsa/key.js');

const logger = utils.getLogger('crypto_ecdsa_aes');

/**
 * The {@link module:api.CryptoSuite} implementation for ECDSA, and AES algorithms using software key generation.
 * This class implements a software-based key generation (as opposed to Hardware Security Module based key management)
 *
 * @class
 * @extends module:api.CryptoSuite
 */
class CryptoSuite_ECDSA_AES extends api.CryptoSuite {

	/**
	 * constructor
	 *
	 * @param {number} keySize Key size for the ECDSA algorithm, can only be 256 or 384
	 * @param {string} hash Optional. Hash algorithm, supported values are "SHA2" and "SHA3"
	 */
	constructor(keySize, hash) {
		if (!keySize) {
			throw new Error('keySize must be specified');
		}
		if (keySize !== 256 && keySize !== 384) {
			throw new Error('Illegal key size: ' + keySize + ' - this crypto suite only supports key sizes 256 or 384');
		}
		let hashAlgo;
		if (hash && typeof hash === 'string') {
			hashAlgo = hash;
		} else {
			hashAlgo = utils.getConfigSetting('crypto-hash-algo');
		}
		if (!hashAlgo || typeof hashAlgo !== 'string') {
			throw new Error(util.format('Unsupported hash algorithm: %j', hashAlgo));
		}
		hashAlgo = hashAlgo.toUpperCase();
		const hashPair = `${hashAlgo}_${keySize}`;
		if (!api.CryptoAlgorithms[hashPair] || !hashPrimitives[hashPair]) {
			throw Error(util.format('Unsupported hash algorithm and key size pair: %s', hashPair));
		}
		super();
		this._keySize = keySize;
		this._hashAlgo = hashAlgo;
		this._cryptoKeyStore = null;

		this._curveName = `secp${keySize}r1`;
		this._ecdsaCurve = elliptic.curves[`p${keySize}`];

		// hash function must be set carefully to produce the hash size compatible with the key algorithm
		// https://www.ietf.org/rfc/rfc5480.txt (see page 9 "Recommended key size, digest algorithm and curve")

		logger.debug('Hash algorithm: %s, hash output size: %s', this._hashAlgo, this._keySize);

		this._hashFunction = hashPrimitives[hashPair];

		this._hashOutputSize = this._keySize / 8;

		this._ecdsa = new EC(this._ecdsaCurve);

	}

	/**
	 * Set the cryptoKeyStore.
	 *
	 * When the application needs to use a key store other than the default,
	 * it should use the {@link Client} newCryptoKeyStore to create an instance and
	 * use this function to set the instance on the CryptoSuite.
	 *
	 * @param {CryptoKeyStore} cryptoKeyStore The cryptoKeyStore.
	 */
	setCryptoKeyStore(cryptoKeyStore) {
		this._cryptoKeyStore = cryptoKeyStore;
	}

	generateEphemeralKey() {
		const pair = KEYUTIL.generateKeypair('EC', this._curveName);
		return new ECDSAKey(pair.prvKeyObj);
	}

	async generateKey(opts) {
		const pair = KEYUTIL.generateKeypair('EC', this._curveName);

		if (typeof opts !== 'undefined' && typeof opts.ephemeral !== 'undefined' && opts.ephemeral === true) {
			logger.debug('generateKey, ephemeral true, Promise resolved');
			return new ECDSAKey(pair.prvKeyObj);
		} else {
			if (!this._cryptoKeyStore) {
				throw new Error('generateKey opts.ephemeral is false, which requires CryptoKeyStore to be set.');
			}
			// unless "opts.ephemeral" is explicitly set to "true", default to saving the key
			const key = new ECDSAKey(pair.prvKeyObj);

			const store = await this._cryptoKeyStore._getKeyStore();
			logger.debug('generateKey, store.setValue');
			await store.putKey(key);
			return key;
		}
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#deriveKey}
	 * To be implemented
	 */
	deriveKey(key, opts) {
		throw new Error('Not implemented yet');
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#importKey}
	 */
	importKey(pem, opts) {
		logger.debug('importKey - start');
		let store_key = true; // default
		if (typeof opts !== 'undefined' && typeof opts.ephemeral !== 'undefined' && opts.ephemeral === true) {
			store_key = false;
		}
		if (store_key && !this._cryptoKeyStore) {
			throw new Error('importKey opts.ephemeral is false, which requires CryptoKeyStore to be set.');
		}

		const self = this;
		// attempt to import the raw content, assuming it's one of the following:
		// X.509v1/v3 PEM certificate (RSA/DSA/ECC)
		// PKCS#8 PEM RSA/DSA/ECC public key
		// PKCS#5 plain PEM DSA/RSA private key
		// PKCS#8 plain PEM RSA/ECDSA private key
		// TODO: add support for the following passcode-protected PEM formats
		// - PKCS#5 encrypted PEM RSA/DSA private
		// - PKCS#8 encrypted PEM RSA/ECDSA private key
		let pemString = Buffer.from(pem).toString();
		pemString = makeRealPem(pemString);
		let key = null;
		let theKey = null;
		let error = null;
		try {
			key = KEYUTIL.getKey(pemString);
		} catch (err) {
			error = new Error('Failed to parse key from PEM: ' + err);
		}

		if (key && key.type && key.type === 'EC') {
			theKey = new ECDSAKey(key);
			logger.debug('importKey - have the key %j', theKey);
		} else {
			error = new Error('Does not understand PEM contents other than ECDSA private keys and certificates');
		}

		if (!store_key) {
			if (error) {
				logger.error('importKey - %s', error);
				throw error;
			}
			return theKey;
		} else {
			if (error) {
				logger.error('importKey - %j', error);
				return Promise.reject(error);
			}
			return new Promise((resolve, reject) => {
				return self._cryptoKeyStore._getKeyStore()
					.then((store) => {
						return store.putKey(theKey);
					}).then(() => {
						return resolve(theKey);
					}).catch((err) => {
						reject(err);
					});

			});
		}
	}

	async getKey(ski) {

		if (!this._cryptoKeyStore) {
			throw new Error('getKey requires CryptoKeyStore to be set.');
		}
		const store = await this._cryptoKeyStore._getKeyStore();
		const key = await store.getKey(ski);
		if (key instanceof ECDSAKey) {
			return key;
		}

		if (key !== null) {
			const pubKey = KEYUTIL.getKey(key);
			return new ECDSAKey(pubKey);
		}
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#hash}
	 * The opts argument is not supported.
	 */
	hash(msg, opts) {
		return this._hashFunction(msg);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#sign}
	 * Signs digest using key k.
	 */
	sign(key, digest) {
		if (typeof key === 'undefined' || key === null) {
			throw new Error('A valid key is required to sign');
		}

		if (typeof digest === 'undefined' || digest === null) {
			throw new Error('A valid message is required to sign');
		}

		// Note that the statement below uses internal implementation specific to the
		// module './ecdsa/key.js'
		const signKey = this._ecdsa.keyFromPrivate(key._key.prvKeyHex, 'hex');
		let sig = this._ecdsa.sign(digest, signKey);
		sig = _preventMalleability(sig, key._key.ecparams);
		logger.debug('ecdsa signature: ', sig);
		const der = sig.toDER();
		return Buffer.from(der);
	}

	verify(key, signature, digest) {
		if (typeof key === 'undefined' || key === null) {
			throw new Error('A valid key is required to verify');
		}

		if (typeof signature === 'undefined' || signature === null) {
			throw new Error('A valid signature is required to verify');
		}

		if (typeof digest === 'undefined' || digest === null) {
			throw new Error('A valid message is required to verify');
		}

		if (!_checkMalleability(signature, key._key.ecparams)) {
			logger.error(new Error('Invalid S value in signature. Must be smaller than half of the order.').stack);
			return false;
		}

		const pubKey = this._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
		// note that the signature is generated on the hash of the message, not the message itself
		return pubKey.verify(this.hash(digest), signature);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#encrypt}
	 * To be implemented.
	 */
	encrypt(key, plainText, opts) {
		throw new Error('Not implemented yet');
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#decrypt}
	 * To be implemented.
	 */
	decrypt(key, cipherText, opts) {
		throw new Error('Not implemented yet');
	}
}

// [Angelo De Caro] ECDSA signatures do not have unique representation and this can facilitate
// replay attacks and more. In order to have a unique representation,
// this change-set forses BCCSP to generate and accept only signatures
// with low-S.
// Bitcoin has also addressed this issue with the following BIP:
// https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki
// Before merging this change-set, we need to ensure that client-sdks
// generates signatures properly in order to avoid massive rejection
// of transactions.

// map for easy lookup of the "N/2" and "N" value per elliptic curve
const ordersForCurve = {
	'secp256r1': {
		'halfOrder': elliptic.curves.p256.n.shrn(1),
		'order': elliptic.curves.p256.n
	},
	'secp384r1': {
		'halfOrder': elliptic.curves.p384.n.shrn(1),
		'order': elliptic.curves.p384.n
	}
};

function _preventMalleability(sig, curveParams) {
	const halfOrder = ordersForCurve[curveParams.name].halfOrder;
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curveParams.name);
	}

	// in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
	// first see if 's' is larger than half of the order, if so, it needs to be specially treated
	if (sig.s.cmp(halfOrder) === 1) { // module 'bn.js', file lib/bn.js, method cmp()
		// convert from BigInteger used by jsrsasign Key objects and bn.js used by elliptic Signature objects
		const bigNum = ordersForCurve[curveParams.name].order;
		sig.s = bigNum.sub(sig.s);
	}

	return sig;
}

function _checkMalleability(sig, curveParams) {
	const halfOrder = ordersForCurve[curveParams.name].halfOrder;
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curveParams.name);
	}

	// first need to unmarshall the signature bytes into the object with r and s values
	const sigObject = new Signature(sig, 'hex');
	if (!sigObject.r || !sigObject.s) {
		throw new Error('Failed to load the signature object from the bytes.');
	}

	// in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
	// first see if 's' is larger than half of the order, if so, it is considered invalid in this context
	if (sigObject.s.cmp(halfOrder) === 1) { // module 'bn.js', file lib/bn.js, method cmp()
		return false;
	}

	return true;
}

// Utilitly method to make sure the start and end markers are correct
function makeRealPem(pem) {
	let result = null;
	if (typeof pem === 'string') {
		result = pem.replace(/-----BEGIN -----/, '-----BEGIN CERTIFICATE-----');
		result = result.replace(/-----END -----/, '-----END CERTIFICATE-----');
		result = result.replace(/-----([^-]+) ECDSA ([^-]+)-----([^-]*)-----([^-]+) ECDSA ([^-]+)-----/, '-----$1 EC $2-----$3-----$4 EC $5-----');
	}
	return result;
}

module.exports = CryptoSuite_ECDSA_AES;
