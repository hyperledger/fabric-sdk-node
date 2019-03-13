/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
chai.should();
chai.use(require('chai-as-promised'));
const rewire = require('rewire');
const proxyquire =  require('proxyquire');

let CouchDBWallet = rewire('../../../lib/impl/wallet/couchdbwallet');
const X509WalletMixin = require('../../../lib/impl/wallet/x509walletmixin');

describe('CouchDBWallet', () => {
	let testwallet;
	let sandbox;
	let nanoStub;
	let getStub;
	let listStub;
	let destroyStub;
	let deleteStub;
	let existsStub;
	let getAllLabelsStub;
	const CouchDBKeyValueStoreMock = class {
		constructor() {
			this.delete = deleteStub;
			this.exists = existsStub;
			this.getAllLabels = getAllLabelsStub;
		}
	};
	let FakeLogger;
	let ClientStub;
	let newCryptoSuiteStub;
	let setCryptoSuiteStub;
	let setCryptoKeyStoreStub;
	let newCryptoKeyStoreStub;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		FakeLogger = {
			error: () => {},
			debug: () => {}
		};
		sandbox.stub(FakeLogger);
		CouchDBWallet.__set__('logger', FakeLogger);
		CouchDBWallet.__set__('CouchDBVStore', CouchDBKeyValueStoreMock);
		CouchDBWallet.__set__('CouchDBWalletKeyValueStore', CouchDBKeyValueStoreMock);
		nanoStub = sandbox.stub();

		deleteStub = sandbox.stub();
		existsStub = sandbox.stub();
		listStub = sandbox.stub();
		getStub = sandbox.stub();
		destroyStub = sandbox.stub();
		getAllLabelsStub = sandbox.stub();
		nanoStub.returns({db: {
			destroy: destroyStub,
			get: getStub,
			list: listStub,
			getAllLabels: getAllLabelsStub
		}});
		CouchDBWallet.__set__('Nano', nanoStub);
		testwallet = new CouchDBWallet({url: 'http://someurl'});
		newCryptoKeyStoreStub = sandbox.stub();
		setCryptoKeyStoreStub = sandbox.stub();
		setCryptoSuiteStub = sandbox.stub();
		newCryptoSuiteStub = sandbox.stub().returns({setCryptoKeyStore: setCryptoKeyStoreStub});
		ClientStub = {
			newCryptoSuite: newCryptoSuiteStub,
			setCryptoSuite: setCryptoSuiteStub,
			newCryptoKeyStore: newCryptoKeyStoreStub
		};
		CouchDBWallet.__set__('Client', ClientStub);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should throw an error if path not defined', () => {
			(() => {
				new CouchDBWallet();
			}).should.throw(/No options/);
		});

		it('should throw an error if path not defined', () => {
			(() => {
				new CouchDBWallet({});
			}).should.throw(/No url/);
		});

		it('should default to X509 wallet mixin', () => {
			testwallet.walletMixin.should.be.an.instanceof(X509WalletMixin);
		});

		it('should accept a mixin parameter', () => {
			const wallet = new CouchDBWallet({url: 'http://someurl'}, 'my_mixin');
			sinon.assert.calledWith(FakeLogger.debug, 'in CouchDBWallet %s', 'constructor');
			wallet.walletMixin.should.equal('my_mixin');
		});

		it('should create a Nano object', () => {
			new CouchDBWallet({url: 'http://someurl'});
			sinon.assert.calledWith(nanoStub, 'http://someurl');
		});

		it('should set dbOptions', () => {
			const wallet = new CouchDBWallet({url: 'http://someurl'}, 'my_mixin');
			wallet.dbOptions.should.deep.equal({url: 'http://someurl'});
			wallet.options.should.deep.equal({url: 'http://someurl'});
		});
	});

	describe('#_createOptions', () => {
		it('should give the default options and the correct url', () => {
			const options = testwallet._createOptions();
			options.should.deep.equal({
				url: 'http://someurl',
				name: 'wallet'
			});
		});
	});

	describe('#getStateStore', () => {
		it('should create a KV store and log that it was created', async() => {
			const kvs = await testwallet.getStateStore('label');
			kvs.should.be.an.instanceof(CouchDBKeyValueStoreMock);
			sinon.assert.calledWith(FakeLogger.debug, 'in %s, label = %s', 'getStateStore', 'label');
		});
	});

	describe('#getCryptoSuite', () => {
		it('should set the cryptoSuite', async() => {
			newCryptoKeyStoreStub.returns('crypto-store');
			const cryptoSuite = await testwallet.getCryptoSuite('label');
			sinon.assert.calledWith(FakeLogger.debug, 'in %s, label = %s', 'getCryptoSuite', 'label');
			sinon.assert.called(newCryptoSuiteStub);
			sinon.assert.calledWith(setCryptoKeyStoreStub, 'crypto-store');
			sinon.assert.calledWith(newCryptoKeyStoreStub);
			cryptoSuite.should.deep.equal(newCryptoSuiteStub());
		});
	});

	describe('#delete', () => {
		it('should delete an identity from the wallet if it exists', async() => {
			deleteStub.returns(true);
			const deleted = await testwallet.delete('label');
			sinon.assert.calledWith(deleteStub, 'label');
			deleted.should.be.true;
		});
	});

	describe('#exists', () => {
		it('should return true if identity exists', async () => {
			existsStub.returns(true);
			const existence = await testwallet.exists('label');
			sinon.assert.calledWith(FakeLogger.debug, 'in %s, label = %s', 'exists', 'label');
			sinon.assert.calledWith(existsStub, 'label');
			existence.should.equal(true);
		});
	});

	describe('#getAllLabels', () => {
		it('should list all identities in the wallet', async() => {
			getAllLabelsStub.returns(['IDENTITY']);
			const identities = await testwallet.getAllLabels();
			identities.should.deep.equal(['IDENTITY']);
		});
	});
});

describe('CouchDBWalletKeyValueStore', () => {
	let sandbox;
	let destroyStub;
	let getStub;
	let listStub;
	let kvs;
	before(() => {
		CouchDBWallet = proxyquire('../../../lib/impl/wallet/couchdbwallet', {
			'fabric-client/lib/impl/CouchDBKeyValueStore': class {}
		});
	});
	beforeEach(() => {
		sandbox = sinon.createSandbox();
		destroyStub = sandbox.stub();
		getStub = sandbox.stub();
		listStub = sandbox.stub();
		const CouchDBWalletKeyValueStore = CouchDBWallet.CouchDBWalletKeyValueStore;
		kvs = new CouchDBWalletKeyValueStore();
		kvs._database = {
			destroy: destroyStub,
			get: getStub,
			list: listStub
		};
	});

	describe('#delete', () => {
		it ('should return true if the key is deleted', async () => {
			destroyStub.yields();
			const deleted = await kvs.delete('key');
			deleted.should.be.true;
		});

		it('should return false if there was an error during deletion', async () => {
			destroyStub.yields(new Error());
			const deleted = await kvs.delete('key');
			deleted.should.be.false;
		});

		it('should return false if error occurs when finding the key', async () => {
			destroyStub.yields(new Error());
			const deleted = await kvs.delete('key');
			deleted.should.be.false;
		});

		it('should return false if error occurs when finding the key', async () => {
			destroyStub.yields(new Error());
			const deleted = await kvs.delete('key');
			deleted.should.be.false;
		});
	});

	describe('#exists', () => {
		it ('should return true if the key is found', async () => {
			getStub.yields();
			const existence = await kvs.exists('key');
			existence.should.be.true;
		});

		it('should return false the key is not found', async () => {
			getStub.yields({error: 'not_found'});
			const existence = await kvs.exists('key');
			existence.should.be.false;
		});
		it('should throw an error if unknown error is thrown', async () => {
			getStub.yields(new Error());
			try {
				await kvs.exists('key');
				should.fail();
			} catch (e) {
				e.should.be.instanceof(Error);
			}
		});
	});

	describe('#getAllLabels', () => {
		it('should return a list of labels without prefixes', async () => {
			listStub.yields(null, ['entry', 'entry1']);
			const list = await kvs.getAllLabels();
			list.should.deep.equal(['entry', 'entry1']);
		});

		it('should throw an error', async () => {
			listStub.yields(new Error());
			try {
				await kvs.getAllLabels();
			} catch (err) {
				err.should.be.instanceof(Error);
			}
		});
	});
});
