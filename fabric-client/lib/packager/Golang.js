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

var os = require('os');
var fs = require('fs-extra');
var tar = require('tar-fs');
var path = require('path');
var zlib = require('zlib');
var utils = require('../utils.js');
var dir = require('node-dir');

var logger = utils.getLogger('packager/Golang.js');

/**
 * All of the files in the directory of the environment variable
 * GOPATH joined to the request.chaincodePath will be included
 * in an archive file.
 */
module.exports.package = function(chaincodePath) {
	return new Promise(function(resolve, reject) {
		logger.info('packaging GOLANG from %s', chaincodePath);

		// Determine the user's $GOPATH
		let goPath =  process.env['GOPATH'];

		// Compose the path to the chaincode project directory
		let projDir = path.join(goPath, 'src', chaincodePath);

		// Create the .tar.gz file of the chaincode package
		fs.mkdtemp(path.join(os.tmpdir(), path.sep), (err, folder) => {
			if (err) return reject(new Error('Failed to create temp folder. ' + err));

			// first copy all the target chaincode files from the source folder to
			// <this_temp_folder>/src/<chaincodePath> folder so that the tar.gz
			// archive can be created with the folder structure preserved
			var dest = path.join(folder, 'src', chaincodePath);
			fs.copy(projDir, dest, (err) => {
				if (err) return reject(new Error('Failed to copy chaincode source to temp folder. ' + err));

				// first set the mode of all files to -rw-r--r--
				dir.files(dest, (err, files) => {
					if (err) return reject(new Error('Failed to iterate over files and subdirectories of the destination folder. ' + err));

					let entries = [];
					files.forEach((file) => {
						fs.chmodSync(file, '644');

						let entry = path.relative(folder, file);
						logger.info('Chaincode package entry: ' + entry);
						entries.push(entry);
					});

					let targzFilePath = path.join(folder, 'deployment-package.tar.gz');
					return generateTarGz(folder, targzFilePath, entries)
						.then(function() {
							logger.debug('Successfully generated chaincode archive %s ', targzFilePath);
							return utils.readFile(targzFilePath)
								.then((data) => {
									logger.debug('Successful readFile to data in bytes');
									return resolve(data);
								});
						});
				});
			});
		});
	});
};

//
// generateTarGz creates a .tar.gz file from contents in the src directory and
// saves them in a dest file.
//
function generateTarGz(src, dest, entries) {
	// A list of file extensions that should be packaged into the .tar.gz.
	// Files with all other file extenstions will be excluded to minimize the size
	// of the install payload.
	var keep = [
		'.go',
		'.yaml',
		'.json',
		'.c',
		'.h'
	];

	return new Promise(function(resolve, reject) {
		// Create the pack stream specifying the ignore/filtering function
		var pack = tar.pack(src, {
			entries: entries,
			ignore: function(name) {
				// Check whether the entry is a file or a directory
				if (fs.statSync(name).isDirectory()) {
					// If the entry is a directory, keep it in order to examine it further
					return false;
				} else {
					// If the entry is a file, check to see if it's the Dockerfile
					if (name.indexOf('Dockerfile') > -1) {
						return false;
					}

					// If it is not the Dockerfile, check its extension
					var ext = path.extname(name);

					// Ignore any file who's extension is not in the keep list
					if (keep.indexOf(ext) === -1) {
						return true;
					} else {
						return false;
					}
				}
			}
		})
		.pipe(zlib.Gzip())
		.pipe(fs.createWriteStream(dest));

		pack.on('close', function() {
			return resolve(dest);
		});
		pack.on('error', function() {
			return reject(new Error('Error on fs.createWriteStream'));
		});
	});
};
