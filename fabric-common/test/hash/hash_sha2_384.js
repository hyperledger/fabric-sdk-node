/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const hash_sha2_384 = rewire('../../lib/hash/hash_sha2_384');
const sinon = require('sinon');

require('chai').should();

describe('hash_sha2_384', () => {
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

	describe('#hash', () => {
		it('should call the reset reset.update.finalize and return the correct value', () => {
			hash = new hash_sha2_384();
			const finalizeStub = sandbox.stub().returns('finalize');
			const updateStub = sandbox.stub().returns({finalize: finalizeStub});
			const resetStub = sandbox.stub(hash, 'reset').returns({update: updateStub});
			hash.hash('data').should.equal('finalize');
			sinon.assert.called(resetStub);
			sinon.assert.calledWith(updateStub, 'data');
			sinon.assert.calledWith(finalizeStub, 'hex');
		});
	});

	describe('#reset', () => {
		it('should call crypto.createHash', () => {
			const cryptoStub = {createHash: sandbox.stub()};
			revert.push(hash_sha2_384.__set__('crypto', cryptoStub));
			hash = new hash_sha2_384();
			hash.reset();
			sinon.assert.calledWith(cryptoStub.createHash, 'sha384');
		});
	});

	describe('#finalize', () => {
		it('should call _hash.digest, reset and reurn the hash', () => {
			hash = new hash_sha2_384();
			const digestStub = sandbox.stub().returns('hash');
			hash._hash = {digest: digestStub};
			const resetStub = sandbox.stub(hash, 'reset');
			hash.finalize('encoding').should.equal('hash');
			sinon.assert.calledWith(digestStub, 'encoding');
			sinon.assert.called(resetStub);
		});
	});
});
