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

var api = require('../../api.js');

var PKCS11_AES_KEY = class extends api.Key {

	constructor(attr, size) {
		if (typeof attr === 'undefined' || attr === null)
			throw new Error('constructor: attr parameter must be specified');
		if (typeof attr.ski === 'undefined' || attr.ski === null)
			throw new Error('constructor: invalid key SKI');
		if (!(attr.ski instanceof Buffer))
			throw new Error('constructor: key SKI must be Buffer type');
		if (typeof attr.key === 'undefined' || attr.key === null)
			throw new Error('constructor: invalid key handle');
		if (!(attr.key instanceof Buffer))
			throw new Error('constructor: key handle must be Buffer type');
		if (size === 'undefined')
			throw new Error('constructor: size parameter must be specified');
		if (size != 256)
			throw new Error('constructor: only 256 bits key size is supported');

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
