/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const nconf = require('nconf');
const rewire = require('rewire');
const Config = require('../lib/Config');
const ConfigRewire = rewire('../lib/Config');

const sinon = require('sinon');
const chai = require('chai');
chai.should();

describe('Config', () => {
	let sandbox;
	let revert;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		let mapSettingsStub;

		beforeEach(() => {
			sandbox.stub(nconf, 'use');
			sandbox.stub(nconf, 'argv');
			sandbox.stub(nconf, 'env');
			nconf.stores.mapenv = 'mapenv';
			mapSettingsStub = sandbox.stub();
			revert.push(ConfigRewire.__set__('Config.prototype.mapSettings', mapSettingsStub));
			revert.push(ConfigRewire.__set__('nconf', nconf));
			process.env.property = 'test-property';
		});

		it('should call nconf, Config.mapSettings and set the correct properties', () => {
			const config = new ConfigRewire();
			sinon.assert.calledWith(mapSettingsStub, nconf.stores.mapenv, sinon.match.hasOwn('property', 'test-property'));
			sinon.assert.calledWith(nconf.use, 'memory');
			sinon.assert.called(nconf.argv);
			sinon.assert.called(nconf.env);
			sinon.assert.calledWith(nconf.use, 'mapenv', {type: 'memory'});
			config._fileStores.should.deep.equal([]);
			config._config.should.deep.equal(nconf);
		});

		afterEach(() => {
			// Unset process.env.property
			process.env.property = undefined;
		});
	});

	describe('#mapSettings', () => {
		let storeStub;

		beforeEach(() => {
			storeStub = {set: () => {}};
			sandbox.stub(storeStub, 'set');
		});

		it('should add the settings to the store', () => {
			const config = new Config();
			config.mapSettings(storeStub, {'setting1': 'value1', 'setting2': 'value2'});
			sinon.assert.calledTwice(storeStub.set);
			storeStub.set.getCall(0).args[0].should.equal('setting1');
			storeStub.set.getCall(0).args[1].should.equal('value1');
			storeStub.set.getCall(1).args[0].should.equal('setting2');
			storeStub.set.getCall(1).args[1].should.equal('value2');
		});
	});

	describe('#reorderFileStores', () => {

		let config;

		beforeEach(() => {
			config = new Config();
		});

		it('should add the new file store to the bottom of an empty list', () => {
			config.reorderFileStores('/some/path', true);
			config._fileStores.should.deep.equal(['/some/path']);
		});

		it('should add the new file store to the bottom of an non-empty list', () => {
			config._fileStores = ['/some/other/path1', '/some/other/path2'];
			config.reorderFileStores('/some/path', true);
			config._fileStores.should.deep.equal(['/some/other/path1', '/some/other/path2', '/some/path']);
		});

		it('should add the new file store to the front of an empty list', () => {
			config.reorderFileStores('/some/path', false);
			config._fileStores.should.deep.equal(['/some/path']);
		});

		it('should add the new file store to the front of an non-empty list', () => {
			config._fileStores = ['/some/other/path1', '/some/other/path2'];
			config.reorderFileStores('/some/path', false);
			config._fileStores.should.deep.equal(['/some/path', '/some/other/path1', '/some/other/path2']);
		});
	});

	describe('#file', () => {
		it('should call Config.reorderFileStores when given a string', () => {
			const config = new ConfigRewire();
			sandbox.stub(config, 'reorderFileStores');
			config.file('string');
			sinon.assert.calledWith(config.reorderFileStores, 'string');
		});

		it('should throw an error when not given a string', () => {
			const config = new ConfigRewire();
			(() => {
				config.file();
			}).should.throw('The "path" parameter must be a string');
		});
	});

	describe('#get', () => {
		let configStub;

		beforeEach(() => {
			configStub = {get: () => {}};
			sandbox.stub(configStub);
		});

		it('should return a value when _config.get does not throw error', () => {
			configStub.get.returns('return-value');
			const config = new ConfigRewire();
			config._config = configStub;

			const result = config.get('name', 'default-value');
			result.should.equal('return-value');
			sinon.assert.calledWith(configStub.get, 'name');
		});

		it('should return the default value when _config.get does not throw error', () => {
			configStub.get.returns('return-value');
			configStub.get.throws(new Error('Error'));
			const config = new ConfigRewire();
			config._config = configStub;

			const result = config.get('name', 'default-value');
			result.should.equal('default-value');
			sinon.assert.calledWith(configStub.get, 'name');
		});

		it('should return the default value when _config.get returns null', () => {
			configStub.get.returns(null);
			const config = new ConfigRewire();
			config._config = configStub;

			const result = config.get('name', 'default-value');
			result.should.equal('default-value');
			sinon.assert.calledWith(configStub.get, 'name');
		});

		it('should return the default value when _config.get returns undefined', () => {
			configStub.get.returns(undefined);
			const config = new ConfigRewire();
			config._config = configStub;

			const result = config.get('name', 'default-value');
			result.should.equal('default-value');
			sinon.assert.calledWith(configStub.get, 'name');
		});
	});

	describe('#set', () => {
		let configStub;

		beforeEach(() => {
			configStub = {set: () => {}};
			sandbox.stub(configStub);
		});

		it('should call _config.set', () => {
			const config = new ConfigRewire();
			config._config = configStub;
			config.set('name', 'value');
			sinon.assert.calledWith(configStub.set, 'name', 'value');
		});
	});
});
