/**
 * Copyright 2017 IBM All Rights Reserved.
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

var api = require('../api.js');
var utils = require('../utils');
var aesKey = require('./aes/pkcs11_key.js');
var ecdsaKey = require('./ecdsa/pkcs11_key.js');

var BN = require('bn.js');
var ecsig = require('elliptic/lib/elliptic/ec/signature.js');
var callsite = require('callsite');
var crypto = require('crypto');
var pkcs11js = require('pkcs11js');
var util = require('util');

var logger = utils.getLogger('crypto_pkcs11');

const _pkcs11ParamsSizeToOid = { 256: '06082A8648CE3D030107', 384: '06052B81040022' };
const _pkcs11ParamsOidToSize = { '06082A8648CE3D030107': 256, '06052B81040022': 384 };

/*
 * Function name and line number for logger.
 */
var __func = function() {
	// 0 is __func itself, 1 is caller of __func
	return callsite()[1].getFunctionName() +
		'[' + callsite()[1].getLineNumber() + ']: ';
};

/**
 * PKCS#11-compliant implementation to support Hardware Security Modules.
 *
 * @class
 * @extends module:api.CryptoSuite
 */
var CryptoSuite_PKCS11 = class extends api.CryptoSuite {

	/**
	 * @param {number} keySize Length of key (in bytes), a.k.a "security level"
	 * @param {string} hash Optional. Hash algorithm, supported values are "SHA2" and "SHA3"
	 * @param {Object} opts Option is the form { lib: string, slot: number, pin: string }
	 *
	 * If lib is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_LIB env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-lib key in the configuration file.
	 *
	 * If slot is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_SLOT env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-slot key in the configuration file.
	 *
	 * If pin is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_PIN env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-pin key in the configuration file.
	 */
	constructor(keySize, hash, opts) {
		if (typeof keySize === 'undefined' || keySize === null)
			throw new Error(__func() + 'keySize must be specified');
		if (typeof keySize === 'string') keySize = parseInt(keySize, 10);
		if (keySize != 256 && keySize != 384)
			throw new Error(__func() +
					'only 256 or 384 bits key sizes are supported');
		logger.info(__func() + 'keySize: ' + keySize);
		/*
		 * If no lib specified, get it from env var or config file.
		 */
		var pkcs11Lib = opts? opts.lib : null;
		if (typeof pkcs11Lib === 'undefined' || pkcs11Lib === null)
			pkcs11Lib = utils.getConfigSetting('crypto-pkcs11-lib');
		if (typeof pkcs11Lib === 'undefined' || pkcs11Lib === null ||
		    typeof pkcs11Lib !== 'string')
			throw new Error(__func() + 'PKCS11 library path must be specified');
		logger.info(__func() + 'PKCS11 library: ' + pkcs11Lib);
		/*
		 * If no slot specified, get it from env var or config file.
		 */
		var pkcs11Slot = opts.slot;
		if (typeof pkcs11Slot === 'undefined' || pkcs11Slot === null)
			pkcs11Slot = utils.getConfigSetting('crypto-pkcs11-slot');
		if (typeof pkcs11Slot === 'undefined' || pkcs11Slot === null)
			throw new Error(__func() + 'PKCS11 slot must be specified');
		if (typeof pkcs11Slot === 'string') pkcs11Slot = parseInt(pkcs11Slot, 10);
		if (isNaN(pkcs11Slot))
			throw new Error(__func() + 'PKCS11 slot number invalid');
		logger.info(__func() + 'PKCS11 slot: ' + pkcs11Slot);
		/*
		 * If no pin specified, get it from env var or config file.
		 */
		var pkcs11Pin = opts.pin;
		if (typeof pkcs11Pin === 'undefined' || pkcs11Pin === null)
			pkcs11Pin = utils.getConfigSetting('crypto-pkcs11-pin');
		if (typeof pkcs11Pin === 'undefined' || pkcs11Pin === null ||
		    typeof pkcs11Pin !== 'string')
			throw new Error(__func() + 'PKCS11 PIN must be set');

		super();

		this._keySize = keySize;

		/*
		 * Load native PKCS11 library, open PKCS11 session and login.
		 */
		this._pkcs11 = new pkcs11js.PKCS11();
		this._pkcs11OpenSession(this._pkcs11, pkcs11Lib, pkcs11Slot, pkcs11Pin);
		/*
		 * SKI to key cache for getKey(ski) function.
		 */
		this._skiToKey = {};
	}

	/**********************************************************************************
	 * Internal PKCS11 functions.                                                     *
	 **********************************************************************************/

	/*
	 * 16-byte front 0 padded time of day in hex for computing SKI.
	 */
	_tod() {
		return ('000000000000000' + (new Date).getTime().toString(16)).substr(-16);
	}

	/*
	 * sha256 of tod as SKI.
	 */
	_ski() {
		var hash = crypto.createHash('sha256');
		hash.update(this._tod());
		return hash.digest();
	}

	/*
	 * Workaround for opencryptoki bug.
	 */
	_fixEcpt(ecpt) {
		if ((ecpt.length & 1) == 0 &&
		    (ecpt[0] == 0x04) && (ecpt[ecpt.length-1] == 0x04))
		{
			logger.info(__func() +
				    'workaround opencryptoki EC point wrong length: ' +
				    ecpt.length);
			ecpt = ecpt.slice(0, ecpt.length-1);
		}
		return ecpt;
	}

	/*
	 * Open pkcs11 session and login.
	 */
	_pkcs11OpenSession(pkcs11, pkcs11Lib, pkcs11Slot, pkcs11Pin) {
		logger.debug(__func() + 'parameters are pkcs11Slot %s pkcs11Pin %s pkcs11Lib %s',
			pkcs11Slot, pkcs11Pin, pkcs11Lib);
		pkcs11.load(pkcs11Lib);
		pkcs11.C_Initialize();

		try {
			// Getting info about PKCS11 Module
			logger.debug(__func() + 'C_GetInfo: ' +
				     util.inspect(pkcs11.C_GetInfo(), {depth: null}));

			// Getting list of slots
			var slots = pkcs11.C_GetSlotList(true);
			if (pkcs11Slot >= slots.length)
				throw new Error(__func() + 'PKCS11 slot number non-exist');
			var slot = slots[pkcs11Slot];
			logger.debug(__func() + 'C_GetSlotList: ' +
				     util.inspect(slots, {depth: null}));
			// Getting info about slot
			logger.debug(__func() + 'C_GetSlotInfo(' + pkcs11Slot + '): ' +
				     util.inspect(pkcs11.C_GetSlotInfo(slot),
						  {depth: null}));
			// Getting info about token
			logger.debug(__func() + 'C_GetTokenInfo(' + pkcs11Slot + '): ' +
				     util.inspect(pkcs11.C_GetTokenInfo(slot),
						  {depth: null}));
			// Getting info about Mechanism
			logger.debug(__func() + 'C_GetMechanismList(' + pkcs11Slot + '): ' +
				     util.inspect(pkcs11.C_GetMechanismList(slot),
						  {depth: null}));
			/*
			 * Open session.
			 */
			this._pkcs11Session = pkcs11.C_OpenSession(
				slot, pkcs11js.CKF_RW_SESSION|pkcs11js.CKF_SERIAL_SESSION);
			// Getting info about Session
			logger.debug(__func() + 'C_GetSessionInfo(' +
				     util.inspect(
					     this._pkcs11Session, {depth: null}) + '): ' +
				     util.inspect(pkcs11.C_GetSessionInfo(
					     this._pkcs11Session), {depth: null}));

			/*
			 * Login with PIN. Error will be thrown if wrong PIN.
			 */
			pkcs11.C_Login(this._pkcs11Session,
				       1/*pkcs11js.CKU_USER*/, pkcs11Pin);
			this._pkcs11Login = true;
			logger.info(__func() + 'session login successful');

			//pkcs11.C_Logout(session);
			//pkcs11.C_CloseSession(session);
		}
		catch(e) {
			if (this._pkcs11Session != null)
				pkcs11.C_CloseSession(this._pkcs11Session);
			pkcs11.C_Finalize();
			throw(e);
		}
		finally {
		}
	}

	/*
	 * Generate PKCS11 AES key.
	 *
	 * Return SKI and key handle.
	 */
	_pkcs11GenerateKey(pkcs11, pkcs11Session, pkcs11Token) {
		var ski = this._ski();
		var secretKeyTemplate = [
			{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_AES },
			{ type: pkcs11js.CKA_VALUE_LEN, value: this._keySize/8 },
			{ type: pkcs11js.CKA_ENCRYPT,   value: true },
			{ type: pkcs11js.CKA_DECRYPT,   value: true },
			/*
			 * If user is logged in:
			 *   - key will be private
			 *   - key will be non-ephemeral by user request
			 * If user is not logged in:
			 *   - key will be public
			 *   - key will be ephermal regardless of user request
			 *
			 * Note that public and private here means publically and privately
			 * accessible, respectively, and has nothing to do with public and
			 * private key pair.
			 */
			{ type: pkcs11js.CKA_PRIVATE,   value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN,     value: this._pkcs11Login && pkcs11Token },
		];

		try {
			/*
			 * Call PKCS11 API to generate the key.
			 */
			var handle = pkcs11.C_GenerateKey(
				pkcs11Session, { mechanism: pkcs11js.CKM_AES_KEY_GEN },
				secretKeyTemplate);
			/*
			 * Template for querying key attributes (debug only).
			 */
			var objectTemplate = [
				{ type: pkcs11js.CKA_ID },
				{ type: pkcs11js.CKA_CLASS },
				{ type: pkcs11js.CKA_KEY_TYPE },
				{ type: pkcs11js.CKA_VALUE_LEN },
				{ type: pkcs11js.CKA_ENCRYPT },
				{ type: pkcs11js.CKA_DECRYPT },
				{ type: pkcs11js.CKA_PRIVATE },
				{ type: pkcs11js.CKA_TOKEN },
			];
			logger.debug(__func() + 'secretKey: ' + util.inspect(
				this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handle, objectTemplate),
				{ depth: null }));

			return { ski: ski, key: handle };
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * Generate PKCS11 ECDSA key pair.
	 *
	 * Return SKI, EC point, and key handles.
	 */
	_pkcs11GenerateECKeyPair(pkcs11, pkcs11Session, pkcs11Token) {
		//var ski = this._ski();
		var privateKeyTemplate = [
			//{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_PRIVATE_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_EC },
			{ type: pkcs11js.CKA_PRIVATE,   value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN,     value: this._pkcs11Login && pkcs11Token },
			{ type: pkcs11js.CKA_SIGN,      value: true },
			{ type: pkcs11js.CKA_DERIVE,    value: true },
		];
		var publicKeyTemplate = [
			//{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_PUBLIC_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_EC },
			{ type: pkcs11js.CKA_PRIVATE,   value: false },
			{ type: pkcs11js.CKA_TOKEN,     value: this._pkcs11Login && pkcs11Token },
			{ type: pkcs11js.CKA_VERIFY,    value: true },
			{ type: pkcs11js.CKA_EC_PARAMS,
			  value: Buffer.from(_pkcs11ParamsSizeToOid[this._keySize],'hex') },
		];

		try {
			/*
			 * Call PKCS11 API to generate the key pair.
			 *
			 * Return public and private key handles.
			 */
			var handles = pkcs11.C_GenerateKeyPair(
				pkcs11Session, { mechanism: pkcs11js.CKM_EC_KEY_PAIR_GEN },
				publicKeyTemplate, privateKeyTemplate);
			/*
			 * Template for querying key attributes (debug only).
			 */
			var objectTemplate = [
				{ type: pkcs11js.CKA_ID },
				{ type: pkcs11js.CKA_CLASS },
				{ type: pkcs11js.CKA_KEY_TYPE },
				{ type: pkcs11js.CKA_PRIVATE },
				{ type: pkcs11js.CKA_TOKEN },
			];
			logger.debug(__func() + 'privateKey: ' + util.inspect(
				this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handles.privateKey,
					objectTemplate),
				{ depth: null }));
			logger.debug(__func() + 'publicKey: ' + util.inspect(
				this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handles.publicKey,
					objectTemplate),
				{ depth: null }));
			/*
			 * Get the public key EC point.
			 */
			var ecpt =
			    (this._pkcs11GetAttributeValue(
				    pkcs11, pkcs11Session, handles.publicKey,
				    [{ type:pkcs11js.CKA_EC_POINT }]))[0].value;
			/*
			 * Workaround for opencryptoki bug reporting wrong ecpt length.
			 */
			ecpt = this._fixEcpt(ecpt);
			logger.debug(__func() + 'ecpt[' + ecpt.length + ']: ' +
				     util.inspect(ecpt, { depth: null }));
			/*
			 * Set CKA_ID of public and private key to be SKI.
			 */
			var ski = crypto.createHash('sha1').update(ecpt).digest();
			this._pkcs11SetAttributeValue(
				pkcs11, pkcs11Session, handles.publicKey,
				[{ type: pkcs11js.CKA_ID, value: ski }]);
			this._pkcs11SetAttributeValue(
				pkcs11, pkcs11Session, handles.privateKey,
				[{ type: pkcs11js.CKA_ID, value: ski }]);
			logger.debug(__func() + 'pub  ski: ' + util.inspect(
				(this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handles.publicKey,
					[{ type: pkcs11js.CKA_ID }]))[0].value,
				{ depth: null }));
			logger.debug(__func() + 'priv ski: ' + util.inspect(
				(this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handles.privateKey,
					[{ type: pkcs11js.CKA_ID }]))[0].value,
				{ depth: null }));

			return { ski: ski, ecpt: ecpt,
				 pub: handles.publicKey, priv: handles.privateKey };
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * Search PKCS11 for AES secret key or ECDSA key pair with given SKI.
	 *
	 * Return key handle(s) if found.
	 */
	_pkcs11SkiToHandle(pkcs11, pkcs11Session, ski) {
		try {
			/*
			 * First look for AES key.
			 */
			var secretKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID,        value: ski },
				{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_SECRET_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_AES },
			]);
			if (secretKeyHandle.length == 1)
				return { secretKey: secretKeyHandle[0] };
			/*
			 * Then look for ECDSA key pair.
			 */
			var privKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID,        value: ski },
				{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_PRIVATE_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_EC },
			]);
			var pubKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID,        value: ski },
				{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_PUBLIC_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_EC },
			]);
			if (pubKeyHandle.length != 1 || privKeyHandle.length != 1)
				throw new Error(__func() + 'no key with SKI ' +
						ski.toString('hex') + ' found');

			return { privateKey: privKeyHandle[0], publicKey: pubKeyHandle[0] };
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * Query PKCS11 EC params (OID) and EC point of an ECDSA key pair.
	 */
	_pkcs11QueryEcparamsEcpt(pkcs11, pkcs11Session, publicKey) {
		try {
			/*
			 * Get EC params (to derive key size) and EC point.
			 */
			var attribs =
			    this._pkcs11GetAttributeValue(
				    this._pkcs11, this._pkcs11Session, publicKey,
				    [ { type:pkcs11js.CKA_EC_PARAMS },
				      { type:pkcs11js.CKA_EC_POINT },
				    ]);
			logger.debug(__func() + 'attribuites: ' +
				     util.inspect(attribs, { depth: null} ));

			var ecparams, ecpt;
			if (attribs[0].type == pkcs11js.CKA_EC_PARAMS) {
				ecparams = attribs[0].value;
				ecpt = attribs[1].value;
			} else {
				ecparams = attribs[1].value;
				ecpt = attribs[1].value;
			}
			/*
			 * Workaround for opencryptoki bug reporting wrong ecpt length.
			 */
			ecpt = this._fixEcpt(ecpt);

			return { ecparams: ecparams, ecpt: ecpt };
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * PKCS11 signing digest with an ECDSA private key.
	 */
	_pkcs11Sign(pkcs11, pkcs11Session, key, digest) {
		try {
			/*
			 * key has been checked to be an ECDSA private key.
			 */
			pkcs11.C_SignInit(pkcs11Session, { mechanism: pkcs11js.CKM_ECDSA },
					  key._handle);
			var sig = pkcs11.C_Sign(pkcs11Session, digest,
						Buffer.alloc(this._keySize));
			logger.debug(__func() + 'ECDSA RAW signature: ' +
				    util.inspect(sig, {depth: null}));
			/*
			 * ASN1 DER encoding against malleability.
			 */
			var r = new BN(sig.slice(0, sig.length/2).toString('hex'), 16);
			var s = new BN(sig.slice(sig.length/2).toString('hex'), 16);
			var der = (new ecsig({ r: r, s: s})).toDER();
			logger.debug(__func() + 'ECDSA DER signature: ' +
				     util.inspect(Buffer.from(der), {depth: null}));
			return Buffer.from(der);
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * PKCS11 verify signature of digest signed with an ECDSA private key.
	 */
	_pkcs11Verify(pkcs11, pkcs11Session, key, digest, signature) {
		try {
			/*
			 * Restore ASN1 DER signature to raw signature.
			 * Error will be thrown if signature is not properly encoded.
			 */
			var rns = new ecsig(signature, 'hex');
			logger.debug(__func() + 'ECDSA R+S signature: ' +
				     util.inspect(rns, {depth: null}));
			var sig = Buffer.concat([ rns.r.toArrayLike(Buffer, '', 0),
						  rns.s.toArrayLike(Buffer, '', 0)]);
			logger.debug(__func() + 'ECDSA RAW signature: ' +
				     util.inspect(sig, {depth: null}));
			/*
			 * key can be either a private or a public key.
			 */
			pkcs11.C_VerifyInit(pkcs11Session,
					    { mechanism: pkcs11js.CKM_ECDSA },
					    key._handle);
			return pkcs11.C_Verify(pkcs11Session, digest, sig);
		}
		catch(e) {
			/*
			 * Error is thrown when signature verification fails.
			 */
			if (e.message.indexOf('CKR_SIGNATURE_INVALID') != -1) return false;
			throw(e);
		}
	}

	/*
	 * PKCS11 encrypt plain text with an AES key.
	 */
	_pkcs11Encrypt(pkcs11, pkcs11Session, key, plainText) {
		try {
			/*
			 * key has been checked to be an AES key.
			 */
			var iv = pkcs11.C_GenerateRandom(pkcs11Session, Buffer.alloc(16));

			pkcs11.C_EncryptInit(pkcs11Session,
					     { mechanism: pkcs11js.CKM_AES_CBC_PAD,
					       parameter: iv },
					     key._handle);
			/*
			 * Prepend iv to ciphertext.
			 */
			return Buffer.concat([
				iv,
				pkcs11.C_Encrypt(pkcs11Session, plainText,
						 Buffer.alloc((plainText.length+16)&(~15))),
			]);
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * PKCS11 decrypt cipher text encrypted with an AES key.
	 */
	_pkcs11Decrypt(pkcs11, pkcs11Session, key, cipherText) {
		try {
			/*
			 * key has been checked to be an AES key.
			 */
			var iv = cipherText.slice(0, 16);

			pkcs11.C_DecryptInit(pkcs11Session,
					     { mechanism: pkcs11js.CKM_AES_CBC_PAD,
					       parameter: iv },
					     key._handle);

			return pkcs11.C_Decrypt(pkcs11Session,
						cipherText.slice(16, cipherText.length),
						Buffer.alloc(cipherText.length-16));
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * PKCS11 derive key with ECDH mechanism.
	 */
	_pkcs11DeriveKey(pkcs11, pkcs11Session, key, pub) {
		var ski = this._ski();
		var derivedKeyTemplate = [
			{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_AES },
			{ type: pkcs11js.CKA_VALUE_LEN, value: 256/8 },
			{ type: pkcs11js.CKA_ENCRYPT,   value: true },
			{ type: pkcs11js.CKA_DECRYPT,   value: true },
			{ type: pkcs11js.CKA_PRIVATE,   value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN,     value: false },
		];

		try {
			return pkcs11.C_DeriveKey(
				pkcs11Session,
				{ mechanism: pkcs11js.CKM_ECDH1_DERIVE,
				  parameter: { type: pkcs11js.CK_PARAMS_EC_DH,
					       kdf: pkcs11js.CKD_SHA256_KDF,
					       publicData: pub._ecpt,
					     }
				},
				key._handle, derivedKeyTemplate);
		}
		catch(e) {
			throw(e);
		}
	}

	_pkcs11CreateObject(pkcs11, pkcs11Session, key, pkcs11Token) {
		var ski = this._ski();
		var keyTemplate = [
			{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS,     value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE,  value: pkcs11js.CKK_AES },
			//SoftHSMv2 prohibits specifying CKA_VALUE_LEN
			//{ type: pkcs11js.CKA_VALUE_LEN, value: key.length },
			{ type: pkcs11js.CKA_VALUE,     value: key },
			{ type: pkcs11js.CKA_ENCRYPT,   value: true },
			{ type: pkcs11js.CKA_DECRYPT,   value: true },
			{ type: pkcs11js.CKA_PRIVATE,   value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN,     value: this._pkcs11Login && pkcs11Token },
		];

		try {
			var handle = pkcs11.C_CreateObject(pkcs11Session, keyTemplate);
			return { ski: ski, key: handle };
		}
		catch(e) {
			throw(e);
		}
	}

	/*
	 * Query PKCS11 object attributes.
	 *
	 * Return array of [ { type:..., value:... }, ... ]
	 */
	_pkcs11GetAttributeValue(pkcs11, pkcs11Session, pkcs11Object, pkcs11Template) {
		return pkcs11.C_GetAttributeValue(pkcs11Session, pkcs11Object,
						  pkcs11Template);
	}

	/*
	 * Set PKCS11 object attributes.
	 */
	_pkcs11SetAttributeValue(pkcs11, pkcs11Session, pkcs11Object, pkcs11Template) {
		return pkcs11.C_SetAttributeValue(pkcs11Session, pkcs11Object,
						  pkcs11Template);
	}

	/*
	 * Find PKCS11 objects matching attribute template.
	 *
	 * Return array of object handles.
	 */
	_pkcs11FindObjects(pkcs11, pkcs11Session, pkcs11Template) {
		pkcs11.C_FindObjectsInit(pkcs11Session, pkcs11Template);
		var objs = [];
		var obj = pkcs11.C_FindObjects(pkcs11Session);
		while (obj) {
			var objectTemplate = [
				{ type: pkcs11js.CKA_CLASS },
				{ type: pkcs11js.CKA_KEY_TYPE },
				{ type: pkcs11js.CKA_PRIVATE },
				{ type: pkcs11js.CKA_TOKEN },
				{ type: pkcs11js.CKA_ID },
			];
			logger.debug(__func() + 'obj:  ' +
				     util.inspect(obj, { depth: null }));
			logger.debug(__func() + 'attr: ' + util.inspect(
				this._pkcs11GetAttributeValue(pkcs11, pkcs11Session, obj,
							      objectTemplate)));
			objs.push(obj);
			obj = pkcs11.C_FindObjects(pkcs11Session);
		}
		pkcs11.C_FindObjectsFinal(pkcs11Session);
		return objs;
	}

	/**********************************************************************************
	 * Public interface functions.                                                    *
	 **********************************************************************************/

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#generateKey}
	 * Returns an instance of {@link module.api.Key} representing the private key,
	 * which also encapsulates the public key. By default the generated key (keypar)
	 * is (are) ephemeral unless opts.ephemeral is set to false, in which case the
	 * key (keypair) will be saved across PKCS11 sessions by the HSM hardware.
	 *
	 * @returns {module:api.Key} Promise of an instance of {@link module:PKCS11_ECDSA_KEY}
	 * containing the private key and the public key.
	 */
	generateKey(opts) {
		if (typeof opts === 'undefined' || opts === null ||
		    typeof opts.algorithm === 'undefined' || opts.algorithm === null ||
		    typeof opts.algorithm !== 'string')
			return Promise.reject(Error(__func() +
						    'opts.algorithm must be String type'));

		var token = (opts.ephemeral !== 'undefined' &&
			     opts.ephemeral === false) ? true : false;
		var self = this;

		switch (opts.algorithm.toUpperCase()) {
		case 'AES':
			return new Promise(function(resolve, reject) {
				try {
					if (self._keySize != 256) throw new Error(
						__func() + 'AES key size must be 256 (bits)');

					var attr = self._pkcs11GenerateKey(
						self._pkcs11, self._pkcs11Session, token);
					/*
					 * Put key in the session cache and return
					 * promise of the key.
					 */
					var key = new aesKey(attr, self._keySize);
					self._skiToKey[attr.ski.toString('hex')] = key;
					return resolve(key);
				}
				catch(e) {
					return reject(e);
				}
			});
			break;
		case 'ECDSA':
			return new Promise(function(resolve, reject) {
				try {
					var attr = self._pkcs11GenerateECKeyPair(
						self._pkcs11, self._pkcs11Session, token);
					/*
					 * Put key in the session cache and return
					 * promise of the key.
					 */
					var key = new ecdsaKey(attr, self._keySize);
					self._skiToKey[attr.ski.toString('hex')] = key;
					return resolve(key);
				}
				catch(e) {
					return reject(e);
				}
			});
		default:
			return Promise.reject(Error(
				__func() + 'must specify AES or ECDSA key algorithm'));
		}
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#getKey}
	 * Returns the key this CSP associates to the Subject Key Identifier ski.
	 */
	getKey(ski) {
		if (typeof ski === 'undefined' || ski === null || !(ski instanceof Buffer))
			return Promise.reject(Error(__func() + 'ski must be Buffer type'));
		/*
		 * Found the ski in the session key cache.
		 */
		var hit = this._skiToKey[ski.toString('hex')];
		if (hit !== undefined) {
			logger.debug(__func() + 'cache hit ' +
				     util.inspect(hit, { depth: null }));
			return Promise.resolve(hit);
		}

		var self = this;
		return new Promise(function(resolve, reject) {
			try {
				var handle = self._pkcs11SkiToHandle(
					self._pkcs11, self._pkcs11Session, ski);
				/*
				 * AES key.
				 */
				var key;
				if (typeof handle.secretKey !== 'undefined') {
					if (self._keySize != 256) {
						throw new Error(__func() + 'key size mismatch, class: ' + self._keySize + ', ski: 256');
					}
					key = new aesKey({ ski: ski,
							   key: handle.secretKey },
							 self._keySize);
				}
				/*
				 * ECDSA key.
				 */
				else {
					var attr = self._pkcs11QueryEcparamsEcpt(
						self._pkcs11, self._pkcs11Session,
						handle.publicKey);

					var keySize = _pkcs11ParamsOidToSize[
						attr.ecparams.toString('hex').
							toUpperCase()];
					if (keySize === undefined ||
					    keySize != self._keySize) {
						throw new Error(__func() + 'key size mismatch, class: ' + self._keySize + ', ski: ' + keySize);
					}
					key = new ecdsaKey({ ski: ski, ecpt: attr.ecpt,
							     pub: handle.publicKey,
							     priv: handle.privateKey },
							   self._keySize);
				}
				/*
				 * Put key in the session cache and return
				 * promise of the key.
				 */
				self._skiToKey[ski.toString('hex')] = key;
				return resolve(key);
			}
			catch(e) {
				return reject(e);
			}
		});
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#sign}
	 * Signs digest using key k.
	 *
	 * The opts argument is not needed.
	 */
	sign(key, digest, opts) {
		if (typeof key === 'undefined' || key === null ||
		    !(key instanceof ecdsaKey) || !key.isPrivate())
			throw new Error(__func() +
					'key must be PKCS11_ECDSA_KEY type private key');
		if (typeof digest === 'undefined' || digest === null ||
		    !(digest instanceof Buffer))
			throw new Error(__func() + 'digest must be Buffer type');

		return this._pkcs11Sign(this._pkcs11, this._pkcs11Session, key, digest);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#verify}
	 * Verifies signature against key k and digest
	 */
	verify(key, signature, digest) {
		if (typeof key === 'undefined' || key === null ||
		    !(key instanceof ecdsaKey))
			throw new Error(__func() + 'key must be PKCS11_ECDSA_KEY type');
		if (typeof signature === 'undefined' || signature === null ||
		    !(signature instanceof Buffer))
			throw new Error(__func() + 'signature must be Buffer type');
		if (typeof digest === 'undefined' || digest === null ||
		    !(digest instanceof Buffer))
			throw new Error(__func() + 'digest must be Buffer type');

		return this._pkcs11Verify(this._pkcs11, this._pkcs11Session,
					  key.getPublicKey(), digest, signature);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#encrypt}
	 * Encrypts plainText using key.
	 * The opts argument should be appropriate for the algorithm used.
	 */
	encrypt(key, plainText, opts) {
		if (typeof key === 'undefined' || key === null || !(key instanceof aesKey))
			throw new Error(__func() + 'key must be PKCS11_AES_KEY type');
		if (typeof plainText === 'undefined' || plainText === null ||
		    !(plainText instanceof Buffer))
			throw new Error(__func() + 'plainText must be Buffer type');

		return this._pkcs11Encrypt(this._pkcs11, this._pkcs11Session, key,
					   plainText);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#decrypt}
	 * Decrypts cipherText using key.
	 * The opts argument should be appropriate for the algorithm used.
	 */
	decrypt(key, cipherText, opts) {
		if (typeof key === 'undefined' || key === null || !(key instanceof aesKey))
			throw new Error(__func() + 'key must be PKCS11_AES_KEY type');
		if (typeof cipherText === 'undefined' || cipherText === null ||
		    !(cipherText instanceof Buffer))
			throw new Error(__func() + 'cipherText must be Buffer type');

		return this._pkcs11Decrypt(this._pkcs11, this._pkcs11Session, key,
					   cipherText);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#deriveKey}
	 */
	deriveKey(key, opts) {
		throw new Error(__func() + 'not yet supported');
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#importKey}
	 */
	importKey(raw, opts) {
		if (typeof raw === 'undefined' || raw === null || !(raw instanceof Buffer))
			return Promise.reject(Error(__func() + 'raw must be Buffer type'));
		if (typeof opts === 'undefined' || opts === null ||
		    typeof opts.algorithm === 'undefined' || opts.algorithm === null ||
		    typeof opts.algorithm !== 'string')
			return Promise.reject(Error(__func() +
						    'opts.algorithm must be String type'));

		var token = (opts.ephemeral !== 'undefined' &&
			     opts.ephemeral === false) ? true : false;
		var self = this;

		switch (opts.algorithm.toUpperCase()) {
		case 'AES':
			return new Promise(function(resolve, reject) {
				try {
					if (raw.length != (256/8)) throw new Error(
						__func() + 'AES key size must be 256 (bits)');

					var attr = self._pkcs11CreateObject(
						self._pkcs11, self._pkcs11Session, raw,
						token);
					/*
					 * Put key in the session cache and return
					 * promise of the key.
					 */
					var key = new aesKey(attr, raw.length*8);
					self._skiToKey[attr.ski.toString('hex')] = key;
					return resolve(key);
				}
				catch(e) {
					reject(e);
				}
			});
		case 'ECDSA':
			return Promise.reject(Error(__func() +
						    'ECDSA key not yet supported'));
		default:
			return Promise.reject(Error(__func() +
						    'only AES or ECDSA key supported'));
		}
	}

};

module.exports = CryptoSuite_PKCS11;
