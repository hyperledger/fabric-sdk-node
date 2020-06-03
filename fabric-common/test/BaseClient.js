/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const {BaseClient} = require('fabric-common');
const BaseClientRewire = rewire('fabric-common/lib/BaseClient');

const chai = require('chai');
const sinon = require('sinon');
const should = chai.should();

describe('BaseClient', () => {

	describe('#constructor', () => {

		it('should set `_cryptoSuite` to null', () => {
			const client = new BaseClient();
			should.equal(client._cryptoSuite, null);
		});
	});

	describe('#BaseClient.newCryptoSuite', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.newCryptoSuite` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const newCryptoSuiteStub = sandbox.stub().returns('newCryptoSuite');
			sdkUtilsStub.newCryptoSuite = newCryptoSuiteStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const result = BaseClientRewire.newCryptoSuite('setting');

			result.should.equal('newCryptoSuite');
			sinon.assert.calledOnce(newCryptoSuiteStub);
			sinon.assert.calledWith(newCryptoSuiteStub, 'setting');
		});
	});

	describe('#BaseClient.newCryptoKeyStore', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.newCryptoKeyStore` with passed parameters and return result', async () => {
			const sdkUtilsStub = sandbox.stub();
			const newCryptoKeyStoreStub = sandbox.stub().returns('newCryptoKeyStore');
			sdkUtilsStub.newCryptoKeyStore = newCryptoKeyStoreStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const result = BaseClientRewire.newCryptoKeyStore('setting');

			result.should.equal('newCryptoKeyStore');
			sinon.assert.calledOnce(newCryptoKeyStoreStub);
			sinon.assert.calledWith(newCryptoKeyStoreStub, 'setting');
		});
	});

	describe('#BaseClient.newDefaultKeyValueStore', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.newKeyValueStore` and return result', async () => {
			const sdkUtilsStub = sandbox.stub();
			const newDefaultKeyValueStoreStub = sandbox.stub().resolves('newDefaultKeyValueStore');
			sdkUtilsStub.newKeyValueStore = newDefaultKeyValueStoreStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			await BaseClientRewire.newDefaultKeyValueStore();

			sinon.assert.calledOnce(newDefaultKeyValueStoreStub);
		});
	});

	describe('#BaseClient.setLogger', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should throw if passed logger does not implement any methods', () => {
			(() => {
				BaseClient.setLogger({});
			}).should.throw(/The "logger" parameter must be an object that implements the following methods, which are missing: debug\(\) info\(\) warn\(\) error\(\)/);
		});

		it('should throw if passed logger does not implement debug', () => {
			(() => {
				const fakelog = sinon.stub();
				fakelog.info = sinon.stub();
				fakelog.warn = sinon.stub();
				fakelog.error = sinon.stub();
				BaseClient.setLogger(fakelog);
			}).should.throw(/The "logger" parameter must be an object that implements the following methods, which are missing: debug\(\)/);
		});

		it('should throw if passed logger does not implement info', () => {
			(() => {
				const fakelog = sinon.stub();
				fakelog.debug = sinon.stub();
				fakelog.warn = sinon.stub();
				fakelog.error = sinon.stub();
				BaseClient.setLogger(fakelog);
			}).should.throw(/The "logger" parameter must be an object that implements the following methods, which are missing: info\(\)/);
		});

		it('should throw if passed logger does not implement warn', () => {
			(() => {
				const fakelog = sinon.stub();
				fakelog.debug = sinon.stub();
				fakelog.info = sinon.stub();
				fakelog.error = sinon.stub();
				BaseClient.setLogger(fakelog);
			}).should.throw(/The "logger" parameter must be an object that implements the following methods, which are missing: warn\(\)/);
		});

		it('should throw if passed logger does not implement error', () => {
			(() => {
				const fakelog = sinon.stub();
				fakelog.debug = sinon.stub();
				fakelog.info = sinon.stub();
				fakelog.warn = sinon.stub();
				BaseClient.setLogger(fakelog);
			}).should.throw(/The "logger" parameter must be an object that implements the following methods, which are missing: error\(\)/);
		});

		it('should overwrite the NodeJS.global logger if it already exists', () => {
			const fakelog1 = sinon.stub();
			fakelog1.debug = sinon.stub().returns('original');

			const fakelog = sinon.stub();
			fakelog.debug = sinon.stub().returns('replacement');
			fakelog.info = sinon.stub();
			fakelog.warn = sinon.stub();
			fakelog.error = sinon.stub();

			global.hfc.logger = fakelog1;
			BaseClient.setLogger(fakelog);

			global.hfc.logger.debug().should.equal('replacement');
		});

		it('should set the NodeJS.global logger if it doesnt exist', () => {

			global.hfc = null;

			const fakelog = sinon.stub();
			fakelog.debug = sinon.stub().returns('new');
			fakelog.info = sinon.stub();
			fakelog.warn = sinon.stub();
			fakelog.error = sinon.stub();

			BaseClient.setLogger(fakelog);

			global.hfc.logger.debug().should.equal('new');
		});
	});

	describe('#BaseClient.getConfigSetting', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.getConfigSetting` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const getConfigSettingStub = sandbox.stub().returns('getConfigSetting');
			sdkUtilsStub.getConfigSetting = getConfigSettingStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const result = BaseClientRewire.getConfigSetting('name', 'default_value');

			result.should.equal('getConfigSetting');
			sinon.assert.calledOnce(getConfigSettingStub);
			sinon.assert.calledWith(getConfigSettingStub, 'name', 'default_value');
		});
	});

	describe('#getConfigSetting', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `BaseClient.getConfigSetting` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const getConfigSettingStub = sandbox.stub().returns('getConfigSetting');
			sdkUtilsStub.getConfigSetting = getConfigSettingStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);


			const client = new BaseClientRewire();
			const result = client.getConfigSetting('name', 'default_value');

			result.should.equal('getConfigSetting');
			sinon.assert.calledOnce(getConfigSettingStub);
			sinon.assert.calledWith(getConfigSettingStub, 'name', 'default_value');
		});
	});

	describe('#BaseClient.addConfigFile', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.addConfigFile` with passed parameters', () => {
			const sdkUtilsStub = sandbox.stub();
			const addConfigFileStub = sandbox.stub();
			sdkUtilsStub.addConfigFile = addConfigFileStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			BaseClientRewire.addConfigFile('path');
			sinon.assert.calledOnce(addConfigFileStub);
			sinon.assert.calledWith(addConfigFileStub, 'path');
		});
	});

	describe('#BaseClient.setConfigSetting', () => {
		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.setConfigSetting` with passed parameters', () => {
			const sdkUtilsStub = sandbox.stub();
			const setConfigSettingStub = sandbox.stub();
			sdkUtilsStub.setConfigSetting = setConfigSettingStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			BaseClientRewire.setConfigSetting('name', 'value');
			sinon.assert.calledOnce(setConfigSettingStub);
			sinon.assert.calledWith(setConfigSettingStub, 'name', 'value');
		});
	});

	describe('#setConfigSetting', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `BaseClient.setConfigSetting` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const setConfigSettingStub = sandbox.stub();
			sdkUtilsStub.setConfigSetting = setConfigSettingStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const client = new BaseClientRewire();
			client.setConfigSetting('name', 'value');

			sinon.assert.calledOnce(setConfigSettingStub);
			sinon.assert.calledWith(setConfigSettingStub, 'name', 'value');
		});
	});

	describe('#BaseClient.getLogger', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.getLogger` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const getLoggerStub = sandbox.stub().returns('i am a logger');
			sdkUtilsStub.getLogger = getLoggerStub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const result = BaseClientRewire.getLogger('name');

			result.should.equal('i am a logger');
			sinon.assert.calledOnce(getLoggerStub);
			sinon.assert.calledWith(getLoggerStub, 'name');
		});
	});

	describe('#setCryptoSuite', () => {

		it('should set the CryptoSuite', () => {
			const suite = 'theSuite';
			const client = new BaseClient();

			client.setCryptoSuite(suite);

			client._cryptoSuite.should.equal(suite);
		});
	});

	describe('#getCryptoSuite', () => {

		it('should return the CryptoSuite', () => {
			const suite = 'theSuite';
			const client = new BaseClient();

			client._cryptoSuite = suite;

			client.getCryptoSuite().should.equal(suite);
		});
	});

	describe('#BaseClient.normalizeX509', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should call `sdkUtils.normalizeX509` with passed parameters and return result', () => {
			const sdkUtilsStub = sandbox.stub();
			const normalizeX509Stub = sandbox.stub().returns('i am normal');
			sdkUtilsStub.normalizeX509 = normalizeX509Stub;
			BaseClientRewire.__set__('sdkUtils', sdkUtilsStub);

			const result = BaseClientRewire.normalizeX509('raw');

			result.should.equal('i am normal');
			sinon.assert.calledOnce(normalizeX509Stub);
			sinon.assert.calledWith(normalizeX509Stub, 'raw');
		});
	});

});
