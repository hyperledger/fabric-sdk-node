/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * Signer is an interface for an opaque private key that can be used for signing operations
 *
 * @class
 */
class Signer {
	/**
	 * @param {module:api.CryptoSuite} cryptoSuite The underlying {@link CryptoSuite} implementation for the digital
	 * signature algorithm
	 * @param {module:api.Key} key The private key
	 */
	constructor(cryptoSuite, key) {
		if (!cryptoSuite) {
			throw new Error('Missing required parameter "cryptoSuite"');
		}

		if (!key) {
			throw new Error('Missing required parameter "key" for private key');
		}

		this._cryptoSuite = cryptoSuite;
		this._key = key;
	}

	/**
	 * Returns the public key corresponding to the opaque, private key
	 *
	 * @returns {module:api.Key} The public key corresponding to the private key
	 */
	getPublicKey() {
		return this._key.getPublicKey();
	}

	/**
	 * Signs digest with the private key.
     *
     * Hash implements the SignerOpts interface and, in most cases, one can
     * simply pass in the hash function used as opts. Sign may also attempt
     * to type assert opts to other types in order to obtain algorithm
     * specific values.
     *
     * Note that when a signature of a hash of a larger message is needed,
     * the caller is responsible for hashing the larger message and passing
     * the hash (as digest) and the hash function (as opts) to Sign.
	 *
	 * @param {byte[]} digest The message to sign
	 * @param {Object} opts
	 *      hashingFunction: the function to use to hash
	 */
	sign(digest, opts) {
		return this._cryptoSuite.sign(this._key, digest, opts);
	}
}

module.exports = Signer;