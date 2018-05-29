/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const api = require('../api.js');
const utils = require('../utils');
const aesKey = require('./aes/pkcs11_key.js');
const ecdsaKey = require('./ecdsa/pkcs11_key.js');

const elliptic = require('elliptic');
const EC = elliptic.ec;

const jsrsa = require('jsrsasign');
const KEYUTIL = jsrsa.KEYUTIL;

const BN = require('bn.js');
const ecsig = require('elliptic/lib/elliptic/ec/signature.js');
const callsite = require('callsite');
const crypto = require('crypto');
const pkcs11js = require('pkcs11js');
const util = require('util');
const ECDSAKey = require('./ecdsa/key.js');
const hashPrimitives = require('../hash.js');

const logger = utils.getLogger('crypto_pkcs11');

const _pkcs11ParamsSizeToOid = { 256: '06082A8648CE3D030107', 384: '06052B81040022' };
const _pkcs11ParamsOidToSize = { '06082A8648CE3D030107': 256, '06052B81040022': 384 };

let _pkcs11 = null;
let _initialized = false;

function _preventMalleability(sig, curve) {

	const halfOrder = curve.n.shrn(1);
	if (!halfOrder) {
		throw new Error('Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ' + curve);
	}

	if (sig.s.cmp(halfOrder) == 1) {
		const bigNum = curve.n;
		sig.s = bigNum.sub(sig.s);
	}

	return sig;
}

/*
 * Function name and line number for logger.
 */
const __func = function () {
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
class CryptoSuite_PKCS11 extends api.CryptoSuite {

	/**
	 * @param {number} keySize Length of key (in bytes), a.k.a "security level"
	 * @param {string} hash Optional. Hash algorithm, supported values are "SHA2" and "SHA3"
	 * @param {Object} opts Options are of the form
	 * <pre>
	 *   {
	 *     lib: string,       // the library package to support this implementation
	 *     slot: number,      // the hardware slot number
	 *     pin: string,       // the user's PIN
	 *     usertype: number,  // the user type
	 *     readwrite: boolean // true if the session is read/write or false if read-only
 	 *   }
	 * </pre>
	 * If 'lib' is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_LIB env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-lib key in the configuration file.
	 *<br><br>
	 * If 'slot' is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_SLOT env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-slot key in the configuration file.
	 *<br><br>
	 * If 'pin' is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_PIN env var, and if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-pin key in the configuration file.
	 *<br><br>
	 * If 'usertype' is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_USERTYPE env var, if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-usertype key in the configuration file,
	 * if the config value is not set, its value will default to 1.
	 * The value will not be validated, assumes the C_Login will validate.
	 * --- from http://docs.oasis-open.org/pkcs11/pkcs11-base/v2.40/os/pkcs11-base-v2.40-os.html
	 *<pre>
	 * 0          CKU_SO                          0UL
	 * 1          CKU_USER                        1UL
	 * 2          CKU_CONTEXT_SPECIFIC            2UL
	 * 4294967295 max allowed            0xFFFFFFFFUL
	 *</pre>
	 *<br>
	 * If 'readwrite' is not specified or null, its value will be taken from the
	 * CRYPTO_PKCS11_READWRITE env var, if the env var is not set, its value will
	 * be taken from the crypto-pkcs11-readwrite key in the configuration file,
	 * if the config value is not set, its value will default to true.
	 */
	constructor(keySize, hash, opts) {
		if (!keySize) throw new Error(__func() + 'keySize must be specified');
		if (typeof keySize === 'string') keySize = parseInt(keySize);
		if (keySize != 256 && keySize != 384)
			throw new Error(__func() + 'only 256 or 384 bits key sizes are supported');
		logger.debug(__func() + 'keySize: ' + keySize);
		/*
		 * If no lib specified, get it from env var or config file.
		 */
		let pkcs11Lib = opts ? opts.lib : null;
		if (!pkcs11Lib) pkcs11Lib = utils.getConfigSetting('crypto-pkcs11-lib');
		if (!pkcs11Lib || typeof pkcs11Lib !== 'string')
			throw new Error(__func() + 'PKCS11 library path must be specified');
		logger.debug(__func() + 'PKCS11 library: ' + pkcs11Lib);
		/*
		 * If no slot specified, get it from env var or config file.
		 */
		let pkcs11Slot = opts ? opts.slot : null;
		if (!pkcs11Slot && pkcs11Slot !== 0) pkcs11Slot = utils.getConfigSetting('crypto-pkcs11-slot');
		if (!pkcs11Slot && pkcs11Slot !== 0) throw new Error(__func() + 'PKCS11 slot must be specified');
		if (typeof pkcs11Slot === 'string') pkcs11Slot = parseInt(pkcs11Slot);
		if (!Number.isInteger(pkcs11Slot)) throw new Error(__func() + 'PKCS11 slot number invalid');
		logger.debug(__func() + 'PKCS11 slot: ' + pkcs11Slot);
		/*
		 * If no user type is specified, check env var or config file, then
		 * default to 1 (pkcs11js.CKU_USER)
		 */
		let pkcs11UserType = opts ? opts.usertype : null;
		if (!pkcs11UserType)
			pkcs11UserType = utils.getConfigSetting('crypto-pkcs11-usertype', 1);
		if (typeof pkcs11UserType === 'string') {
			pkcs11UserType = parseInt(pkcs11UserType);
		}
		if (!Number.isInteger(pkcs11UserType)) throw new Error(__func() + 'PKCS11 usertype number invalid');
		/*
		 * If no read write specified, check env var or config file, then
		 * default to true
		 */
		let pkcs11ReadWrite = opts ? opts.readwrite : null;
		if (!pkcs11ReadWrite)
			pkcs11ReadWrite = utils.getConfigSetting('crypto-pkcs11-readwrite', true);
		if (typeof pkcs11ReadWrite === 'string') {
			if (pkcs11ReadWrite.toLowerCase() === 'true') {
				pkcs11ReadWrite = true;
			} else if (pkcs11ReadWrite.toLowerCase() === 'false') {
				pkcs11ReadWrite = false;
			} else {
				throw new Error(__func() + 'PKCS11 readwrite setting must be "true" or "false"');
			}
		}
		if (typeof pkcs11ReadWrite !== 'boolean') {
			throw new Error(__func() + 'PKCS11 readwrite setting must be a boolean value');
		}
		/*
		 * If no pin specified, get it from env var or config file.
		 */
		let pkcs11Pin = opts ? opts.pin : null;
		if (!pkcs11Pin) pkcs11Pin = utils.getConfigSetting('crypto-pkcs11-pin');
		if (!pkcs11Pin || typeof pkcs11Pin !== 'string')
			throw new Error(__func() + 'PKCS11 PIN must be set');


		let hashAlgo;
		if (hash && typeof hash === 'string') {
			hashAlgo = hash;
		} else {
			hashAlgo = utils.getConfigSetting('crypto-hash-algo');
		}
		if (!hashAlgo || typeof hashAlgo !== 'string')
			throw new Error(util.format('Unsupported hash algorithm: %j', hashAlgo));
		hashAlgo = hashAlgo.toUpperCase();
		const hashPair = `${hashAlgo}_${keySize}`;
		if (!api.CryptoAlgorithms[hashPair] || !hashPrimitives[hashPair])
			throw Error(util.format('Unsupported hash algorithm and key size pair: %s', hashPair));

		super();

		this._keySize = keySize;

		this._curveName = `secp${this._keySize}r1`;
		this._ecdsaCurve = elliptic.curves[`p${this._keySize}`];

		this._hashAlgo = hashAlgo;

		this._hashFunction = hashPrimitives[hashPair];

		/*
		 * Load native PKCS11 library, open PKCS11 session and login.
		 */
		if (_pkcs11 == null) {
			_pkcs11 = new pkcs11js.PKCS11();
		}
		this._pkcs11 = _pkcs11;

		this._pkcs11OpenSession(this._pkcs11, pkcs11Lib, pkcs11Slot, pkcs11Pin, pkcs11UserType, pkcs11ReadWrite);
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
		const hash = new hashPrimitives.hash_sha2_256();
		return hash.reset().update(this._tod()).finalize();
	}

	/*
	 * Workaround for opencryptoki bug.
	 */
	_fixEcpt(ecpt) {
		if ((ecpt.length & 1) == 0 &&
			(ecpt[0] == 0x04) && (ecpt[ecpt.length - 1] == 0x04)) {
			logger.debug(__func() +
				'workaround opencryptoki EC point wrong length: ' +
				ecpt.length);
			ecpt = ecpt.slice(0, ecpt.length - 1);
		} else if (ecpt[0] == 0x04 && ecpt[2] == 0x04) {
			logger.debug('trimming leading 0x04 0xXX', ecpt);
			ecpt = ecpt.slice(2);
			logger.debug(ecpt);
		}
		return ecpt;
	}

	/*
	 * Open pkcs11 session and login.
	 */
	_pkcs11OpenSession(pkcs11, pkcs11Lib, pkcs11Slot, pkcs11Pin, pkcs11UserType, pkcs11ReadWrite) {
		logger.debug(__func() + 'parameters are pkcs11Slot %s pkcs11Lib %s', pkcs11Slot, pkcs11Lib);

		if (!_initialized) {
			pkcs11.load(pkcs11Lib);
			pkcs11.C_Initialize();
			_initialized = true;
		}

		try {
			// Getting info about PKCS11 Module
			logger.debug(__func() + 'C_GetInfo: ' +
				util.inspect(pkcs11.C_GetInfo(), { depth: null }));

			// Getting list of slots
			const slots = pkcs11.C_GetSlotList(true);
			if (pkcs11Slot >= slots.length)
				throw new Error(__func() + 'PKCS11 slot number non-exist');
			const slot = slots[pkcs11Slot];
			logger.debug(__func() + 'C_GetSlotList: ' +
				util.inspect(slots, { depth: null }));
			// Getting info about slot
			logger.debug(__func() + 'C_GetSlotInfo(' + pkcs11Slot + '): ' +
				util.inspect(pkcs11.C_GetSlotInfo(slot), { depth: null }));
			// Getting info about token
			logger.debug(__func() + 'C_GetTokenInfo(' + pkcs11Slot + '): ' +
				util.inspect(pkcs11.C_GetTokenInfo(slot), { depth: null }));
			// Getting info about Mechanism
			logger.debug(__func() + 'C_GetMechanismList(' + pkcs11Slot + '): ' +
				util.inspect(pkcs11.C_GetMechanismList(slot), { depth: null }));
			/*
			 * Open session.
			 */
			let flags = pkcs11js.CKF_SERIAL_SESSION;
			if (pkcs11ReadWrite) {
				flags = flags | pkcs11js.CKF_RW_SESSION;
			}
			this._pkcs11Session = pkcs11.C_OpenSession(slot, flags);

			// Getting info about Session
			logger.debug(__func() + 'C_GetSessionInfo(' +
				util.inspect(this._pkcs11Session, { depth: null }) + '): ' +
				util.inspect(pkcs11.C_GetSessionInfo(this._pkcs11Session), { depth: null }));

			/*
			 * Login with PIN. Error will be thrown if wrong PIN.
			 */
			pkcs11.C_Login(this._pkcs11Session, pkcs11UserType, pkcs11Pin);
			this._pkcs11Login = true;
			logger.debug(__func() + 'session login successful');

			//pkcs11.C_Logout(session);
			//pkcs11.C_CloseSession(session);
		}
		catch (e) {
			if (this._pkcs11Session != null)
				pkcs11.C_CloseSession(this._pkcs11Session);
			pkcs11.C_Finalize();
			_initialized = false;
			throw (e);
		}
	}

	/*
	 * Generate PKCS11 AES key.
	 *
	 * Return SKI and key handle.
	 */
	_pkcs11GenerateKey(pkcs11, pkcs11Session, pkcs11Token) {
		const ski = this._ski();
		const secretKeyTemplate = [
			{ type: pkcs11js.CKA_ID, value: ski },
			{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
			{ type: pkcs11js.CKA_VALUE_LEN, value: this._keySize / 8 },
			{ type: pkcs11js.CKA_ENCRYPT, value: true },
			{ type: pkcs11js.CKA_DECRYPT, value: true },
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
			{ type: pkcs11js.CKA_PRIVATE, value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN, value: this._pkcs11Login && pkcs11Token },
		];

		try {
			/*
			 * Call PKCS11 API to generate the key.
			 */
			const handle = pkcs11.C_GenerateKey(
				pkcs11Session, { mechanism: pkcs11js.CKM_AES_KEY_GEN },
				secretKeyTemplate);
			/*
			 * Template for querying key attributes (debug only).
			 */
			const objectTemplate = [
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

			return { ski, key: handle };
		}
		catch (e) {
			throw (e);
		}
	}

	/*
	 * Generate PKCS11 ECDSA key pair.
	 *
	 * Return SKI, EC point, and key handles.
	 */
	_pkcs11GenerateECKeyPair(pkcs11, pkcs11Session, pkcs11Token) {
		//var ski = this._ski();
		const privateKeyTemplate = [
			//{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_EC },
			{ type: pkcs11js.CKA_PRIVATE, value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN, value: this._pkcs11Login && pkcs11Token },
			{ type: pkcs11js.CKA_SIGN, value: true },
			{ type: pkcs11js.CKA_DERIVE, value: true },
		];
		const publicKeyTemplate = [
			//{ type: pkcs11js.CKA_ID,        value: ski },
			{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PUBLIC_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_EC },
			{ type: pkcs11js.CKA_PRIVATE, value: false },
			{ type: pkcs11js.CKA_TOKEN, value: this._pkcs11Login && pkcs11Token },
			{ type: pkcs11js.CKA_VERIFY, value: true },
			{
				type: pkcs11js.CKA_EC_PARAMS,
				value: Buffer.from(_pkcs11ParamsSizeToOid[this._keySize], 'hex')
			},
		];

		try {
			/*
			 * Call PKCS11 API to generate the key pair.
			 *
			 * Return public and private key handles.
			 */
			const handles = pkcs11.C_GenerateKeyPair(
				pkcs11Session, { mechanism: pkcs11js.CKM_EC_KEY_PAIR_GEN },
				publicKeyTemplate, privateKeyTemplate);
			/*
			 * Template for querying key attributes (debug only).
			 */
			const objectTemplate = [
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
			let ecpt =
				(this._pkcs11GetAttributeValue(
					pkcs11, pkcs11Session, handles.publicKey,
					[{ type: pkcs11js.CKA_EC_POINT }]))[0].value;
			/*
			 * Workaround for opencryptoki bug reporting wrong ecpt length.
			 */
			ecpt = this._fixEcpt(ecpt);
			logger.debug(__func() + 'ecpt[' + ecpt.length + ']: ' +
				util.inspect(ecpt, { depth: null }));
			/*
			 * Set CKA_ID of public and private key to be SKI.
			 */
			const ski = Buffer.from(hashPrimitives.SHA2_256(ecpt), 'hex');
			this._pkcs11SetAttributeValue(
				pkcs11, pkcs11Session, handles.publicKey,
				[{ type: pkcs11js.CKA_ID, value: ski }, { type: pkcs11js.CKA_LABEL, value: ski.toString('hex') }]);
			this._pkcs11SetAttributeValue(
				pkcs11, pkcs11Session, handles.privateKey,
				[{ type: pkcs11js.CKA_ID, value: ski }, { type: pkcs11js.CKA_LABEL, value: ski.toString('hex') }]);
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

			return { ski, ecpt, pub: handles.publicKey, priv: handles.privateKey };
		}
		catch (e) {
			throw (e);
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
			const secretKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID, value: ski },
				{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
			]);
			if (secretKeyHandle.length == 1)
				return { secretKey: secretKeyHandle[0] };
			/*
			 * Then look for ECDSA key pair.
			 */
			const privKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID, value: ski },
				{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_EC },
			]);
			const pubKeyHandle = this._pkcs11FindObjects(pkcs11, pkcs11Session, [
				{ type: pkcs11js.CKA_ID, value: ski },
				{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PUBLIC_KEY },
				{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_EC },
			]);
			if (pubKeyHandle.length != 1 || privKeyHandle.length != 1)
				throw new Error(__func() + 'no key with SKI ' +
					ski.toString('hex') + ' found');

			return { privateKey: privKeyHandle[0], publicKey: pubKeyHandle[0] };
		}
		catch (e) {
			throw (e);
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
			const attribs =
				this._pkcs11GetAttributeValue(
					this._pkcs11, this._pkcs11Session, publicKey,
					[
						{ type: pkcs11js.CKA_EC_PARAMS },
						{ type: pkcs11js.CKA_EC_POINT },
					]);
			logger.debug(__func() + 'attribuites: ' +
				util.inspect(attribs, { depth: null }));

			let ecparams, ecpt;
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
		catch (e) {
			throw (e);
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
			const sig = pkcs11.C_Sign(pkcs11Session, digest,
				Buffer.alloc(this._keySize));
			logger.debug(__func() + 'ECDSA RAW signature: ' +
				util.inspect(sig, { depth: null }));
			/*
			 * ASN1 DER encoding against malleability.
			 */
			const r = new BN(sig.slice(0, sig.length / 2).toString('hex'), 16);
			const s = new BN(sig.slice(sig.length / 2).toString('hex'), 16);
			const signature = _preventMalleability({ r: r, s: s }, this._ecdsaCurve);
			const der = (new ecsig({ r: signature.r, s: signature.s })).toDER();
			logger.debug(__func() + 'ECDSA DER signature: ' +
				util.inspect(Buffer.from(der), { depth: null }));
			return Buffer.from(der);
		}
		catch (e) {
			throw (e);
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
			const rns = new ecsig(signature, 'hex');
			logger.debug(__func() + 'ECDSA R+S signature: ' +
				util.inspect(rns, { depth: null }));
			const sig = Buffer.concat([rns.r.toArrayLike(Buffer, '', 0),
				rns.s.toArrayLike(Buffer, '', 0)]);
			logger.debug(__func() + 'ECDSA RAW signature: ' +
				util.inspect(sig, { depth: null }));
			/*
			 * key can be either a private or a public key.
			 */
			pkcs11.C_VerifyInit(pkcs11Session,
				{ mechanism: pkcs11js.CKM_ECDSA },
				key._handle);
			return pkcs11.C_Verify(pkcs11Session, digest, sig);
		}
		catch (e) {
			/*
			 * Error is thrown when signature verification fails.
			 */
			if (e.message.indexOf('CKR_SIGNATURE_INVALID') != -1) return false;
			throw (e);
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
			const iv = pkcs11.C_GenerateRandom(pkcs11Session, Buffer.alloc(16));

			pkcs11.C_EncryptInit(pkcs11Session,
				{ mechanism: pkcs11js.CKM_AES_CBC_PAD, parameter: iv },
				key._handle);
			/*
			 * Prepend iv to ciphertext.
			 */
			return Buffer.concat([
				iv,
				pkcs11.C_Encrypt(pkcs11Session, plainText, Buffer.alloc((plainText.length + 16) & (~15)))
			]);
		}
		catch (e) {
			throw (e);
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
			const iv = cipherText.slice(0, 16);

			pkcs11.C_DecryptInit(pkcs11Session,
				{ mechanism: pkcs11js.CKM_AES_CBC_PAD, parameter: iv },
				key._handle);

			return pkcs11.C_Decrypt(pkcs11Session,
				cipherText.slice(16, cipherText.length),
				Buffer.alloc(cipherText.length - 16));
		}
		catch (e) {
			throw (e);
		}
	}

	/*
	 * PKCS11 derive key with ECDH mechanism.
	 */
	_pkcs11DeriveKey(pkcs11, pkcs11Session, key, pub) {
		const ski = this._ski();
		const derivedKeyTemplate = [
			{ type: pkcs11js.CKA_ID, value: ski },
			{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
			{ type: pkcs11js.CKA_VALUE_LEN, value: 256 / 8 },
			{ type: pkcs11js.CKA_ENCRYPT, value: true },
			{ type: pkcs11js.CKA_DECRYPT, value: true },
			{ type: pkcs11js.CKA_PRIVATE, value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN, value: false },
		];

		try {
			return pkcs11.C_DeriveKey(
				pkcs11Session,
				{
					mechanism: pkcs11js.CKM_ECDH1_DERIVE,
					parameter: {
						type: pkcs11js.CK_PARAMS_EC_DH,
						kdf: pkcs11js.CKD_SHA256_KDF,
						publicData: pub._ecpt,
					}
				},
				key._handle, derivedKeyTemplate);
		}
		catch (e) {
			throw (e);
		}
	}

	_pkcs11CreateObject(pkcs11, pkcs11Session, key, pkcs11Token) {
		const ski = this._ski();
		const keyTemplate = [
			{ type: pkcs11js.CKA_ID, value: ski },
			{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
			{ type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
			//SoftHSMv2 prohibits specifying CKA_VALUE_LEN
			//{ type: pkcs11js.CKA_VALUE_LEN, value: key.length },
			{ type: pkcs11js.CKA_VALUE, value: key },
			{ type: pkcs11js.CKA_ENCRYPT, value: true },
			{ type: pkcs11js.CKA_DECRYPT, value: true },
			{ type: pkcs11js.CKA_PRIVATE, value: this._pkcs11Login },
			{ type: pkcs11js.CKA_TOKEN, value: this._pkcs11Login && pkcs11Token },
		];

		try {
			const handle = pkcs11.C_CreateObject(pkcs11Session, keyTemplate);
			return { ski, key: handle };
		}
		catch (e) {
			throw (e);
		}
	}

	/*
	 * Query PKCS11 object attributes.
	 *
	 * Return array of [ { type:..., value:... }, ... ]
	 */
	_pkcs11GetAttributeValue(pkcs11, pkcs11Session, pkcs11Object, pkcs11Template) {
		return pkcs11.C_GetAttributeValue(pkcs11Session, pkcs11Object, pkcs11Template);
	}

	/*
	 * Set PKCS11 object attributes.
	 */
	_pkcs11SetAttributeValue(pkcs11, pkcs11Session, pkcs11Object, pkcs11Template) {
		return pkcs11.C_SetAttributeValue(pkcs11Session, pkcs11Object, pkcs11Template);
	}

	/*
	 * Find PKCS11 objects matching attribute template.
	 *
	 * Return array of object handles.
	 */
	_pkcs11FindObjects(pkcs11, pkcs11Session, pkcs11Template) {
		pkcs11.C_FindObjectsInit(pkcs11Session, pkcs11Template);
		const objs = [];
		let obj = pkcs11.C_FindObjects(pkcs11Session);
		while (obj) {
			const objectTemplate = [
				{ type: pkcs11js.CKA_CLASS },
				{ type: pkcs11js.CKA_KEY_TYPE },
				{ type: pkcs11js.CKA_PRIVATE },
				{ type: pkcs11js.CKA_TOKEN },
				{ type: pkcs11js.CKA_ID },
			];
			logger.debug(__func() + 'obj:  ' + util.inspect(obj, { depth: null }));
			logger.debug(__func() + 'attr: ' +
				util.inspect(this._pkcs11GetAttributeValue(pkcs11, pkcs11Session, obj, objectTemplate)));
			objs.push(obj);
			obj = pkcs11.C_FindObjects(pkcs11Session);
		}
		pkcs11.C_FindObjectsFinal(pkcs11Session);
		return objs;
	}

	setCryptoKeyStore(cryptoKeyStore) {
		this._cryptoKeyStore = cryptoKeyStore;
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
		if (opts != null && (typeof opts.algorithm === 'undefined' || opts.algorithm === null)) {
			opts.algorithm = 'ECDSA';
		}
		if (typeof opts === 'undefined' || opts === null ||
			typeof opts.algorithm === 'undefined' || opts.algorithm === null ||
			typeof opts.algorithm !== 'string')
			return Promise.reject(Error(__func() + 'opts.algorithm must be String type'));

		const token = !opts.ephemeral;
		const self = this;

		switch (opts.algorithm.toUpperCase()) {
		case 'AES':
			return new Promise(((resolve, reject) => {
				try {
					if (self._keySize != 256) throw new Error(
						__func() + 'AES key size must be 256 (bits)');

					const attr = self._pkcs11GenerateKey(
						self._pkcs11, self._pkcs11Session, token);
						/*
						 * Put key in the session cache and return
						 * promise of the key.
						 */
					const key = new aesKey(attr, self._keySize);
					self._skiToKey[attr.ski.toString('hex')] = key;
					return resolve(key);
				}
				catch (e) {
					return reject(e);
				}
			}));
		case 'ECDSA':
			return new Promise(((resolve, reject) => {
				try {
					const attr = self._pkcs11GenerateECKeyPair(
						self._pkcs11, self._pkcs11Session, token);
						/*
						 * Put key in the session cache and return
						 * promise of the key.
						 */
					const key = new ecdsaKey(attr, self._keySize);
					self._skiToKey[attr.ski.toString('hex')] = key;
					key._cryptoSuite = self;
					return resolve(key);
				}
				catch (e) {
					return reject(e);
				}
			}));
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
		if (!ski || !(ski instanceof Buffer || typeof ski === 'string'))
			return Promise.reject(Error(__func() + 'ski must be Buffer|string type'));
		/*
		 * Found the ski in the session key cache.
		 */
		const hit = this._skiToKey[ski.toString('hex')];
		if (hit !== undefined) {
			logger.debug(__func() + 'cache hit ' +
				util.inspect(hit, { depth: null }));
			return Promise.resolve(hit);
		}
		if (typeof ski == 'string') {
			ski = Buffer.from(ski, 'hex');
		}

		const self = this;
		return new Promise(((resolve, reject) => {
			try {
				const handle = self._pkcs11SkiToHandle(
					self._pkcs11, self._pkcs11Session, ski);
				/*
				 * AES key.
				 */
				let key;
				if (typeof handle.secretKey !== 'undefined') {
					if (self._keySize != 256) {
						throw new Error(__func() + 'key size mismatch, class: ' + self._keySize + ', ski: 256');
					}
					key = new aesKey({ ski, key: handle.secretKey }, self._keySize);
				}
				/*
				 * ECDSA key.
				 */
				else {
					const attr = self._pkcs11QueryEcparamsEcpt(
						self._pkcs11, self._pkcs11Session,
						handle.publicKey);

					const keySize = _pkcs11ParamsOidToSize[
						attr.ecparams.toString('hex').
							toUpperCase()];
					if (keySize === undefined ||
						keySize != self._keySize) {
						throw new Error(__func() + 'key size mismatch, class: ' + self._keySize + ', ski: ' + keySize);
					}
					key = new ecdsaKey({ ski, ecpt: attr.ecpt, pub: handle.publicKey, priv: handle.privateKey },
						self._keySize);
				}
				/*
				 * Put key in the session cache and return
				 * promise of the key.
				 */
				self._skiToKey[ski.toString('hex')] = key;
				return resolve(key);
			}
			catch (e) {
				return reject(e);
			}
		}));
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#sign}
	 * Signs digest using key k.
	 *
	 */
	sign(key, digest) {
		if (typeof key === 'undefined' || key === null ||
			!(key instanceof ecdsaKey) || !key.isPrivate())
			throw new Error(__func() + 'key must be PKCS11_ECDSA_KEY type private key');
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
			!(key instanceof ecdsaKey || key instanceof ECDSAKey))
			throw new Error(__func() + 'key must be PKCS11_ECDSA_KEY type or ECDSA_KEY type');
		if (typeof signature === 'undefined' || signature === null ||
			!(signature instanceof Buffer))
			throw new Error(__func() + 'signature must be Buffer type');
		if (typeof digest === 'undefined' || digest === null ||
			!(digest instanceof Buffer))
			throw new Error(__func() + 'digest must be Buffer type');

		if (key instanceof ECDSAKey) {
			const ecdsa = new EC(this._ecdsaCurve);
			const pubKey = ecdsa.keyFromPublic(key.getPublicKey()._key.pubKeyHex, 'hex');
			return pubKey.verify(this.hash(digest), signature);
		}

		return this._pkcs11Verify(this._pkcs11, this._pkcs11Session,
			key.getPublicKey(), digest, signature);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#encrypt}
	 * Encrypts plainText using key.
	 * The opts argument is not supported.
	 */
	encrypt(key, plainText, opts) {
		if (opts);
		if (typeof key === 'undefined' || key === null || !(key instanceof aesKey))
			throw new Error(__func() + 'key must be PKCS11_AES_KEY type');
		if (typeof plainText === 'undefined' || plainText === null ||
			!(plainText instanceof Buffer))
			throw new Error(__func() + 'plainText must be Buffer type');

		return this._pkcs11Encrypt(this._pkcs11, this._pkcs11Session, key, plainText);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#decrypt}
	 * Decrypts cipherText using key.
	 * The opts argument is not supported yet.
	 */
	decrypt(key, cipherText, opts) {
		if (opts);
		if (typeof key === 'undefined' || key === null || !(key instanceof aesKey))
			throw new Error(__func() + 'key must be PKCS11_AES_KEY type');
		if (typeof cipherText === 'undefined' || cipherText === null ||
			!(cipherText instanceof Buffer))
			throw new Error(__func() + 'cipherText must be Buffer type');

		return this._pkcs11Decrypt(this._pkcs11, this._pkcs11Session, key, cipherText);
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#deriveKey}
	 */
	deriveKey(key, opts) {
		if (key || opts);
		throw new Error(__func() + 'not yet supported');
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#importKey}
	 */
	importKey(pem, opts) {
		const optsLocal = opts ? opts : {};

		const algorithm = optsLocal.algorithm ? optsLocal.algorithm : 'X509Certificate';

		if (!pem || !(pem instanceof Buffer || typeof pem === 'string'))
			return Promise.reject(Error(__func() + 'pem must be Buffer type or String type'));
		if (typeof algorithm !== 'string')
			return Promise.reject(Error(__func() + 'opts.algorithm must be String type'));

		const token = !optsLocal.ephemeral;
		const self = this;

		switch (algorithm.toUpperCase()) {
		case 'X509CERTIFICATE':
			if (token) {
				return Promise.resolve(new ECDSAKey(KEYUTIL.getKey(pem)));
			} else {
				return new ECDSAKey(KEYUTIL.getKey(pem));
			}
		case 'AES':
			return new Promise(((resolve, reject) => {
				try {
					if (pem.length != (256 / 8))
						throw new Error(__func() + 'AES key size must be 256 (bits)');

					const attr = self._pkcs11CreateObject(self._pkcs11, self._pkcs11Session, pem, token);
					/*
									 * Put key in the session cache and return
									 * promise of the key.
									 */
					const key = new aesKey(attr, pem.length * 8);
					self._skiToKey[attr.ski.toString('hex')] = key;
					return resolve(key);
				}
				catch (e) {
					reject(e);
				}
			}));
		case 'ECDSA':
			return Promise.reject(Error(__func() + 'ECDSA key not yet supported'));
		default:
			return Promise.reject(Error(__func() + 'only AES or ECDSA key supported'));
		}
	}

	/**
	 * This is an implementation of {@link module:api.CryptoSuite#hash}
	 * The opts argument is not supported yet.
	 */
	hash(msg, opts) {
		if (opts);
		return this._hashFunction(msg);
	}

	closeSession() {
		this._pkcs11.C_CloseSession(this._pkcs11Session);
	}

	finalize() {
		this._pkcs11.C_Finalize();
		_initialized = false;
	}

}

module.exports = CryptoSuite_PKCS11;
