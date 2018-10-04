/*
 Copyright IBM Corp. All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/
const os = require('os');
const path = require('path');

const tempdir = path.join(os.tmpdir(), 'hfc');

module.exports = {
	tempdir: tempdir
};
