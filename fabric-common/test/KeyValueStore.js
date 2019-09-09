/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const KeyValueStore = require('../lib/KeyValueStore');

const chai = require('chai');
const should = chai.should();

describe('KeyValueStore', () => {
	let keyValueStore;

	beforeEach(() => {
		keyValueStore = new KeyValueStore();
	});

	describe('#initialize', () => {
		it('should return undefined', async () => {
			const result = await keyValueStore.initialize();
			should.equal(result, undefined);
		});
	});

	describe('#getName', () => {
		it('should return undefined', () => {
			const value1 = keyValueStore.getValue('name');
			const value2 = keyValueStore.getValue();
			should.equal(value1, undefined);
			should.equal(value2, undefined);
		});
	});

	describe('#setValue', () => {
		it('should return undefined', () => {
			should.equal(keyValueStore.setValue(), undefined);
			should.equal(keyValueStore.setValue('name'), undefined);
			should.equal(keyValueStore.setValue(null, 'value'), undefined);
		});
	});
});
