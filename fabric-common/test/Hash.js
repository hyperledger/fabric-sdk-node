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
