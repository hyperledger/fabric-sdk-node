/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');
const X509WalletMixin = require('./x509walletmixin');
const Wallet = require('../../api/wallet');
const logger = require('../../logger').getLogger('BaseWallet');
const util = require('util');

/**
 * Base class for the built-in wallet implementations.  For internal use only.
 * @class
 * @implements {Wallet}
 */
class BaseWallet extends Wallet {

	constructor(walletMixin = new X509WalletMixin()) {
		super();
		logger.debug('in BaseWallet constructor, mixin = %j', walletMixin);
		this.storesInitialized = false;
		this.walletMixin = walletMixin;
	}

	// ===============================================
	// SPI Methods
	// ===============================================

	/**
	 * End users of a wallet don't make use of this method, this method is for use by the
	 * fabric-network implementation
	 *
	 * @param {*} client
	 * @param {*} label
	 * @returns The user context
	 * @memberof Wallet
	 */
	async setUserContext(client, label) {
		logger.debug('in setUserContext, label = %s', label);

		label = this.normalizeLabel(label);

		// TODO: We could check the client to see if the context matches what we would load ?
		// Although this may be complex to do, maybe we could cache the previous label and
		// Another setUserContext call can be bypassed.
		await this.configureClientStores(client, label);
		const loadedIdentity = await client.getUserContext(label, true);
		if (!loadedIdentity || !loadedIdentity.isEnrolled()) {
			const msg = util.format('identity \'%s\' isn\'t enrolled, or loaded', label);
			logger.error('setUserContext: ' + msg);
			throw new Error(msg);
		}
		return loadedIdentity;
	}

	async configureClientStores(client, label) {
		logger.debug('in configureClientStores, label = %s', label);

		label = this.normalizeLabel(label);
		if (!client) {
			client = new Client();
		}

		const store = await this.getStateStore(label);
		client.setStateStore(store);

		let cryptoSuite;
		if (this.walletMixin && this.walletMixin.getCryptoSuite) {
			cryptoSuite = await this.walletMixin.getCryptoSuite(label, this);
		}

		if (!cryptoSuite) {
			cryptoSuite = await this.getCryptoSuite(label);
		}
		client.setCryptoSuite(cryptoSuite);
		return client;
	}

	// ========================================
	// The following 2 apis are implemented to
	// provide the persistence mechanism
	// a mixin can override the getCryptoSuite
	// ========================================

	async getStateStore(label) { // eslint-disable-line no-unused-vars
		throw new Error('Not implemented');
	}

	async getCryptoSuite(label) { // eslint-disable-line no-unused-vars
		throw new Error('Not implemented');
	}

	// if this is overridden, then it has to be bi-directional
	// for the list to work properly.
	normalizeLabel(label) {
		return label;
	}

	// =========================================================
	// End user APIs
	// =========================================================

	// =========================================================
	// Mixins provide support for import & export
	// =========================================================

	async import(label, identity) {
		logger.debug('in import, label = %s', label);

		label = this.normalizeLabel(label);
		const client = await this.configureClientStores(null, label);
		if (this.walletMixin && this.walletMixin.importIdentity) {
			return await this.walletMixin.importIdentity(client, label, identity);
		} else {
			logger.error('no import method exists');
			throw new Error('no import method exists');
		}
	}

	async export(label) {
		logger.debug('in export, label = %s', label);

		label = this.normalizeLabel(label);
		const client = await this.configureClientStores(null, label);
		if (this.walletMixin && this.walletMixin.exportIdentity) {
			return await this.walletMixin.exportIdentity(client, label);
		} else {
			logger.error('no export method exists');
			throw new Error('no export method exists');
		}
	}

	// =========================================================
	// Wallets combined with mixins provide support for list
	// =========================================================

	async list() {
		logger.debug('in list');

		const idInfoList = [];
		const labelList = await this.getAllLabels();  // these need to be denormalised
		if (labelList && labelList.length > 0 && this.walletMixin && this.walletMixin.getIdentityInfo) {
			for (const label of labelList) {
				const client = await this.configureClientStores(null, label);
				const idInfo = await this.walletMixin.getIdentityInfo(client, label);
				if (idInfo) {
					idInfoList.push(idInfo);
				} else {
					idInfoList.push({
						label,
						mspId: 'not provided',
						identifier: 'not provided'
					});
				}
			}
		}

		logger.debug('list returns %j', idInfoList);
		return idInfoList;
	}

	async getAllLabels() {
		return null;
	}

	// =========================================================
	// Wallets provide support for delete and exists
	// =========================================================


	async delete(label) { // eslint-disable-line no-unused-vars
		throw new Error('Not implemented');
	}

	async exists(label) { // eslint-disable-line no-unused-vars
		throw new Error('Not implemented');
	}

	// TODO: FUTURE: Need some sort of api for a mixin to call to be able to integrate correctly
	// with the specific persistence mechanism if it wants to use the same persistence
	// feature
}

module.exports = BaseWallet;
