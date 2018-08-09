/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('lint', () => {
	return gulp.src([
		'**/*.js',
		'fabric-network/**/*.js',
		'fabric-client/**/*.js',
		'fabric-ca-client/lib/*.js',
		'!coverage/**',
		'!docs/**',
		'!fabric-network/coverage/**',
		'!fabric-network/node_modules/**',
		'!fabric-client/coverage/**',
		'!fabric-client/node_modules/**',
		'!fabric-ca-client/coverage/**',
		'!fabric-ca-client/node_modules/**',
		'!node_modules/**',
		'!test/typescript/*.js',
		'!tmp/**',
	]).pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});
