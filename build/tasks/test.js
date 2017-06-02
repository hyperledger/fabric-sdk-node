'use strict';

var gulp = require('gulp');
var tape = require('gulp-tape');
var tapColorize = require('tap-colorize');
var istanbul = require('gulp-istanbul');
var addsrc = require('gulp-add-src');

var fs = require('fs-extra');
var path = require('path');
var os = require('os');
var util = require('util');
var shell = require('gulp-shell');
var testConstants = require('../../test/unit/constants.js');

// by default for running the tests print debug to a file
var debugPath = path.join(testConstants.tempdir, 'test-log/debug.log');
process.env.HFC_LOGGING = util.format('{"debug":"%s"}', debugPath);
console.log('\n####################################################');
console.log(util.format('# debug log: %s', debugPath));
console.log('####################################################\n');

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
	fs.removeSync(testConstants.tempdir);
	return fs.ensureFileSync(debugPath);
});

gulp.task('docker-clean', shell.task([
	// stop and remove chaincode docker instances
	'docker kill $(docker ps | grep "dev-peer0.org[12].example.com-e" | awk \'{print $1}\')',
	'docker rm $(docker ps -a | grep "dev-peer0.org[12].example.com-e" | awk \'{print $1}\')',

	// remove chaincode images so that they get rebuilt during test
	'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com-e" | awk \'{print $3}\')'
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
	return gulp.src(shouldRunPKCS11Tests([
		'test/unit/**/*.js',
		'!test/unit/constants.js',
		'!test/unit/util.js',
		'!test/unit/logger.js',
		'test/integration/e2e.js',
		'test/integration/query.js',
		'test/integration/fabric-ca-services-tests.js',
		'test/integration/client.js',
		'test/integration/orderer-channel-tests.js',
		'test/integration/cloudant-fabricca-tests.js',
		'test/integration/couchdb-fabricca-tests.js',
		'test/integration/fileKeyValueStore-fabricca-tests.js',
		'test/integration/install.js',
		'test/integration/events.js',
		'test/integration/upgrade.js',
		'test/integration/get-config.js',
		'test/integration/create-configtx-channel.js',
		'test/integration/e2e/join-channel.js',
		'test/integration/e2e/instantiate-chaincode.js',
		'test/integration/e2e/invoke-transaction.js',
		'test/integration/e2e/query.js',
		'test/integration/grpc.js'
	]))
	.pipe(addsrc.append(
		'test/unit/logger.js' // put this to the last so the debugging levels are not mixed up
	))
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

	return gulp.src(shouldRunPKCS11Tests([
		'test/unit/**/*.js',
		'!test/unit/constants.js',
		'!test/unit/util.js',
		'!test/unit/logger.js'
	]))
	.pipe(addsrc.append(
		'test/unit/logger.js' // put this to the last so the debugging levels are not mixed up
	))
	.pipe(tape({
		reporter: tapColorize()
	}))
	.pipe(istanbul.writeReports({
		reporters: ['lcov', 'json', 'text',
			'text-summary', 'cobertura']
	}));
});

// currently only the x64 CI jobs are configured with SoftHSM
// disable the pkcs11.js test for s390 or other jobs
// also skip it by default and allow it to be turned on manuall
// with an environment variable so everyone don't have to
// install SoftHsm just to run unit tests
function shouldRunPKCS11Tests(tests) {
	if (os.arch().match(/(x64|x86)/) === null ||
		!(typeof process.env.PKCS11_TESTS === 'string' && process.env.PKCS11_TESTS.toLowerCase() == 'true')) {
		tests.push('!test/unit/pkcs11.js');
	}

	return tests;
}
