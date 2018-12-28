/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');
const BaseWallet = require('./basewallet');
const api = require('fabric-client/lib/api.js');
const logger = require('../../logger').getLogger('InMemoryWallet');

// this will be shared across all instance of a memory wallet, so really an app should
// only have one instance otherwise if you put 2 different identities with the same
// label it will overwrite the existing one.
const memoryStore = new Map();

/**
 * In-memory wallet implementation. Note that the in-memory state is shared between all
 * instances of this class in a given Node.js process.
 * @memberof module:fabric-network
 * @implements {module:fabric-network.Wallet}
 */
class InMemoryWallet extends BaseWallet {
	/**
	 * Creates an instance of an in-memory wallet.
	 * @param {WalletMixin} [walletmixin] Optionally provide an alternative wallet mixin.
	 * Defaults to [X509WalletMixin]{@link module:fabric-network.X509WalletMixin}.
	 */
	constructor(walletmixin) {
		super(walletmixin);
		logger.debug('in InMemoryWallet constructor');
	}

	async getStateStore(label) {
		logger.debug('in getStateStore, label = %s', label);
		label = this.normalizeLabel(label);
		const store = await new InMemoryKVS(label);
		return store;
	}

	async getCryptoSuite(label) {
		logger.debug('in getCryptoSuite, label = %s', label);
		label = this.normalizeLabel(label);
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(InMemoryKVS, label));
		return cryptoSuite;
	}

	/**
	 * @private
	 */
	async delete(label) {
		logger.debug('in delete, label = %s', label);
		label = this.normalizeLabel(label);
		if (memoryStore.has(label)) {
			memoryStore.delete(label);
			return true;
		}
		return false;
	}

	/**
	 * @private
	 */
	async exists(label) {
		logger.debug('in exists, label = %s', label);
		label = this.normalizeLabel(label);
		return memoryStore.has(label);
	}

	async getAllLabels() {
		const labels =  Array.from(memoryStore.keys());
		logger.debug('getAllLabels returns: %j', labels);
		return labels;
	}
}

class InMemoryKVS extends api.KeyValueStore {

	/**
	 * constructor
	 *
	 * @param {Object} options contains a single property <code>path</code> which points to the top-level directory
	 * for the store
	 */
	constructor(prefix) {
		super();
		logger.debug('in InMemoryKVS constructor, prefix = ' + prefix);
		this.partitionKey = prefix;
		return Promise.resolve(this);
	}

	async getValue(name) {
		logger.debug('getValue, name = ' + name);
		const idStore = memoryStore.get(this.partitionKey);
		if (!idStore) {
			return null;
		}
		return idStore.get(name);
	}

	async setValue(name, value) {
		logger.debug('setValue, name = ' + name);
		let idStore = memoryStore.get(this.partitionKey);
		if (!idStore) {
			idStore = new Map();
		}
		idStore.set(name, value);
		memoryStore.set(this.partitionKey, idStore);
		return value;
	}
}

module.exports = InMemoryWallet;
