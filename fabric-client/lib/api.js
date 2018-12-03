/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * This module defines the APIs for the pluggable components of the node.js SDK.
 *
 * @module api
 */

/**
 * Abstract class for a Key-Value store. The Channel class uses this store
 * to save sensitive information such as authenticated user's private keys,
 * certificates, etc.
 *
 * The SDK provides a default implementation based on files. An alternative
 * implementation can be specified using the "key-value-store" configuration
 * setting, pointing to a full require() path to package for the module.
 *
 * @class
 */
module.exports.KeyValueStore = class {

	/**
	 * Get the value associated with <code>name</code>.
	 *
	 * @param {string} name Name of the key
	 * @returns {Promise} Promise for the value corresponding to the key. If the value does not exist in the
	 * store, returns null without rejecting the promise
	 */
	getValue(name) {
	}

	/**
	 * Set the value associated with <code>name</code>.
	 * @param {string} name Name of the key to save
	 * @param {string} value The Value to save
	 * @returns {Promise} Promise for the 'value' object upon successful write operation
	 */
	setValue(name, value) {
	}

};

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
module.exports.CryptoSuite = class {

	/**
	 * Generate a key using the options in <code>opts</code>. If the <code>opts.ephemeral</code>
	 * parameter is false, the method, in addition to returning the imported {@link Key}
	 * instance, also persists the generated key in the key store as PEM files that can be
	 * retrieved using the <code>getKey()</code> method
	 *
	 * @param {KeyOpts} opts Optional
	 * @returns {module:api.Key} Promise for an instance of the Key class
	 * @throws Will throw an error if not implemented
	 */
	generateKey(opts) {
	}

	/**
	 * Generate an ephemeral key.
	 *
	 * @returns {module:api.Key} An instance of the Key class
	 * @throws Will throw an error if not implemented
	 */
	generateEphemeralKey() {
	}

	/**
	 * Derives the new private key from the source public key using the parameters passed in the <code>opts</code>.
	 * This operation is needed for deriving private keys corresponding to the Transaction Certificates.
	 *
	 * @param {module:api.Key} key The source key
	 * @param {KeyOpts} opts Optional
	 * @returns {module:api.Key} Derived key
	 */
	deriveKey(key, opts) {
	}

	/**
	 * Imports a {@link Key} from its raw representation using <code>opts</code>. If the <code>opts.ephemeral</code>
	 * parameter is false, the method, in addition to returning the imported {@link Key}
	 * instance, also saves the imported key in the key store as PEM files that can be
	 * retrieved using the 'getKey()' method
	 *
	 * @param {string} pem PEM string of the key to import
	 * @param {KeyOpts} opts Optional
	 * @returns {Key | Promise} If "opts.ephemeral" is true, returns the Key class synchronously.
	 *          If "opts.ephemeral" not set or false, returns a Promise of an instance of the
	 *          Key class.
	 */
	importKey(pem, opts) {
	}

	/**
	 * Returns the {@link Key} this implementation associates to the Subject Key Identifier ski.
	 *
	 * @param {string} ski Subject Key Identifier specific to a Crypto Suite implementation, as the
	 *    unique index to represent the key
	 * @returns {module:api.Key} Promise of an instance of the Key class corresponding to the ski
	 */
	getKey(ski) {
	}

	/**
	 * Produce a hash of the message <code>msg</code> using options <code>opts</code>
	 *
	 * @param {string} msg Source message to be hashed
	 * @param {Object} opts
	 *      algorithm: an identifier for the algorithm to be used, such as "SHA3"
	 * @returns {string} The hashed digest in hexidecimal string encoding
	 */
	hash(msg, opts) {
	}

	/**
	 * Signs digest using key. The opts argument should be appropriate for the algorithm used.
	 *
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
	 *
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
	 *
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
	 *
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
	 *
	 * @param {CryptoKeyStore} cryptoKeyStore The cryptoKeyStore.
	 * @abstract
	 */
	setCryptoKeyStore(cryptoKeyStore) {
		if (cryptoKeyStore) {
			throw new Error('Can\'t call abstract method, must be implemented by sub-class!');
		}
		throw new Error('Can\'t call abstract method, must be implemented by sub-class!');
	}
};

/**
 * Key represents a cryptographic key. It can be symmetric or asymmetric. In the case of an
 * asymmetric key, the key can be public or private. In the case of a private asymmetric
 * key, the getPublicKey() method allows to retrieve the corresponding public-key.
 * A key can be referenced via the Subject Key Identifier (SKI) and resolvable by the
 * appropriate {@link CryptoSuite} implementation
 *
 * @class
 */
module.exports.Key = class {

	/**
	 * Returns the subject key identifier of this key
	 *
	 * @returns {string} The subject key identifier of this key as a hexidecial encoded string
	 */
	getSKI() {}

	/**
	 * Returns true if this key is a symmetric key, false is this key is asymmetric
	 *
	 * @returns {boolean} if this key is a symmetric key
	 */
	isSymmetric() {}

	/**
	 * Returns true if this key is an asymmetric private key, false otherwise.
	 *
	 * @returns {boolean} if this key is an asymmetric private key
	 */
	isPrivate() {}

	/**
	 * Returns the corresponding public key if this key is an asymmetric private key.
	 * If this key is already public, returns this key itself.
	 *
	 * @returns {module:api.Key} the corresponding public key if this key is an asymmetric private key.
	 * If this key is already public, returns this key itself.
	 */
	getPublicKey() {}

	/**
	 * Converts this key to its PEM representation, if this operation is allowed.
	 *
	 * @returns {string} the PEM string representation of the key
	 */
	toBytes() {}
};

module.exports.CryptoAlgorithms = {
	// ECDSA Elliptic Curve Digital Signature Algorithm (key gen, import, sign, verify),
	// at default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	ECDSA: 'ECDSA',
	// ECDSA Elliptic Curve Digital Signature Algorithm over P-256 curve
	ECDSAP256: 'ECDSAP256',
	// ECDSA Elliptic Curve Digital Signature Algorithm over P-384 curve
	ECDSAP384: 'ECDSAP384',
	// ECDSAReRand ECDSA key re-randomization
	ECDSAReRand: 'ECDSA_RERAND',

	// RSA at the default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	RSA: 'RSA',
	// RSA at 1024 bit security level.
	RSA1024: 'RSA1024',
	// RSA at 2048 bit security level.
	RSA2048: 'RSA2048',
	// RSA at 3072 bit security level.
	RSA3072: 'RSA3072',
	// RSA at 4096 bit security level.
	RSA4096: 'RSA4096',

	// AES Advanced Encryption Standard at the default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	AES: 'AES',
	// AES Advanced Encryption Standard at 128 bit security level
	AES128: 'AES128',
	// AES Advanced Encryption Standard at 192 bit security level
	AES192: 'AES192',
	// AES Advanced Encryption Standard at 256 bit security level
	AES256: 'AES256',

	// HMAC keyed-hash message authentication code
	HMAC: 'HMAC',
	// HMACTruncated256 HMAC truncated at 256 bits.
	HMACTruncated256: 'HMAC_TRUNCATED_256',

	// SHA Secure Hash Algorithm using default family.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	SHA: 'SHA',
	// SHA256
	SHA256: 'SHA256',
	// SHA384
	SHA384: 'SHA384',
	// SHA256
	SHA2_256: 'SHA256',
	// SHA384
	SHA2_384: 'SHA384',
	// SHA3_256
	SHA3_256: 'SHA3_256',
	// SHA3_384
	SHA3_384: 'SHA3_384',

	// X509Certificate Label for X509 certificate related operation
	X509Certificate: 'X509Certificate'
};

/**
 * Base class for hash primitives.
 * @type {Hash}
 */
module.exports.Hash = class {
	constructor(blockSize) {
		this._blockSize = blockSize;
		this.reset();
	}

	hash(data) {
		return this.reset().update(data).finalize();
	}

	reset() {
		return this;
	}

	update(data) {
		this._hash.update(data);
		return this;
	}

	finalize() {
	}
};

/**
 * Base class for endorsement handling
 * @class
 */
module.exports.EndorsementHandler = class {

	/**
	 * @typedef {Object} EndorsementHandlerParameters
	 * @property {Object} request - {@link ChaincodeInvokeRequest}
	 * @property {Object} signed_proposal - the encoded protobuf "SignedProposal"
	 *           created by the sendTransactionProposal method before calling the
	 *           handler. Will be the object to be endorsed by the target peers.
	 * @property {Number} timeout - the timeout setting passed on sendTransactionProposal
	 *           method.
	 */

	/**
	 * This method will process the request object to calculate the target peers.
	 * Once the targets have been determined, the channel to send the endorsement
	 * transaction to all targets. The results will be analyzed to see if
	 * enough completed endorsements have been received.
	 *
	 * @param {EndorsementHandlerParameters} params - A {@link EndorsementHandlerParameters}
	 *        that contains enough information to determine the targets and contains
	 *        a {@link ChaincodeInvokeRequest} to be sent using the included channel
	 *        with the {@link Channel} 'sendTransactionProposal' method.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}, the
	 *        same results as calling the {@link Channel} 'sendTransactionProposal'
	 *        method directly.
	 */
	endorse(params) {
		if (params) {
			throw new Error('The "endorse" method must be implemented');
		}
		throw new Error('The "endorse" method must be implemented');
	}

	/**
	 * This method will be called by the channel when the channel is initialzied.
	 */
	initialize() {
		throw new Error('The "initialize" method must be implemented');
	}

	/**
	 * This static method will be called by the channel to create an instance of
	 * this handler. It will be passed the channel object this handler is working
	 * with.
	 */
	static create(channel) {
		if (channel) {
			throw new Error('The "create" method must be implemented');
		}
		throw new Error('The "create" method must be implemented');
	}
};

/**
 * Base class for commit handling
 * @class
 */
module.exports.CommitHandler = class {

	/**
	 * @typedef {Object} CommitHandlerParameters
	 * @property {Object} request - {@link TransactionRequest}
	 * @property {Object} signed_envelope - An object that will be sent to the
	 *           orderer that contains the encoded endorsed proposals and the
	 *           signature of the sender.
	 * @property {Number} timeout - the timeout setting passed on sendTransaction
	 *           method.
	 */

	/**
	 * This method will process the parameters to determine the orderers.
	 * The handler will use the provided orderers or use the orderers assigned to
	 * the channel. The handler is expected to preform failover and use all available
	 * orderers to send the endorsed transaction.
	 *
	 * @param {CommitHandlerParameters} params - A {@link EndorsementHandlerParameters}
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}, the
	 *        same results as calling the {@link Channel} 'sendTransactionProposal'
	 *        method directly.
	 */
	commit(params) {
		if (params) {
			throw new Error('The "commit" method must be implemented');
		}
		throw new Error('The "commit" method must be implemented');
	}

	/**
	 * This method will be called by the channel when the channel is initialzied.
	 */
	initialize() {
		throw new Error('The "initialize" method must be implemented');
	}

	/**
	 * This static method will be called by the channel to create an instance of
	 * this handler. It will be passed the channel object this handler is working
	 * with.
	 */
	static create(channel) {
		if (channel) {
			throw new Error('The "create" method must be implemented');
		}
		throw new Error('The "create" method must be implemented');
	}
};
