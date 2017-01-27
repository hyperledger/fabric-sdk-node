var gulp = require('gulp'),
	watch = require('gulp-watch'),
	debug = require('gulp-debug'),
	ca = require('./ca.js');

gulp.task('watch', function () {
	watch(ca.DEPS, { ignoreInitial: false, base: 'fabric-client/' })
	.pipe(debug())
	.pipe(gulp.dest('fabric-ca-client/'));

	watch([
		'fabric-client/index.js',
		'fabric-client/config/**/*',
		'fabric-client/lib/**/*',
		'fabric-ca-client/index.js',
		'fabric-ca-client/config/**/*',
		'fabric-ca-client/lib/**/*'
	], { ignoreInitial: false, base: './' })
	.pipe(debug())
	.pipe(gulp.dest('node_modules'));
});