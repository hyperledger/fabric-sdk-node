/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const fs = require('fs-extra');
const klaw = require('klaw');
const tar = require('tar-stream');
const path = require('path');
const zlib = require('zlib');
const utils = require('../utils.js');

const logger = utils.getLogger('packager/BasePackager.js');

const BasePackager = class {

	/**
	 * Constructor
	 *
	 * @param {*} [keep] Array of valid source file extensions
	 */
	constructor (keep) {
		if (this.constructor === BasePackager) {
			// BasePackager can not be constructed.
			throw new TypeError('Can not construct abstract class.');
		}
		if (this.package === BasePackager.prototype.package) {
			throw new TypeError('Please implement method package from child class');
		}

		this.keep = keep;
	}

	/**
	 * All of the files in the directory of request.chaincodePath will be
	 * included in an archive file.
	 *
	 * @param chaincodePath
	 * @param metadataPath
	 */
	package (chaincodePath, metadataPath) {
		if(chaincodePath||metadataPath);
		throw new TypeError('Please implement method package from child class');
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid chaincode source (ISREG + keep)
	 *
	 * @param filepath
	 */
	findSource (filepath) {
		if(filepath);
		throw new Error('abstract function called');
	}

	/**
	 * Find the metadata descriptor files.
	 *
	 * @param filePath The top-level directory containing the metadata descriptors.
	 * Only files with a ".json" extension will be included in the results.
	 * @returns {Promise}
	 */
	findMetadataDescriptors (filePath) {
		return new Promise((resolve, reject) => {
			logger.debug('findMetadataDescriptors : start');
			const descriptors = [];
			klaw(filePath).on('data', (entry) => {
				if (entry.stats.isFile() && this.isMetadata(entry.path)) {

					const desc = {
						name: path.join('META-INF', path.relative(filePath, entry.path).split('\\').join('/')), // for windows style paths
						fqp: entry.path
					};
					logger.debug(' findMetadataDescriptors  :: %j', desc);
					descriptors.push(desc);
				}
			})
				.on('error', (error, item) => {
					logger.error('error while packaging item %j :: %s', item, error);
					reject(error);
				})
				.on('end', () => {
					resolve(descriptors);
				});
		});
	}

	/**
	 * Predicate function for determining whether a given path should be
	 * considered a valid metadata descriptor based entirely on the
	 * file extension.
	 * @param filePath The top-level directory containing the metadata descriptors.
	 * @returns {boolean} Returns true for valid metadata descriptors.
	 */
	isMetadata (filePath) {
		const extensions = ['.json'];
		return (extensions.indexOf(path.extname(filePath)) != -1);
	}

	/**
	 * Predicate function for determining whether a given path should be
	 * considered valid source code, based entirely on the extension.  It is
	 * assumed that other checks for file type (e.g. ISREG) have already been
	 * performed.
	 * @param filePath
	 * @returns {boolean}
	 */
	isSource (filePath) {
		return (this.keep.indexOf(path.extname(filePath)) != -1);
	}

	/**
	 * Given an {fqp, name} tuple, generate a tar entry complete with sensible
	 * header and populated contents read from the filesystem.
	 *
	 * @param pack
	 * @param desc
	 * @returns {Promise}
	 */
	packEntry (pack, desc) {
		return new Promise((resolve, reject) => {
			// Use a synchronous read to reduce non-determinism
			const content = fs.readFileSync(desc.fqp);
			if (!content) {
				reject(new Error('failed to read ' + desc.fqp));
			} else {
				// Use a deterministic "zero-time" for all date fields
				const zeroTime = new Date(0);
				const header = {
					name: desc.name,
					size: content.size,
					mode: 0o100644,
					atime: zeroTime,
					mtime: zeroTime,
					ctime: zeroTime
				};

				pack.entry(header, content, (err) => {
					if (err)
						reject(err);
					else
						resolve(true);
				});
			}
		});
	}

	/**
	 * Creates an .tar.gz stream from the provided descriptor entries
	 *
	 * @param descriptors
	 * @param dest
	 * @returns {Promise}
	 */
	generateTarGz (descriptors, dest) {
		return new Promise((resolve, reject) => {
			const pack = tar.pack();

			// Setup the pipeline to compress on the fly and resolve/reject the promise
			pack.pipe(zlib.createGzip()).pipe(dest).on('finish', () => {
				resolve(true);
			}).on('error', (err) => {
				reject(err);
			});

			// Iterate through each descriptor in the order it was provided and resolve
			// the entry asynchronously.  We will gather results below before
			// finalizing the tarball
			const tasks = [];
			for (const desc of descriptors) {
				const task = this.packEntry(pack, desc);
				tasks.push(task);
			}

			// Block here until all entries have been gathered, and then finalize the
			// tarball.  This should result in a flush of the entire pipeline before
			// resolving the top-level promise.
			Promise.all(tasks).then(() => {
				pack.finalize();
			}).catch((err) => {
				reject(err);
			});
		});
	}

};

module.exports = BasePackager;
