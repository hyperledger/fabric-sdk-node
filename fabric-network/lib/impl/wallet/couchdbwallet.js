/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Client = require('fabric-client');
const BaseWallet = require('./basewallet');
const CouchDBVStore = require('fabric-client/lib/impl/CouchDBKeyValueStore');
const logger = require('../../logger').getLogger('CouchDBWallet');
const Nano = require('nano');
/**
 * This class defines an implementation of an Identity wallet that persists
 * to a Couch DB database
 *
 * @class
 * @extends {BaseWallet}
 */
class CouchDBWallet extends BaseWallet {

	/**
	 * Creates an instance of the CouchDBWallet
	 * @param {Object} options contains required property <code>url</code> and other Nano options
	 * @param {WalletMixin} mixin
	 * @memberof CouchDBWallet
	 */
	constructor(options, mixin) {
		const method = 'constructor';
		super(mixin);
		logger.debug('in CouchDBWallet %s', method);
		if (!options) {
			throw new Error('No options given');
		}
		if (!options.url) {
			throw new Error('No url given');
		}
		this.options = options;
		this.couch = Nano(options.url);
		this.dbOptions = {};
		Object.assign(this.dbOptions, this.options);
	}

	_createOptions() {
		const dbOptions = {};
		Object.assign(dbOptions, this.options);
		dbOptions.name = 'wallet';
		return dbOptions;
	}

	/**
	 * @inheritdoc
	 */
	async getStateStore(label) {
		const method = 'getStateStore';
		logger.debug('in %s, label = %s', method, label);
		const store = new CouchDBWalletKeyValueStore(this._createOptions());
		return store;
	}

	/**
	 * @inheritdoc
	 */
	async getCryptoSuite(label) {
		const method = 'getCryptoSuite';
		logger.debug('in %s, label = %s', method, label);
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(CouchDBWalletKeyValueStore, this._createOptions()));
		return cryptoSuite;
	}

	/**
	 * @inheritdoc
	 */
	async delete(label) {
		const method = 'delete';
		logger.debug('in %s, label = %s', method, label);
		label = this.normalizeLabel(label);
		const kvs = await this.getStateStore(this.options.name);
		return kvs.delete(label);
	}

	/**
	 * @inheritdoc
	 */
	async exists(label) {
		const method = 'exists';
		logger.debug('in %s, label = %s', method, label);
		label = this.normalizeLabel(label);
		const kvs = await this.getStateStore(this.options.name);
		return kvs.exists(label);
	}

	/**
	 * @inheritdoc
	 */
	async getAllLabels() {
		const method = 'getAllLabels';
		logger.debug('in %s', method);
		const kvs = await this.getStateStore(this.options.name);
		return kvs.getAllLabels();
	}
}

class CouchDBWalletKeyValueStore extends CouchDBVStore {
	constructor(options) {
		super(options);
	}

	async delete(key) {
		const self = this;
		return new Promise((resolve) => {
			self._database.destroy(key, (err) => {
				if (err) {
					return resolve(false);
				}
				return resolve(true);
			});
		});
	}

	async exists(key) {
		const self = this;
		return new Promise((resolve, reject) => {
			self._database.get(key, (err) => {
				if (err) {
					if (err.error === 'not_found') {
						return resolve(false);
					} else {
						return reject(err);
					}
				} else {
					return resolve(true);
				}
			});
		});
	}

	async getAllLabels() {
		const self = this;
		return new Promise((resolve, reject) => {
			self._database.list((err, list) => {
				if (err) {
					return reject(err);
				}
				return resolve(list);
			});
		});
	}
}

module.exports = CouchDBWallet;
module.exports.CouchDBWalletKeyValueStore = CouchDBWalletKeyValueStore;
