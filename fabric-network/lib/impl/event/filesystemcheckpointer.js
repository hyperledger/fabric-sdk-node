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


class FileSystemCheckpointer extends BaseCheckpointer {
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

	async save(transactionId, blockNumber) {
		const checkpointPath = this._getCheckpointFileName(this._chaincodeId);
		if (!(await fs.exists(checkpointPath))) {
			await this._initialize();
		}
		const checkpoint = await this.load();
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
		await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));
	}

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

	_getCheckpointFileName() {
		let filePath = path.join(this._basePath, this._channelName);
		if (this._chaincodeId) {
			filePath = path.join(filePath, this._chaincodeId);
		}
		return path.join(filePath, this._listenerName);
	}
}

module.exports = FileSystemCheckpointer;
