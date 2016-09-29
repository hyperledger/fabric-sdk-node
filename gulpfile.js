var requireDir = require('require-dir');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build/tasks', { recurse: true });

var gulp = require('gulp');
var eslint = require('gulp-eslint');

gulp.task('lint', function () {
	return gulp.src(['**/*.js', '!node_modules/**', '!docs/**'])
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
					semi: ['error', 'always']
				}
			}
		))
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('default', ['lint'], function () {
		// This will only run if the lint task is successful...
});