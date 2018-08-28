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

const Golang = require('./packager/Golang.js');
const Car = require('./packager/Car.js');
const Node = require('./packager/Node.js');
const Java = require('./packager/Java.js');
const utils = require('./utils.js');

const logger = utils.getLogger('packager');

/**
 * Utility function to package a chaincode. The contents will be returned as a byte array.
 *
 * @param {string} chaincodePath - required - String of the path to location of
 *                the source code of the chaincode
 * @param {string} chaincodeType - String of the type of chaincode
 *                 ['golang', 'node', 'car', 'java'] (default 'golang')
 * @param {boolean} devmode -Set to true to use chaincode development mode
 * @param {string} metadataPath - Optional.
 *        The path to the top-level directory containing metadata descriptors
 * @returns {Promise} A promise for the data as a byte array
 */
module.exports.package = function(chaincodePath, chaincodeType, devmode, metadataPath) {
	logger.debug('packager: chaincodePath: %s, chaincodeType: %s, devmode: %s, metadataPath: %s',
		chaincodePath,chaincodeType,devmode, metadataPath);
	return new Promise((resolve, reject) => {
		if (devmode) {
			logger.debug('packager: Skipping chaincode packaging due to devmode configuration');
			return resolve(null);
		}

		if (!chaincodePath || chaincodePath && chaincodePath.length < 1) {
			// Verify that chaincodePath is being passed
			return reject(new Error('Missing chaincodePath parameter'));
		}

		const type = chaincodeType ? chaincodeType : 'golang';
		logger.debug('packager: type %s ',type);

		let handler;

		switch (type.toLowerCase()) {
		case 'car':
			handler = new Car();
			break;
		case 'node':
			handler = new Node();
			break;
		case 'java':
			handler = new Java();
			break;
		default:
			handler = new Golang(['.go','.c','.h','.s']);
		}

		return resolve(handler.package(chaincodePath, metadataPath));
	});
};
