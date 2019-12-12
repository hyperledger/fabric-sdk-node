/*
# SPDX-License-Identifier: Apache-2.0
*/

const runShellCommand = require('./runShellCommand').runShellCommand;

const binariesPath = '/tmp/fabric-binaries';
const version = '1.4.0';
const darwinTarFile = 'hyperledger-fabric-darwin-amd64-' + version + '.tar.gz';
const amd64TarFile = 'hyperledger-fabric-linux-amd64-' + version + '.tar.gz';
const darwin = 'darwin-amd64-' + version + '/' + darwinTarFile;
const amd64 = 'linux-amd64-' + version + '/' + amd64TarFile;
const binariesRoot = 'https://nexus.hyperledger.org/content/repositories/releases/org/hyperledger/fabric/hyperledger-fabric/';
const darwinBinaries =  binariesRoot + darwin;
const amd64Binaries = binariesRoot + amd64;


module.exports.installAndGenerateCertsamd64 = async function() {
	// Retrieve the cryptogen material binaries, pinned at 1.4
	// Download and extract binaries from tar file
	// Set to path via export
	await runShellCommand('mkdir -p ' + binariesPath + ';');
	await runShellCommand('wget ' + amd64Binaries + ' -P ' + binariesPath + ';');
	await runShellCommand('tar xvzf ' + binariesPath + '/' + amd64TarFile + ' -C ' + binariesPath + ';');
	await generateTestCerts();
	return;
};

module.exports.installAndGenerateCertsMac = async function() {
	await runShellCommand('curl --create-dirs --output ' + binariesPath + '/' + darwinTarFile + ' ' + darwinBinaries + ';');
	await runShellCommand('tar xvzf ' + binariesPath + '/' + darwinTarFile + ' -C ' + binariesPath + ';');
	await generateTestCerts();
	return;
};

async function generateTestCerts() {
	// Generate required crypto material, channel tx blocks, and fabric ca certs
	await runShellCommand('./test/fixtures/crypto-material/generateAll.sh ' + binariesPath + '/bin;');
	await runShellCommand('./test/ts-fixtures/crypto-material/generateAll.sh ' + binariesPath + '/bin;');
	await runShellCommand('./test/fixtures/fabricca/generateCSR.sh;');
}


