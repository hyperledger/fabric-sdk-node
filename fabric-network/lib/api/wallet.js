/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-unused-vars */


'use strict';

/* eslint-disable no-unused-vars */
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

	//=========================================================
	// End user APIs
	//=========================================================

	async import(label, identity) {
		throw new Error('Not implemented');
	}

	async export(label) {
		throw new Error('Not implemented');
	}

	async list() {
		throw new Error('Not implemented');
	}

	async delete(label) {
		throw new Error('Not implemented');
	}

	async exists(label) {
		throw new Error('Not implemented');
	}
}

module.exports = Wallet;
