/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const runShellCommand = require('./runShellCommand').runShellCommand;
const os = require('os');

const binariesPath = '/tmp/fabric-binaries';
const version = '1.4.0';
const darwinTarFile = `hyperledger-fabric-darwin-amd64-${version}.tar.gz`;
const amd64TarFile = `hyperledger-fabric-linux-amd64-${version}.tar.gz`;
const binariesRoot = `https://github.com/hyperledger/fabric/releases/download/v${version}`;
const darwinBinaries =  `${binariesRoot}/${darwinTarFile}`;
const amd64Binaries = `${binariesRoot}/${amd64TarFile}`;

async function installAndGenerateCerts() {
	if (os.platform() === 'darwin') {
		await installAndGenerateCertsMac();
	} else {
		await installAndGenerateCertsamd64();
	}
}

async function installAndGenerateCertsamd64() {
	// Retrieve the cryptogen material binaries, pinned at 1.4
	// Download and extract binaries from tar file
	// Set to path via export
	await runShellCommand(`mkdir -p ${binariesPath}`, null);
	await runShellCommand(`wget ${amd64Binaries} -P ${binariesPath}`, null);
	await runShellCommand(`tar xvzf ${binariesPath}/${amd64TarFile} -C ${binariesPath}`, null);
	await generateTestCerts();
}

async function installAndGenerateCertsMac() {
	await runShellCommand(`curl -L --create-dirs --output ${binariesPath}/${darwinTarFile} ${darwinBinaries}`, null);
	await runShellCommand(`tar xvzf ${binariesPath}/${darwinTarFile} -C ${binariesPath}`, null);
	await generateTestCerts();
}

async function generateTestCerts() {
	// Generate required crypto material, channel tx blocks, and fabric ca certs
	await runShellCommand(`./test/fixtures/crypto-material/generateAll.sh ${binariesPath}/bin`, null);
	await runShellCommand(`./test/ts-fixtures/crypto-material/generateAll.sh ${binariesPath}/bin`, null);
	await runShellCommand('./test/fixtures/fabricca/generateCSR.sh', null);
}

installAndGenerateCerts()
	.catch(error => {
		console.log(error); // eslint-disable-line no-console
		process.exitCode = 1;
	});
