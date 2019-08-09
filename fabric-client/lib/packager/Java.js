/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
