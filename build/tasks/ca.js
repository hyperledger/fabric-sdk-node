/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

var gulp = require('gulp');
var debug = require('gulp-debug');

const DEPS = [
	'fabric-client/lib/api.js',
	'fabric-client/lib/hash.js',
	'fabric-client/lib/utils.js',
	'fabric-client/lib/BaseClient.js',
	'fabric-client/lib/Config.js',
	'fabric-client/lib/Remote.js',
	'fabric-client/lib/User.js',
	'fabric-client/lib/impl/CouchDBKeyValueStore.js',
	'fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js',
	'fabric-client/lib/impl/ecdsa/*',
	'fabric-client/lib/impl/CryptoKeyStore.js',
	'fabric-client/lib/impl/FileKeyValueStore.js',
	'fabric-client/lib/msp/identity.js',
	'fabric-client/lib/msp/msp.js',
	'fabric-client/lib/protos/msp/identities.proto',
	'fabric-client/lib/protos/msp/msp_config.proto'
];

gulp.task('ca', function() {
	return gulp.src(DEPS, { base: 'fabric-client/' })
		.pipe(debug())
		.pipe(gulp.dest('fabric-ca-client/'))
		.pipe(gulp.dest('node_modules/fabric-ca-client'));
});

module.exports.DEPS = DEPS;
