/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const should = chai.should();
const rewire = require('rewire');

const FileSystemWallet = rewire('../../../lib/impl/wallet/filesystemwallet');
const X509WalletMixin = require('../../../lib/impl/wallet/x509walletmixin');
const Client = require('fabric-client');
const api = require('fabric-client/lib/api.js');
const fs = require('fs-extra');
const Path = require('path');
const rimraf = require('rimraf');
const os = require('os');

describe('FileSystemWallet', () => {
	let testwallet;
	const sandbox = sinon.createSandbox();

	beforeEach(() => {
		testwallet = new FileSystemWallet('/somepath');
		sinon.stub(testwallet, 'normalizeLabel').returnsArg(0);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should throw an error if path not defined', () => {
			(() => {
				new FileSystemWallet();
			}).should.throw(/No path/);
		});

		it('should default to X509 wallet mixin', () => {
			testwallet.walletMixin.should.be.an.instanceof(X509WalletMixin);
		});

		it('should accept a mixin parameter', () => {
			const wallet = new FileSystemWallet('/somepath', 'my_mixin');
			wallet.walletMixin.should.equal('my_mixin');
		});
	});

	describe('#_createFileKVS', () => {
		it('should create a File Key Value Store', async () => {
			sandbox.stub(fs, 'mkdirs').callsArg(1);
			const store = await FileSystemWallet._createFileKVS('test');
			store.should.be.an.instanceof(api.KeyValueStore);
		});
	});

	describe('#_getPartitionedPath', () => {
		it('should create partitioned path', () => {
			sandbox.stub(Path, 'join').returns('/joined/path');
			testwallet._getPartitionedPath('label');
			sinon.assert.calledOnce(testwallet.normalizeLabel);
			sinon.assert.calledOnce(Path.join);
			sinon.assert.calledWith(Path.join, '/somepath', 'label');
		});
	});

	describe('#_isDirectory', () => {
		beforeEach(() => {
			sandbox.stub(Path, 'join').withArgs('/somepath', 'adir').returns('/somepath/adir');
		});

		it('should return true if a directory', async () => {
			sandbox.stub(fs, 'lstat').withArgs('/somepath/adir').resolves(
				{
					isDirectory: () => {
						return true;
					}
				}
			);
			const isDir = await testwallet._isDirectory('adir');
			isDir.should.be.true;
		});

		it('should return false if not a directory', async () => {
			sandbox.stub(fs, 'lstat').withArgs('/somepath/adir').resolves(
				{
					isDirectory: () => {
						return false;
					}
				}
			);
			const isDir = await testwallet._isDirectory('adir');
			isDir.should.be.false;
		});

		it('should return false if an error is thrown', async () => {
			sandbox.stub(fs, 'lstat').rejects(new Error('bad karma'));
			const isDir = await testwallet._isDirectory('adir');
			isDir.should.be.false;
		});

	});

	describe('#getStateStore', () => {
		it('should create a KV store', async () => {
			// use Error as a class to be detected
			sandbox.stub(FileSystemWallet, '_createFileKVS').resolves(new Error());
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path');
			const store = await testwallet.getStateStore('test');
			sinon.assert.calledOnce(FileSystemWallet._createFileKVS);
			sinon.assert.calledWith(FileSystemWallet._createFileKVS, '/partitioned/path');
			store.should.be.an.instanceof(Error);
		});
	});

	describe('#getCryptoSuite', () => {
		it('should create a KV store', async () => {
			sandbox.stub(Client, 'newCryptoKeyStore').returns({});
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path2');
			const suite = await testwallet.getCryptoSuite('test');
			sinon.assert.calledOnce(Client.newCryptoKeyStore);
			sinon.assert.calledWith(Client.newCryptoKeyStore, {path: '/partitioned/path2'});
			suite.should.be.an.instanceof(api.CryptoSuite);
		});
	});

	describe('#exists', () => {
		it('should return true if directory and file of same name exists', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path3/user1');
			sandbox.stub(fs, 'exists').withArgs('/partitioned/path3/user1/user1').resolves(true);
			sinon.stub(testwallet, '_isDirectory').withArgs('user1').resolves(true);

			const exists = await testwallet.exists('user1');
			exists.should.equal(true);
			sinon.assert.calledOnce(fs.exists);
			sinon.assert.calledOnce(testwallet._isDirectory);
		});

		it('should return false if directory but file of same name does not exist', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path3/user1');
			sandbox.stub(fs, 'exists').withArgs('/partitioned/path3/user1/user1').resolves(false);
			sinon.stub(testwallet, '_isDirectory').withArgs('user1').resolves(true);

			const exists = await testwallet.exists('user1');
			exists.should.equal(false);
			sinon.assert.calledOnce(fs.exists);
			sinon.assert.calledOnce(testwallet._isDirectory);
		});

		it('should return false if directory does not exist', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path3/user1');
			sinon.stub(testwallet, '_isDirectory').withArgs('user1').resolves(false);
			sandbox.stub(fs, 'exists');

			const exists = await testwallet.exists('user1');
			exists.should.equal(false);
			sinon.assert.calledOnce(testwallet._isDirectory);
			sinon.assert.notCalled(fs.exists);
		});
	});

	describe('#delete', () => {
		const savedRimRaf = FileSystemWallet.__get__('rimraf');

		afterEach(() => {
			FileSystemWallet.__set__('rimraf', savedRimRaf);
		});

		it('should delete an identity from the wallet if it exists', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path5/user1');
			sinon.stub(testwallet, 'exists').withArgs('user1').returns(true);
			const rimrafStub = sinon.stub();
			FileSystemWallet.__set__('rimraf', rimrafStub.callsArg(1));
			const success = await testwallet.delete('user1');
			success.should.be.true;
			sinon.assert.calledOnce(rimrafStub);
		});

		it('should return false if identity does not exist', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path5/user1');
			sinon.stub(testwallet, 'exists').withArgs('user1').returns(false);
			const rimrafStub = sinon.stub();
			FileSystemWallet.__set__('rimraf', rimrafStub.callsArg(1));
			const success = await testwallet.delete('user1');
			success.should.be.false;
			sinon.assert.notCalled(rimrafStub);
		});


		it('should throw an error if delete fails', () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path6/user2');
			sinon.stub(testwallet, 'exists').withArgs('user2').returns(true);

			const rimrafStub = sinon.stub();
			FileSystemWallet.__set__('rimraf', rimrafStub.callsArgWith(1, new Error('Unable to delete')));
			testwallet.delete('user2').should.eventually.be.rejectedWith(/Unable to delete/);
		});
	});

	describe('#getAllLabels', () => {
		// test readdir returns null, [], throws error
		it('should list all identities in the wallet', async () => {

			// user1 and user3 are the only valid identities
			sandbox.stub(fs, 'readdir').resolves(['user1', 'user2', 'user3', 'user4']);
			const isDirStub = sinon.stub(testwallet, '_isDirectory');
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path7');
			const existsStub = sandbox.stub(fs, 'exists');
			isDirStub.withArgs('user1').resolves(true);
			isDirStub.withArgs('user2').resolves(false);
			isDirStub.returns(true);

			existsStub.withArgs('/partitioned/path7/user1').resolves(true);
			existsStub.withArgs('/partitioned/path7/user3').resolves(true);
			existsStub.withArgs('/partitioned/path7/user4').resolves(false);

			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(2);
			labels.includes('user1').should.equal(true);
			labels.includes('user3').should.equal(true);
		});

		it('should handle no entries in the wallet - 1', async () => {
			sandbox.stub(fs, 'readdir').resolves(null);
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

		it('should handle no entries in the wallet - 2', async () => {
			sandbox.stub(fs, 'readdir').resolves([]);
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

		it('should handle no entries in the wallet - 3', async () => {
			sandbox.stub(fs, 'readdir').rejects(new Error('no directory'));
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

	});

	describe('Functional tests', () => {
		const tmpdir = Path.join(os.tmpdir(), 'unittest-network-test163');

		after(async () => {
			const rimRafPromise = new Promise((resolve) => {
				rimraf(tmpdir, (err) => {
					if (err) {
						// eslint-disable-next-line no-console
						console.log(`failed to delete ${tmpdir}, error was ${err}`);
						resolve();
					}
					resolve();
				});
			});
			await rimRafPromise;
		});

		it('should perform all the actions of a wallet correctly', async () => {
			const cert = `-----BEGIN CERTIFICATE-----
MIICfzCCAiWgAwIBAgIUNAqZVk9s5/HR7k30feNp8DrYbK4wCgYIKoZIzj0EAwIw
cDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh
biBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xGTAXBgNVBAMT
EG9yZzEuZXhhbXBsZS5jb20wHhcNMTgwMjI2MjAwOTAwWhcNMTkwMjI2MjAxNDAw
WjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xpbmExFDASBgNV
BAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZjbGllbnQxDjAMBgNVBAMTBWFkbWlu
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEz05miTKv6Vz+qhc5362WIZ44fs/H
X5m9zDOifle5HIjt4Usj+TiUgT1hpbI8UI9pueWhbrZpZXlX6+mImi52HaOBrzCB
rDAOBgNVHQ8BAf8EBAMCA6gwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMC
MAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFPnxMtT6jgYsMAgI38ponGs8sgbqMCsG
A1UdIwQkMCKAIKItrzVrKqtXkupT419m/M7x1/GqKzorktv7+WpEjqJqMCEGA1Ud
EQQaMBiCFnBlZXIwLm9yZzEuZXhhbXBsZS5jb20wCgYIKoZIzj0EAwIDSAAwRQIh
AM1JowZMshCRs6dnOfRmUHV7399KnNvs5QoNw93cuQuAAiBtBEGh1Xt50tZjDcYN
j+yx4IraL4JvMrCHbR5/R+Xo1Q==
-----END CERTIFICATE-----`;
			const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbTXpl4NGXuPtSC/V
PTVNGVBgVv8pZ6kGktVcnQD0KiKhRANCAATPTmaJMq/pXP6qFznfrZYhnjh+z8df
mb3MM6J+V7kciO3hSyP5OJSBPWGlsjxQj2m55aFutmlleVfr6YiaLnYd
-----END PRIVATE KEY-----
`;

			const identityLabel = 'User1@org1.example.com';

			const fileSystemWallet = new FileSystemWallet(tmpdir);

			// test list works
			let list = await fileSystemWallet.list();
			list.length.should.equal(0);

			// test import and exists works
			await fileSystemWallet.import(identityLabel, X509WalletMixin.createIdentity('Org1MSP', cert, key));
			let exists = await fileSystemWallet.exists(identityLabel);
			exists = exists && await fs.exists(tmpdir);
			exists = exists && await fs.exists(Path.join(tmpdir, identityLabel));
			exists.should.be.true;

			// test exports works
			let exported = await fileSystemWallet.export(identityLabel);
			exported.privateKey = exported.privateKey.replace(/(\r\n\t|\n|\r\t|\r)/gm, '');
			const orgKey = key.replace(/(\r\n\t|\n|\r\t|\r)/gm, '');

			exported.should.deep.equal({
				certificate: cert,
				privateKey: orgKey,
				mspId: 'Org1MSP',
				type: 'X509'
			});
			exported = await fileSystemWallet.export('IdoNotExist');
			should.equal(null, exported);

			// test list works
			list = await fileSystemWallet.list();
			list.length.should.equal(1);
			list[0].label.should.equal(identityLabel);

			// test delete
			let wasDeleted = await fileSystemWallet.delete(identityLabel);
			exists = await fs.exists(Path.join(tmpdir, identityLabel));
			wasDeleted = wasDeleted && !exists;
			wasDeleted.should.be.true;
			wasDeleted = await fileSystemWallet.delete(identityLabel);
			wasDeleted.should.be.false;
		});
	});
});
