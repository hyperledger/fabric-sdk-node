/*
Copyright IBM Corp. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const testutil = require('./util.js');
const path = require('path');
const fs = require('fs-extra');
const targz = require('targz');

const Packager = require('fabric-client/lib/Packager.js');
const Node = require('fabric-client/lib/packager/Node.js');
const Golang = require('fabric-client/lib/packager/Golang.js');

test('\n\n** BasePackager tests **\n\n', (t) => {
	const keep = [
		'.keep',
		'.keep2'
	];
	// test with concrete implementations
	const node = new Node(keep);
	t.equal(node.isSource('path/src.keep'), true, 'Node.isSource() should return true for valid extension ".keep"');
	t.equal(node.isSource('path/src.keep2'), true, 'Node.isSource() should return true for valid extension ".keep2"');
	t.equal(node.isSource('path/src.keep3'), false, 'Node.isSource() should return false for invalid extension ".keep3"');
	t.equal(node.isMetadata('path/metadata.json'), true, 'Node.isMetadata() should return true for valid extension ".json"');
	t.equal(node.isMetadata('path/metadata.notjson'), false, 'Node.isMetadata() should return false for invalid extension ".notjson"');
	node.findMetadataDescriptors(testutil.METADATA_PATH)
		.then((descriptors) => {
			const expected = 'META-INF/statedb/couchdb/indexes/index.json';
			t.equal(descriptors.length, 1, 'Expected Node.findMetadataDescriptors() to return one valid descriptor');
			t.equal(descriptors[0].name, expected, 'Node.findMetadataDescriptors() should return valid descriptor name');
		}).catch((err) => {
			t.fail('Node.findMetadataDescriptors() failed with unexpected error');
			t.comment(err.stack ? err.stack : err);
		});

	const golang = new Golang(keep);
	t.equal(golang.isSource('path/src.keep'), true, 'Golang.isSource() should return true for valid extension ".keep"');
	t.equal(golang.isSource('path/src.keep2'), true, 'Golang.isSource() should return true for valid extension ".keep2"');
	t.equal(golang.isSource('path/src.keep3'), false, 'Golang.isSource() should return false for invalid extension ".keep3"');
	t.equal(golang.isMetadata('path/metadata.json'), true, 'Golang.isMetadata() should return true for valid extension ".json"');
	t.equal(golang.isMetadata('path/metadata.notjson'), false, 'Golang.isMetadata() should return false for invalid extension ".notjson"');
	golang.findMetadataDescriptors(testutil.METADATA_PATH)
		.then((descriptors) => {
			const expected = 'META-INF/statedb/couchdb/indexes/index.json';
			t.equal(descriptors.length, 1, 'Expected Golang.findMetadataDescriptors() to return one valid descriptor');
			t.equal(descriptors[0].name, expected, 'Golang.findMetadataDescriptors() should return valid descriptor name');
		}).catch((err) => {
			t.fail('Golang.findMetadataDescriptors() failed with unexpected error');
			t.comment(err.stack ? err.stack : err);
		});

	golang.findMetadataDescriptors('/somepath')
		.then(() => {
			t.fail('Should have thrown an exception');
		}).catch((err) => {
			t.pass('Golang.findMetadataDescriptors() pass with expected error');
			t.comment(err.stack ? err.stack : err);
		});
	t.end();
});

test('\n\n** Golang Packager tests **\n\n', (t) => {
	Packager.package('blah', '', true)
		.then((data) => {
			t.equal(data, null, 'Channel.packageChaincode() should return null for dev mode');
			return Packager.package(null, '', false);
		}).then(() => {
			t.fail('Packager.package() should have rejected a call that does not have chaincodePath parameter');
			t.end();
		},
		(err) => {
			const msg = 'Missing chaincodePath parameter';
			if (err.message.indexOf(msg) >= 0) {
				t.pass('Should throw error: ' + msg);
			} else {
				t.fail(err.message + ' should be ' + msg);
				t.end();
			}

			testutil.setupChaincodeDeploy();
			return Packager.package(testutil.CHAINCODE_PATH, '', true);
		}).then((data) => {
			t.equal(data, null, 'Should return null when packaging for dev mode');
			return Packager.package('blah', '', false);
		}).then(() => {
			t.fail('Packager.package() should have rejected a call that does not have valid chaincodePath parameter');
			t.end();
		},
		(err) => {
			const msg = 'ENOENT: no such file or directory';
			if (err.message.indexOf(msg) >= 0) {
				t.pass('Should throw error: ' + msg);
			} else {
				t.fail(err.message + 'should be' + msg);
				t.end();
			}

			return Packager.package(testutil.CHAINCODE_PATH, '', false);
		}).then((data) => {
			const tmpFile = path.join(testutil.getTempDir(), 'test-deploy-copy.tar.gz');
			const destDir = path.join(testutil.getTempDir(), 'test-deploy-copy-tar-gz');
			fs.writeFileSync(tmpFile, data);
			fs.removeSync(destDir);
			targz.decompress({
				src: tmpFile,
				dest: destDir
			}, (err) => {
				if (err) {
					t.fail('Failed to extract generated chaincode package. ' + err);
				}

				const checkPath = path.join(destDir, 'src', 'github.com', 'example_cc', 'example_cc.go');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/github.com/example_cc/example_cc.go" file');

				t.end();
			});
			return Packager.package(testutil.CHAINCODE_PATH, '', false, testutil.METADATA_PATH);
		}).then((data) => {
			const tmpFile = path.join(testutil.getTempDir(), 'test-deploy-copy.tar.gz');
			const destDir = path.join(testutil.getTempDir(), 'test-deploy-copy-tar-gz');
			fs.writeFileSync(tmpFile, data);
			fs.removeSync(destDir);
			targz.decompress({
				src: tmpFile,
				dest: destDir
			}, (err) => {
				if (err) {
					t.fail('Failed to extract generated chaincode package. ' + err);
					const checkPath = path.join(destDir, 'META-INF', 'statedb', 'couchdb', 'indexes', 'index.json');
					t.equal(fs.existsSync(checkPath), true,
						'The tar.gz file produced by Packager.package() has the "META-INF/statedb/couchdb/indexes/index.json" file');
				}
				t.end();
			});
		}).catch((err) => {
			t.fail('Caught error in Package.package tests');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});

// ignore the dummy.js
const npmignore1 = 'dummy.js';
let destDir = path.join(testutil.getTempDir(), 'test-node-chaincode');
let tmpFile = path.join(testutil.getTempDir(), 'test-node-chaincode.tar.gz');
let targzDir = path.join(testutil.getTempDir(), 'test-node-chaincode-tar-gz');

function check(data, checkFcn) {
	fs.writeFileSync(tmpFile, data);
	fs.removeSync(targzDir);

	return new Promise((resolve, reject) => {
		targz.decompress({
			src: tmpFile,
			dest: targzDir
		}, (err) => {
			if (err) {
				reject('Failed to extract generated chaincode package. ' + err);
			}

			checkFcn();
			resolve();
		});
	});
}

test('\n\n** Node.js Packager tests **\n\n', (t) => {
	Packager.package(testutil.NODE_CHAINCODE_PATH, 'node', true)
		.then((data) => {
			t.equal(data, null, 'Should return null when packaging for dev mode');
			return Packager.package('blah', 'node', false);
		}).then(() => {
			t.fail('Packager.package() should have rejected a call that does not have valid chaincodePath parameter');
			t.end();
		}, (err) => {
			const msg = 'ENOENT: no such file or directory';
			if (err.message.indexOf(msg) >= 0) {
				t.pass('Should throw error: ' + msg);
			} else {
				t.fail(err.message + 'should be' + msg);
				t.end();
			}

			fs.removeSync(destDir);
			fs.copySync(testutil.NODE_CHAINCODE_PATH, destDir);

			fs.outputFileSync(path.join(destDir, 'node_modules/dummy/package.json'), 'dummy package.json content');
			fs.outputFileSync(path.join(destDir, 'dummy.js'), 'this is the content of dummy.js');

			return Packager.package(destDir, 'node', false);
		}).then((data) => {
			return check(data, () => {
				let checkPath = path.join(targzDir, 'src', 'chaincode.js');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/chaincode.js" file');
				checkPath = path.join(targzDir, 'src', 'package.json');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/package.json" file');
				checkPath = path.join(targzDir, 'src', 'dummy.js');
				t.equal(fs.existsSync(checkPath), true, 'dummy.js should exist this time, because we does not ignore it');
				checkPath = path.join(targzDir, 'src', 'node_modules');
				t.equal(fs.existsSync(checkPath), false, 'The tar.gz file produced by Packager.package() does not have the "node_modules" folder');
			});
		}).then(() => {
		// ignore the dummy.js
			fs.outputFileSync(path.join(destDir, '.npmignore'), npmignore1);
			return Packager.package(destDir, 'node', false);
		}).then((data) => {
			return check(data, () => {
				let checkPath = path.join(targzDir, 'src', 'chaincode.js');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/chaincode.js" file');
				checkPath = path.join(targzDir, 'src', 'package.json');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/package.json" file');
				checkPath = path.join(targzDir, 'src', 'node_modules');
				t.equal(fs.existsSync(checkPath), false, 'The tar.gz file produced by Packager.package() does not have the "node_modules" folder');
			});
		}).then(() => {
			fs.outputFileSync(path.join(destDir, '.npmignore'), '');
			fs.outputFileSync(path.join(destDir, 'some.other.file'), 'dummy content');

			return Packager.package(destDir, 'node', false);
		}).then((data) => {
			return check(data, () => {
				let checkPath = path.join(targzDir, 'src', 'chaincode.js');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/chaincode.js" file');
				checkPath = path.join(targzDir, 'src', 'package.json');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/package.json" file');
				checkPath = path.join(targzDir, 'src', 'some.other.file');
				t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/some.other.file" file');
				checkPath = path.join(targzDir, 'src', 'node_modules');
				t.equal(fs.existsSync(checkPath), false, 'The tar.gz file produced by Packager.package() does not has the "node_modules" folder');
			});
		}).then(() => {
			return Packager.package(destDir, 'node', false, testutil.METADATA_PATH);
		}).then((data) => {
			return check(data, () => {
				const checkPath = path.join(targzDir, 'META-INF', 'statedb', 'couchdb', 'indexes', 'index.json');
				t.equal(fs.existsSync(checkPath), true,
					'The tar.gz file produced by Packager.package() has the "META-INF/statedb/couchdb/indexes/index.json" file');
			});
		}).then(() => {
			t.end();
		}).catch((err) => {
			t.fail('Caught error in Package.package tests');
			t.comment(err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n** Java chaincode Packager tests **\n\n', async (t) => {
	try {
		const dev_mode_package = await Packager.package(testutil.JAVA_CHAINCODE_PATH, 'java', true);
		t.equal(dev_mode_package, null, 'Should return null when packaging for dev mode');
		try {
			await Packager.package('blah', 'java', false);
			t.fail('Packager.package() should have rejected a call that does not have valid chaincodePath parameter');
		} catch (error) {
			const msg = 'ENOENT: no such file or directory';
			if (error.message.indexOf(msg) >= 0) {
				t.pass('Should throw error: ' + msg);
			} else {
				t.fail(error.message + 'should be' + msg);
				t.end();
			}
		}

		destDir = path.join(testutil.getTempDir(), 'test-java-chaincode');
		tmpFile = path.join(testutil.getTempDir(), 'test-java-chaincode.tar.gz');
		targzDir = path.join(testutil.getTempDir(), 'test-java-chaincode-tar-gz');

		fs.removeSync(destDir);
		fs.copySync(testutil.JAVA_CHAINCODE_PATH, destDir);

		const real_package = await Packager.package(destDir, 'java', false);
		await processPackage(real_package, tmpFile, targzDir);
		let checkPath = path.join(targzDir, 'src', 'src', 'main', 'java', 'org', 'hyperledger', 'fabric', 'example', 'SimpleChaincode.java');
		t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "SimpleChaincode.java" file');

		const meta_package = await Packager.package(destDir, 'java', false, testutil.METADATA_PATH);
		await processPackage(meta_package, tmpFile, targzDir);
		checkPath = path.join(targzDir, 'META-INF', 'statedb', 'couchdb', 'indexes', 'index.json');
		t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "META-INF/statedb/couchdb/indexes/index.json" file');
	} catch (overall_error) {
		t.fail('Caught error in Java Package.package tests');
		t.comment(overall_error.stack ? overall_error.stack : overall_error);
	}

	t.end();

});

function processPackage(data, tempFile, targetDir) {
	return new Promise((resolve, reject) => {
		fs.writeFileSync(tempFile, data);
		fs.removeSync(targetDir);
		targz.decompress({
			src: tempFile,
			dest: targetDir
		}, (err) => {
			if (err) {
				reject('Failed to extract generated chaincode package. ' + err);
			}
			resolve();
		});
	});
}
