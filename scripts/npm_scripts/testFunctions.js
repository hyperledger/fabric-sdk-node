/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs-extra');
const path = require('path');

module.exports.cleanUp = function() {
	const tempdir = path.join(__dirname, '../../test/temp');
	// by default for running the tests, print debug to a file
	const debugPath = path.join(tempdir, 'debug.log');

	// some tests create temporary files or directories
	// they are all created in the same temp folder
	fs.removeSync(tempdir);
	fs.removeSync('fabric-network/lib');
	fs.ensureFileSync(debugPath);
	return;
};

module.exports.cleanUpDocs = function() {
	fs.removeSync('docs/gen/master');
	return;
};

module.exports.createCucumberLogFile = function() {
	fs.ensureFileSync('test/temp/debugc.log');
	return;
};
