/*
  Copyright 2017 IBM All Rights Reserved.

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

var api = require('../../api.js');
var jsrsa = require('jsrsasign');
var asn1 = jsrsa.asn1;

var elliptic = require('elliptic');
var EC = elliptic.ec;


/**
 * This module implements the {@link module:api.Key} interface, for ECDSA key management
 * by Hardware Security Module support via PKCS#11 interface.
 *
 * @class PKCS11_ECDSA_KEY
 * @extends module:api.Key
 */
var PKCS11_ECDSA_KEY = class extends api.Key {

	constructor(attr, size) {
		if (typeof attr === 'undefined' || attr === null)
			throw new Error('constructor: attr parameter must be specified');
		if (typeof attr.ski === 'undefined' || attr.ski === null)
			throw new Error('constructor: invalid key SKI');
		if (!(attr.ski instanceof Buffer))
			throw new Error('constructor: key SKI must be Buffer type');
		if ((typeof attr.priv === 'undefined' || attr.priv === null) &&
			(typeof attr.pub === 'undefined' || attr.pub === null))
			throw new Error('constructor: invalid key handles');
		if (typeof attr.priv !== 'undefined' && attr.priv !== null &&
			!(attr.priv instanceof Buffer))
			throw new Error('constructor: private key handle must be Buffer type');
		if (typeof attr.pub !== 'undefined' && attr.pub !== null &&
			!(attr.pub instanceof Buffer))
			throw new Error('constructor: public key handle must be Buffer type');
		if (size === 'undefined')
			throw new Error('constructor: size parameter must be specified');
		if (size != 256 && size != 384) throw new Error(
			'constructor: only 256 or 384 bits key size is supported');

		super();

		/*
		 * Common for both private and public key.
		 */
		this._ski = attr.ski;
		this._size = size;

		/*
		 * private key: ski set, ecpt set, priv set,   pub set
		 * public  key: ski set, ecpt set, priv unset, pub set
		 */
		if (typeof attr.priv !== 'undefined' && attr.priv !== null) {
			this._handle = attr.priv;
			this._pub = new PKCS11_ECDSA_KEY(
				{ ski: attr.ski, ecpt: attr.ecpt, pub: attr.pub }, size);
		}
		else {
			this._ecpt = attr.ecpt;
			this._handle = attr.pub;
			this._pub = null;
		}
	}

	signCSR(csr, sigAlgName) {

		csr.asn1SignatureAlg =
			new asn1.x509.AlgorithmIdentifier({'name': sigAlgName});

		var digest = this._cryptoSuite.hash(Buffer.from(csr.asn1CSRInfo.getEncodedHex(), 'hex'));
		var sig = this._cryptoSuite.sign(this, Buffer.from(digest, 'hex'));
		csr.hexSig = sig.toString('hex');

		csr.asn1Sig = new asn1.DERBitString({'hex': '00' + csr.hexSig});
		var seq = new asn1.DERSequence({'array': [csr.asn1CSRInfo, csr.asn1SignatureAlg, csr.asn1Sig]});
		csr.hTLV = seq.getEncodedHex();
		csr.isModified = false;
	}

	newCSRPEM(param) {
		var _KJUR_asn1_csr = asn1.csr;
		if (param.subject === undefined) throw 'parameter subject undefined';
		if (param.sbjpubkey === undefined) throw 'parameter sbjpubkey undefined';
		if (param.sigalg === undefined) throw 'parameter sigalg undefined';
		if (param.sbjprvkey === undefined) throw 'parameter sbjpubkey undefined';
		var ecdsa = new EC(this._cryptoSuite._ecdsaCurve);
		var pubKey = ecdsa.keyFromPublic(this._pub._ecpt);
		var csri = new _KJUR_asn1_csr.CertificationRequestInfo();
		csri.setSubjectByParam(param.subject);
		csri.setSubjectPublicKeyByGetKey({xy: pubKey.getPublic('hex'), curve: 'secp256r1'});
		if (param.ext !== undefined && param.ext.length !== undefined) {
			for (let ext of param.ext) {
				for (let key in ext) {
					csri.appendExtensionByName(key, ext[key]);
				}
			}
		}

		var csr = new _KJUR_asn1_csr.CertificationRequest({'csrinfo': csri});
		this.signCSR(csr, param.sigalg);

		var pem = csr.getPEMString();
		return pem;

	}

	generateCSR(subjectDN) {
		//check to see if this is a private key
		if (!this.isPrivate()){
			throw new Error('A CSR cannot be generated from a public key');
		}

		try {
			var csr = this.newCSRPEM({
				subject: { str: asn1.x509.X500Name.ldapToOneline(subjectDN)},
				sbjpubkey: this._pub,
				sigalg: 'SHA256withECDSA',
				sbjprvkey: this
			});
			return csr;
		} catch (err) {
			throw err;
		}
	}

	getSKI() {
		return this._ski.toString('hex');
	}

	isSymmetric() {
		return false;
	}

	isPrivate() {
		return (this._pub != null);
	}

	getPublicKey() {
		return this._pub == null ? this : this._pub;
	}

	toBytes() {
		if (this._pub != null)
			throw new Error('toBytes: not allowed for private key');

		return this._ecpt;
	}
};

module.exports = PKCS11_ECDSA_KEY;
