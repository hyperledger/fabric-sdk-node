/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const Hash = rewire('../lib/Hash');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('Hash', () => {
	let sandbox;
	let revert;
	let hash;

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
		it('should set the _blockSize and call reset()', () => {
			const hashResetStub = sandbox.stub();
			revert.push(Hash.__set__('Hash.prototype.reset', hashResetStub));
			hash = new Hash(5);
			hash._blockSize.should.equal(5);
			sinon.assert.called(hashResetStub);
		});
	});

	describe('#hash', () => {
		it('should return the correct function', () => {
			const hashFinalizeStub = sandbox.stub();
			const hashUpdateStub = sandbox.stub().returns({
				finalize: hashFinalizeStub
			});
			const hashResetStub = sandbox.stub().returns({
				update: hashUpdateStub,
			});
			revert.push(Hash.__set__('Hash.prototype.reset', hashResetStub));
			hash = new Hash(5);
			hash.hash('data');
			sinon.assert.calledTwice(hashResetStub);
			sinon.assert.calledWith(hashUpdateStub, 'data');
			sinon.assert.calledOnce(hashFinalizeStub);
		});
	});

	describe('#reset', () => {
		it('should return an instance of itself', () => {
			hash = new Hash(5);
			hash.reset().should.equal(hash);
		});
	});

	describe('#update', () => {
		it('should call _hash.update and return an instance of itself', () => {
			hash = new Hash(5);
			const hashUpdateStub = sandbox.stub();
			hash._hash = {update: hashUpdateStub};
			hash.update('data').should.equal(hash);
			sinon.assert.calledWith(hashUpdateStub, 'data');
		});
	});

	describe('#finalize', () => {
		it('should not throw', () => {
			hash = new Hash(5);
			(() => {
				hash.finalize();
			}).should.not.throw();
		});
	});
});
