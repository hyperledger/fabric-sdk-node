/*
 Copyright IBM Corp. All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/
const path = require('path');

// test temp directory is /fabric-sdk-node/test/temp
const tempdir = path.join(__dirname, '../temp');

module.exports = {
	tempdir: tempdir,
};
