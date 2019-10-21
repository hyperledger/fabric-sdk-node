/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('eslint', () => {
	return gulp.src([
		'**/*.js',
		'fabric-network/**/*.js',
		'fabric-client/**/*.js',
		'fabric-ca-client/lib/*.js',
		'fabric-common/**/*.js',
		'!coverage/**',
		'!docs/**',
		'!fabric-network/coverage/**',
		'!fabric-network/lib/**',
		'!fabric-network/node_modules/**',
		'!fabric-client/coverage/**',
		'!fabric-client/node_modules/**',
		'!fabric-ca-client/coverage/**',
		'!fabric-ca-client/node_modules/**',
		'!fabric-common/node_modules/**',
		'!fabric-common/coverage/**',
		'!node_modules/**',
		'!test/typescript/**/*.js',
		'!fabric-protos/**',
	]).pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});
