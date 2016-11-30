'use strict';

var gulp = require('gulp');
var debug = require('gulp-debug');

const DEPS = [
	'hfc/lib/api.js',
	'hfc/lib/hash.js',
	'hfc/lib/utils.js',
	'hfc/lib/Config.js',
	'hfc/lib/Remote.js',
	'hfc/lib/impl/CryptoSuite_ECDSA_AES.js',
	'hfc/lib/impl/ecdsa/*',
	'hfc/lib/impl/FileKeyValueStore.js'
];

gulp.task('cop', function() {
	return gulp.src(DEPS, { base: 'hfc/' })
		.pipe(debug())
		.pipe(gulp.dest('hfc-cop/'));
});

module.exports.DEPS = DEPS;
