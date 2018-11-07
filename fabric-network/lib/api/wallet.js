/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-unused-vars */


'use strict';

/**
 * @typedef {Object} Wallet~IdentityInfo
 * @memberof module:fabric-network
 * @property label
 * @property mspId
 * @property identifier
 */

/**
 * @typedef {Object} Wallet~Identity
 * @memberof module:fabric-network
 * @property type
 * @property mspId
 * @property certificate
 * @property privateKey
 */

/**
 * Wallet defines the interface for storing and managing users' identities in a fabric network.
 * This is an abstract base class and must be extended.
 * @interface
 * @memberof module:fabric-network
 */
class Wallet {

	// ===============================================
	// SPI Methods
	// ===============================================

	async setUserContext(client, label) {
		throw new Error('Not implemented');
	}

	async configureClientStores(client, label) {
		throw new Error('Not implemented');
	}

	// =========================================================
	// End user APIs
	// =========================================================

	/**
	 * Import an identity into the wallet
	 * @async
	 * @param {string} label
	 * @param {module:fabric-network.Wallet~Identity} identity
	 */
	async import(label, identity) {
		throw new Error('Not implemented');
	}

	/**
	 * Extract an identity from the wallet
	 * @async
	 * @param {string} label
	 * @returns {module:fabric-network.Wallet~Identity}
	 */
	async export(label) {
		throw new Error('Not implemented');
	}

	/**
	 * List the contents of the wallet
	 * @async
	 * @returns {module:fabric-network.Wallet~IdentityInfo[]}
	 */
	async list() {
		throw new Error('Not implemented');
	}

	/**
	 * Removes an identity from the wallet
	 * @async
	 * @param {string} label
	 */
	async delete(label) {
		throw new Error('Not implemented');
	}

	/**
	 * Query the existence of an identity in the wallet
	 * @async
	 * @param {string} label
	 * @returns {boolean}
	 */
	async exists(label) {
		throw new Error('Not implemented');
	}
}

module.exports = Wallet;
