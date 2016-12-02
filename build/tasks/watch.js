var gulp = require('gulp'),
	watch = require('gulp-watch'),
	debug = require('gulp-debug'),
	cop = require('./cop.js');

gulp.task('watch', function () {
	watch(cop.DEPS, { ignoreInitial: false, base: 'hfc/' })
	.pipe(debug())
	.pipe(gulp.dest('hfc-cop/'));

	watch([
		'hfc/lib/**/*',
		'hfc/index.js',
		'hfc/config/**/*',
		'hfc-cop/lib/**/*',
		'hfc-cop/config/**/*'
	], { ignoreInitial: false, base: './' })
	.pipe(debug())
	.pipe(gulp.dest('node_modules'));
});