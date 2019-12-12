/*
# SPDX-License-Identifier: Apache-2.0
*/

const path = require('path');
const runShellCommand = require('./runShellCommand').runShellCommand;

module.exports.dockerReady = async function() {
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
	// Debug level of Docker containers used in scenario tests
	process.env.DOCKER_DEBUG = 'INFO';

	const env = Object.create(process.env);
	// make sure that necessary containers are up by docker-compose
	await runShellCommand('docker-compose -f test/fixtures/docker-compose/docker-compose-tls-level-db.yaml -p node up -d && sleep 15', env);
	await runShellCommand('docker ps -a', env);
	return;
};