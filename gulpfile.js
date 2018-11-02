/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const requireDir = require('require-dir');
const gulp = require('gulp');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build/tasks', {recurse: true});

gulp.task('default', ['lint', 'check_license'], () => {
	// This will only run if the lint task is successful...
});
