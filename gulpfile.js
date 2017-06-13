/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
var requireDir = require('require-dir');
var gulp = require('gulp');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build/tasks', { recurse: true });

gulp.task('default', ['lint'], function () {
		// This will only run if the lint task is successful...
});
