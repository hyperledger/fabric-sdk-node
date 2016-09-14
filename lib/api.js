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

/**
 * This module defined the API surface for node.js SDK. The APIs are defined
 * according to the Hyperledger Fabric's [common SDK specification]{@link https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing}
 *
 * @module api
 */

var Base = require('./base.js');

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
module.exports.KeyValueStore = Base.extend(/** @lends module:api.KeyValueStore.prototype */{

    /**
     * Get the value associated with name.
     *
     * @param {string} name of the key
     * @returns Promise for the value corresponding to the key
     */
    getValue: function(name) {},

    /**
     * Set the value associated with name.
     * @param {string} name of the key to save
     * @param {string} value to save
     * @returns {Promise} Promise for a "true" value upon successful write operation
     */
    setValue(name, value) {}

});

/**
 * Abstract class for a suite of crypto algorithms used by the SDK to perform encryption,
 * decryption and secure hashing. A complete suite includes libraries for asymmetric
 * keys (such as ECDSA or RSA), symmetric keys (such as AES) and secure hash (such as 
 * SHA2/3)
 *
 * @class
 */
module.exports.CryptoSuite = Base.extend(/** @lends module:api.CryptoSuite.prototype */{

    /**
     * what's a suitable description of this property?
     */
    TCertEncTCertIndex: "1.2.3.4.5.6.7",

    /**
     * Get the security level of the asymmetric keys algorithm, which corresponds to the
     * length of the key
     *
     * @returns {number} The security level
     */
    getSecurityLevel: function() {},

    /**
     * Set the security level of the asymmetric keys algorithm
     *
     * @param {number} securityLevel The security level
     */
    setSecurityLevel: function(securityLevel) {},

    /**
     * Get the hash algorithm (such as SHA2, SHA3)
     *
     * @returns {string} The hash algorithm
     */
    getHashAlgorithm: function() {},

    /**
     * Set the hash algorithm
     *
     * @param {string} hashAlgorithm The hash algorithm
     */
    setHashAlgorithm: function(hashAlgorithm /*string*/ ) {},

    /**
     * Generate a nonce to use as one-time state key. Size of the nonce
     * is determined by the crypto suite implementation
     *
     * @returns {byte[]} the random number
     */
    generateNonce: function() {},

    ecdsaKeyFromPrivate: function(key, encoding) {},

    ecdsaKeyFromPublic: function(key, encoding) {},

    ecdsaPrivateKeyToASN1: function(prvKeyHex /*string*/ ) {},

    ecdsaSign: function(key /*Buffer*/ , msg /*Buffer*/ ) {},

    ecdsaPEMToPublicKey: function(chainKey) {},

    eciesEncryptECDSA: function(ecdsaRecipientPublicKey, msg) {},

    ecdsaKeyGen: function() {},

    eciesKeyGen: function() {},

    eciesEncrypt: function(recipientPublicKey, msg) {},

    eciesDecrypt: function(recipientPrivateKey, cipherText) {},

    hmac: function(key, bytes) {},

    aesCBCPKCS7Decrypt: function(key, bytes) {},

    aes256GCMDecrypt(key /*Buffer*/ , ct /*Buffer*/ ) {},

    aesKeyGen: function() {},

    hmacAESTruncated: function(key, bytes) {}

});

/**
 * A model to represent x.509 certificate
 *
 * @class
 */
module.exports.X509Certificate = Base.extend(/** @lends module:api.X509Certificate.prototype */{

    /**
     * What would be a suitable description of this method?
     *
     * @param {Object} Object ID
     */
    criticalExtension: function(oid) {}

});

/**
 * Represents enrollment data for a user.
 *
 * @class 
 */
module.exports.Enrollment = Base.extend(/** @lends module:api.Enrollment.prototype */{
    /**
     * @property {Buffer} key private key generated locally by the SDK
     */
    key: null,

    /**
     * @property {string} cert certificate issued by member services after successful enrollment
     */
    cert: "",

    /**
     * @property {string} chainKey what's the best description for this?
     */
    chainKey: ""
});

/**
 * A member is an entity that transacts on a chain.
 * Types of members include end users, peers, etc.
 */
module.exports.Member = Base.extend({


});

module.exports.MemberServices = Base.extend({

    /**
     * Get the security level
     * @returns The security level
     */
    getSecurityLevel: function() {},

    /**
     * Set the security level
     * @params securityLevel The security level
     */
    setSecurityLevel: function(securityLevel /*number*/ ) {},

    /**
     * Get the hash algorithm
     * @returns The security level
     */
    getHashAlgorithm: function() {},

    /**
     * Set the security level
     * @params securityLevel The security level
     */
    setHashAlgorithm: function(hashAlgorithm /*string*/ ) {},

    /**
     * Register the member and return an enrollment secret.
     * @param req Registration request with the following fields:
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
     * @param registrar The identity of the registar (i.e. who is performing the registration)
     * @returns promise for enrollmentSecret
     */
    register: function(req /*RegistrationRequest*/ , registrar /*Member*/ ) {},

    /**
     * Enroll the member and return an opaque member object
     * @param req Enrollment request with the following fields:
	 *
	 *	    // The enrollment ID
	 *	    enrollmentID: "",
	 *
	 *	    // The enrollment secret (a one-time password)
	 *	    enrollmentSecret: ""
     *
     * @returns promise for Enrollment
     */
    enroll: function(req /*EnrollmentRequest*/ ) {},

    /**
     * Get an array of transaction certificates (tcerts).
     * @param req A GetTCertBatchRequest:
	 *
	 *	    name: string, 
	 * 		enrollment: an Enrollment object, 
	 * 		num: a number, 
	 *		attrs: a string[]
     *
     * @returns promise for TCert[]
     */
    getTCertBatch: function(req /*GetTCertBatchRequest*/ ) {}

});

module.exports.PrivacyLevel = {
    Nominal: 0,
    Anonymous: 1
};

/**
 * The base Certificate class
 */
module.exports.Certificate = Base.extend({

	/** 
	 * @param privacyLevel - Denoting if the Certificate is anonymous or carrying its owner's identity. 
	 */
    constructor: function(cert /*Buffer*/, privateKey, privLevel /*PrivacyLevel*/) {
    	this._cert = cert;
    	this._privateKey = privateKey;
    	this._privacyLevel = privacyLevel;
    },

    encode: function() {
        return this._cert;
    }
});

/**
 * Enrollment certificate.
 */
module.exports.ECert = module.exports.Certificate.extend({

    constructor: function(cert /*Buffer*/, privateKey) {
        module.exports.Certificate.prototype.constructor(cert, privateKey, module.exports.PrivacyLevel.Nominal);
    }

});

/**
 * Transaction certificate.
 */
module.exports.TCert = module.exports.Certificate.extend({
    
    constructor: function(publicKey, privateKey) {
        module.exports.Certificate.prototype.constructor(publicKey, privateKey, module.exports.PrivacyLevel.Anonymous);
    }
});

/**
 *
 * @class
 */
module.exports.Chain = Base.extend({

});

module.exports.Peer = Base.extend({
    /**
     * Get the chain of which this peer is a member.
     * @returns {Chain} The chain of which this peer is a member.
     */
    getChain: function() {},

    /**
     * Get the URL of the peer.
     * @returns {string} Get the URL associated with the peer.
     */
    getUrl: function() {},

    /**
     * Send a transaction to this peer.
     * @param tx A transaction
     * @param eventEmitter The event emitter
     */
    sendTransaction: function(tx, eventEmitter) {}

});

