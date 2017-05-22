'use strict';

var gulp = require('gulp');
var tape = require('gulp-tape');
var tapColorize = require('tap-colorize');
var istanbul = require('gulp-istanbul');

var fs = require('fs-extra');
var shell = require('gulp-shell');
var testConstants = require('../../test/unit/constants.js');

gulp.task('pre-test', function() {
	return gulp.src([
		'node_modules/fabric-client/lib/**/*.js',
		'node_modules/fabric-ca-client/lib/FabricCAClientImpl.js'])
	.pipe(istanbul())
	.pipe(istanbul.hookRequire());
});

gulp.task('clean-up', function() {
	// some tests create temporary files or directories
	// they are all created in the same temp folder
	return fs.removeSync(testConstants.tempdir);
});

gulp.task('docker-clean', shell.task([
	// stop and remove chaincode docker instances
	'docker kill $(docker ps |grep "^dev-peer0.org[12].example.com-e" |awk "{print $1}")',
	'docker rm $(docker ps -a|grep "^dev-peer0.org[12].example.com-e" |awk "{print $1}")',

	// remove chaincode images so that they get rebuilt during test
	'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com-e" | awk "{print $3}")'
], {
	verbose: true, // so we can see the docker command output
	ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
}));

gulp.task('test', ['clean-up', 'lint', 'docker-clean', 'pre-test', 'ca'], function() {
	// use individual tests to control the sequence they get executed
	// first run the ca-tests that tests all the member registration
	// and enrollment scenarios (good and bad calls). Then the rest
	// of the tests will re-use the same key value store that has
	// saved the user certificates so they can interact with the
	// network
	return gulp.src([
		'test/unit/**/*.js',
		'!test/unit/constants.js',
		'!test/unit/util.js',
		'!test/unit/pkcs11.js',
		'test/integration/fabric-ca-services-tests.js',
		'test/integration/client.js',
		'test/integration/orderer-channel-tests.js',
		'test/integration/cloudant-fabricca-tests.js',
		'test/integration/couchdb-fabricca-tests.js',
		'test/integration/fileKeyValueStore-fabricca-tests.js',
		'test/integration/e2e.js',
		'test/integration/install.js',
		'test/integration/events.js',
		'test/integration/query.js',
		'test/integration/upgrade.js',
		'test/integration/new-channel.js',
		'test/integration/get-config.js',
		'test/integration/create-configtx-channel.js',
		'test/integration/e2e/join-channel.js',
		'test/integration/e2e/instantiate-chaincode.js',
		'test/integration/e2e/invoke-transaction.js',
		'test/integration/e2e/query.js',
		'test/integration/grpc.js'
	])
	.pipe(tape({
		reporter: tapColorize()
	}))
	.pipe(istanbul.writeReports({
		reporters: ['lcov', 'json', 'text',
			'text-summary', 'cobertura']
	}));
});

gulp.task('test-headless', ['clean-up', 'lint', 'pre-test', 'ca'], function() {
	// this is needed to avoid a problem in tape-promise with adding
	// too many listeners
	// to the "unhandledRejection" event
	process.setMaxListeners(0);

	return gulp.src([
		'test/unit/**/*.js',
		'!test/unit/constants.js',
		'!test/unit/util.js',
		'!test/unit/pkcs11.js'
	])
	.pipe(tape({
		reporter: tapColorize()
	}))
	.pipe(istanbul.writeReports({
		reporters: ['lcov', 'json', 'text',
			'text-summary', 'cobertura']
	}));
});
