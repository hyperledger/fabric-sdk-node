/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Abstract class for a suite of crypto algorithms used by the SDK to perform digital signing,
 * encryption/decryption and secure hashing. A complete suite includes support for asymmetric
 * keys (such as ECDSA or RSA), symmetric keys (such as AES) and secure hash (such as
 * SHA2/3).
 *
 * The SDK provides a default implementation based on ECDSA + SHA2/3. An alternative
 * implementation can be specified using the "crypto-suite-software" configuration setting, pointing
 * to a full require() path to the package for the module.
 *
 * @class
 */
class CryptoSuite {

	/**
	 * Generate a key using the options in <code>opts</code> and persist it in the key store as PEM files that can be
	 * retrieved using the <code>getKey()</code> method
	 * @abstract
	 * @async
	 * @param {KeyOpts} opts Optional
	 * @returns {Promise<module:api.Key>} Promise for an instance of the Key class
	 */
	generateKey(opts) {
		throw new Error('Unimplemented abstract method');
	}

	/**
	 * Generate an ephemeral key.
	 * @abstract
	 * @returns {module:api.Key} An instance of the Key class
	 */
	generateEphemeralKey() {
		throw new Error('Unimplemented abstract method');
	}

	/**
	 * Derives the new private key from the source public key using the parameters passed in the <code>opts</code>.
	 * This operation is needed for deriving private keys corresponding to the Transaction Certificates.
	 * @abstract
	 * @param {module:api.Key} key The source key
	 * @param {KeyOpts} opts Optional
	 * @returns {module:api.Key} Derived key
	 */
	deriveKey(key, opts) {
	}

	/**
	 * Creates a {@link Key} from its raw representation
	 * @abstract
	 * @param {*} pem PEM string of the key to create
	 * @param {KeyOpts} opts Options for the concrete implementation
	 * @returns {module:api.Key} The created key
	 */
	createKeyFromRaw(pem, opts) {
		throw new Error('Unimplemented abstract method');
	}

	/**
	 * Imports a {@link Key} from its raw representation using <code>opts</code> to the key store as PEM files that can be
	 * retrieved using the 'getKey()' method
	 * @abstract
	 * @async
	 * @param {string} pem PEM string of the key to import
	 * @param {KeyOpts} opts Options for the concrete implementation
	 * @returns {Promise<module:api.Key>} returns an instance of the Key class that was persisted.
	 */
	importKey(pem, opts) {
		throw new Error('Unimplemented abstract method');
	}

	/**
	 * Returns the {@link Key} this implementation associates to the Subject Key Identifier ski.
	 * @abstract
	 * @param {string} ski Subject Key Identifier specific to a Crypto Suite implementation, as the
	 *    unique index to represent the key
	 * @returns {module:api.Key} Promise of an instance of the Key class corresponding to the ski
	 */
	getKey(ski) {
	}

	/**
	 * Returns the key size this implementation uses when generating new keys.
	 *
	 * @returns {number} key size
	 */
	getKeySize() {
		return this._keySize;
	}

	/**
	 * Produce a hash of the message <code>msg</code> using options <code>opts</code>
	 * @abstract
	 * @param {string} msg Source message to be hashed
	 * @param {Object} opts
	 *      algorithm: an identifier for the algorithm to be used, such as "SHA3"
	 * @returns {string} The hashed digest in hexidecimal string encoding
	 */
	hash(msg, opts) {
	}

	/**
	 * Signs digest using key. The opts argument should be appropriate for the algorithm used.
	 * @abstract
	 * @param {module:api.Key} key Signing key (private key)
	 * @param {byte[]} digest The message digest to be signed. Note that when a
	 * signature of a larger message is needed, the caller is responsible
	 * for hashing the larger message and passing the hash (as digest) to sign.
	 * @returns {byte[]} the resulting signature
	 */
	sign(key, digest) {
	}

	/**
	 * Verifies signature against key and digest
	 * @abstract
	 * @param {module:api.Key} key Signing verification key (public key)
	 * @param {byte[]} signature The signature to verify
	 * @param {byte[]} digest The digest that the signature was created for
	 * @returns {boolean} true if the signature verifies successfully
	 */
	verify(key, signature, digest) {
	}

	/**
	 * Encrypts plaintext using key.
	 * The opts argument should be appropriate for the algorithm used.
	 * @abstract
	 * @param {module:api.Key} key Encryption key (public key)
	 * @param {byte[]} plainText Plain text to encrypt
	 * @param {Object} opts Encryption options
	 * @returns {byte[]} Cipher text after encryption
	 */
	encrypt(key, plaintext, opts) {
	}

	/**
	 * Decrypts ciphertext using key.
	 * The opts argument should be appropriate for the algorithm used.
	 * @abstract
	 * @param {module:api.Key} key Decryption key (private key)
	 * @param {byte[]} cipherText Cipher text to decrypt
	 * @param {Object} opts Decrypt options
	 * @returns {byte[]} Plain text after decryption
	 */
	decrypt(key, ciphertext, opts) {
	}

	/**
	 * Set the cryptoKeyStore.
	 *
	 * When the application needs to use a key store other than the default,
	 * it should use the {@link Client} newCryptoKeyStore to create an instance and
	 * use this function to set the instance on the CryptoSuite.
	 * @abstract
	 * @param {CryptoKeyStore} cryptoKeyStore The cryptoKeyStore.
	 * @abstract
	 */
	setCryptoKeyStore(cryptoKeyStore) {
		throw new Error('Can\'t call abstract method, must be implemented by sub-class!');
	}
}

module.exports = CryptoSuite;
