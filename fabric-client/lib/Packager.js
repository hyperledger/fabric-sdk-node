/*
 * SPDX-License-Identifier: Apache-2.0
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
module.exports.package = async function (chaincodePath, chaincodeType, devmode, metadataPath) {
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
			handler = new Golang(['.go', '.c', '.h', '.s']);
	}

	return handler.package(chaincodePath, metadataPath);
};
