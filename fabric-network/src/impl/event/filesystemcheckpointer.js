/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const BaseCheckpointer = require('./basecheckpointer');

/**
 * @typedef FileSystemCheckpointer~FileSystemCheckpointerOptions
 * @memberof module:fabric-network
 * @property {string} [basePath] The directory that will store the checkpoint
 * @property {number} [maxLength] The maximum number of blocks that can be in the checkpointer
 */

/**
 * Created a checkpointer in a file per event listener
 * @memberof module:fabric-network
 * @extends module:fabric-network~BaseCheckpointer
 * @class
 */
class FileSystemCheckpointer extends BaseCheckpointer {
	/**
	 *
	 * @param {string} channelName
	 * @param {string} listenerName The name of the listener being checkpointer
	 * @param {module:fabric-network.FileSystemCheckpointer~FileSystemCheckpointerOptions} [options]
	 */
	constructor(channelName, listenerName, options = {}) {
		super(options);
		if (!options.basePath) {
			options.basePath = path.join(os.homedir(), '/.hlf-checkpoint');
		}
		this._basePath = path.resolve(options.basePath); // Ensure that this path is correct
		this._channelName = channelName;
		this._listenerName = listenerName;
	}

	async _initialize() {
		const checkpointPath = this._getCheckpointFileName();
		await fs.ensureDir(path.join(this._basePath, this._channelName));
		await fs.createFile(checkpointPath);
	}

	/**
	 * @inheritdoc
	 */
	async save(transactionId, blockNumber, expectedTotal) {
		const hasExpectedTotal = !!expectedTotal;
		const checkpointPath = this._getCheckpointFileName(this._chaincodeId);
		if (!(await fs.exists(checkpointPath))) {
			await this._initialize();
		}

		let fullCheckpoint;
		let checkpoint;
		if (hasExpectedTotal) {
			fullCheckpoint = await this.load();
			if (fullCheckpoint.hasOwnProperty('blockNumber')) {
				fullCheckpoint = {[fullCheckpoint.blockNumber]: fullCheckpoint};
			}
			checkpoint = fullCheckpoint[blockNumber] || {blockNumber: blockNumber, transactionIds: [], expectedTotal};
		} else {
			checkpoint = await this.load();
		}

		if (Number(checkpoint.blockNumber) === Number(blockNumber)) {
			const transactionIds = checkpoint.transactionIds;
			if (transactionId) {
				transactionIds.push(transactionId);
			}
			checkpoint.transactionIds = transactionIds;
		} else {
			if (transactionId) {
				checkpoint.transactionIds = [transactionId];
			} else {
				checkpoint.transactionIds = [];
			}
			checkpoint.blockNumber = blockNumber;
		}
		if (hasExpectedTotal) {
			fullCheckpoint[blockNumber] = checkpoint;
			fullCheckpoint = this._prune(fullCheckpoint);
			await fs.writeFile(checkpointPath, JSON.stringify(fullCheckpoint));
		} else {
			await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));
		}
	}

	/**
	 * @inheritdoc
	 */
	async load() {
		const checkpointPath = this._getCheckpointFileName(this._chaincodeId);
		if (!(await fs.exists(checkpointPath))) {
			await this._initialize();
		}
		const checkpointBuffer = (await fs.readFile(checkpointPath));
		let checkpoint = checkpointBuffer.toString('utf8');
		if (!checkpoint) {
			checkpoint = {};
		} else {
			checkpoint = JSON.parse(checkpoint);
		}
		return checkpoint;
	}

	/**
	 * @inheritdoc
	 */
	async loadLatestCheckpoint() {
		const checkpoint = await this.load();
		const orderedBlockNumbers = Object.keys(checkpoint).sort();
		if (checkpoint.hasOwnProperty('blockNumber') || orderedBlockNumbers.length === 0) {
			return checkpoint;
		} else {
			// Sort checkpoints in ascending order
			for (const blockNumber of orderedBlockNumbers) {
				const blockCheckpoint = checkpoint[blockNumber];
				if (!blockCheckpoint.hasOwnProperty('expectedNumber')) {
					continue;
				} else if (Number(blockCheckpoint.expectedNumber) > blockCheckpoint.transactionIds.length) {
					return blockCheckpoint;
				}
			}
		}
		return checkpoint[orderedBlockNumbers[orderedBlockNumbers.length - 1]];
	}

	_getCheckpointFileName() {
		let filePath = path.join(this._basePath, this._channelName);
		if (this._chaincodeId) {
			filePath = path.join(filePath, this._chaincodeId);
		}
		return path.join(filePath, this._listenerName);
	}

	_prune(checkpoint) {
		if (!checkpoint.hasOwnProperty('blockNumber')) {
			checkpoint = Object.values(checkpoint).sort((a, b) => {
				return b.blockNumber - a.blockNumber;
			});

			if (checkpoint.length > this.options.maxLength) {
				checkpoint = checkpoint.slice(0, this.options.maxLength);
			}
			const rebuiltCheckpoint = {};
			for (const cp of checkpoint) {
				rebuiltCheckpoint[cp.blockNumber] = cp;
			}
			return rebuiltCheckpoint;
		}
		return checkpoint;
	}
}

module.exports = FileSystemCheckpointer;
