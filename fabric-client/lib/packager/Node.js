/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const path = require('path');
const sbuf = require('stream-buffers');
const utils = require('../utils.js');
const walk = require('ignore-walk');

let logger = utils.getLogger('packager/Node.js');

let BasePackager = require('./BasePackager');

class NodePackager extends BasePackager {

	/**
	 * Package chaincode source and metadata for deployment.
	 * @param {string} chaincodePath The path to the top-level directory containing the source code
	 * and package.json.
	 * @param {string} [metadataPath] The path to the top-level directory containing metadata descriptors
	 * @returns {Promise.<TResult>}
	 */
	package (chaincodePath, metadataPath) {
		logger.debug('packaging Node from %s', chaincodePath);

		// Compose the path to the chaincode project directory
		let projDir = chaincodePath;

		// We generate the tar in two phases: First grab a list of descriptors,
		// and then pack them into an archive.  While the two phases aren't
		// strictly necessary yet, they pave the way for the future where we
		// will need to assemble sources from multiple packages

		let buffer = new sbuf.WritableStreamBuffer();
		return this.findSource(projDir).then((srcDescriptors) => {
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

			// ignore the node_modules folder by default
			files = files.filter(f => f.indexOf('node_modules') !== 0);

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
