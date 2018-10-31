/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const cucumber = require('cucumber');
const sdkSteps = require('../steps');

module.exports = function () {
	sdkSteps.call(this);
};

if (cucumber.defineSupportCode) {
	cucumber.defineSupportCode((context) => {
		module.exports.call(context);
	});
}
