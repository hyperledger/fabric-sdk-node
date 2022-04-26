/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const path = require('path');
const utils = require('../utils.js');
const walk = require('ignore-walk');

const logger = utils.getLogger('JavaPackager.js');

const BasePackager = require('./BasePackager');
const BufferStream = require('./BufferStream');

class JavaPackager extends BasePackager {

	/**
	 * Package chaincode source and metadata files for deployment.
	 * @param {string} chaincodePath The path to the top-level directory containing the source code.
	 * @param {string} [metadataPath] The path to the top-level directory containing metadata descriptors
	 * @returns {Promise.<byte[]>}
	 */
	async package (chaincodePath, metadataPath) {
		logger.debug('packaging Java source from %s', chaincodePath);

		let descriptors = await this.findSource(chaincodePath);
		if (metadataPath) {
			logger.debug('packaging metadata files from %s', metadataPath);

			const metaDescriptors = await super.findMetadataDescriptors(metadataPath);
			descriptors = descriptors.concat(metaDescriptors);
		}
		const stream = new BufferStream();
		await super.generateTarGz(descriptors, stream);
		return stream.toBuffer();
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid java chaincode source
	 * note: currently all files found in the source path are included
	 *
	 * @param filePath
	 * @returns {Promise}
	 */
	async findSource (filePath) {
		const descriptors = [];

		const ignoreFiles = ['.fabricignore'];
		const files = await walk({path: filePath, follow: true, ignoreFiles});
		if (files) {
			files.forEach((entry) => {
				const desc = {
					name: path.join('src', entry).split('\\').join('/'), // for windows style paths
					fqp: path.join(filePath, entry)
				};

				logger.debug('adding descriptor entry', desc);
				descriptors.push(desc);
			});
		} else {
			logger.debug(' No files found at this path %s', filePath);
		}

		return descriptors;
	}
}

module.exports = JavaPackager;
