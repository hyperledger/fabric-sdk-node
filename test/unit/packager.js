/*
Copyright IBM Corp. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const tape = require('tape');
const _test = require('tape-promise');
const test = _test(tape);
const testutil = require('./util.js');
const path = require('path');
const fs = require('fs-extra');
const targz = require('targz');

const Packager = require('fabric-client/lib/Packager.js');

test('\n\n** Golang Packager tests **\n\n', function(t) {
	Packager.package('blah','',true)
	.then((data) => {
		t.equal(data, null, 'Channel.packageChaincode() should return null for dev mode');
		return Packager.package(null,'',false);
	}).then(() => {
		t.fail('Packager.package() should have rejected a call that does not have chaincodePath parameter');
		t.end();
	},
	(err) => {
		let msg = 'Missing chaincodePath parameter';
		if (err.message.indexOf(msg) >= 0) {
			t.pass('Should throw error: '+msg);
		} else {
			t.fail(err.message+' should be '+msg);
			t.end();
		}

		testutil.setupChaincodeDeploy();
		return Packager.package(testutil.CHAINCODE_PATH,'',true);
	}).then((data) => {
		t.equal(data, null, 'Should return null when packaging for dev mode');
		return Packager.package(testutil.CHAINCODE_PATH,'',false);
	}).then((data) => {
		let tmpFile = path.join(testutil.getTempDir(), 'test-deploy-copy.tar.gz');
		let destDir = path.join(testutil.getTempDir(), 'test-deploy-copy-tar-gz');
		fs.writeFileSync(tmpFile, data);
		fs.removeSync(destDir);
		targz.decompress({
			src: tmpFile,
			dest: destDir
		}, (err) => {
			if (err)
				t.fail('Failed to extract generated chaincode package. ' + err);

			let checkPath = path.join(destDir, 'src', 'github.com', 'example_cc', 'example_cc.go');
			t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "src/github.com/example_cc/example_cc.go" file');

			t.end();
		});
	}).catch((err) => {
		t.fail('Caught error in Package.package tests');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});

const npmignore1 = '**/node_modules';
const destDir = path.join(testutil.getTempDir(), 'test-node-chaincode');
const tmpFile = path.join(testutil.getTempDir(), 'test-node-chaincode.tar.gz');
const targzDir = path.join(testutil.getTempDir(), 'test-node-chaincode-tar-gz');
function check(data, checkFcn) {
	fs.writeFileSync(tmpFile, data);
	fs.removeSync(targzDir);

	return new Promise((resolve, reject) => {
		targz.decompress({
			src: tmpFile,
			dest: targzDir
		}, (err) => {
			if (err)
				reject('Failed to extract generated chaincode package. ' + err);

			checkFcn();
			resolve();
		});
	})
}

test('\n\n** Node.js Packager tests **\n\n', function(t) {
	Packager.package(testutil.NODE_CHAINCODE_PATH, 'node', true)
	.then((data) => {
		t.equal(data, null, 'Should return null when packaging for dev mode');

		fs.removeSync(destDir);
		fs.copySync(testutil.NODE_CHAINCODE_PATH, destDir);

		fs.outputFileSync(path.join(destDir, '.npmignore'), npmignore1);
		fs.outputFileSync(path.join(destDir, 'node_modules/dummy/package.json'), 'dummy package.json content');

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
			t.equal(fs.existsSync(checkPath), true, 'The tar.gz file produced by Packager.package() has the "node_modules" folder');
		});
	}).then(() => {
		t.end();
	}).catch((err) => {
		t.fail('Caught error in Package.package tests');
		t.comment(err.stack ? err.stack : err);
		t.end();
	});
});