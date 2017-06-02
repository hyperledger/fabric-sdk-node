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

const _spkiBase = { 256: '3059301306072A8648CE3D020106082A8648CE3D030107034200',
		    384: '',
		  };

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
		    (typeof attr.pub  === 'undefined' || attr.pub  === null))
			throw new Error('constructor: invalid key handles');
		if (typeof attr.priv !== 'undefined' && attr.priv !== null &&
		    !(attr.priv instanceof Buffer)) throw new Error(
			    'constructor: private key handle must be Buffer type');
		if (typeof attr.pub  !== 'undefined' && attr.pub  !== null &&
		    !(attr.pub  instanceof Buffer)) throw new Error(
			    'constructor: public key handle must be Buffer type');
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

	getSKI() {
		return this._ski;
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
