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
var sjcl = require('sjcl');
var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;
var util = require('util');
var hashPrimitives = require('../hash.js');
var utils = require('../utils');
var ECDSAKey = require('./ecdsa/key.js');

// constants
const AESKeyLength = 32;
const HMACKeyLength = 32;
const ECIESKDFOutput = 512; // bits
const IVLength = 16; // bytes

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
	 * @param {KeyValueStore} kvs An instance of a {@link module:api.KeyValueStore} implementation used to save private keys
	 */
	constructor(keySize, kvs) {
		if (keySize !== 256 && keySize !== 384) {
			throw new Error('Illegal key size: ' + keySize + ' - this crypto suite only supports key sizes 256 or 384');
		}

		super();

		if (typeof kvs === 'undefined' || kvs === null) {
			this._store = null;
		} else {
			if (typeof kvs.getValue !== 'function' || typeof kvs.setValue !== 'function') {
				throw new Error('The "kvs" parameter for this constructor must be an instance of a KeyValueStore implementation');
			}

			this._store = kvs;
		}

		this._keySize = keySize;
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
		var hashAlgo = utils.getConfigSetting('crypto-hash-algo');

		logger.debug('Hash algorithm: %s, hash output size: %s', hashAlgo, this._keySize);

		switch (hashAlgo.toLowerCase() + '-' + this._keySize) {
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
		default:
			throw Error(util.format('Unsupported hash algorithm and key size pair: %s-%s', hashAlgo, this._keySize));
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
			return Promise.resolve(new ECDSAKey(pair.prvKeyObj, this._keySize));
		} else {
			// unless "opts.ephemeral" is explicitly set to "true", default to saving the key
			var key = new ECDSAKey(pair.prvKeyObj, this._keySize);

			var self = this;
			return new Promise(
				function(resolve, reject) {
					self._getKeyValueStore(self._store)
					.then (
						function (store) {
							logger.debug('generateKey, store.setValue');
							store.setValue(key.getSKI(), KEYUTIL.getPEM(pair.prvKeyObj, 'PKCS8PRV'))
							.then(
								function() {
									return resolve(key);
								}
							).catch(
								function(err) {
									reject(err);
								}
							);
						});
				}
			);
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
		if (!opts)
			throw new Error('Missing required parameter "opts"');

		if (!opts.algorithm)
			throw new Error('Parameter "opts" missing required field "algorithm"');

		if (opts.algorithm === api.CryptoAlgorithms.X509Certificate) {
			// importing public key from an x.509 certificate
			var pemString = Buffer.from(raw).toString();
			try {
				var publicKey = KEYUTIL.getKey(raw);

				if (publicKey.type === 'EC') {
					return new ECDSAKey(publicKey, publicKey.ecparams.keylen);
				} else {
					// TODO PEM encoded private keys, DER encoded public certs and private keys, etc
					throw new Error('Does not understand certificates other than ECDSA public keys');
				}
			} catch(err) {
				logger.error('Failed to parse public key from PEM: ' + err);
				throw err;
			}
		}
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#getKey}
	 * Returns the key this CSP associates to the Subject Key Identifier ski.
	 */
	getKey(ski) {
		var self = this;

		return new Promise(
			function(resolve, reject) {
				self._getKeyValueStore(self._store)
				.then (
					function (store) {
						store.getValue(ski)
						.then(function(raw) {
							if (raw !== null) {
								var privKey = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(raw);
								return resolve(new ECDSAKey(privKey, self._keySize));
							} else {
								return resolve(null);
							}
						})
						.catch(function(err) {
							reject(err);
						});
					});
			}
		);
	}

	_getKeyValueStore(store) {
		var self = this;
		return new Promise(function(resolve, reject) {
			if (store === null) {
				logger.info('This class requires a KeyValueStore to save keys, no store was passed in, using the default store');
				store = utils.newKeyValueStore({
					path: '/tmp/hfc-key-store'
				})
				.then(
					function (kvs) {
						logger.debug('_getKeyValueStore returning kvs');
						self._store = kvs;
						resolve(kvs);
					}
				);
			} else {
				logger.debug('_getKeyValueStore resolving store');
				resolve(store);
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
};

function _zeroBuffer(length) {
	var buf = new Buffer(length);
	buf.fill(0);
	return buf;
}

module.exports = CryptoSuite_ECDSA_AES;
