/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const api = require('../../api.js');

const PKCS11_AES_KEY = class extends api.Key {

	constructor(attr, size) {
		if (typeof attr === 'undefined' || attr === null) {
			throw new Error('constructor: attr parameter must be specified');
		}
		if (typeof attr.ski === 'undefined' || attr.ski === null) {
			throw new Error('constructor: invalid key SKI');
		}
		if (!(attr.ski instanceof Buffer)) {
			throw new Error('constructor: key SKI must be Buffer type');
		}
		if (typeof attr.key === 'undefined' || attr.key === null) {
			throw new Error('constructor: invalid key handle');
		}
		if (!(attr.key instanceof Buffer)) {
			throw new Error('constructor: key handle must be Buffer type');
		}
		if (size === 'undefined') {
			throw new Error('constructor: size parameter must be specified');
		}
		if (size !== 256) {
			throw new Error('constructor: only 256 bits key size is supported');
		}

		super();

		this._ski = attr.ski;
		this._handle = attr.key;
		this._size = size; /* bits */
		this._block = 128; /* bits */
	}

	getSKI() {
		return this._ski;
	}

	isSymmetric() {
		return true;
	}

	isPrivate() {
		return false;
	}

	getPublicKey() {
		throw new Error('getPublicKey: not an asymmetric key');
	}

	toBytes() {
		throw new Error('toBytes: not allowed for secret key');
	}
};

module.exports = PKCS11_AES_KEY;
