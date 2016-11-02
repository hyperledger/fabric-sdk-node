'use strict';

var gulp = require('gulp');
var tape = require('gulp-tape');
var tapColorize = require('tap-colorize');
var istanbul = require('gulp-istanbul');

gulp.task('pre-test', function() {
	return gulp.src(['lib/**/*.js'])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire());
});

gulp.task('test', ['pre-test'], function() {
	return gulp.src('test/unit/*.js')
		.pipe(tape({
			reporter: tapColorize()
		}))
		.pipe(istanbul.writeReports());
});

gulp.task('test-headless', ['pre-test'], function() {
	return gulp.src('test/unit/headless-tests.js')
		.pipe(tape({
			reporter: tapColorize()
		}))
		.pipe(istanbul.writeReports());
});
