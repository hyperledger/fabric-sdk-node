/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * Base checkpointer providing an interface for checkpointers
 * @class
 */
class BaseCheckpointer {
	/**
	 * The constructor
	 * @param {Object} options The options to configure the checkpointer
	 */
	constructor(options) {
		this.options = options || {};
		this._chaincodeId = null;
	}

	/**
	 * Updates the storage mechanism
	 * @param {String} transactionId the transaction ID
	 * @param {Number} blockNumber the block number
	 * @async
	 */
	async save(transactionId, blockNumber) {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Loads the latest checkpoint
	 * @async
	 */
	async load() {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Sets the chaincode ID to group together listeners
	 * @param {String} chaincodeId the chaincodeId
	 */
	async setChaincodeId(chaincodeId) {
		this._chaincodeId = chaincodeId;
	}
}

module.exports = BaseCheckpointer;
