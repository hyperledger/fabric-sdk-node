/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
var gulp = require('gulp');
var eslint = require('gulp-eslint');

gulp.task('lint', function () {
	return gulp.src([
		'**/*.js',
		'fabric-client/**/*.js',
		'fabric-ca-client/lib/*.js',
		'examples/**/*.js',
		'!examples/balance-transfer/node_modules/**',
		'!node_modules/**',
		'!fabric-client/node_modules/**',
		'!fabric-ca-client/node_modules/**',
		'!docs/**',
		'!coverage/**',
		'!tmp/**'
	])
	.pipe(eslint(
		{
			env: ['es6', 'node'],
			extends: 'eslint:recommended',
			parserOptions: {
				sourceType: 'module'
			},
			rules: {
				indent: ['error', 'tab'],
				'linebreak-style': ['error', 'unix'],
				quotes: ['error', 'single'],
				semi: ['error', 'always'],
				'no-trailing-spaces': ['error'],
				'max-len': [
					'error',
					{
						'code': 150,
						'ignoreTrailingComments': true,
						'ignoreUrls': true,
						'ignoreStrings': true,
						'ignoreTemplateLiterals': true,
						'ignoreRegExpLiterals': true
					}
				]
			}
		}
	))
	.pipe(eslint.format())
	.pipe(eslint.failAfterError());
});
