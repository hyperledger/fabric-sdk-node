/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-unused-vars */


'use strict';

/**
 * Wallet defines the interface for storing and managing users' identities in a fabric network.
 * This is an abstract base class and must be extended.
 *
 * @interface
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
	 * @param label
	 * @param identity
	 * @returns {Promise<void>}
	 */
	async import(label, identity) {
		throw new Error('Not implemented');
	}

	/**
	 * Extract an identity from the wallet
	 * @param label
	 * @returns {Promise<void>}
	 */
	async export(label) {
		throw new Error('Not implemented');
	}

	/**
	 * List the contents of the wallet
	 * @returns {Promise<void>}
	 */
	async list() {
		throw new Error('Not implemented');
	}

	/**
	 * Removes an identity from the wallet
	 * @param label
	 * @returns {Promise<void>}
	 */
	async delete(label) {
		throw new Error('Not implemented');
	}

	/**
	 * Query the existence of an identity in the wallet
	 * @param label
	 * @returns {Promise<void>}
	 */
	async exists(label) {
		throw new Error('Not implemented');
	}
}

module.exports = Wallet;
