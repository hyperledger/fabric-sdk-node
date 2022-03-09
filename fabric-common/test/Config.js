/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const Config = require('../lib/Config');
const ConfigRewire = rewire('../lib/Config');

const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();

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

	describe('environment variables', () => {
		let originalEnv;

		beforeEach(() => {
			originalEnv = Object.assign({}, process.env);
		});

		afterEach(() => {
			Object.keys(process.env).forEach(key => delete process.env[key]);
			Object.assign(process.env, originalEnv);
		});

		const tests = [
			{name: 'should convert number-like strings to numbers',   envName: 'testnumber',      value: '101',  expected: 101},
			{name: 'should convert underscores to hyphens',           envName: 'test_underscore', value: 'PASS', configName: 'test-underscore'},
			{name: 'should convert to lowercase',                     envName: 'TESTUPPERCASE',   value: 'PASS', configName: 'testuppercase'},
			{name: 'should convert boolean-like strings to booleans', envName: 'testboolean',     value: 'true', expected: true},
		];

		tests.forEach(test => it(`${test.name}`, () => {
			process.env[test.envName] = test.value;
			const config = new Config();
			const result = config.get(test.configName || test.envName);
			should.exist(result);
			result.should.equal(test.expected || test.value);
		}));
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
