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

const fs = require('fs-extra');
const path = require('path');
const utils = require('../utils.js');
const walk = require('ignore-walk');
const BasePackager = require('./BasePackager');
const BufferStream = require('./BufferStream');

const logger = utils.getLogger('packager/Golang.js');

class GolangPackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The Go package name.  The GOPATH environment variable must be set
	 * and the package must be located under GOPATH/src.
	 * @param {string} [metadataPath] The path to the top-level directory containing metadata descriptors.
	 * @returns {Promise.<TResult>}
	 */
	async package (chaincodePath, metadataPath) {
		logger.debug('packaging GOLANG from %s', chaincodePath);

		// Determine the user's $GOPATH
		const goPath = process.env.GOPATH;

		// Compose the path to the chaincode project directory
		const projDir = path.join(goPath, 'src', chaincodePath);

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		const srcDescriptors = await this.findSource(goPath, projDir);
		let descriptors;
		if (metadataPath) {
			const metaDescriptors = await super.findMetadataDescriptors(metadataPath);
			descriptors = srcDescriptors.concat(metaDescriptors);
		} else {
			descriptors = srcDescriptors;
		}
		const stream = new BufferStream();
		await super.generateTarGz(descriptors, stream);
		return stream.toBuffer();
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid golang source (ISREG + (*.(go|c|h)))
	 * As a convenience, we also formulate a tar-friendly "name" for each file
	 * based on relative position to 'goPath'.
	 * @param goPath
	 * @param filePath
	 * @returns {Promise}
	 */
	async findSource (goPath, filePath) {
		const ignoreFiles = ['.fabricignore'];
		const fabricIgnoreFileExists = await fs.exists(path.join(filePath, '.fabricignore'));

		let files = await walk({
			path: filePath,
			// applies filtering based on the same rules as "npm publish":
			// if .npmignore exists, uses rules it specifies
			ignoreFiles,
			// follow symlink dirs
			follow: true
		});

		const descriptors = [];

		if (!files) {
			files = [];
		}

		// ignore the node_modules folder by default, unless the user has
		// provided a .fabricignore file - in which case they are in full
		// control of what gets packaged.
		if (!fabricIgnoreFileExists) {
			files = files.filter(f => super.isSource(f));
		}

		files.forEach((entry) => {
			const fqp = path.join(filePath, entry);
			const desc = {
				name: path.relative(goPath, fqp).split('\\').join('/'), // for windows style paths
				fqp
			};

			logger.debug('adding entry', desc);
			descriptors.push(desc);
		});

		return descriptors;
	}
}

module.exports = GolangPackager;
