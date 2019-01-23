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

const rewire = require('rewire');
const HashPrimitives = rewire('../lib/HashPrimitives');
const sinon = require('sinon');

require('chai').should();

describe('HashPrimitives', () => {

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
		it('should call hash and return an insatnce of hash_sha2_256 (default to hex)', () => {
			const mockHashFunction = sandbox.stub().returns('hash');
			const mockHash = sandbox.stub().returns({hash: mockHashFunction});
			revert.push(HashPrimitives.__set__('hash_sha2_256', mockHash));
			HashPrimitives.SHA2_256('data').should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data', 'hex');
		});
		it('should call hash and return an insatnce of hash_sha2_256 (specify hex)', () => {
			const mockHashFunction = sandbox.stub().returns('hash');
			const mockHash = sandbox.stub().returns({hash: mockHashFunction});
			revert.push(HashPrimitives.__set__('hash_sha2_256', mockHash));
			HashPrimitives.SHA2_256('data', 'hex').should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data', 'hex');
		});
		it('should call hash and return an insatnce of hash_sha2_256 (specify null)', () => {
			const mockHashFunction = sandbox.stub().returns('hash');
			const mockHash = sandbox.stub().returns({hash: mockHashFunction});
			revert.push(HashPrimitives.__set__('hash_sha2_256', mockHash));
			HashPrimitives.SHA2_256('data', null).should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data', null);
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
			revert.push(HashPrimitives.__set__('hash_sha2_384', mockHash));
			HashPrimitives.SHA2_384('data').should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data');
		});
		it('should call hash and return an insatnce of hash_sha2_384 (specify hex)', () => {
			const mockHashFunction = sandbox.stub().returns('hash');
			const mockHash = sandbox.stub().returns({hash: mockHashFunction});
			revert.push(HashPrimitives.__set__('hash_sha2_384', mockHash));
			HashPrimitives.SHA2_384('data', 'hex').should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data', 'hex');
		});
		it('should call hash and return an insatnce of hash_sha2_384 (specify null)', () => {
			const mockHashFunction = sandbox.stub().returns('hash');
			const mockHash = sandbox.stub().returns({hash: mockHashFunction});
			revert.push(HashPrimitives.__set__('hash_sha2_384', mockHash));
			HashPrimitives.SHA2_384('data', null).should.equal('hash');
			sinon.assert.called(mockHash);
			sinon.assert.calledWith(mockHashFunction, 'data', null);
		});
	});

});