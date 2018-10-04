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
const Golang = rewire('../../lib/packager/Golang');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Golang', () => {

	let revert;
	let sandbox;
	let FakeLogger;
	let findMetadataDescriptorsStub;
	let generateTarGzStub;
	let bufferStub;
	let getContentsStub;

	let golang;
	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		FakeLogger = {
			error: () => {},
			debug: () => {}
		};
		sinon.stub(FakeLogger);
		revert.push(Golang.__set__('logger', FakeLogger));
		findMetadataDescriptorsStub = sandbox.stub().resolves(['descriptor1']);
		generateTarGzStub = sandbox.stub().resolves();
		revert.push(Golang.__set__('BasePackager.prototype.findMetadataDescriptors', findMetadataDescriptorsStub));
		revert.push(Golang.__set__('BasePackager.prototype.generateTarGz', generateTarGzStub));
		getContentsStub = sandbox.stub();
		bufferStub = class {
			constructor() {
				this.getContents = getContentsStub;
			}
		};
		revert.push(Golang.__set__('sbuf.WritableStreamBuffer', bufferStub));

		golang = new Golang();
	});

	describe('#package', () => {
		let findSourceStub;

		beforeEach(() => {
			findSourceStub = sandbox.stub();
			golang.findSource = findSourceStub;
		});

		it('should return the package when given the metadata path', async() => {
			findSourceStub.resolves(['descriptor2']);
			await golang.package('ccpath', 'metadatapath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2', 'descriptor1'], new bufferStub());
			sinon.assert.called(getContentsStub);
		});

		it('should return the package when not given the metadata path', async() => {
			findSourceStub.resolves(['descriptor2']);
			await golang.package('ccpath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2'], new bufferStub());
			sinon.assert.called(getContentsStub);
		});
	});

	describe('#findSource', () => {
		let klawStub;
		let isFileStub;
		let isSourceStub;
		let onStub;
		let entryStub;

		beforeEach(() => {
			isFileStub = sandbox.stub();
			isSourceStub = sandbox.stub();
			revert.push(Golang.__set__('BasePackager.prototype.isSource', isSourceStub));
			onStub = sandbox.stub();
			onStub.returns({on: onStub});
			klawStub = sandbox.stub().returns({on: onStub});
			revert.push(Golang.__set__('klaw', klawStub));
			entryStub = {stats: {isFile: isFileStub}, path: 'path'};
		});

		it('should throw an error', async() => {
			onStub.withArgs('error').yields(new Error('fake error'), {path: 'path'});
			try {
				await golang.findSource('gopath', 'filepath');
			} catch (err) {
				sinon.assert.calledWithMatch(FakeLogger.error, /error while packaging path/);
				err.should.be.instanceof(Error);
			}
		});

		it('should return a list of descriptors and log each one added', async() => {
			onStub.withArgs('data').yields(entryStub).returns({on: onStub});
			onStub.withArgs('end').yields();
			isFileStub.returns(true);
			isSourceStub.returns(true);

			const desctiptors = await golang.findSource('gopath', 'filepath');
			sinon.assert.calledWith(FakeLogger.debug, 'adding entry', {name: '../path', fqp: 'path'});
			desctiptors.should.deep.equal([{
				'fqp': 'path',
				'name': '../path'
			}]);
		});

		it('should not add a descriptor if entry is not a file', async() => {
			onStub.withArgs('data').yields(entryStub).returns({on: onStub});
			onStub.withArgs('end').yields();
			isFileStub.returns(false);
			isSourceStub.returns(true);

			const descriptors = await golang.findSource('gopath', 'filepath');
			sinon.assert.notCalled(FakeLogger.debug);
			descriptors.should.deep.equal([]);
		});
	});
});
