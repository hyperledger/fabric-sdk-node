/*
 Copyright IBM Corp. All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/
var os = require('os');
var path = require('path');

var tempdir = path.join(os.tmpdir(), 'hfc');

module.exports = {
	tempdir: tempdir
};
