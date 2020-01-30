/*
# SPDX-License-Identifier: Apache-2.0
*/

const fs = require('fs-extra');
const path = require('path');

module.exports.cleanUp = function() {
	const tempdir = path.join(__dirname, '../../test/temp');
	// by default for running the tests, print debug to a file
	const debugPath = path.join(tempdir, 'debug.log');

	// some tests create temporary files or directories
	// they are all created in the same temp folder
	fs.removeSync(tempdir);
	fs.ensureFileSync(debugPath);
	return;
};

module.exports.cleanUpDocs = function() {
	fs.removeSync('docs/gen/master');
	return;
};

module.exports.createCucumberLogFile = function() {
	fs.ensureFileSync('test/temp/debugc.log');
	return;
};

module.exports.copyFabricClient = function() {
	const filesToCopy = [
		'lib/api.js',
		'lib/hash.js',
		'lib/utils.js',
		'lib/BaseClient.js',
		'lib/Config.js',
		'lib/ProtoLoader.js',
		'lib/Remote.js',
		'lib/User.js',
		'lib/impl/bccsp_pkcs11.js',
		'lib/impl/CouchDBKeyValueStore.js',
		'lib/impl/CryptoSuite_ECDSA_AES.js',
		'lib/impl/aes/pkcs11_key.js',
		'lib/impl/ecdsa/key.js',
		'lib/impl/ecdsa/pkcs11_key.js',
		'lib/impl/CryptoKeyStore.js',
		'lib/impl/FileKeyValueStore.js',
		'lib/msp/identity.js',
		'lib/msp/msp.js',
		'lib/protos/msp/identities.proto',
		'lib/protos/msp/msp_config.proto',
		'types/tsconfig.json',
		'types/base.d.ts'
	];
	for (const fileToCopy of filesToCopy) {
		// Copy the above array of files from fabric-client/ to fabric-ca-client/
		fs.ensureFileSync(`fabric-ca-client/${fileToCopy}`);
		fs.copyFileSync(`fabric-client/${fileToCopy}`, `fabric-ca-client/${fileToCopy}`);

		// Copy the above array of files from fabric-client/ to node_modules/fabric-ca-client/
		fs.ensureFileSync(`node_modules/fabric-ca-client/${fileToCopy}`);
		fs.copyFileSync(`fabric-client/${fileToCopy}`, `node_modules/fabric-ca-client/${fileToCopy}`);
	}

};