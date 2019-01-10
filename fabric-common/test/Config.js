/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');
const Config = require('../lib/Config');
const ConfigRewire = rewire('../lib/Config');
const nconf = require('nconf');

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
			revert.push(ConfigRewire.__set__('process.env', 'env'));
		});

		it('should call nconf, Config.mapSettings and set the correct properties', () => {
			const config = new ConfigRewire();
			sinon.assert.calledWith(mapSettingsStub, nconf.stores.mapenv, 'env');
			sinon.assert.calledWith(nconf.use, 'memory');
			sinon.assert.called(nconf.argv);
			sinon.assert.called(nconf.env);
			sinon.assert.calledWith(nconf.use, 'mapenv', {type: 'memory'});
			config._fileStores.should.deep.equal([]);
			config._config.should.deep.equal(nconf);
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
		let configStub;
		let fileStoresStub;

		beforeEach(() => {
			configStub = {remove: () => {}, file: () => {}};
			sandbox.stub(configStub);
			fileStoresStub = {push: () => {}, unshift: () => {}};
			sandbox.stub(fileStoresStub);
		});

		it('should re-add file store items where bottom is false', () => {
			const config = new Config();
			config._fileStores = fileStoresStub;
			config._config = configStub;
			config.reorderFileStores('path', false);
			sinon.assert.calledWith(configStub.remove, fileStoresStub.push);
			sinon.assert.calledWith(configStub.remove, fileStoresStub.unshift);
			sinon.assert.calledWith(fileStoresStub.unshift, 'path');
			sinon.assert.calledWith(configStub.file, fileStoresStub.push, fileStoresStub.push);
			sinon.assert.calledWith(configStub.file, fileStoresStub.unshift, fileStoresStub.unshift);
		});

		it('should re-add file store items where bottom is true', () => {
			const config = new Config();
			config._fileStores = fileStoresStub;
			config._config = configStub;
			config.reorderFileStores('path', true);
			sinon.assert.calledWith(configStub.remove, fileStoresStub.push);
			sinon.assert.calledWith(configStub.remove, fileStoresStub.unshift);
			sinon.assert.calledWith(fileStoresStub.push, 'path');
			sinon.assert.calledWith(configStub.file, fileStoresStub.push, fileStoresStub.push);
			sinon.assert.calledWith(configStub.file, fileStoresStub.unshift, fileStoresStub.unshift);
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
