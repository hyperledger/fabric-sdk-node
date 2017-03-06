'use strict';

var gulp = require('gulp');
var debug = require('gulp-debug');

const DEPS = [
	'fabric-client/lib/api.js',
	'fabric-client/lib/hash.js',
	'fabric-client/lib/utils.js',
	'fabric-client/lib/Config.js',
	'fabric-client/lib/Remote.js',
	'fabric-client/lib/impl/CouchDBKeyValueStore.js',
	'fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js',
	'fabric-client/lib/impl/ecdsa/*',
	'fabric-client/lib/impl/CryptoKeyStore.js',
	'fabric-client/lib/impl/FileKeyValueStore.js'
];

gulp.task('ca', function() {
	return gulp.src(DEPS, { base: 'fabric-client/' })
		.pipe(debug())
		.pipe(gulp.dest('fabric-ca-client/'))
		.pipe(gulp.dest('node_modules/fabric-ca-client'));
});

module.exports.DEPS = DEPS;
