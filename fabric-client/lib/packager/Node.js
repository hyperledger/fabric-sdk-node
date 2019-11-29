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
const {Utils: utils} = require('fabric-common');

const walk = require('ignore-walk');

const logger = utils.getLogger('packager/Node.js');

const BasePackager = require('./BasePackager');
const BufferStream = require('./BufferStream');

class NodePackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The path to the top-level directory containing the source code
	 * and package.json.
	 * @param {string} [metadataPath] The path to the top-level directory containing metadata descriptors
	 * @returns {Promise.<TResult>}
	 */
	async package(chaincodePath, metadataPath) {
		logger.debug(`packaging Node from ${chaincodePath}`);

		// Compose the path to the chaincode project directory
		const projDir = chaincodePath;

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		const srcDescriptors = await this.findSource(projDir);
		let descriptors = srcDescriptors;
		if (metadataPath) {
			const metaDescriptors = await super.findMetadataDescriptors(metadataPath);
			descriptors = srcDescriptors.concat(metaDescriptors);
		}
		const stream = new BufferStream();
		await super.generateTarGz(descriptors, stream);
		return stream.toBuffer();
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid node chaincode source
	 *
	 * @param filePath
	 * @returns {Promise}
	 */
	async findSource(filePath) {
		let files = await walk({
			path: filePath,
			// applies filtering based on the same rules as "npm publish":
			// if .npmignore exists, uses rules it specifies
			ignoreFiles: ['.npmignore'],
			// follow symlink dirs
			follow: true
		});
		const descriptors = [];

		if (!files) {
			files = [];
		}

		// ignore the node_modules folder by default
		files = files.filter(f => f.indexOf('node_modules') !== 0);

		files.forEach((entry) => {
			const desc = {
				name: path.join('src', entry).split('\\').join('/'), // for windows style paths
				fqp: path.join(filePath, entry)
			};

			logger.debug('adding entry', desc);
			descriptors.push(desc);
		});

		return descriptors;
	}
}

module.exports = NodePackager;
