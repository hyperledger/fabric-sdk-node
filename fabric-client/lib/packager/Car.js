/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const utils = require('../utils.js');

const logger = utils.getLogger('packager/Car.js');
const fs = require('fs-extra');

class Car {
	package(path) {
		logger.debug(`Packaging CAR file from ${path}`);
		return fs.readFileSync(path);
	}
}

module.exports = Car;
