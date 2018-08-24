/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const klaw = require('klaw');
const path = require('path');
const sbuf = require('stream-buffers');
const utils = require('../utils.js');
const BasePackager = require('./BasePackager');

const logger = utils.getLogger('packager/Golang.js');

class GolangPackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The Go package name.  The GOPATH environment variable must be set
	 * and the package must be located under GOPATH/src.
	 * @param {string} [metadataPath] The path to the top-level directory containing metadata descriptors.
	 * @returns {Promise.<TResult>}
	 */
	package (chaincodePath, metadataPath) {
		logger.debug('packaging GOLANG from %s', chaincodePath);

		// Determine the user's $GOPATH
		const goPath = process.env['GOPATH'];

		// Compose the path to the chaincode project directory
		const projDir = path.join(goPath, 'src', chaincodePath);

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		const buffer = new sbuf.WritableStreamBuffer();

		return this.findSource(goPath, projDir).then((srcDescriptors) => {
			if (metadataPath){
				return super.findMetadataDescriptors(metadataPath)
					.then((metaDescriptors) => {
						return srcDescriptors.concat(metaDescriptors);
					});
			} else {
				return srcDescriptors;
			}
		}).then((descriptors) => {
			return super.generateTarGz(descriptors, buffer);
		}).then(() => {
			return buffer.getContents();
		});
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
	findSource (goPath, filePath) {
		return new Promise((resolve, reject) => {
			const descriptors = [];
			klaw(filePath).on('data', (entry) => {

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
