/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

// requires
var api = require('../api.js');

var crypto = require('crypto');
var elliptic = require('elliptic');
var EC = elliptic.ec;
var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;
var util = require('util');
var BN = require('bn.js');
var Signature = require('elliptic/lib/elliptic/ec/signature.js');
var path = require('path');
const os = require('os');

var hashPrimitives = require('../hash.js');
var utils = require('../utils');
var ECDSAKey = require('./ecdsa/key.js');
var CKS = require('./CryptoKeyStore.js');

var logger = utils.getLogger('crypto_ecdsa_aes');

/**
 * The {@link module:api.CryptoSuite} implementation for ECDSA, and AES algorithms using software key generation.
 * This class implements a software-based key generation (as opposed to Hardware Security Module based key management)
 *
 * @class
 */
var CryptoSuite_ECDSA_AES = class extends api.CryptoSuite {

	/**
	 * constructor
	 *
	 * @param {number} keySize Key size for the ECDSA algorithm, can only be 256 or 384
	 * @param {object} opts Implementation-specific options object for the {@link KeyValueStore} class to instantiate an instance
	 * @param {string} KVSImplClass Optional. The built-in key store saves private keys. The key store may be backed by different
	 * {@link KeyValueStore} implementations. If specified, the value of the argument must point to a module implementing the
	 * KeyValueStore interface.
	 * @param {string} hash Optional. Hash algorithm, supported values are "SHA2" and "SHA3"
	 */
	constructor(keySize, opts, KVSImplClass, hash) {
		super();

		if (keySize !== 256 && keySize !== 384) {
			throw new Error('Illegal key size: ' + keySize + ' - this crypto suite only supports key sizes 256 or 384');
		}

		if (typeof hash === 'string' && hash !== null && hash !== '') {
			this._hashAlgo = hash;
		} else {
			this._hashAlgo = utils.getConfigSetting('crypto-hash-algo');
		}

		if (typeof opts === 'undefined' || opts === null) {
			opts = {
				path: CryptoSuite_ECDSA_AES.getDefaultKeyStorePath()
			};
		}

		var superClass;

		if (typeof KVSImplClass !== 'undefined' && KVSImplClass !== null) {
			if (typeof KVSImplClass !== 'function') {
				throw new Error('Super class for the key store must be a module.');
			} else {
				superClass = KVSImplClass;
			}
		} else {
			// no super class specified, use the default key value store implementation
			superClass = require(utils.getConfigSetting('key-value-store'));
		}

		this._keySize = keySize;
		this._store = null;
		this._storeConfig = {
			superClass: superClass,
			opts: opts
		};
		this._initialize();
	}

	_initialize() {
		if (this._keySize === 256) {
			this._curveName = 'secp256r1';
			this._ecdsaCurve = elliptic.curves['p256'];
		} else if (this._keySize === 384) {
			this._curveName = 'secp384r1';
			this._ecdsaCurve = elliptic.curves['p384'];
		}

		// hash function must be set carefully to produce the hash size compatible with the key algorithm
		// https://www.ietf.org/rfc/rfc5480.txt (see page 9 "Recommended key size, digest algorithm and curve")

		logger.debug('Hash algorithm: %s, hash output size: %s', this._hashAlgo, this._keySize);

		switch (this._hashAlgo.toLowerCase() + '-' + this._keySize) {
		case 'sha3-256':
			this._hashFunction = hashPrimitives.sha3_256;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha3_256;
			break;
		case 'sha3-384':
			this._hashFunction = hashPrimitives.sha3_384;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha3_384;
			break;
		case 'sha2-256':
			this._hashFunction = hashPrimitives.sha2_256;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha2_256;
			break;
		case 'sha2-384':
			this._hashFunction = hashPrimitives.sha2_384;
			//TODO: this._hashFunctionKeyDerivation = xxxxxxx;
			break;
		default:
			throw Error(util.format('Unsupported hash algorithm and key size pair: %s-%s', this._hashAlgo, this._keySize));
		}

		this._hashOutputSize = this._keySize / 8;

		this._ecdsa = new EC(this._ecdsaCurve);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#generateKey}
	 * Returns an instance of {@link module.api.Key} representing the private key, which also
	 * encapsulates the public key. It'll also save the private key in the KeyValueStore
	 *
	 * @returns {Key} Promise of an instance of {@link module:ECDSA_KEY} containing the private key and the public key
	 */
	generateKey(opts) {
		var pair = KEYUTIL.generateKeypair('EC', this._curveName);

		if (typeof opts !== 'undefined' && typeof opts.ephemeral !== 'undefined' && opts.ephemeral === true) {
			return Promise.resolve(new ECDSAKey(pair.prvKeyObj));
		} else {
			// unless "opts.ephemeral" is explicitly set to "true", default to saving the key
			var key = new ECDSAKey(pair.prvKeyObj);

			var self = this;
			return new Promise((resolve, reject) => {
				self._getKeyStore()
				.then ((store) => {
					logger.debug('generateKey, store.setValue');
					return store.putKey(key)
						.then(() => {
							return resolve(key);
						}).catch((err) => {
							reject(err);
						});
				});
			});
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
	importKey(raw, opts) {
		var self = this;
		return new Promise((resolve, reject) => {
			// attempt to import the raw content, assuming it's one of the following:
			// X.509v1/v3 PEM certificate (RSA/DSA/ECC)
			// PKCS#8 PEM RSA/DSA/ECC public key
			// PKCS#5 plain PEM DSA/RSA private key
			// PKCS#8 plain PEM RSA/ECDSA private key
			// TODO: add support for the following passcode-protected PEM formats
			// - PKCS#5 encrypted PEM RSA/DSA private
			// - PKCS#8 encrypted PEM RSA/ECDSA private key
			var pemString = Buffer.from(raw).toString();
			try {
				var key = KEYUTIL.getKey(pemString);

				if (key.type && key.type === 'EC') {
					// save the key in the key store
					var theKey = new ECDSAKey(key);

					return self._getKeyStore()
						.then ((store) => {
							return store.putKey(theKey);
						}).then(() => {
							return resolve(theKey);
						}).catch((err) => {
							reject(err);
						});
				} else {
					// TODO PEM encoded RSA public keys
					reject(new Error('Does not understand certificates other than ECDSA public keys'));
				}
			} catch(err) {
				logger.error('Failed to parse key from PEM: ' + err);
				reject(err);
			}
		});
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#getKey}
	 * Returns the key this CSP associates to the Subject Key Identifier ski.
	 */
	getKey(ski) {
		var self = this;
		var store;

		return new Promise((resolve, reject) => {
			self._getKeyStore()
			.then ((st) => {
				store = st;
				return store.getKey(ski);
			}).then((key) => {
				if (key instanceof ECDSAKey)
					return resolve(key);

				if (key !== null) {
					var pubKey = KEYUTIL.getKey(key);
					return resolve(new ECDSAKey(pubKey));
				}
			}).catch((err) => {
				reject(err);
			});
		});
	}

	_getKeyStore() {
		var self = this;
		return new Promise((resolve, reject) => {
			if (self._store === null) {
				logger.info(util.format('This class requires a CryptoKeyStore to save keys, using the store: %j', self._storeConfig));

				CKS(self._storeConfig.superClass, self._storeConfig.opts)
				.then((ks) => {
					logger.debug('_getKeyStore returning ks');
					self._store = ks;
					return resolve(self._store);
				}).catch((err) => {
					reject(err);
				});
			} else {
				logger.debug('_getKeyStore resolving store');
				return resolve(self._store);
			}
		});
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#hash}
	 * Hashes messages msg using options opts.
	 */
	hash(msg, opts) {
		return this._hashFunction(msg);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#sign}
	 * Signs digest using key k.
	 *
	 * The opts argument is not needed.
	 */
	sign(key, digest, opts) {
		if (typeof key === 'undefined' || key === null) {
			throw new Error('A valid key is required to sign');
		}

		if (typeof digest === 'undefined' || digest === null) {
			throw new Error('A valid message is required to sign');
		}

		// Note that the statement below uses internal implementation specific to the
		// module './ecdsa/key.js'
		var signKey = this._ecdsa.keyFromPrivate(key._key.prvKeyHex, 'hex');
		var sig = this._ecdsa.sign(digest, signKey);
		sig = _preventMalleability(sig, key._key.ecparams);
		logger.debug('ecdsa signature: ', sig);
		return sig.toDER();
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#verify}
	 * Verifies signature against key k and digest
	 * The opts argument should be appropriate for the algorithm used.
	 */
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

		var pubKey = this._ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
		// note that the signature is generated on the hash of the message, not the message itself
		return pubKey.verify(this.hash(digest), signature);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#encrypt}
	 * Encrypts plaintext using key k.
	 * The opts argument should be appropriate for the algorithm used.
	 */
	encrypt(key, plaintext, opts) {
		throw new Error('Not implemented yet');
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#decrypt}
	 * Decrypts ciphertext using key k.
	 * The opts argument should be appropriate for the algorithm used.
	 */
	decrypt(key, cipherText, opts) {
		throw new Error('Not implemented yet');
	}

	static getDefaultKeyStorePath() {
		return path.join(os.homedir(), '.hfc-key-store');
	}
};

// [Angelo De Caro] ECDSA signatures do not have unique representation and this can facilitate
// replay attacks and more. In order to have a unique representation,
// this change-set forses BCCSP to generate and accept only signatures
// with low-S.
// Bitcoin has also addressed this issue with the following BIP:
// https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki
// Before merging this change-set, we need to ensure that client-sdks
// generates signatures properly in order to avoid massive rejection
// of transactions.

// map for easy lookup of the "N/2" value per elliptic curve
const halfOrdersForCurve = {
	'secp256r1': elliptic.curves['p256'].n.shrn(1),
	'secp384r1': elliptic.curves['p384'].n.shrn(1)
};

function _preventMalleability(sig, curveParams) {
	var halfOrder = halfOrdersForCurve[curveParams.name];
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curve);
	}

	// in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
	// first see if 's' is larger than half of the order, if so, it needs to be specially treated
	if (sig.s.cmp(halfOrder) == 1) { // module 'bn.js', file lib/bn.js, method cmp()
		// convert from BigInteger used by jsrsasign Key objects and bn.js used by elliptic Signature objects
		var bigNum = new BN(curveParams.n.toString(16), 16);
		sig.s = bigNum.sub(sig.s);
	}

	return sig;
}

function _checkMalleability(sig, curveParams) {
	var halfOrder = halfOrdersForCurve[curveParams.name];
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curve);
	}

	// first need to unmarshall the signature bytes into the object with r and s values
	var sigObject = new Signature(sig, 'hex');
	if (!sigObject.r || !sigObject.s) {
		throw new Error('Failed to load the signature object from the bytes.');
	}

	// in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
	// first see if 's' is larger than half of the order, if so, it is considered invalid in this context
	if (sigObject.s.cmp(halfOrder) == 1) { // module 'bn.js', file lib/bn.js, method cmp()
		return false;
	}

	return true;
}

module.exports = CryptoSuite_ECDSA_AES;
