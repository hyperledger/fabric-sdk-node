/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const InMemoryKeyValueStore = require('../../lib/impl/InMemoryKeyValueStore');

const chai = require('chai');
const expect = chai.expect;

describe('InMemoryKeyValueStore', () => {
	let store;

	beforeEach(async () => {
		store = new InMemoryKeyValueStore();
		await store.initialize();
	});

	it('get returns null if key does not exist', async () => {
		const result = await store.getValue('no');
		expect(result).to.be.null;
	});

	it('set returns the value', async () => {
		const result = await store.setValue('key', 'value');
		expect(result).to.equal('value');
	});

	it('get returns a set value', async () => {
		await store.setValue('key', 'value');
		const result = await store.getValue('key');
		expect(result).to.equal('value');
	});
});
