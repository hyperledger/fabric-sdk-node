/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Identity = require('./Identity');

/**
 * SigningIdentity is an extension of Identity to cover signing capabilities. E.g., signing identity
 * should be requested in the case of a client who wishes to sign proposal responses and transactions
 *
 * @class
 */
class SigningIdentity extends Identity {
	/**
	 * @param {string} certificate HEX string for the PEM encoded certificate
	 * @param {module:api.Key} publicKey The public key represented by the certificate
	 * @param {string} mspId The associated MSP's ID that manages this identity
	 * @param {module:api.CryptoSuite} cryptoSuite The underlying {@link CryptoSuite} implementation for the digital
	 * signature algorithm
	 * @param {Signer} signer The signer object encapsulating the opaque private key and the corresponding
	 * digital signature algorithm to be used for signing operations
	 */
	constructor(certificate, publicKey, mspId, cryptoSuite, signer) {
		if (!certificate) {
			throw new Error('Missing required parameter "certificate".');
		}
		if (!publicKey) {
			throw new Error('Missing required parameter "publicKey".');
		}
		if (!mspId) {
			throw new Error('Missing required parameter "mspId".');
		}
		if (!cryptoSuite) {
			throw new Error('Missing required parameter "cryptoSuite".');
		}
		super(certificate, publicKey, mspId, cryptoSuite);

		if (!signer) {
			throw new Error('Missing required parameter "signer".');
		}

		this._signer = signer;
	}

	/**
	 * Signs digest with the private key contained inside the signer.
	 *
	 * @param {byte[]} msg The message to sign
	 * @param {Object} opts Options object for the signing, contains one field 'hashFunction' that allows
	 *   different hashing algorithms to be used. If not present, will default to the hash function
	 *   configured for the identity's own crypto suite object
	 */
	sign(msg, opts) {
		// calculate the hash for the message before signing
		let hashFunction;
		if (opts && opts.hashFunction) {
			if (typeof opts.hashFunction !== 'function') {
				throw new Error('The "hashFunction" field must be a function');
			}

			hashFunction = opts.hashFunction;
		} else {
			hashFunction = this._cryptoSuite.hash.bind(this._cryptoSuite);
		}

		const digest = hashFunction(msg);
		return this._signer.sign(Buffer.from(digest, 'hex'), null);
	}

	static isInstance(object) {
		return object._certificate &&
			object._publicKey &&
			object._mspId &&
			object._cryptoSuite &&
			object._signer;
	}
}

module.exports = SigningIdentity;