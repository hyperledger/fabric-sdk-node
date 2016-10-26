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

var aesjs = require('aes-js');
var crypto = require('crypto');
var elliptic = require('elliptic');
var EC = elliptic.ec;
var sha3_256 = require('js-sha3').sha3_256;
var sha3_384 = require('js-sha3').sha3_384;
var sjcl = require('sjcl');
var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;
var util = require('util');
var hashPrimitives = require('../hash.js');
var certParser = require('../utils-x509cert.js')();
var utils = require('../utils');

// constants
const SHA2 = 'SHA2';
const SHA3 = 'SHA3';
const NonceSize = 24;
const AESKeyLength = 32;
const HMACKeyLength = 32;
const BlockSize = 16;

const GCMTagSize = 16;
const GCMStandardNonceSize = 12;

const ECIESKDFOutput = 512; // bits
const IVLength = 16; // bytes
const AESBlockLength = 16;

const CURVE_P_256_Size = 256;
const CURVE_P_384_Size = 384;

const DEFAULT_HASH_ALGORITHM = 'SHA3';
const DEFAULT_SECURITY_LEVEL = 256;

// the string in the certificate after 'BEGIN'
const PEM_HEADER_PUBLIC_KEY = 'ECDSA PUBLIC KEY';

var logger = utils.getLogger('crypto_ecdsa_sha');

/**
 * The crypto suite implementation for ECDSA, AES and SHA algorithms.
 *
 * @class
 */
var CryptoSuite_ECDSA_SHA = class extends api.CryptoSuite {

	/**
	 * constructor
	 */
	constructor() {
		super();
		this._hashAlgorithm = DEFAULT_HASH_ALGORITHM;
		this._securityLevel = DEFAULT_SECURITY_LEVEL;
		this._curveName = '';
		this._suite = '';
		this._hashFunction = null;
		this._hashFunctionKeyDerivation = null;
		this._hashOutputSize = -1;
		this._ecdsaCurve = null;

		this._initialize();
	}

	/**
	 * must match one of the values in ca.proto
	 * @ignore
	 */
	getPublicKeyAlgorithm() {
		return 'ECDSA';
	}

	/**
	 * Get the security level
	 * @returns The security level
	 * @ignore
	 */
	getSecurityLevel() {
		return this._securityLevel;
	}

	/**
	 * Set the security level
	 * @params securityLevel The security level
	 * @ignore
	 */
	setSecurityLevel(securityLevel) {
		this._checkSecurityLevel(securityLevel);

		this._securityLevel = securityLevel;
		this._initialize();
	}

	/**
	 * Get the hash algorithm
	 * @returns {string} The hash algorithm
	 * @ignore
	 */
	getHashAlgorithm() {
		return this._hashAlgorithm;
	}

	/**
	 * Set the hash algorithm
	 * @params hashAlgorithm The hash algorithm ('SHA2' or 'SHA3')
	 * @ignore
	 */
	setHashAlgorithm(hashAlgorithm) {
		CryptoSuite_ECDSA_SHA._checkHashFunction(hashAlgorithm);

		this._hashAlgorithm = hashAlgorithm;
		this._initialize();
	}

	generateNonce() {
		return crypto.randomBytes(NonceSize);
	}

	generateKeyPair() {
		return KEYUTIL.generateKeypair('EC', this._curveName);
	}

	asymmetricDecrypt(recipientPrivateKey, cipherText) {
		var self = this;

		logger.debug('recipientPrivateKey=%s', util.inspect(recipientPrivateKey));
		var level = recipientPrivateKey.ecparams.keylen;

		if (this._securityLevel != level) {
			throw Error('Invalid key. It\'s security does not match the current security level ' +  this._securityLevel + ' ' + level);
		}
		//cipherText = ephemeralPubKeyBytes + encryptedTokBytes + macBytes
		//ephemeralPubKeyBytes = first ((384+7)/8)*2 + 1 bytes = first 97 bytes
		//hmac is sha3_384 = 48 bytes or sha3_256 = 32 bytes
		var Rb_len = Math.floor((level + 7) / 8) * 2 + 1;
		var D_len = level >> 3;
		var ct_len = cipherText.length;

		if (ct_len <= Rb_len + D_len)
			throw new Error('Illegal cipherText length: ' + ct_len + ' must be > ' + (Rb_len + D_len));

		var Rb = cipherText.slice(0, Rb_len);  // ephemeral public key bytes
		var EM = cipherText.slice(Rb_len, ct_len - D_len);  // encrypted content bytes
		var D = cipherText.slice(ct_len - D_len);

		logger.debug('Rb :\n%s', new Buffer(Rb).toString('hex'));
		logger.debug('EM :\n%s', new Buffer(EM).toString('hex'));
		logger.debug('D  :\n%s', new Buffer(D).toString('hex'));

		var EC = elliptic.ec;
		var ecdsa = new EC('p' + level);

		//convert bytes to usable key object
		var ephPubKey = ecdsa.keyFromPublic(new Buffer(Rb, 'hex'), 'hex');
		var privKey = ecdsa.keyFromPrivate(recipientPrivateKey.prvKeyHex, 'hex');
		logger.debug('computing Z... %s, %s', privKey, ephPubKey);

		var Z = privKey.derive(ephPubKey.pub);
		logger.debug('Z computed: %s', Z);
		logger.debug('Shared secret:  ', new Buffer(Z.toArray(), 'hex'));
		var kdfOutput = self._hkdf(Z.toArray(), ECIESKDFOutput, null, null);
		// obtain the encryption key used to decrypt the token bytes
		var aesKey = kdfOutput.slice(0, AESKeyLength);
		// obtain the hashing key for verifying the token bytes with MAC
		var hmacKey = kdfOutput.slice(AESKeyLength, AESKeyLength + HMACKeyLength);
		logger.debug('aesKey:  ', new Buffer(aesKey, 'hex'));
		logger.debug('hmacKey: ', new Buffer(hmacKey, 'hex'));

		var recoveredD = self.hmac(hmacKey, EM);
		logger.debug('recoveredD:  ', new Buffer(recoveredD).toString('hex'));

		if (D.compare(new Buffer(recoveredD)) != 0) {
			// debug('D='+D.toString('hex')+' vs '+new Buffer(recoveredD).toString('hex'));
			throw new Error('HMAC verify failed when trying to decrypt token challenge during user enrollment');
		}
		var iv = EM.slice(0, IVLength);
		var cipher = crypto.createDecipheriv('aes-256-cfb', new Buffer(aesKey), iv);
		var decryptedBytes = cipher.update(EM.slice(IVLength));
		logger.debug('decryptedBytes: ',new Buffer(decryptedBytes).toString('hex'));
		return decryptedBytes;
	}

	getKeyPairForSigning(key, encoding) {
		// select curve and hash algo based on level
		var keypair = new EC(this._ecdsaCurve).keyFromPrivate(key, encoding);
		logger.debug('keypair: ', keypair);
		return keypair;
	}

	getKeyPairForEncryption(key, encoding) {
		var publicKey = new EC(this._ecdsaCurve).keyFromPublic(key, encoding);
		logger.debug('publicKey: [%j]', publicKey);
		return publicKey;
	}

	sign(key, msg) {
		var ecdsa = new EC(this._ecdsaCurve);
		var signKey = ecdsa.keyFromPrivate(key, 'hex');
		var sig = ecdsa.sign(new Buffer(this._hashFunction(msg), 'hex'), signKey);
		logger.debug('ecdsa signature: ', sig);
		return sig;
	}

	getPublicKeyFromPEM(chainKey) {
		// enrollChainKey is a PEM. Extract the key from it.
		var pem = new Buffer(chainKey, 'hex').toString();
		logger.debug('ChainKey %s', pem);
		chainKey = KEYUTIL.getHexFromPEM(pem, PEM_HEADER_PUBLIC_KEY);
		// debug(chainKey);
		var certBuffer = utils.toArrayBuffer(new Buffer(chainKey, 'hex'));
		var asn1 = certParser.org.pkijs.fromBER(certBuffer);
		// debug('asn1:\n', asn1);
		var cert;
		cert = new certParser.org.pkijs.simpl.PUBLIC_KEY_INFO({schema: asn1.result});
		// debug('cert:\n', JSON.stringify(cert, null, 4));

		var ab = new Uint8Array(cert.subjectPublicKey.value_block.value_hex);
		var ecdsaChainKey = this.getKeyPairForEncryption(ab, 'hex');

		return ecdsaChainKey;
	}

	ecdsaPrivateKeyToASN1(prvKeyHex) {
		var Ber = require('asn1').Ber;
		var sk = new Ber.Writer();
		sk.startSequence();
		sk.writeInt(1);
		sk.writeBuffer(new Buffer(prvKeyHex, 'hex'), 4);
		sk.writeByte(160);
		sk.writeByte(7);
		if (this._securityLevel == CURVE_P_384_Size ) {
			// OID of P384
			sk.writeOID('1.3.132.0.34');
		} else if (this._securityLevel == CURVE_P_256_Size) {
			// OID of P256
			sk.writeOID('1.2.840.10045.3.1.7');
		} else {
			throw Error('Not supported. Level ' + this._securityLevel);
		}
		sk.endSequence();
		return sk.buffer;
	}

	eciesKeyGen() {
		return KEYUTIL.generateKeypair('EC', this._curveName);
	}

	eciesEncryptECDSA(ecdsaRecipientPublicKey, msg) {
		var self = this;
		var EC = elliptic.ec;
		//var curve = elliptic.curves['p'+level];
		var ecdsa = new EC('p' + self._securityLevel);

		// Generate ephemeral key-pair
		var ephKeyPair = KEYUTIL.generateKeypair('EC', this._curveName);
		var ephPrivKey = ecdsa.keyFromPrivate(ephKeyPair.prvKeyObj.prvKeyHex, 'hex');
		var Rb = ephKeyPair.pubKeyObj.pubKeyHex;

		// Derive a shared secret field element z from the ephemeral secret key k
		// and convert z to an octet string Z
		var Z = ephPrivKey.derive(ecdsaRecipientPublicKey.pub);
		logger.debug('[Z]: %j', Z);
		var kdfOutput = self._hkdf(Z.toArray(), ECIESKDFOutput, null, null);
		logger.debug('[kdfOutput]: %j', new Buffer(new Buffer(kdfOutput).toString('hex'), 'hex').toString('hex'));

		var aesKey = kdfOutput.slice(0, AESKeyLength);
		var hmacKey = kdfOutput.slice(AESKeyLength, AESKeyLength + HMACKeyLength);
		logger.debug('[Ek] ', new Buffer(aesKey, 'hex'));
		logger.debug('[Mk] ', new Buffer(hmacKey, 'hex'));

		var iv = crypto.randomBytes(IVLength);
		var cipher = crypto.createCipheriv('aes-256-cfb', new Buffer(aesKey), iv);
		logger.debug('MSG %j: ', msg);
		var encryptedBytes = cipher.update(msg);
		logger.debug('encryptedBytes: ',JSON.stringify(encryptedBytes));
		var EM = Buffer.concat([iv, encryptedBytes]);
		var D = self.hmac(hmacKey, EM);

		logger.debug('[Rb] ', new Buffer(Rb,'hex').toString('hex')+' len='+Rb.length);
		logger.debug('[EM] ', EM.toString('hex'));
		logger.debug('[D] ', new Buffer(D).toString('hex'));

		return Buffer.concat([new Buffer(Rb, 'hex'), EM, new Buffer(D)]);
	}

	eciesEncrypt(recipientPublicKey, msg) {
		var level = recipientPublicKey.ecparams.keylen;
		logger.debug('=============> %d', level);
		var EC = elliptic.ec;
		var curve = elliptic.curves['p' + level];
		logger.debug('=============> curve=%s', util.inspect(curve));
		var ecdsa = new EC(curve);

		return this.eciesEncryptECDSA(ecdsa.keyFromPublic(recipientPublicKey.pubKeyHex, 'hex'), msg);
	}

	aesKeyGen() {
		return crypto.randomBytes(AESKeyLength);
	}

	_aesCFBDecryt(key, encryptedBytes) {

		var iv = crypto.randomBytes(IVLength);
		var aes = new aesjs.ModeOfOperation.cfb(key, iv, IVLength);

		logger.debug('encryptedBytes: ', encryptedBytes);

		//need to pad encryptedBytes to multiples of 16
		var numMissingBytes = IVLength - (encryptedBytes.length % AESBlockLength);
		logger.debug('missingBytes: ', numMissingBytes);

		if (numMissingBytes > 0) {
			encryptedBytes = Buffer.concat([encryptedBytes, new Buffer(numMissingBytes)]);
		}

		logger.debug('encryptedBytes: ', encryptedBytes);

		var decryptedBytes = aes.decrypt(encryptedBytes);

		return decryptedBytes.slice(IVLength, decryptedBytes.length - numMissingBytes);

	}

	aesCBCPKCS7Decrypt(key, bytes) {

		var decryptedBytes, unpaddedBytes;

		decryptedBytes = CryptoSuite_ECDSA_SHA._CBCDecrypt(key, bytes);
		unpaddedBytes = CryptoSuite_ECDSA_SHA._PKCS7UnPadding(decryptedBytes);

		return unpaddedBytes;
	}

	aes256GCMDecrypt(key, ct) {
		var decipher = crypto.createDecipheriv('aes-256-gcm', key, ct.slice(0, GCMStandardNonceSize));
		decipher.setAuthTag(ct.slice(ct.length - GCMTagSize));
		var dec = decipher.update(
			ct.slice(GCMStandardNonceSize, ct.length - GCMTagSize).toString('hex'),
			'hex', 'hex'
		);
		dec += decipher.final('hex');
		return dec;
	}

	_hkdf(ikm, keyBitLength, salt, info) {

		if (!salt)
			salt = _zeroBuffer(this._hashOutputSize);

		if (!info)
			info = '';

		var key = CryptoSuite_ECDSA_SHA._hkdf2(bytesToBits(new Buffer(ikm)), keyBitLength, bytesToBits(salt), info, this._hashFunctionKeyDerivation);

		return bitsToBytes(key);

	}


	hmac(key, bytes) {
		logger.debug('HMAC key: ', JSON.stringify(key));
		logger.debug('bytes to digest: ', JSON.stringify(bytes));

		var hmac = new sjcl.misc.hmac(bytesToBits(key), this._hashFunctionKeyDerivation);
		hmac.update(bytesToBits(bytes));
		var result = hmac.digest();
		logger.debug('HMAC digest: ', bitsToBytes(result));
		return bitsToBytes(result);
	}

	hmacAESTruncated(key, bytes) {
		var res = this.hmac(key, bytes);
		return res.slice(0, AESKeyLength);
	}

	hash(bytes) {
		return this._hashFunction(bytes);
	}

	_checkSecurityLevel(securityLevel) {
		if (securityLevel != 256 && securityLevel != 384)
			throw new Error('Illegal level: ' + securityLevel + ' - must be either 256 or 384');
	}

	static _checkHashFunction(hashAlgorithm) {
		if (!_isString(hashAlgorithm))
			throw new Error('Illegal Hash function family: ' + hashAlgorithm + ' - must be either SHA2 or SHA3');

		hashAlgorithm = hashAlgorithm.toUpperCase();
		if (hashAlgorithm != SHA2 && hashAlgorithm != SHA3)
			throw new Error('Illegal Hash function family: ' + hashAlgorithm + ' - must be either SHA2 or SHA3');
	}

	_initialize() {
		this._checkSecurityLevel(this._securityLevel);
		CryptoSuite_ECDSA_SHA._checkHashFunction(this._hashAlgorithm);

		this._suite = this._hashAlgorithm.toLowerCase() + '-' + this._securityLevel;
		if (this._securityLevel == CURVE_P_256_Size) {
			this._curveName = 'secp256r1';
		} else if (this._securityLevel == CURVE_P_384_Size) {
			this._curveName = 'secp384r1';
		}

		switch (this._suite) {
		case 'sha3-256':
			logger.debug('Using sha3-256');
			this._hashFunction = sha3_256;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha3_256;
			this._hashOutputSize = 32;
			break;
		case 'sha3-384':
			logger.debug('Using sha3-384');
			this._hashFunction = sha3_384;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha3_384;
			this._hashOutputSize = 48;
			break;
		case 'sha2-256':
			logger.debug('Using sha2-256');
			this._hashFunction = hashPrimitives.sha2_256;
			this._hashFunctionKeyDerivation = hashPrimitives.hash_sha2_256;
			this._hashOutputSize = 32;
			break;
		default:
			throw Error('Unsupported hash algorithm and security level pair ' + this._suite);
		}

		switch (this._securityLevel) {
		case 256:
			this._ecdsaCurve = elliptic.curves['p256'];
			break;
		case 384:
			this._ecdsaCurve = elliptic.curves['p384'];
			break;
		}

	}

	/** HKDF with the specified hash function.
	 * @param {bitArray} ikm The input keying material.
	 * @param {Number} keyBitLength The output key length, in bits.
	 * @param {String|bitArray} salt The salt for HKDF.
	 * @param {String|bitArray} info The info for HKDF.
	 * @param {Object} [Hash=sjcl.hash.sha256] The hash function to use.
	 * @return {bitArray} derived key.
	 * @ignore
	 */
	static _hkdf2(ikm, keyBitLength, salt, info, Hash) {
		var hmac, key, i, hashLen, loops, curOut, ret = [];

		// Hash = Hash || sjcl.hash.sha256;
		if (typeof info === 'string') {
			info = sjcl.codec.utf8String.toBits(info);
		} else if (!info) {
			info = sjcl.codec.utf8String.toBits('');
		}
		if (typeof salt === 'string') {
			salt = sjcl.codec.utf8String.toBits(salt);
		} else if (!salt) {
			salt = [];
		}

		hmac = new sjcl.misc.hmac(salt, Hash);
		//key = hmac.mac(ikm);
		hmac.update(ikm);
		key = hmac.digest();
		// debug('prk: %j', new Buffer(bitsToBytes(key)).toString('hex'));
		hashLen = sjcl.bitArray.bitLength(key);

		loops = Math.ceil(keyBitLength / hashLen);
		if (loops > 255) {
			throw new sjcl.exception.invalid('key bit length is too large for hkdf');
		}

		curOut = [];
		for (i = 1; i <= loops; i++) {
			hmac = new sjcl.misc.hmac(key, Hash);
			hmac.update(curOut);
			hmac.update(info);
			// debug('sjcl.bitArray.partial(8, i): %j', sjcl.bitArray.partial(8, i));
			hmac.update(bytesToBits([i]));

			// hmac.update([sjcl.bitArray.partial(8, i)]);
			curOut = hmac.digest();
			ret = sjcl.bitArray.concat(ret, curOut);
		}
		return sjcl.bitArray.clamp(ret, keyBitLength);
	}

	static _CBCDecrypt(key, bytes) {
		logger.debug('Decrypt key length: ', key.length);
		logger.debug('Decrypt bytes length: ', bytes.length);

		var iv = bytes.slice(0, BlockSize);
		logger.debug('Decrypt iv length: ', iv.length);
		var encryptedBytes = bytes.slice(BlockSize);
		logger.debug('encrypted bytes length: ', encryptedBytes.length);

		var decryptedBlocks = [];
		var decryptedBytes;

		// CBC only works with 16 bytes blocks
		if (encryptedBytes.length > BlockSize) {
			//CBC only support cipertext with length Blocksize
			var start = 0;
			var end = BlockSize;
			while (end <= encryptedBytes.length) {
				let aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
				logger.debug('start|end', start, end);
				var encryptedBlock = encryptedBytes.slice(start, end);
				var decryptedBlock = aesCbc.decrypt(encryptedBlock);
				logger.debug('decryptedBlock: ', decryptedBlock);
				decryptedBlocks.push(decryptedBlock);
				//iv for next round equals previous block
				iv = encryptedBlock;
				start += BlockSize;
				end += BlockSize;
			}

			decryptedBytes = Buffer.concat(decryptedBlocks);
		}
		else {
			let aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
			decryptedBytes = aesCbc.decrypt(encryptedBytes);
		}

		logger.debug('decrypted bytes: ', JSON.stringify(decryptedBytes));

		return decryptedBytes;

	}

	static _PKCS7UnPadding(bytes) {

		//last byte is the number of padded bytes
		var padding = bytes.readUInt8(bytes.length - 1);
		//should check padded bytes, but just going to extract
		var unpadded = bytes.slice(0, bytes.length - padding);
		return unpadded;
	}

};  // end Crypto class

// Determine if an object is a string
function _isString(obj) {
	return (typeof obj === 'string' || obj instanceof String);
}

function _zeroBuffer(length) {
	var buf = new Buffer(length);
	buf.fill(0);
	return buf;
}

module.exports = CryptoSuite_ECDSA_SHA;
