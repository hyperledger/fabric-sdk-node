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
const BufferStream = require('../../lib/packager/BufferStream');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Java', () => {
	const Java = rewire('../../lib/packager/Java');

	let revert;
	let sandbox;
	let FakeLogger;
	let findMetadataDescriptorsStub;
	let generateTarGzStub;

	let java;
	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		FakeLogger = {
			error: () => {
			},
			debug: () => {
			}
		};
		sinon.stub(FakeLogger);
		revert.push(Java.__set__('logger', FakeLogger));
		findMetadataDescriptorsStub = sandbox.stub().resolves(['descriptor1']);
		generateTarGzStub = sandbox.stub().resolves();
		revert.push(Java.__set__('BasePackager.prototype.findMetadataDescriptors', findMetadataDescriptorsStub));
		revert.push(Java.__set__('BasePackager.prototype.generateTarGz', generateTarGzStub));

		java = new Java();
	});

	describe('#package', () => {
		let findSourceStub;

		beforeEach(() => {
			findSourceStub = sandbox.stub();
			java.findSource = findSourceStub;
		});

		it('should return the package when given the metadata path', async () => {
			findSourceStub.resolves(['descriptor2']);
			await java.package('ccpath', 'metadatapath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2', 'descriptor1'], sinon.match.instanceOf(BufferStream));
		});

		it('should return the package when not given the metadata path', async () => {
			findSourceStub.resolves(['descriptor2']);
			await java.package('ccpath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2'], sinon.match.instanceOf(BufferStream));
		});
	});

	describe('#findSource', () => {
		let walkStub;

		beforeEach(() => {
			walkStub = sandbox.stub().resolves();
			revert.push(Java.__set__('walk', walkStub));
		});

		it('should return a list of descriptors if files are returned', async () => {
			walkStub.resolves(['FILE_1']);
			const descriptors = await java.findSource('path');
			sinon.assert.calledWith(FakeLogger.debug, 'adding descriptor entry', {fqp: 'path/FILE_1', name: 'src/FILE_1'});
			descriptors.should.deep.equal([{fqp: 'path/FILE_1', name: 'src/FILE_1'}]);
		});

		it('should return a list of descriptors if no files are returned', async () => {
			walkStub.resolves();
			const _path = 'path';
			const descriptors = await java.findSource(_path);
			sinon.assert.calledWith(FakeLogger.debug, ` No files found at this path ${_path}`);
			descriptors.should.deep.equal([]);
		});
	});
});
