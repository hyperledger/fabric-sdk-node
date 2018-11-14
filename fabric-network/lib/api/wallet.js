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
 * @property {string} label Label used to refer to this identity in the wallet.
 * @property {string} mspId Organizational unit to which this identity belongs.
 * @property {string} identifier
 */

/**
 * @typedef {Object} Wallet~Identity
 * @memberof module:fabric-network
 * @property {string} type Type of credentials, for example X509.
 * @property {string} mspId Organizational unit to which this identity belongs.
 * @property {string} certificate Certificate containing the public key in PEM format.
 * @property {string} privateKey Private key in PEM format.
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
