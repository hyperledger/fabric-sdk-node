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
		'fabric-client/**/*.js',
		'fabric-ca-client/lib/*.js',
		'!fabric-ca-client/coverage/**',
		'!test/typescript/*.js',
		'!node_modules/**',
		'!fabric-client/node_modules/**',
		'!fabric-ca-client/node_modules/**',
		'!docs/**',
		'!coverage/**',
		'!tmp/**',
	]).pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});
