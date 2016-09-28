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
 * This module defined the API surface for node.js SDK. The APIs are defined
 * according to the Hyperledger Fabric's [common SDK specification]{@link https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing}
 *
 * @module api
 */

var utils = require('./utils.js');

/**
 * Abstract class for a Key-Value store. The Chain class uses this store
 * to save sensitive information such as authenticated user's private keys,
 * certificates, etc.
 *
 * The SDK provides a default implementation based on files. An alternative
 * implementation can be specified using the "KEY_VALUE_STORE" environment
 * variable pointing to a full path to the require() package.
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
 * SHA2/3)
 *
 * @class
 */
module.exports.CryptoSuite = class {

    constructor() {
        /**
         * what's a good description for this property?
         * @member {string}
         */
        this.TCertEncTCertIndex = "1.2.3.4.5.6.7";
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
     * Packages the private key into a key pair to use for signing
     *
     * @param {string} privateKey the private key
     * @param {string} encoding "hex" or other encoding scheme
     * @returns {Object} an associative array which has the following parameters:
     *   prvKeyObj - RSAKey or ECDSA object of private key
     *   pubKeyObj - null, as only the private key is needed for signing
     */
    getKeyPairForSigning(privateKey, encoding) {}

    /**
     * Packages the public key into a key pair to use for encryption
     *
     * @param {string} publicKey the public key
     * @param {string} encoding "hex" or other encoding scheme
     * @returns {Object} an associative array which has the following parameters:
     *   prvKeyObj - null, as only the public key is needed for encryption
     *   pubKeyObj - RSAKey or ECDSA object of public key
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


    ecdsaPrivateKeyToASN1(prvKeyHex /*string*/ ) {}
    ecdsaPEMToPublicKey(chainKey) {}
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
 * A model to represent x.509 certificate
 *
 * @class
 */
module.exports.X509Certificate = class {

    /**
     * What would be a suitable description of this method?
     *
     * @param {Object} Object ID
     */
    criticalExtension(oid) {}

};

/**
 * Represents enrollment data for a user.
 *
 * @class 
 */
module.exports.Enrollment = class {
    
    constructor() {
        /**
         * @member {Buffer} key private key generated locally by the SDK
         * @memberof module:api.Enrollment.prototype
         */
        this.key = null;

        /**
         * @member {string} cert certificate issued by member services after successful enrollment
         * @memberof module:api.Enrollment.prototype
         */
        this.cert = "";

        /**
         * @member {string} chainKey what's the best description for this?
         * @memberof module:api.Enrollment.prototype
         */
        this.chainKey = "";
    }
};

/**
 * A member is an entity that transacts on a chain.
 * Types of members include end users, peers, etc.
 */
module.exports.Member = class {


};

module.exports.MemberServices = class {

    /**
     * Get the security level
     * @returns The security level
     */
    getSecurityLevel() {}

    /**
     * Set the security level
     * @params securityLevel The security level
     */
    setSecurityLevel(securityLevel /*number*/ ) {}

    /**
     * Get the hash algorithm
     * @returns The security level
     */
    getHashAlgorithm() {}

    /**
     * Set the security level
     * @params {string }securityLevel The security level
     */
    setHashAlgorithm(hashAlgorithm) {}

    /**
     * Register the member and return an enrollment secret.
     * @param {Object} req Registration request with the following fields:
	 *
	 *	    // The enrollment ID of the member
	 *	    enrollmentID: "",
	 *
	 *	    // Roles associated with this member.
	 *	    // Fabric roles include: 'client', 'peer', 'validator', 'auditor'
	 *	    // Default value: ['client']
	 *	    roles: ["client"],
	 *
	 *	    // Affiliation for a user
	 *	    affiliation: "",
	 *
	 *	    // 'registrar' enables this identity to register other members with types
	 *	    // and can delegate the 'delegationRoles' roles
	 *	    registrar:
	 *	        // The allowable roles which this member can register
	 *	        roles: null, //string[]
	 *
	 *	        // The allowable roles which can be registered by members registered by this member
	 *	        delegateRoles: null //string[]
	 *	    
     * @param {Member} registrar The identity of the registar (i.e. who is performing the registration)
     * @returns promise for enrollmentSecret
     */
    register(req, registrar) {}

    /**
     * Enroll the member and return an opaque member object
     * @param {Object} req Enrollment request with the following fields:
	 *
	 *	    // The enrollment ID
	 *	    enrollmentID: "",
	 *
	 *	    // The enrollment secret (a one-time password)
	 *	    enrollmentSecret: ""
     *
     * @returns promise for Enrollment
     */
    enroll(req) {}

    /**
     * Get an array of transaction certificates (tcerts).
     * @param {Object} req A GetTCertBatchRequest:
	 *
	 *	    name: string, 
	 * 		enrollment: an Enrollment object, 
	 * 		num: a number, 
	 *		attrs: a string[]
     *
     * @returns promise for TCert[]
     */
    getTCertBatch(req) {}

};

module.exports.PrivacyLevel = {
    Nominal: 0,
    Anonymous: 1
};

/**
 * The base Certificate class
 */
module.exports.Certificate = class {

	/** 
	 * @param privacyLevel - Denoting if the Certificate is anonymous or carrying its owner's identity. 
	 */
    constructor(cert /*Buffer*/, privateKey, privLevel /*PrivacyLevel*/) {
    	this._cert = cert;
    	this._privateKey = privateKey;
    	this._privacyLevel = privacyLevel;
    }

    encode() {
        return this._cert;
    }
};

/**
 * Enrollment certificate.
 */
module.exports.ECert = class extends module.exports.Certificate {

    constructor(cert /*Buffer*/, privateKey) {
        super(cert, privateKey, module.exports.PrivacyLevel.Nominal);
    }

};

/**
 * Transaction certificate.
 */
module.exports.TCert = class extends module.exports.Certificate {
    
    constructor(publicKey, privateKey) {
        super(publicKey, privateKey, module.exports.PrivacyLevel.Anonymous);
    }
};

/**
 *
 * @class
 */
module.exports.Chain = class {

    constructor() {
        /**
         * @member {api.CryptoSuite} cryptoPrimitives The crypto primitives object provides access to the crypto suite
         * for functions like sign, encrypt, decrypt, etc.
         * @memberof module:api.Chain.prototype
         */
        this.cryptoPrimitives = utils.getCryptoSuite();
    }

};

module.exports.Peer = class {
    /**
     * Get the chain of which this peer is a member.
     * @returns {Chain} The chain of which this peer is a member.
     */
    getChain() {}

    /**
     * Get the URL of the peer.
     * @returns {string} Get the URL associated with the peer.
     */
    getUrl() {}

    /**
     * Send a transaction to this peer.
     * @param tx A transaction
     * @param eventEmitter The event emitter
     */
    sendTransaction(tx, eventEmitter) {}

};

