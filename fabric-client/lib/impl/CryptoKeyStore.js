/*
 Copyright 2016-2017 IBM All Rights Reserved.

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

var jsrsasign = require('jsrsasign');
var KEYUTIL = jsrsasign.KEYUTIL;

var api = require('../api.js');
var utils = require('../utils.js');
var ECDSAKey = require('./ecdsa/key.js');

var logger = utils.getLogger('CryptoKeyStore.js');

/*
 * The mixin enforces the special indexing mechanism with private and public
 * keys on top of a standard implementation of the KeyValueStore interface
 * with the getKey() and putKey() methods
 */
var CryptoKeyStoreMixin = (KeyValueStore) => class extends KeyValueStore {
	constructor(options) {
		return super(options);
	}

	getKey(ski) {
		var self = this;

		// first try the private key entry, since it encapsulates both
		// the private key and public key
		return this.getValue(_getKeyIndex(ski, true))
		.then((raw) => {
			if (raw !== null) {
				var privKey = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(raw);
				// TODO: for now assuming ECDSA keys only, need to add support for RSA keys
				return new ECDSAKey(privKey);
			}

			// didn't find the private key entry matching the SKI
			// next try the public key entry
			return self.getValue(_getKeyIndex(ski, false));
		}).then((key) => {
			if (ECDSAKey.isInstance(key))
				return key;

			if (key !== null) {
				var pubKey = KEYUTIL.getKey(key);
				return new ECDSAKey(pubKey);
			}
		});
	}

	putKey(key) {
		var idx = _getKeyIndex(key.getSKI(), key.isPrivate());
		var pem = key.toBytes();
		return this.setValue(idx, pem)
		.then(() => {
			return key;
		});
	}
};

/**
 * A CryptoKeyStore uses an underlying instance of {@link module:api.KeyValueStore} implementation
 * to persist crypto keys.
 *
 * @param {function} KVSImplClass Optional. The built-in key store saves private keys.
 *    The key store may be backed by different {@link KeyValueStore} implementations.
 *    If specified, the value of the argument must point to a module implementing the
 *    KeyValueStore interface.
 * @param {Object} opts Implementation-specific option object used in the constructor
 *
 * @class
 */
var CryptoKeyStore = function(KVSImplClass, opts) {
	var superClass;

	if (typeof KVSImplClass !== 'function') {
		superClass = require(utils.getConfigSetting('key-value-store'));
	} else {
		superClass = KVSImplClass;
	}

	if (KVSImplClass !== null && typeof opts === 'undefined') {
		// the function is called with only one argument for the 'opts'
		opts = KVSImplClass;
	}

	var MyClass = class extends CryptoKeyStoreMixin(superClass) {};
	return new MyClass(opts);
};

function _getKeyIndex(ski, isPrivateKey) {
	if (isPrivateKey)
		return ski + '-priv';
	else
		return ski + '-pub';
}

module.exports = CryptoKeyStore;
