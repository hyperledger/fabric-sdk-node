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
 * @private
 */
class BaseCheckpointer {
	/**
	 * The constructor
	 * @param {Object} options - The options to configure the checkpointer
	 */
	constructor(options = {}) {
		this.options = Object.assign({}, options);
	}

	/**
	 * Initializes the checkpointer using the options provided when the instance
	 * was constructed
	 * @async
	 */
	async initialize() {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Prunes the checkpointer store to be the same as the in memory checkpoints
	 * @async
	 */
	async prune() {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Updates the storage mechanism to save the checkpoint.
	 * @param {string} blockNumber - The blockNumber of the checkpoint to save
	 * @param {string} [transactionId] - Optional, The transactionId of the checkpoint to save
	 * @async
	 */
	async save(blockNumber, transactionId) {
		throw new Error('Method has not been implemented');
	}

	/**
	 * checks the storage mechanism for the transactionId and
	 * blockNumber. The transactionId is optional.
	 * @param {string} blockNumber
	 * @param {string} [transactionId]
	 * @returns {boolean} True when the block number or the block number and
	 * the transactionId have been seen by this checkpointer.
	 * @async
	 */
	async check(blockNumber, transactionId) {
		throw new Error('Method has not been implemented');
	}

	/**
	 * Returns a blockNumber of the last block received in order. May not be the
	 * last block received or be the highest block received if the blocks are
	 * received out of order.
	 * For example if blocks 1, 2, 4, 5 have been received, then
	 * block 2 should be returned, this is the last block before a break
	 * in receiving the blocks in order. The listening should start at block 2
	 * since block 3 is missing.
	 * This method should only be used when using the checkpointer with a
	 * block listener or a commit listener that is listening for all
	 * transactions, other listeners will not receive all blocks.
	 * The event listeners will use the getBlockNumber() or getTransactionId()
	 * methods to avoid processing blocks/transactions that have been seen.
	 * @return {string} The block number as string
	 * @async
	 */
	async getStartBlock() {
		throw new Error('Method has not been implemented');
	}
}

module.exports = BaseCheckpointer;
