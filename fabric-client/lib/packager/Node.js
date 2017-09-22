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

var klaw = require('klaw');
var path = require('path');
var sbuf = require('stream-buffers');
var utils = require('../utils.js');

var logger = utils.getLogger('packager/Node.js');

var BasePackager = require('./BasePackager');

// A list of file extensions that should be packaged into the .tar.gz.
// Files with all other file extenstions will be excluded to minimize the size
// of the install payload.
var keep = [
	'.js',
	'.json',
	'.proto',
	'.yaml',
	'.yml',
];

class NodePackager extends BasePackager {

	constructor () {
		super(keep);
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

		var buffer = new sbuf.WritableStreamBuffer();

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
		return new Promise((resolve, reject) => {
			var descriptors = [];
			klaw(filePath).on('data', (entry) => {

				if (entry.stats.isFile() && super.isSource(entry.path)) {

					// TOOD: remove 'src'
					var desc = {
						name: 'src/' + path.relative(filePath, entry.path).split('\\').join('/'), // for windows style paths
						fqp: entry.path,
					};

					logger.debug('adding entry', desc);
					descriptors.push(desc);
				}

			}).on('end', () => {
				resolve(descriptors);
			});
		});
	}
}

module.exports = NodePackager;