/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const Java = rewire('../../lib/packager/Java');
const BufferStream = require('../../lib/packager/BufferStream');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Java', () => {

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
			error: () => {},
			debug: () => {}
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

		it('should return the package when given the metadata path', async() => {
			findSourceStub.resolves(['descriptor2']);
			await java.package('ccpath', 'metadatapath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2', 'descriptor1'], sinon.match.instanceOf(BufferStream));
		});

		it('should return the package when not given the metadata path', async() => {
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

		it('should return a list of descriptors if files are returned', async() => {
			walkStub.resolves(['FILE_1']);
			const descriptors = await java.findSource('path');
			sinon.assert.calledWith(FakeLogger.debug, 'adding descriptor entry', {fqp: 'path/FILE_1', name: 'src/FILE_1'});
			descriptors.should.deep.equal([{fqp: 'path/FILE_1', name: 'src/FILE_1'}]);
		});

		it('should return a list of descriptors if no files are returned', async() => {
			walkStub.resolves();
			const descriptors = await java.findSource('path');
			sinon.assert.calledWith(FakeLogger.debug, ' No files found at this path %s', 'path');
			descriptors.should.deep.equal([]);
		});
	});
});
