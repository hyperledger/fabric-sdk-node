/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

/**
 * This module defines the API for the pluggable components of the node.js SDK. The APIs are defined
 * according to the Hyperledger Fabric's [common SDK specification]{@link https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing}
 *
 * @module api
 */

var utils = require('./utils.js');
var Remote = require('./Remote');

/**
 * Abstract class for a Key-Value store. The Chain class uses this store
 * to save sensitive information such as authenticated user's private keys,
 * certificates, etc.
 *
 * The SDK provides a default implementation based on files. An alternative
 * implementation can be specified using the "KEY_VALUE_STORE" environment
 * variable pointing to a full path to the require() package for the module.
 *
 * @class
 */
module.exports.KeyValueStore = class {

	/**
	 * Get the value associated with name.
	 *
	 * @param {string} name of the key
	 * @returns Promise for the value corresponding to the key
	 */
	getValue(name) {}

	/**
	 * Set the value associated with name.
	 * @param {string} name of the key to save
	 * @param {string} value to save
	 * @returns {Promise} Promise for a "true" value upon successful write operation
	 */
	setValue(name, value) {}

};

/**
 * Abstract class for a suite of crypto algorithms used by the SDK to perform encryption,
 * decryption and secure hashing. A complete suite includes libraries for asymmetric
 * keys (such as ECDSA or RSA), symmetric keys (such as AES) and secure hash (such as
 * SHA2/3).
 *
 * The SDK provides a default implementation based on ECDSA + AES + SHA2/3. An alternative
 * implementation can be specified using the "CRYPTO_SUITE" environment variable, pointing
 * to a full path to the require() package for the module.
 *
 * @class
 */
module.exports.CryptoSuite = class {

	constructor() {
		/**
		 * what's a good description for this property?
		 * @member {string}
		 */
		this.TCertEncTCertIndex = '1.2.3.4.5.6.7';
	}

	/**
	 * Returns the supported asymmetric key algorithms that this suite represents
	 *
	 * @returns {string} The algorithm name such as "ECDSA", "RSA" etc.
	 */
	getPublicKeyAlgorithm() {}

	/**
	 * Get the security level of the asymmetric keys algorithm, which corresponds to the
	 * length of the key
	 *
	 * @returns {number} The security level
	 */
	getSecurityLevel() {}

	/**
	 * Set the security level of the asymmetric keys algorithm
	 *
	 * @param {number} securityLevel The security level
	 */
	setSecurityLevel(securityLevel) {}

	/**
	 * Get the hash algorithm (such as SHA2, SHA3)
	 *
	 * @returns {string} The hash algorithm
	 */
	getHashAlgorithm() {}

	/**
	 * Set the hash algorithm
	 *
	 * @param {string} hashAlgorithm The hash algorithm
	 */
	setHashAlgorithm(hashAlgorithm) {}

	/**
	 * Generate a nonce to use as one-time state key. Size of the nonce
	 * is determined by the crypto suite implementation
	 *
	 * @returns {byte[]} the random number
	 */
	generateNonce() {}

	/**
	 * Generate asymmetric key pair
	 *
	 * @returns {Object} an associative array which has the following parameters:
	 *   prvKeyObj - RSAKey or ECDSA object of private key
	 *   pubKeyObj - RSAKey or ECDSA object of public key
	 */
	generateKeyPair() {}

	/**
	 * Decrypt, using the private key of an asymmetric key pair, a cipher that was
	 * encrypted with the public key of the key pair
	 *
	 * @returns {byte[]} Decripted bytes
	 */
	asymmetricDecrypt(recipientPrivateKey, cipherText) {}

	/**
	 * Packages the encoded private key into a key pair to use for
	 * signing
	 *
	 * @param {string} privateKey the encoded private key.  For
	 *        example, prvKeyHex of keyPair.prvKeyObj.prvKeyHex.
	 * @param {string} encoding "hex" or other encoding scheme
	 * @returns {Object} an associative array which has the following parameters:
	 *   priv - RSAKey or ECDSA object of private key prvKeyObj
	 *   pub - null, as only the private key is needed for signing
	 */
	getKeyPairForSigning(privateKey, encoding) {}

	/**
	 * Packages the public key into a key pair to use for encryption
	 *
	 * @param {string} publicKey the encoded public key.  For
	 *        example, pubKeyHex of keyPair.pubKeyObj.pubKeyHex.
	 * @param {string} encoding "hex" or other encoding scheme
	 * @returns {Object} an associative array which has the following parameters:
     *   priv - null, as only the public key is needed for encryption
     *   pub - RSAKey or ECDSA object of public key
	 */
	getKeyPairForEncryption(publicKey, encoding) {}

	/**
	 * Signs the message with digital signature
	 *
	 * @param {Buffer} key The key pair object as an associative array with the following parameters:
	 *   prvKeyObj - RSAKey or ECDSA object of private key
	 *   pubKeyObj - null, as only the private key is needed for signing
	 * @param {Buffer} msg The message content to be signed
	 * @returns {Object} the signature
	 */
	sign(key, msg) {}

	/**
	 * Loads a public key object from a PEM encoded certificate
	 *
	 * @param {string} pem HEX encoded string of a PEM certificate
	 * @returns {Object} public key object specific to the algorithm
	 */
	getPublicKeyFromPEM(pem) {}

	ecdsaPrivateKeyToASN1(prvKeyHex /*string*/ ) {}
	eciesEncryptECDSA(ecdsaRecipientPublicKey, msg) {}
	eciesKeyGen() {}
	eciesEncrypt(recipientPublicKey, msg) {}
	hmac(key, bytes) {}
	aesCBCPKCS7Decrypt(key, bytes) {}
	aes256GCMDecrypt(key /*Buffer*/ , ct /*Buffer*/ ) {}
	aesKeyGen() {}
	hmacAESTruncated(key, bytes) {}

};

/**
 * Represents enrollment data for a user.
 *
 * @class
 */
module.exports.Enrollment = class {

	constructor(key, cert, chainKey) {
		/**
		 * @member {Buffer} privateKey private key generated locally by the SDK
		 * @memberof module:api.Enrollment.prototype
		 */
		this.privateKey = key;

		/**
		 * @member {string} certificate HEX encoded string for the certificate issued by member services after successful enrollment
		 * @memberof module:api.Enrollment.prototype
		 */
		this.certificate = cert;

		/**
		 * @member {string} chainEncryptionKey HEX encoded string for public encryption key used to optionally encrypt content
		 * sent to endorsers and validators
		 * @memberof module:api.Enrollment.prototype
		 */
		this.chainEncryptionKey = chainKey;
	}
};

/**
 * The member services client. Can add new users to the member service's user registry ("Register"),
 * and exchange one-time passwords for enrollment certificates ("Enroll"). It also downloads TCerts
 * for an enrolled user.
 *
 * @class
 */
module.exports.MemberServices = class extends Remote {

	/**
	 * Get the key length of the asymmetric key algorithm in effect
	 *
	 * @returns {number} The key length, for instance "256" or "384"
	 */
	getSecurityLevel() {}

	/**
	 * Set the key length of the asymmetric key algorithm in effect, it must be one that is supported
	 * by the current crypto suite.
	 *
	 * @params {number} securityLevel The key length for the asymmetric key algorithm, for instance "256" or "384"
	 */
	setSecurityLevel(securityLevel) {}

	/**
	 * Get the secure hash algorithm in effect, for instance "SHA2" or "SHA3"
	 *
	 * @returns {string} The secure hash algorithm
	 */
	getHashAlgorithm() {}

	/**
	 * Set the secure hash algorithm in effect, for instance "SHA2" or "SHA3". It must be one that is
	 * supported by the current crypto suite.
	 *
	 * @params {string} securityLevel The secure hash algorithm
	 */
	setHashAlgorithm(hashAlgorithm) {}

	/**
	 * Add the member to the user registry and return an enrollment secret to be used later one to exchange
	 * for enrollment certificate.
	 *
	 * @param {Object} req Registration request with the following fields:
	 *
	 *	    enrollmentID: {string} The enrollment ID of the member,
	 *
	 *	    roles: {string[]} Roles associated with this member. One of 'client', 'peer', 'validator', 'auditor'. Default: ["client"],
	 *
	 *	    affiliation: {string} what organization this user belongs to,
	 *
	 *	    registrar: {Object} registrar enables this identity to register other members and can delegate the 'delegationRoles' roles
	 *
	 *	        roles: {string[]} The allowable roles which this member can register
	 *
	 *	        delegateRoles: {string[]} The allowable roles which can be registered by members registered by this member
	 *
	 * @param {Member} registrar The identity of the registar (i.e. who is performing the registration)
	 * @returns Promise for the enrollment secret
	 */
	register(req, registrar) {}

	/**
	 * Exchange the one-time password, a.k.a the enrollment secrete, for enrollment certificate.
	 *
	 * User enrollment is a two step process.
	 * 1) Send a create Certificate request to the server with two public keys:
	 *    - A signature key that will be used to verify the signature of the keys
	 *    - An encryption key that will be used to encrypt the data
	 *
	 * In response to this request, server creates a challenge and sends it to the client after encrypting it with
	 * the encryption public key to ensure that the client is in possession of the encryption private key
	 *
	 * 2) Client decrypts the token returned by the server in step 1, adds it to the request, creates the signature
	 * with the signing private key and sends another Create Certificate request to the server. Server verifies that
	 * signature and decrypted token is correct, server sends enrollment certificates to the client.
	 *
	 * @param {Object} req Enrollment request with the following fields:
	 *
	 *	    enrollmentID: {string} The enrollment ID,
	 *
	 *	    enrollmentSecret: {string} The enrollment secret (a one-time password)
	 *
	 * @returns Promise for [Enrollment]{@link module:api.Enrollment}
	 */
	enroll(req) {}

	/**
	 * Get an array of transaction certificates (tcerts).
	 *
	 * @param {Object} req A request object with the following fields:
	 *
	 *	    name: {string} name of the user
	 * 		enrollment: [Enrollment]{@link module:api.Enrollment} an object representing the user to get the TCerts for,
	 * 		num: {number} batch size,
	 *		attrs: {string[]} the list of user attributes to include in the TCerts
	 *
	 * @returns Promise for array of [TCert]{@link module:api.TCert}
	 */
	getTCertBatch(req) {}

};

/**
 * @class
 */
module.exports.PrivacyLevel = {
	/**
	 * @member {constant} Nominal Representing a certain identity
	 * @memberof module:api.PrivacyLevel
	 */
	Nominal: 0,

	/**
	 * @member {constant} Anonymous Anonymous
	 * @memberof module:api.PrivacyLevel
	 */
	Anonymous: 1
};

/**
 * The base Certificate class
 *
 * @class
 */
module.exports.Certificate = class {

	constructor(cert, privateKey, privacyLevel) {
		/**
		 * @member {buffer} cert The certificate
		 * @memberof module:api.Certificate
		 */
		this._cert = cert;

		/**
		 * @member {buffer} privateKey The private key
		 * @memberof module:api.Certificate
		 */
		this._privateKey = privateKey;

		/**
		 * @member {module:api.PrivacyLevel} privacyLevel - Denoting if the Certificate is anonymous or carrying its owner's identity.
		 * @memberof module:api.Certificate
		 */
		this._privacyLevel = privacyLevel;
	}

	encode() {
		return this._cert;
	}
};

/**
 * Enrollment certificate. These certificates are nominal.
 *
 * @class
 */
module.exports.ECert = class extends module.exports.Certificate {

	constructor(cert, privateKey) {
		super(cert, privateKey, module.exports.PrivacyLevel.Nominal);
	}

};

/**
 * Transaction certificate. These certificates are anonymous.
 *
 * @class
 */
module.exports.TCert = class extends module.exports.Certificate {

	constructor(publicKey, privateKey) {
		super(publicKey, privateKey, module.exports.PrivacyLevel.Anonymous);
	}
};

