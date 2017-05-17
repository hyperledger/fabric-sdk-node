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
var klaw = require('klaw');
var tar = require('tar-stream');
var path = require('path');
var zlib = require('zlib');
var sbuf = require('stream-buffers');
var utils = require('../utils.js');

var logger = utils.getLogger('packager/Golang.js');

// A list of file extensions that should be packaged into the .tar.gz.
// Files with all other file extenstions will be excluded to minimize the size
// of the install payload.
var keep = [
	'.go',
	'.c',
	'.h'
];

// -------------------------------------------------------------------------
// package(path)
// -------------------------------------------------------------------------
// All of the files in the directory of the environment variable
// GOPATH joined to the request.chaincodePath will be included
// in an archive file.
// -------------------------------------------------------------------------
module.exports.package = function(chaincodePath) {
	logger.info('packaging GOLANG from %s', chaincodePath);

	// Determine the user's $GOPATH
	let goPath =  process.env['GOPATH'];

	// Compose the path to the chaincode project directory
	let projDir = path.join(goPath, 'src', chaincodePath);

	// We generate the tar in two phases: First grab a list of descriptors,
	// and then pack them into an archive.  While the two phases aren't
	// strictly necessary yet, they pave the way for the future where we
	// will need to assemble sources from multiple packages

	var buffer = new sbuf.WritableStreamBuffer();

	return findSource(goPath, projDir)
		.then((descriptors) => {
			return generateTarGz(descriptors, buffer);
		})
		.then(() => {
			return buffer.getContents();;
		});
};

// -------------------------------------------------------------------------
// isSource(path)
// -------------------------------------------------------------------------
// predicate function for determining whether a given path should be
// considered valid source code, based entirely on the extension.  It is
// assumed that other checks for file type (e.g. ISREG) have already been
// performed.
// -------------------------------------------------------------------------
function isSource(filePath) {
	return (keep.indexOf(path.extname(filePath)) != -1);
}

// -------------------------------------------------------------------------
// findSource(goPath, filePath)
// -------------------------------------------------------------------------
// Given an input 'filePath', recursively parse the filesystem for any files
// that fit the criteria for being valid golang source (ISREG + (*.(go|c|h)))
// As a convenience, we also formulate a tar-friendly "name" for each file
// based on relative position to 'goPath'.
// -------------------------------------------------------------------------
function findSource(goPath, filePath) {
	return new Promise((resolve, reject) => {
		var descriptors = [];
		klaw(filePath)
			.on('data', (entry) => {

				if (entry.stats.isFile() && isSource(entry.path)) {

					var desc = {
						name: path.relative(goPath, entry.path).split('\\').join('/'), // for windows style paths
						fqp: entry.path
					};

					logger.debug('adding entry', desc);
					descriptors.push(desc);
				}

			})
			.on('end', () => {
				resolve(descriptors);
			});
	});
}

// -------------------------------------------------------------------------
// packEntry(pack, desc)
// -------------------------------------------------------------------------
// Given an {fqp, name} tuple, generate a tar entry complete with sensible
// header and populated contents read from the filesystem.
// -------------------------------------------------------------------------
function packEntry(pack, desc) {
	return new Promise((resolve, reject) => {
		// Use a synchronous read to reduce non-determinism
		var content = fs.readFileSync(desc.fqp);
		if (!content) {
			reject(new Error('failed to read ' + desc.fqp));
		} else {
			// Use a deterministic "zero-time" for all date fields
			var zeroTime = new Date(0);
			var header = {name: desc.name,
						  size: content.size,
						  mode: 0o100644,
						  atime: zeroTime,
						  mtime: zeroTime,
						  ctime: zeroTime
						 };

			pack.entry(header, content, (err) => {
				if (err)
					reject(err);
				else
					resolve(true);
			});
		}
	});
}

// -------------------------------------------------------------------------
// generateTarGz(descriptors, dest)
// -------------------------------------------------------------------------
// creates an .tar.gz stream from the provided descriptor entries
// -------------------------------------------------------------------------
function generateTarGz(descriptors, dest) {
	return new Promise((resolve, reject) => {
		var pack = tar.pack();

		// Setup the pipeline to compress on the fly and resolve/reject the promise
		pack
			.pipe(zlib.createGzip())
			.pipe(dest)
			.on('finish', () => {
				resolve(true);
			})
			.on('error', (err) => {
				reject(err);
			});

		// Iterate through each descriptor in the order it was provided and resolve
		// the entry asynchronously.  We will gather results below before
		// finalizing the tarball
		var tasks = [];
		for (let desc of descriptors) {
			var task = packEntry(pack, desc);
			tasks.push(task);
		}

		// Block here until all entries have been gathered, and then finalize the
		// tarball.  This should result in a flush of the entire pipeline before
		// resolving the top-level promise.
		Promise.all(tasks)
			.then(() => {
				pack.finalize();
			})
			.catch((err) => {
				reject(err);
			});
	});
}
