/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const gulp = require('gulp');
const shell = require('gulp-shell');
const runSequence = require('run-sequence');

const version = '1.4.0';
const binariesPath = '/tmp/fabric-binaries';
const darwinTarFile = 'hyperledger-fabric-darwin-amd64-' + version + '.tar.gz';
const amd64TarFile = 'hyperledger-fabric-linux-amd64-' + version + '.tar.gz';
const s390TarFile = 'hyperledger-fabric-linux-s390x-' + version + '.tar.gz';
const darwin = 'darwin-amd64-' + version + '/' + darwinTarFile;
const amd64 = 'linux-amd64-' + version + '/' + amd64TarFile;
const s390 = 'linux-s390x-' + version + '/' + s390TarFile;
const binariesRoot = 'https://nexus.hyperledger.org/content/repositories/releases/org/hyperledger/fabric/hyperledger-fabric/';
const darwinBinaries =  binariesRoot + darwin;
const amd64Binaries = binariesRoot + amd64;
const s390Binaries = binariesRoot + s390;

// Retrieve the cryptogen material binaries, pinned at 1.4
// Download and xxtract binaries from tar file
// Set to path via export
gulp.task('get-crypto-binaries-amd64', shell.task(
	'mkdir -p ' + binariesPath + ';' +
	'wget ' + amd64Binaries + ' -P ' + binariesPath + ';' +
	'tar xvzf ' + binariesPath + '/' + amd64TarFile + ' -C ' + binariesPath + ';')
);

gulp.task('get-crypto-binaries-mac', shell.task(
	'curl --create-dirs --output ' + binariesPath + '/' + darwinTarFile + ' ' + darwinBinaries + ';' +
	'tar xvzf ' + binariesPath + '/' + darwinTarFile + ' -C ' + binariesPath + ';')
);

gulp.task('get-crypto-binaries-s390', shell.task(
	'mkdir -p ' + binariesPath + ';' +
	'wget ' + s390Binaries + ' -P ' + binariesPath + ';' +
	'tar xvzf ' + binariesPath + '/' + s390TarFile + ' -C ' + binariesPath + ';')
);

// Generate required crypto material, channel tx blocks, and fabric ca certs
// - shell command to run the required test file scripts
gulp.task('generate-test-certs', shell.task(
	'./test/fixtures/crypto-material/generateAll.sh ' + binariesPath + '/bin;' +
	'./test/fixtures/fabricca/generateCSR.sh;')
);

// Perform both of the above sequentially
gulp.task('install-and-generate-certs', (done) => {
	const tasks = ['get-crypto-binaries-amd64', 'generate-test-certs'];
	runSequence(...tasks, done);
});

gulp.task('install-and-generate-certs-mac', (done) => {
	const tasks = ['get-crypto-binaries-mac', 'generate-test-certs'];
	runSequence(...tasks, done);
});

gulp.task('install-and-generate-certs-s390', (done) => {
	const tasks = ['get-crypto-binaries-s390', 'generate-test-certs'];
	runSequence(...tasks, done);
});
