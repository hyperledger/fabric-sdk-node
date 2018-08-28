/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console */

'use strict';

const addsrc = require('gulp-add-src');
const gulp = require('gulp');
const mocha = require('gulp-mocha');
const tape = require('gulp-tape');

const tapColorize = require('tap-colorize');

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const util = require('util');
const shell = require('gulp-shell');
const testConstants = require('../../test/unit/constants.js');

// by default for running the tests print debug to a file
const debugPath = path.join(testConstants.tempdir, 'test-log/debug.log');
process.env.HFC_LOGGING = util.format('{"debug":"%s"}', escapeWindowsPath(debugPath));

function escapeWindowsPath(p) {
	if (path.sep == '/') return p;
	return p.replace(/\\/g, '\\\\');
}

console.log('\n####################################################');
console.log(util.format('# debug log: %s', debugPath));
console.log('####################################################\n');

const arch = process.arch;
const release = require(path.join(__dirname, '../../package.json')).testFabricVersion;
const thirdparty_release = require(path.join(__dirname, '../../package.json')).testFabricThirdParty;
let dockerImageTag = '';
let thirdpartyImageTag = '';
let docker_arch = '';

// this is a release build, need to build the proper docker image tag
// to run the tests against the corresponding fabric released docker images
if (arch.indexOf('x64') === 0) {
	docker_arch = ':amd64';
} else if (arch.indexOf('s390') === 0) {
	docker_arch = ':s390x';
} else if (arch.indexOf('ppc64') === 0) {
	docker_arch = ':ppc64le';
} else {
	throw new Error('Unknown architecture: ' + arch);
}

// release check, if master is specified then we are using a fabric that has been
// built from source, otherwise we are using specific published versions.

// prepare thirdpartyImageTag (currently using couchdb image in tests)
if (!/master/.test(thirdparty_release)) {
	thirdpartyImageTag = docker_arch + '-' + thirdparty_release;
}
if (!/master/.test(release)) {
	dockerImageTag = docker_arch + '-' + release;
}
// these environment variables would be read at test/fixtures/docker-compose.yaml
process.env.DOCKER_IMG_TAG = dockerImageTag;
process.env.THIRDPARTY_IMG_TAG = thirdpartyImageTag;

gulp.task('pre-test', () => {
	return gulp.src([
		'fabric-network/lib/**/*.js',
		'fabric-client/lib/**/*.js',
		'fabric-ca-client/lib/FabricCAClientImpl.js',
		'fabric-ca-client/lib/helper.js',
		'fabric-ca-client/lib/IdentityService.js',
		'fabric-ca-client/lib/AffiliationService.js',
	]);
});

gulp.task('clean-up', () => {
	// some tests create temporary files or directories
	// they are all created in the same temp folder
	fs.removeSync(testConstants.tempdir);
	return fs.ensureFileSync(debugPath);
});

gulp.task('docker-clean', shell.task([
	// stop and remove chaincode docker instances
	'docker kill $(docker ps | grep "dev-peer0.org[12].example.com-[en]" | awk \'{print $1}\')',
	'docker rm $(docker ps -a | grep "dev-peer0.org[12].example.com-[en]" | awk \'{print $1}\')',

	// remove chaincode images so that they get rebuilt during test
	'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com-[en]" | awk \'{print $3}\')',

	// clean up all the containers created by docker-compose
	'docker-compose -f test/fixtures/docker-compose.yaml down'
], {
	verbose: true, // so we can see the docker command output
	ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
}));

gulp.task('docker-ready', ['docker-clean'], shell.task([
	// make sure that necessary containers are up by docker-compose
	'docker-compose -f test/fixtures/docker-compose.yaml up -d'
]));

gulp.task('compile', shell.task([
	'npm run compile',
], {
	verbose: true, // so we can see the docker command output
	ignoreErrors: false // once compile failed, throw error
}));

// Use nyc instead of gulp-istanbul to generate coverage report
// Cannot use gulp-istabul because it throws "unexpected identifier" for async/await functions
gulp.task('test', shell.task(
	'./node_modules/nyc/bin/nyc.js gulp run-test'
));

gulp.task('test-headless', shell.task(
	'./node_modules/nyc/bin/nyc.js gulp run-test-headless'
));

gulp.task('test-mocha', ['mocha-fabric-client'],
	() => {
		return gulp.src(['./fabric-ca-client/test/**/*.js'], { read: false })
			.pipe(mocha({ reporter: 'list', exit: true }));
	}
);

gulp.task('mocha-fabric-client',
	() => {
		return gulp.src(['./fabric-client/test/**/*.js'], { read: false })
			.pipe(mocha({ reporter: 'list', exit: true }));
	}
);

gulp.task('mocha-fabric-network',
	() => {
		return gulp.src(['./fabric-network/test/**/*.js'], { read: false })
			.pipe(mocha({ reporter: 'list', exit: true }));
	}
);

gulp.task('run-test', ['run-full', 'mocha-fabric-client', 'mocha-fabric-network'],
	() => {
		return gulp.src(['./fabric-ca-client/test/**/*.js'], { read: false })
			.pipe(mocha({ reporter: 'list', exit: true }));
	}
);

gulp.task('run-test-headless', ['run-headless', 'mocha-fabric-client', 'mocha-fabric-network'],
	() => {
		return gulp.src(['./fabric-ca-client/test/**/*.js'], { read: false })
			.pipe(mocha({ reporter: 'list', exit: true }));
	}
);

gulp.task('run-full', ['clean-up', 'lint', 'pre-test', 'compile', 'docker-ready', 'ca'],
	() => {
		// use individual tests to control the sequence they get executed
		// first run the ca-tests that tests all the member registration
		// and enrollment scenarios (good and bad calls). Then the rest
		// of the tests will re-use the same key value store that has
		// saved the user certificates so they can interact with the
		// network
		return gulp.src(shouldRunPKCS11Tests([
			'test/unit/config.js', // needs to be first
			'test/unit/**/*.js',
			'!test/unit/constants.js',
			'!test/unit/util.js',
			'!test/unit/logger.js',
			// channel: mychannel, chaincode: e2enodecc:v0
			'test/integration/nodechaincode/e2e.js',
			'test/integration/network-e2e/e2e.js',
			// channel: mychannel, chaincode: end2endnodesdk:v0/v1
			'test/integration/e2e.js',
			'test/integration/signTransactionOffline.js',
			'test/integration/query.js',
			'test/integration/fabric-ca-affiliation-service-tests.js',
			'test/integration/fabric-ca-identity-service-tests.js',
			'test/integration/fabric-ca-certificate-service-tests.js',
			'test/integration/fabric-ca-services-tests.js',
			'test/integration/client.js',
			'test/integration/orderer-channel-tests.js',
			'test/integration/cloudant-fabricca-tests.js',
			'test/integration/couchdb-fabricca-tests.js',
			'test/integration/fileKeyValueStore-fabricca-tests.js',
			'test/integration/install.js',
			'test/integration/events.js',
			'test/integration/channel-event-hub.js',
			// channel: mychannel, chaincode: end2endnodesdk:v3
			'test/integration/upgrade.js',
			'test/integration/get-config.js',
			// channel: mychanneltx, chaincode: end2endnodesdk:v0
			'test/integration/create-configtx-channel.js',
			'test/integration/e2e/join-channel.js',
			'test/integration/instantiate.js',
			'test/integration/e2e/invoke-transaction.js',
			'test/integration/e2e/query.js',
			'test/integration/invoke.js',
			'test/integration/network-config.js',
			'test/integration/only-admin.js',
			'test/integration/javachaincode/e2e.js',
			'test/integration/discovery.js',
			'test/integration/grpc.js',
			// channel: mychannelts chaincode: examplets:v1
			'test/typescript/test.js',
			//
			'test/integration/perf/orderer.js',
			'test/integration/perf/peer.js'
		]))
			.pipe(addsrc.append(
				'test/unit/logger.js' // put this to the last so the debugging levels are not mixed up
			))
			.pipe(tape({
				reporter: tapColorize()
			}));
	});

gulp.task('run-headless', ['clean-up', 'lint', 'pre-test', 'ca'],
	() => {
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
		tests.push('!test/integration/javachaincode/e2e.js');
	}

	return tests;
}
