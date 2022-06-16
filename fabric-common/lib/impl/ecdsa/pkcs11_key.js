/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const Key = require('../../Key');
const Utils = require('../../Utils');
const jsrsa = require('jsrsasign');
const asn1 = jsrsa.asn1;

const elliptic = require('elliptic');
const EC = elliptic.ec;


/**
 * This module implements the {@link module:api.Key} interface, for ECDSA key management
 * by Hardware Security Module support via PKCS#11 interface.
 *
 * @class Pkcs11EcdsaKey
 * @extends module:api.Key
 */
const Pkcs11EcdsaKey = class extends Key {

	constructor(attr, size) {
		if (typeof attr === 'undefined' || attr === null) {
			throw new Error('constructor: attr parameter must be specified');
		}
		if (typeof attr.ski !== 'undefined' && attr.ski !== null && !(attr.ski instanceof Buffer)) {
			throw new Error('constructor: key SKI must be Buffer type');
		}
		if ((typeof attr.priv === 'undefined' || attr.priv === null) &&
			(typeof attr.pub === 'undefined' || attr.pub === null)) {
			throw new Error('constructor: invalid key handles');
		}
		if (typeof attr.priv !== 'undefined' && attr.priv !== null &&
			!(attr.priv instanceof Buffer)) {
			throw new Error('constructor: private key handle must be Buffer type');
		}
		if (typeof attr.pub !== 'undefined' && attr.pub !== null &&
			!(attr.pub instanceof Buffer)) {
			throw new Error('constructor: public key handle must be Buffer type');
		}
		if (size === 'undefined') {
			throw new Error('constructor: size parameter must be specified');
		}
		if (size !== 256 && size !== 384) {
			throw new Error(
				'constructor: only 256 or 384 bits key size is supported');
		}

		super();

		/*
		 * Common for both private and public key.
		 */
		this._ski = attr.ski;
		this._size = size;
		this._isPrivate = false;

		/*
		 * private key: ski set, ecpt set, priv set,   pub set
		 * public  key: ski set, ecpt set, priv unset, pub set
		 */
		if (typeof attr.priv !== 'undefined' && attr.priv !== null) {
			this._handle = attr.priv;
			this._isPrivate = true;
			if (attr.ski && attr.ecpt && attr.pub) {
				this._pub = new Pkcs11EcdsaKey({ski: attr.ski, ecpt: attr.ecpt, pub: attr.pub}, size);
			}
		} else {
			this._ecpt = attr.ecpt;
			this._handle = attr.pub;
			this._pub = null;
		}
	}

	signCSR(csr, sigAlgName) {
		csr.asn1SignatureAlg = new asn1.x509.AlgorithmIdentifier({
			name: sigAlgName,
		});
		const csri = new asn1.csr.CertificationRequestInfo(csr.params);
		const digest = this._cryptoSuite.hash(
			Buffer.from(csri.getEncodedHex(), 'hex')
		);
		const sig = this._cryptoSuite.sign(this, Buffer.from(digest, 'hex'));
		csr.params.sighex = sig.toString('hex');

		csr.asn1Sig = new asn1.DERBitString({hex: '00' + csr.params.sighex});
		const seq = new asn1.DERSequence({
			array: [csri, csr.asn1SignatureAlg, csr.asn1Sig],
		});
		csr.hTLV = seq.getEncodedHex();
		csr.isModified = false;
	}

	newCSRPEM(param) {
		const _KJUR_asn1_csr = asn1.csr;
		if (param.subject === undefined) {
			throw new Error('parameter subject undefined');
		}
		if (param.sbjpubkey === undefined) {
			throw new Error('parameter sbjpubkey undefined');
		}
		if (param.sigalg === undefined) {
			throw new Error('parameter sigalg undefined');
		}
		if (param.sbjprvkey === undefined) {
			throw new Error('parameter sbjpubkey undefined');
		}
		const ecdsa = new EC(this._cryptoSuite._ecdsaCurve);
		const pubKey = ecdsa.keyFromPublic(this._pub._ecpt);
		const extreq = Utils.mapCSRExtensions(param.ext);
		const sigAlgName = param.sigalg;
		const csr = new _KJUR_asn1_csr.CertificationRequest({
			subject: param.subject,
			sbjpubkey: {xy: pubKey.getPublic('hex'), curve: 'secp256r1'},
			sigalg: sigAlgName,
			extreq: extreq
		});
		this.signCSR(csr, sigAlgName);

		const pem = csr.getPEM();
		return pem;
	}

	/* implementation must include 'opts' as a parameter to this method */
	generateKey() {
		throw new Error('Not implemented');
	}

	generateEphemeralKey() {
		throw new Error('Not implemented');
	}

	generateCSR(subjectDN, extensions) {
		// check to see if this is a private key
		if (!this.isPrivate()) {
			throw new Error('A CSR cannot be generated from a public key');
		}

		const csr = this.newCSRPEM({
			subject: {str: asn1.x509.X500Name.ldapToOneline(subjectDN)},
			sbjpubkey: this._pub,
			sigalg: 'SHA256withECDSA',
			sbjprvkey: this,
			ext: extensions
		});
		return csr;
	}

	getSKI() {
		return this._ski.toString('hex');
	}

	getHandle() {
		return this._handle.toString('hex');
	}

	isSymmetric() {
		return false;
	}

	isPrivate() {
		return (this._pub !== null);
	}

	getPublicKey() {
		return this._pub === null ? this : this._pub;
	}

	/**
	 * Returns the string representation of the bytes that represent
	 * the key.
	 *    if private key then it will be the handle to the private key
	 *    if public key then it will be the actual public key
	 * @returns {string} key or handle to the key as string
	 */
	toBytes() {
		if (this.isPrivate) {
			return this._handle.toString('hex');
		}

		return this._ecpt.toString('hex');
	}
};

module.exports = Pkcs11EcdsaKey;
