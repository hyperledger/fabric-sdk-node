/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const gulp = require('gulp');
const gulpTslint = require('gulp-tslint');
const tslint = require('tslint');

gulp.task('tslint', () => {
	const program = tslint.Linter.createProgram('tslint.json');
	return gulp.src([
		'fabric-client/**/*.ts',
		'fabric-network/**/*.ts',
		'test/**/*.ts',
		'!fabric-network/coverage/**',
		'!fabric-network/lib/**',
		'!fabric-network/node_modules/**',
		'!fabric-client/coverage/**',
		'!fabric-client/node_modules/**',
	]).pipe(gulpTslint({
		formatter: 'prose',
		program
	})).pipe(gulpTslint.report({
		summarizeFailureOutput: true
	}));
});
