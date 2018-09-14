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
const Hash = rewire('../lib/hash');
const {hash_sha2_256, hash_sha2_384, hash_sha3_256, hash_sha3_384} = Hash;
const sinon = require('sinon');

describe('hash_sha2_256', () => {
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
			hash = new hash_sha2_256();
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
			revert.push(Hash.__set__('crypto', cryptoStub));
			hash = new hash_sha2_256();
			hash.reset();
			sinon.assert.calledWith(cryptoStub.createHash, 'sha256');
		});
	});

	describe('#finalize', () => {
		it('should call _hash.digest, reset and reurn the hash', () => {
			hash = new hash_sha2_256();
			const digestStub = sandbox.stub().returns('hash');
			hash._hash = {digest: digestStub};
			const resetStub = sandbox.stub(hash, 'reset');
			hash.finalize('encoding').should.equal('hash');
			sinon.assert.calledWith(digestStub, 'encoding');
			sinon.assert.called(resetStub);
		});
	});
});

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
			revert.push(Hash.__set__('crypto', cryptoStub));
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

describe('hash_sha3_256', () => {
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

	describe('hashSimple', () => {
		it('should create an instance of sha3_256', () => {
			const mockSha3256 = sandbox.stub();
			revert.push(Hash.__set__('sha3_256', mockSha3256));
			hash_sha3_256.hashSimple('data');
			sinon.assert.calledWith(mockSha3256, 'data');
		});
	});

	describe('#reset', () => {
		it('should call sha3_256.create', () => {
			const sha3_256Stub = {create: sandbox.stub()};
			revert.push(Hash.__set__('sha3_256', sha3_256Stub));
			hash = new hash_sha3_256();
			hash.reset();
			sinon.assert.called(sha3_256Stub.create);
		});
	});

	describe('#finalize', () => {
		it('should call _hash.hex, reset and reurn the hash', () => {
			hash = new hash_sha3_256();
			const hexStub = sandbox.stub().returns('hash');
			hash._hash = {hex: hexStub};
			const resetStub = sandbox.stub(hash, 'reset');
			hash.finalize().should.equal('hash');
			sinon.assert.called(hexStub);
			sinon.assert.called(resetStub);
		});
	});
});

describe('hash_sha3_384', () => {
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

	describe('hashSimple', () => {
		it('should create an instance of hash_sha3_384', () => {
			const mockSha3384 = sandbox.stub();
			revert.push(Hash.__set__('sha3_384', mockSha3384));
			hash_sha3_384.hashSimple('data');
			sinon.assert.calledWith(mockSha3384, 'data');
		});
	});

	describe('#reset', () => {
		it('should call sha3_384.create', () => {
			const sha3_384Stub = {create: sandbox.stub()};
			revert.push(Hash.__set__('sha3_384', sha3_384Stub));
			hash = new hash_sha3_384();
			hash.reset();
			sinon.assert.called(sha3_384Stub.create);
		});
	});

	describe('#finalize', () => {
		it('should call _hash.hex, reset and reurn the hash', () => {
			hash = new hash_sha3_384();
			const hexStub = sandbox.stub().returns('hash');
			hash._hash = {hex: hexStub};
			const resetStub = sandbox.stub(hash, 'reset');
			hash.finalize().should.equal('hash');
			sinon.assert.called(hexStub);
			sinon.assert.called(resetStub);
		});
	});
});

describe('SHA2_256', () => {
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
	it('should call hash and return an insatnce of hash_sha2_256', () => {
		const mockHashFunction = sandbox.stub().returns('hash');
		const mockHash = sandbox.stub().returns({hash: mockHashFunction});
		revert.push(Hash.__set__('hash_sha2_256', mockHash));
		Hash.SHA2_256('data').should.equal('hash');
		sinon.assert.called(mockHash);
		sinon.assert.calledWith(mockHashFunction, 'data');
	});
});

describe('SHA2_384', () => {
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
	it('should call hash and return an insatnce of hash_sha2_384', () => {
		const mockHashFunction = sandbox.stub().returns('hash');
		const mockHash = sandbox.stub().returns({hash: mockHashFunction});
		revert.push(Hash.__set__('hash_sha2_384', mockHash));
		Hash.SHA2_384('data').should.equal('hash');
		sinon.assert.called(mockHash);
		sinon.assert.calledWith(mockHashFunction, 'data');
	});
});
