var gulp = require('gulp'),
	watch = require('gulp-watch'),
	debug = require('gulp-debug'),
	cop = require('./cop.js');

gulp.task('watch', function () {
	watch(cop.DEPS, { ignoreInitial: false, base: 'hfc/' })
	.pipe(debug())
	.pipe(gulp.dest('hfc-cop/'));

	watch([
		'hfc/index.js',
		'hfc/config/**/*',
		'hfc/lib/**/*',
		'hfc-cop/index.js',
		'hfc-cop/config/**/*',
		'hfc-cop/lib/**/*'
	], { ignoreInitial: false, base: './' })
	.pipe(debug())
	.pipe(gulp.dest('node_modules'));
});