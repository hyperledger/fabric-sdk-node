/*
  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

'use strict';

const path = require('path');
const sbuf = require('stream-buffers');
const utils = require('../utils.js');
const walk = require('ignore-walk');

let logger = utils.getLogger('packager/Node.js');

let BasePackager = require('./BasePackager');

class NodePackager extends BasePackager {

	constructor () {
		super([]);
	}

	/**
	 * All of the files in the directory of request.chaincodePath will be
	 * included in an archive file.
	 * @param chaincodePath
	 * @returns {Promise.<TResult>}
	 */
	package (chaincodePath) {
		logger.info('packaging Node from %s', chaincodePath);

		// Compose the path to the chaincode project directory
		let projDir = chaincodePath;

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		let buffer = new sbuf.WritableStreamBuffer();

		return this.findSource(projDir).then((descriptors) => {
			return super.generateTarGz(descriptors, buffer);
		}).then(() => {
			return buffer.getContents();
		});
	}

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid node chaincode source
	 *
	 * @param filePath
	 * @returns {Promise}
	 */
	findSource (filePath) {
		return walk({
			path: filePath,
			// applies filtering based on the same rules as "npm publish":
			// if .npmignore exists, uses rules it specifies
			ignoreFiles: ['.npmignore'],
			// follow symlink dirs
			follow: true
		}).then((files) => {
			let descriptors = [];

			if (!files) {
				files = [];
			}

			files.forEach((entry) => {
				let desc = {
					name: path.join('src', entry).split('\\').join('/'), // for windows style paths
					fqp: path.join(filePath, entry)
				};

				logger.debug('adding entry', desc);
				descriptors.push(desc);
			});

			return descriptors;
		});
	}
}

module.exports = NodePackager;