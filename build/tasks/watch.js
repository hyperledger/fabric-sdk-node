/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
let gulp = require('gulp'),
	watch = require('gulp-watch'),
	debug = require('gulp-debug'),
	fs = require('fs'),
	ca = require('./ca.js');

gulp.task('watch', function () {
	watch(ca.DEPS, { ignoreInitial: false, base: 'fabric-client/' })
	.pipe(debug())
	.pipe(gulp.dest('fabric-ca-client/'));

	// only do the following if node_modules/fabric-client and
	// node_modules/fabric-ca-client are NOT created as sym links
	let statsA = lstatSync('node_modules/fabric-client');
	let statsB = lstatSync('node_modules/fabric-ca-client');
	if (!statsA.isSymbolicLink() && !statsB.isSymbolicLink()) {
		watch([
			'fabric-client/index.js',
			'fabric-client/config/**/*',
			'fabric-client/lib/**/*',
			'fabric-ca-client/index.js',
			'fabric-ca-client/config/**/*',
			'fabric-ca-client/lib/**/*'
		], { ignoreInitial: false, base: './' })
		.pipe(debug())
		.pipe(gulp.dest('node_modules'));
	}
});
