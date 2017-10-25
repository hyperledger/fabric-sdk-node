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

var fs = require('fs-extra');
var klaw = require('klaw');
var tar = require('tar-stream');
var path = require('path');
var zlib = require('zlib');
var sbuf = require('stream-buffers');
var utils = require('../utils.js');
var BasePackager = require('./BasePackager');

var logger = utils.getLogger('packager/Golang.js');

// A list of file extensions that should be packaged into the .tar.gz.
// Files with all other file extenstions will be excluded to minimize the size
// of the install payload.
var keep = [
	'.go',
	'.c',
	'.h'
];

class GolangPackager extends BasePackager {

	constructor () {
		super(keep);
	}

	/**
	 * All of the files in the directory of the environment variable
	 * GOPATH joined to the request.chaincodePath will be included
	 * in an archive file.
	 * @param chaincodePath
	 * @returns {Promise.<TResult>}
	 */
	package (chaincodePath) {
		logger.info('packaging GOLANG from %s', chaincodePath);

		// Determine the user's $GOPATH
		let goPath = process.env['GOPATH'];

		// Compose the path to the chaincode project directory
		let projDir = path.join(goPath, 'src', chaincodePath);

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		var buffer = new sbuf.WritableStreamBuffer();

		return this.findSource(goPath, projDir).then((descriptors) => {
			return super.generateTarGz(descriptors, buffer);
		}).then(() => {
			return buffer.getContents();
		});
	};

	/**
	 * Given an input 'filePath', recursively parse the filesystem for any files
	 * that fit the criteria for being valid golang source (ISREG + (*.(go|c|h)))
	 * As a convenience, we also formulate a tar-friendly "name" for each file
	 * based on relative position to 'goPath'.
	 * @param goPath
	 * @param filePath
	 * @returns {Promise}
	 */
	findSource (goPath, filePath) {
		return new Promise((resolve, reject) => {
			var descriptors = [];
			klaw(filePath).on('data', (entry) => {

				if (entry.stats.isFile() && super.isSource(entry.path)) {

					var desc = {
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


