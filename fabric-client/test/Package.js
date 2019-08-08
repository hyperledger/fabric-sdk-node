/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs');
const Package = require('..').Package;
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const languageToType = {
	golang: 'golang',
	golangWithFabricIgnores: 'golang',
	javascript: 'node',
	javascriptWithFabricIgnores: 'node',
	javascriptWithNpmIgnores: 'node',
	typescript: 'node',
	typescriptWithFabricIgnores: 'node',
	typescriptWithNpmIgnores: 'node',
	java: 'java',
	javaWithFabricIgnores: 'java'
};

const fileNames = {
	golang: [
		'src/golang-contract/chaincode.go',
		'src/golang-contract/chaincode_test.go',
		'src/golang-contract/main.go'
	],
	golangWithFabricIgnores: [
		'src/golangWithFabricIgnores-contract/.editorconfig',
		'src/golangWithFabricIgnores-contract/.fabricignore',
		'src/golangWithFabricIgnores-contract/chaincode.go',
		'src/golangWithFabricIgnores-contract/main.go'
	],
	javascript: [
		'src/.editorconfig',
		'src/.eslintignore',
		'src/.eslintrc.js',
		'src/index.js',
		'src/lib/chaincode.js',
		'src/lib/start.js',
		'src/package.json',
		'src/test/chaincode.js',
		'src/test/start.js'
	],
	javascriptWithFabricIgnores: [
		'src/.editorconfig',
		'src/.eslintignore',
		'src/.eslintrc.js',
		'src/.fabricignore',
		'src/index.js',
		'src/lib/chaincode.js',
		'src/lib/start.js',
		'src/node_modules/whatever/index.js',
		'src/package.json'
	],
	javascriptWithNpmIgnores: [
		'src/.editorconfig',
		'src/.eslintignore',
		'src/.eslintrc.js',
		'src/.npmignore',
		'src/index.js',
		'src/lib/chaincode.js',
		'src/lib/start.js',
		'src/package.json'
	],
	typescript: [
		'src/.editorconfig',
		'src/package.json',
		'src/src/chaincode.spec.ts',
		'src/src/chaincode.ts',
		'src/src/index.ts',
		'src/src/start.spec.ts',
		'src/src/start.ts',
		'src/tsconfig.json',
		'src/tslint.json'
	],
	typescriptWithFabricIgnores: [
		'src/.editorconfig',
		'src/.fabricignore',
		'src/node_modules/whatever/index.js',
		'src/package.json',
		'src/src/chaincode.ts',
		'src/src/index.ts',
		'src/src/start.ts',
		'src/tsconfig.json',
		'src/tslint.json'
	],
	typescriptWithNpmIgnores: [
		'src/.editorconfig',
		'src/.npmignore',
		'src/package.json',
		'src/src/chaincode.ts',
		'src/src/index.ts',
		'src/src/start.ts',
		'src/tsconfig.json',
		'src/tslint.json'
	],
	java: [
		'src/build.gradle',
		'src/settings.gradle',
		'src/src/main/java/org/example/Chaincode.java',
		'src/src/main/java/org/example/Start.java',
		'src/src/test/java/org/example/ChaincodeTest.java'
	],
	javaWithFabricIgnores: [
		'src/.fabricignore',
		'src/build.gradle',
		'src/settings.gradle',
		'src/src/main/java/org/example/Chaincode.java',
		'src/src/main/java/org/example/Start.java'
	]
};

const languages = Object.keys(fileNames);

const metadataFileNames = [
	'META-INF/statedb/couchdb/indexes/indexOwner.json'
];

describe('Package', () => {

	let GOPATH;

	beforeEach(() => {
		GOPATH = process.env.GOPATH;
		process.env.GOPATH = path.resolve(__dirname, 'data', 'go');
	});

	afterEach(() => {
		process.env.GOPATH = GOPATH;
	});

	describe('#fromBuffer', () => {

		for (const language of languages) {

			if (language.endsWith('Ignores')) {
				continue;
			}

			const type = languageToType[language];

			it(`should load a smart contract package from a buffer [${language}]`, async () => {
				const pkgFile = path.resolve(__dirname, 'data', `${language}-contract.cds`);
				const pkgBuffer = fs.readFileSync(pkgFile);
				const pkg = await Package.fromBuffer(pkgBuffer);
				pkg.getName().should.equal('my-contract');
				pkg.getVersion().should.equal('1.2.3');
				pkg.getType().should.equal(type);
				pkg.getFileNames().should.deep.equal(fileNames[language]);
			});

			it(`should load a smart contract package from a buffer with metadata [${language}]`, async () => {
				const pkgFile = path.resolve(__dirname, 'data', `${language}-contract-metadata.cds`);
				const pkgBuffer = fs.readFileSync(pkgFile);
				const pkg = await Package.fromBuffer(pkgBuffer);
				pkg.getName().should.equal('my-contract');
				pkg.getVersion().should.equal('1.2.3');
				pkg.getType().should.equal(type);
				pkg.getFileNames().should.deep.equal(metadataFileNames.concat(fileNames[language]));
			});

		}

	});

	describe('#fromDirectory', () => {

		for (const language of languages) {

			const type = languageToType[language];

			it(`should throw an error for an empty smart contract name [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				await Package.fromDirectory({name: '', version: '1.2.3', path: pkgDirectory, type})
					.should.be.rejectedWith(/Smart contract name not specified/);
			});

			it(`should throw an error for an invalid smart contract name [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				await Package.fromDirectory({name: 'great@scott', version: '1.2.3', path: pkgDirectory, type})
					.should.be.rejectedWith(/Invalid smart contract name/);
			});

			it(`should throw an error for an empty smart contract version [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				await Package.fromDirectory({name: 'my-contract', version: '', path: pkgDirectory, type})
					.should.be.rejectedWith(/Smart contract version not specified/);
			});

			it(`should throw an error for an invalid smart contract version [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				await Package.fromDirectory({name: 'my-contract', version: '1@2@3', path: pkgDirectory, type})
					.should.be.rejectedWith(/Invalid smart contract version/);
			});

			it(`should create a smart contract package from a directory [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				const pkg = await Package.fromDirectory({name: 'my-contract', version: '1.2.3', path: pkgDirectory, type});
				pkg.getName().should.equal('my-contract');
				pkg.getVersion().should.equal('1.2.3');
				pkg.getType().should.equal(type);
				pkg.getFileNames().should.deep.equal(fileNames[language]);
			});

			it(`should create a smart contract package from a directory with metadata [${language}]`, async () => {
				let pkgDirectory;
				if (language.startsWith('golang')) {
					pkgDirectory = `${language}-contract`;
				} else {
					pkgDirectory = path.resolve(__dirname, 'data', `${language}-contract`);
				}
				const metaDirectory = path.resolve(__dirname, 'data', 'META-INF');
				const pkg = await Package.fromDirectory({name: 'my-contract', version: '1.2.3', path: pkgDirectory, type, metadataPath: metaDirectory});
				pkg.getName().should.equal('my-contract');
				pkg.getVersion().should.equal('1.2.3');
				pkg.getType().should.equal(type);
				pkg.getFileNames().should.deep.equal(metadataFileNames.concat(fileNames[language]));
			});

		}

	});

	describe('#toBuffer', async () => {

		for (const language of languages) {

			if (language.endsWith('Ignores')) {
				continue;
			}

			it(`should save a smart contract package to a buffer [${language}]`, async () => {
				const pkgFile = path.resolve(__dirname, 'data', `${language}-contract.cds`);
				const pkgBuffer1 = fs.readFileSync(pkgFile);
				const pkg = await Package.fromBuffer(pkgBuffer1);
				const pkgBuffer2 = await pkg.toBuffer();
				Buffer.compare(pkgBuffer1, pkgBuffer2).should.equal(0);
			});

		}

	});

});
