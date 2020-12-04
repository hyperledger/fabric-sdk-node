/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const Key = require('../lib/Key');

const chai = require('chai');
const should = chai.should();

describe('Key', () => {
	let key;

	beforeEach(() => {
		key = new Key();
	});

	describe('#getSKI', () => {
		it('should return undefined', () => {
			should.equal(key.getSKI(), undefined);
		});
	});

	describe('#getHandle', () => {
		it('should return undefined', () => {
			should.equal(key.getHandle(), undefined);
		});
	});

	describe('#isSymmetric', () => {
		it('should return undefined', () => {
			should.equal(key.isSymmetric(), undefined);
		});
	});

	describe('#isPrivate', () => {
		it('should return undefined', () => {
			should.equal(key.isPrivate(), undefined);
		});
	});

	describe('#getPublicKey', () => {
		it('should return undefined', () => {
			should.equal(key.getPublicKey(), undefined);
		});
	});

	describe('#toBytes', () => {
		it('should return undefined', () => {
			should.equal(key.toBytes(), undefined);
		});
	});
});
