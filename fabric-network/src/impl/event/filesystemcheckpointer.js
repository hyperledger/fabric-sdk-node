/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs-extra');
const Long = require('long');
const BaseCheckpointer = require('./basecheckpointer');
const logger = require('fabric-network/lib/logger').getLogger('FileSystemCheckpointer');

/**
 * @typedef FileSystemCheckpointer~FileSystemCheckpointerOptions
 * @private
 * @memberof module:fabric-network
 * @property {string} checkpointPath - The path to the checkpoint.
 * @property {number} [maxLength] The maximum number of blocks that can be in the checkpointer.
 *  The default is 1000.
 */

/**
 * Created a checkpointer in a file per event listener
 * @memberof module:fabric-network
 * @extends module:fabric-network~BaseCheckpointer
 * @class
 * @private
 */
class FileSystemCheckpointer extends BaseCheckpointer {
	/**
	 *
	 * @param {string} channelName
	 * @param {string} listenerName The name of the listener being checkpointer
	 * @param {module:fabric-network.FileSystemCheckpointer~FileSystemCheckpointerOptions} [options]
	 */
	constructor(options = {}) {
		logger.debug('const - start');
		super(options);

		const {
			checkpointPath, // user must provide the path of the checkpoint file
			maxLength = 1000
		} = options;

		if (!checkpointPath) {
			throw Error('Missing checkpointPath parameter');
		}
		this.checkpointPath = checkpointPath;
		logger.debug('const - checkpointPath path %s', checkpointPath);
		this.maxLength = maxLength;
		this.checkpoints = new Map();
	}

	/**
	 * @inheritdoc
	 */
	async initialize() {
		const method = 'initialize';
		logger.debug('%s - start', method);
		this.checkpoints.clear();
		// first we need to read in the contents
		if (fs.existsSync(this.checkpointPath)) {
			logger.debug('%s - existing file - load checkpoints');
			const fileContents = fs.readFileSync(this.checkpointPath, 'utf-8');
			if (fileContents) {
				fileContents.split(/\r?\n/).forEach((line) => {
					if (line && line.length > 0) {
						logger.debug('%s - adding checkpoint =>%s<=', method, line);
						const splitLine = line.split(',');
						let transactionId;
						const blockNumber = splitLine[0];
						if (splitLine.length > 1) {
							transactionId = splitLine[1];
						}
						this._addCheckpoint(blockNumber, transactionId);
					}
				});
			}
			logger.debug('%s - checkpoints size:%s', method, this.checkpoints.size);
		} else {
			this._writeFile('');
		}

		// now add nothing to be sure we can append
		this._writeLine('');
	}

	/**
	 * @inheritdoc
	 */
	async save(blockNumber, transactionId) {
		const method = 'save';
		logger.debug('%s - start', method);
		// saves the blockNumber and transactionId, which are strings
		if (transactionId) {
			this._writeLine(`${blockNumber},${transactionId}\n`);
		} else {
			this._writeLine(`${blockNumber}\n`);
		}
		// now put into memeory
		this._addCheckpoint(blockNumber, transactionId);
	}

	/**
	 * @inheritdoc
	 */
	async check(blockNumber, transactionId) {
		const method = 'check';
		logger.debug('%s - start', method);
		// get from memeory
		const checkpoint = this.checkpoints.get(blockNumber);
		if (checkpoint && transactionId) {
			return checkpoint.transactionIds.includes(transactionId);
		} else if (checkpoint) {
			return true;
		}

		return false;
	}

	/**
	 * @inheritdoc
	 */
	async getStartBlock() {
		const method = 'getStartBlock';
		logger.debug('%s - start', method);

		if (this.checkpoints.size === 0) {
			return Long.fromValue(0).toString();
		}

		// first sort the block numbers
		const blockNumbers = [];
		for (const blockNumber of this.checkpoints.keys()) {
			// get a number to properly sort, must be a long
			// as javascript 'number' is not big enough
			blockNumbers.push(Long.fromValue(blockNumber));
		}

		// now sort
		blockNumbers.sort((a, b) => {
			return a.compare(b);
		});

		const one = Long.fromValue(1);
		// now the list is in asending order
		// lets start at the top, the oldest
		// and look for first missing block
		let startBlock = blockNumbers[0];
		for (const nextBlock of blockNumbers) {
			if (nextBlock.subtract(startBlock).greaterThan(one)) {
				break;
			}
			startBlock = nextBlock;
		}

		return startBlock.toString();
	}

	/**
	 * @inheritdoc
	 */
	async prune() {
		const method = 'prune';
		logger.debug('%s - start', method);

		// clear the file out
		this._clearFile();
		let file = '';
		// match the file to the memory
		for (const key of this.checkpoints.keys()) {
			const checkpoint = this.checkpoints.get(key);
			if (checkpoint.transactionIds.length > 0) {
				for (const transactionId of checkpoint.transactionIds) {
					file += `${checkpoint.blockNumber},${transactionId}\n`;
				}
			} else {
				file += `${checkpoint.blockNumber}\n`;
			}
		}

		this._writeFile(file);

		logger.debug('%s - file now has %s checkpoints', method, this.checkpoints.size);
	}

	_addCheckpoint(blockNumber, transactionId) {
		const method = '_addCheckpoint';
		logger.debug('%s - start', method);

		let checkpoint;

		if (this.checkpoints.has(blockNumber)) {
			checkpoint = this.checkpoints.get(blockNumber);
			logger.debug('%s - blockNumber % is in checkpoints', method, blockNumber);
		} else {
			checkpoint = {};
			checkpoint.blockNumber = blockNumber;
			checkpoint.transactionIds = [];
			logger.debug('%s - blockNumber % is not in checkpoints', method, blockNumber);
		}

		if (transactionId) {
			if (checkpoint.transactionIds.includes(transactionId)) {
				logger.debug('%s - transactionId %s is in checkpoints', method, transactionId);
			} else {
				checkpoint.transactionIds.push(transactionId);
				logger.debug('%s - transactionId %s added to checkpoint', method, transactionId);
			}
		}

		// update
		this.checkpoints.set(blockNumber, checkpoint);
		logger.debug('%s - set checkpoint =>%s<=', method, JSON.stringify(checkpoint));

		// delete oldest keys until size is good
		for (const key of this.checkpoints.keys()) {
			if (this.checkpoints.size > this.maxLength) {
				logger.debug('%s - remove blockNumber %s', method, blockNumber);
				this.checkpoints.delete(key);
			}
		}
	}

	_writeFile(file) {
		const method = '_writeFile';
		logger.debug('%s - start', method);
		fs.writeFileSync(this.checkpointPath, file, {flag: 'w+'});
	}

	_writeLine(line) {
		const method = '_writeLine';
		logger.debug('%s - line %s', method, line);
		fs.appendFileSync(this.checkpointPath, line);
	}

	_clearFile() {
		const method = '_clearFile';
		logger.debug('%s - start', method);
		fs.writeFileSync(this.checkpointPath, '');
	}
}

module.exports = FileSystemCheckpointer;
