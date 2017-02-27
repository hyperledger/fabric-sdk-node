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

var Golang = require('./packager/Golang.js');
var Car = require('./packager/Car.js');
var utils = require('./utils.js');

var logger = utils.getLogger('packager');

/**
 * Utility function to package a chaincode. The contents will be returned as a byte array.
 *
 * @param {Object} chaincodePath required - String of the path to location of
 *                the source code of the chaincode
 * @param {Object} chaincodeType optional - String of the type of chaincode
 *                 ['golang', 'car', 'java'] (default 'golang')
 * @param {boolean} devmode optional - True if using dev mode
 * @returns {Promise} A promise for the data as a byte array
 */
module.exports.package = function(chaincodePath, chaincodeType, devmode) {
	logger.debug('packager: chaincodePath: %s, chaincodeType: %s, devmode: %s',chaincodePath,chaincodeType,devmode);
	return new Promise(function(resolve, reject) {
		if (devmode) {
			logger.debug('packager: Skipping chaincode packaging due to devmode configuration');
			return resolve(null);
		}

		if (!chaincodePath || chaincodePath && chaincodePath.length < 1) {
			// Verify that chaincodePath is being passed
			return reject(new Error('Missing chaincodePath parameter'));
		}

		let type = !!chaincodeType ? chaincodeType : 'golang';
		logger.debug('packager: type %s ',type);

		let handler;

		switch (type) {
		case 'car':
			handler = Car.package;
			break;
		default:
			handler = Golang.package;
		}

		return resolve(handler(chaincodePath));
	});
};
