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
const Lifecycle = require('./packager/Lifecycle.js');
const {Utils: utils} = require('fabric-common');

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
 * @property {string} [goPath] - Optional. The path to be used with the golang
 *        chaincode. Will default to the environment "GOPATH" value.
 * @returns {Promise} A promise for the data as a byte array
 */
module.exports.package = async function (chaincodePath, chaincodeType, devmode, metadataPath, goPath) {
	logger.debug('packager: chaincodePath: %s, chaincodeType: %s, devmode: %s, metadataPath: %s',
		chaincodePath, chaincodeType, devmode, metadataPath);

	if (devmode) {
		logger.debug('packager: Skipping chaincode packaging due to devmode configuration');
		return null;
	}

	if (!chaincodePath || chaincodePath && chaincodePath.length < 1) {
		// Verify that chaincodePath is being passed
		throw new Error('Missing chaincodePath parameter');
	}

	const type = chaincodeType ? chaincodeType : 'golang';
	logger.debug('packager: type %s ', type);

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
			handler = new Golang(['.go', '.c', '.h', '.s', '.mod', '.sum']);
	}

	return handler.package(chaincodePath, metadataPath, goPath);
};

/**
 * Utility function to do the final packaging of chaincode. This will create the tar ball
 * needed by the Chaincode Lifecycle system chaincode. The content produced will be used
 * as the InstallChaincodeArgs Chaincode Install Package bytes.
 *
 * The contents will be returned as a byte array.
 *
 * @param {string} label The label of the chaincode package
 * @param {string} chaincodeType The chaincode type
 * @param {Byte[]} packageBytes The chaincode package
 * @param {string} chaincodePath Optional unless chaincodeType is "golang".
 * @returns {Promise<byte[]>} A promise for the data as a byte array
 */
module.exports.finalPackage = async function (label, chaincodeType, packageBytes, chaincodePath) {
	logger.debug('finalPackager - Start');

	if (!label) {
		throw new Error('Missing "label" parameter');
	}

	if (!chaincodeType) {
		throw new Error('Missing "chaincodeType" parameter');
	}

	if (!packageBytes) {
		throw new Error('Missing "packageBytes" parameter');
	}

	if (chaincodeType === 'golang') {
		if (!chaincodePath) {
			throw new Error('Missing "chaincodePath" parameter');
		}
	}

	const handler = new Lifecycle();
	return handler.finalPackage(label, chaincodeType, packageBytes, chaincodePath);
};
