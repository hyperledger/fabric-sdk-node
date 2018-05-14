/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

var utils = require('../utils.js');

var logger = utils.getLogger('packager/Car.js');

class Car {
	package (path) {
		logger.debug('Packaging CAR file from %s', path);
		return utils.readFile(path);
	}
}

module.exports = Car;
