/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';
const jsrsasign = require('jsrsasign');
const KEYUTIL = jsrsasign.KEYUTIL;

const ECDSAKey = require('./ecdsa/key.js');
const KeyValueStore = require('../KeyValueStore');
const InMemoryKeyValueStore = require('./InMemoryKeyValueStore');

const _getPrivateKeyIndex = (ski) => {
	return ski + '-priv';
};

const _getPublicKeyIndex = (ski) => {
	return ski + '-pub';
};

/**
 * A CryptoKeyStore uses an underlying instance of {@link module:api.KeyValueStore} implementation
 * to persist crypto keys.
 *
 * This class enforces the special indexing mechanism with private and public
 * keys on top of a standard implementation of the KeyValueStore interface
 * with the getKey() and putKey() methods
 *
 * @class
 */
class CryptoKeyStore extends KeyValueStore {
	/**
	 * @param {KeyValueStore} keyValueStore
	 */
	constructor(keyValueStore) {
		super();
		this.keyValueStore = keyValueStore;
	}

	async initialize() {
		await this.keyValueStore.initialize();
	}

	async getValue(name) {
		return await this.keyValueStore.getValue(name);
	}

	async setValue(name, value) {
		await this.keyValueStore.setValue(name, value);
	}

	async getKey(ski) {
		// first try the private key entry, since it encapsulates both
		// the private key and public key
		const raw = await this.getValue(_getPrivateKeyIndex(ski));

		if (raw !== null) {
			const privKey = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(raw);
			// TODO: for now assuming ECDSA keys only, need to add support for RSA keys
			return new ECDSAKey(privKey);
		}

		// didn't find the private key entry matching the SKI
		// next try the public key entry
		const key = await this.getValue(_getPublicKeyIndex(ski));
		if (key instanceof ECDSAKey) {
			return key;
		}
		if (key !== null) {
			const pubKey = KEYUTIL.getKey(key);
			return new ECDSAKey(pubKey);
		}

	}

	async putKey(key) {
		const idx = key.isPrivate() ? _getPrivateKeyIndex(key.getSKI()) : _getPublicKeyIndex(key.getSKI());
		const pem = key.toBytes();
		await this.setValue(idx, pem);
		return key;
	}
}

/**
 *
 * @param {function} KVSImplClass Optional. The built-in key store saves private keys.
 *    The key store may be backed by different {@link KeyValueStore} implementations.
 *    If specified, the value of the argument must point to a module implementing the
 *    KeyValueStore interface.
 * @param {Object} opts Implementation-specific option object used in the constructor
 * @return {CryptoKeyStore}
 */
const newInstance = (KVSImplClass, opts) => {
	const keyValueStore = typeof KVSImplClass === 'function' ? new KVSImplClass(opts) : new InMemoryKeyValueStore();
	return Promise.resolve(new CryptoKeyStore(keyValueStore));
};


module.exports = newInstance;
