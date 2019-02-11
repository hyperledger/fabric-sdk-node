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

const klaw = require('klaw');
const path = require('path');
const sbuf = require('stream-buffers');
const {Utils: utils} = require('fabric-common');

const BasePackager = require('./BasePackager');

const logger = utils.getLogger('packager/Golang.js');

class GolangPackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The Go package name. The package must be located under GOPATH/src.
	 * @param {string} [metadataPath[] Optional. The path to the top-level directory containing metadata descriptors.
	 * @param {string} [goPath] Optional. The GOPATH setting used when building the chaincode. This will
	 *        default to the environment setting "GOPATH".
	 * @returns {Promise.<TResult>}
	 */
	async package (chaincodePath, metadataPath, goPath) {
		// Determine the user's $GOPATH
		let _goPath = goPath;
		if (!_goPath) {
			_goPath = process.env.GOPATH;
		}

		// Compose the path to the chaincode project directory
		const projDir = path.join(_goPath, 'src', chaincodePath);

		logger.debug('packaging GOLANG chaincodePath from %s', chaincodePath);
		logger.debug('packaging GOLANG _goPath from %s', _goPath);
		logger.debug('packaging GOLANG projDir from %s', projDir);

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		const buffer = new sbuf.WritableStreamBuffer();

		const srcDescriptors = await this.findSource(_goPath, projDir);

		let descriptors = srcDescriptors;
		if (metadataPath) {
			const metaDescriptors = await super.findMetadataDescriptors(metadataPath);
			descriptors = srcDescriptors.concat(metaDescriptors);
		}
		await super.generateTarGz(descriptors, buffer);
		return buffer.getContents();
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
	findSource(goPath, filePath) {
		return new Promise((resolve, reject) => {
			const descriptors = [];
			klaw(filePath)
				.on('data', (entry) => {

					if (entry.stats.isFile() && super.isSource(entry.path)) {
						const desc = {
							name: path.relative(goPath, entry.path).split('\\').join('/'), // for windows style paths
							fqp: entry.path
						};

						logger.debug('adding entry', desc);
						descriptors.push(desc);
					}

				})
				.on('error', (error, item) => {
					logger.error(`error while packaging ${item.path}`);
					reject(error);
				})
				.on('end', () => {
					resolve(descriptors);
				});
		});
	}
}

module.exports = GolangPackager;
