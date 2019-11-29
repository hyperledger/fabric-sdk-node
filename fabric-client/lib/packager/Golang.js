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
const klaw = require('klaw');
const path = require('path');
const {Utils: utils} = require('fabric-common');

const BasePackager = require('./BasePackager');
const BufferStream = require('./BufferStream');

const logger = utils.getLogger('packager/Golang.js');

class GolangPackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The Go package name or path to Go module. If a package name, it must be
	 *        located under GOPATH/src. If a path to a Go module, a go.mod must be present.
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

		// Compose the path to the go.mod candidate
		const isModule = fs.existsSync(path.join(chaincodePath, 'go.mod'));

		// Compose the path to the chaincode project directory
		const projDir = isModule ? chaincodePath : path.join(_goPath, 'src', chaincodePath);
		const basePath = isModule ? chaincodePath : _goPath;

		logger.debug('packaging GOLANG chaincodePath from %s', chaincodePath);
		logger.debug('packaging GOLANG isModule %s', isModule);
		logger.debug('packaging GOLANG _goPath from %s', _goPath);
		logger.debug('packaging GOLANG basePath from %s', basePath);
		logger.debug('packaging GOLANG projDir from %s', projDir);

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		const srcDescriptors = await this.findSource(basePath, projDir);
		let descriptors = srcDescriptors.map(desc => {
			if (isModule) {
				desc.name = path.join('src', desc.name);
			}
			return desc;
		});
		if (metadataPath) {
			const metaDescriptors = await super.findMetadataDescriptors(metadataPath);
			descriptors = srcDescriptors.concat(metaDescriptors);
		}

		const stream = new BufferStream();
		await super.generateTarGz(descriptors, stream);
		return stream.toBuffer();
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any
	 * files that fit the criteria for being valid golang source (ISREG +
	 * (*.(go|c|h|s|mod|sum))) As a convenience, we also formulate a
	 * tar-friendly "name" for each file based on relative position to
	 * 'basePath'.
	 * @param basePath
	 * @param filePath
	 * @returns {Promise}
	 */
	findSource(basePath, filePath) {
		return new Promise((resolve, reject) => {
			const descriptors = [];
			klaw(filePath)
				.on('data', (entry) => {

					if (entry.stats.isFile() && super.isSource(entry.path)) {
						const desc = {
							name: path.relative(basePath, entry.path).split('\\').join('/'), // for windows style paths
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
