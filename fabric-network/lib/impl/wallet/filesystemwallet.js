/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Client = require('fabric-client');
const rimraf = require('rimraf');
const fs = require('fs-extra');
const Path = require('path');
const BaseWallet = require('./basewallet');
const FileKVS = require('fabric-client/lib/impl/FileKeyValueStore');
const logger = require('../../logger').getLogger('FileSystemWallet');

/**
 * This class defines an implementation of an Identity wallet that persists
 * to the file system.
 * @memberof module:fabric-network
 * @implements {module:fabric-network.Wallet}
 */
class FileSystemWallet extends BaseWallet {

	/**
	 * create a new File Key Value Store
	 *
	 * @static
	 * @param {string} path the root path of the key value store
	 * @returns {Promise} a promise that is resolved when a new File KVS instance is recreated.
	 * @private
	 */
	static async _createFileKVS(path) {
		return await new FileKVS({path});
	}

	/**
	 * check to see if the label defines a directory in the wallet
	 *
	 * @static
	 * @param {string} label
	 * @returns {Promise} a promise that returns true if this is a valid directory, false otherwise
	 * @private
	 */
	async _isDirectory(label) {
		const method = '_isDirectory';
		let isDir;
		try {
			const stat = await fs.lstat(Path.join(this.path, label));
			isDir = stat.isDirectory();
		} catch (err) {
			isDir = false;
		}
		logger.debug('%s - return value: %s', method, isDir);
		return isDir;
	}

	/**
	 * Creates an instance of FileSystemWallet.
	 * @param {string} path The root path for this wallet on the file system
	 * @param {WalletMixin} [mixin] Optionally provide an alternative wallet mixin.
	 * Defaults to [X509WalletMixin]{@link module:fabric-network.X509WalletMixin}.
	 */
	constructor(path, mixin) {
		if (!path) {
			throw new Error('No path for wallet has been provided');
		}
		super(mixin);
		this.path = path;
	}

	/**
	 * Get the partitioned path for the provided label
	 *
	 * @param {string} label
	 * @returns {string} the partitioned path
	 * @memberof FileSystemWallet
	 * @private
	 */
	_getPartitionedPath(label) {
		label = this.normalizeLabel(label);
		const partitionedPath = Path.join(this.path, label);
		return partitionedPath;
	}

	async getStateStore(label) {
		const partitionedPath = this._getPartitionedPath(label);
		return FileSystemWallet._createFileKVS(partitionedPath);
	}

	async getCryptoSuite(label) {
		const partitionedPath = this._getPartitionedPath(label);
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: partitionedPath}));
		return cryptoSuite;
	}

	async getAllLabels() {
		let dirList;
		const labelList = [];
		try {
			dirList = await fs.readdir(this.path);
		} catch (err) {
			return [];
		}

		if (dirList && dirList.length > 0) {
			for (const label of dirList) {
				const reallyExists = await this.exists(label);
				if (reallyExists) {
					labelList.push(label);
				}
			}
		}
		return labelList;
	}

	/**
	 * @private
	 */
	async delete(label) {
		const method = 'delete';
		const reallyExists = await this.exists(label);
		if (!reallyExists) {
			return false;
		}
		const partitionedPath = this._getPartitionedPath(label);
		const rmPromise = new Promise((resolve, reject) => {
			rimraf(partitionedPath, (err) => {
				if (err) {
					logger.debug('%s - error returned trying to rm rf \'%s\': %s', method, partitionedPath, err);
					reject(err);
				}
				resolve(true);
			});
		});
		return await rmPromise;
	}

	/**
	 * @private
	 */
	async exists(label) {
		const method = 'exists';
		let exists = false;
		const isDir = await this._isDirectory(label);
		if (isDir) {
			exists = await fs.exists(Path.join(this._getPartitionedPath(label), label));
		}
		logger.debug('%s - label: %s, isDir: %s, exists: %s', method, label, isDir, exists);
		return exists;
	}
}

module.exports = FileSystemWallet;
