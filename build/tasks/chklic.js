// SPDX-License-Identifier: Apache-2.0

const gulp = require('gulp');
const shell = require('gulp-shell');

gulp.task('check_license', shell.task('./scripts/check_license.sh'));
