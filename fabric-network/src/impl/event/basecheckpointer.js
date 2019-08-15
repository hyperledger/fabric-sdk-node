/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * @typedef {Object} BaseCheckpointer~Checkpoint
 * @memberof module:fabric-network
 * @property {number} blockNumber
 * @property {string[]} transactionIds
 * @property {number} [expectedTotal] The expected number of events in the block
 */

/**
 * Base checkpointer providing an interface for checkpointers
 * @memberof module:fabric-network
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
	 * @param {Number} expectedTotal the number of events expected in this block
	 * @async
	 */
	async save(transactionId, blockNumber, expectedTotal) {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Loads the latest checkpoint
	 * @return {module:fabric-network.BaseCheckpointer~Checkpoint | Object} Object parameter has key
	 * blockNumber: string and value {@link module:fabric-network.BaseCheckpointer~Checkpoint}
	 * @async
	 */
	async load() {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Loads the earliest incomplete checkpoint to decide which
	 * block to replay from
	 * @return {module:fabric-network.BaseCheckpointer~Checkpoint}
	 * @async
	 */
	async loadLatestCheckpoint() {
		return this.load();
	}

	/**
	 * Sets the chaincode ID to group together listeners
	 * @param {String} chaincodeId the chaincodeId
	 */
	setChaincodeId(chaincodeId) {
		this._chaincodeId = chaincodeId;
	}
}

module.exports = BaseCheckpointer;
