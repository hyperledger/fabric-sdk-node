/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const Golang = rewire('../../lib/packager/Golang');
const BufferStream = require('../../lib/packager/BufferStream');

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

		golang = new Golang(['.go']);
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
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2', 'descriptor1'], sinon.match.instanceOf(BufferStream));
		});

		it('should return the package when not given the metadata path', async() => {
			findSourceStub.resolves(['descriptor2']);
			await golang.package('ccpath');
			sinon.assert.calledWith(generateTarGzStub, ['descriptor2'], sinon.match.instanceOf(BufferStream));
		});
	});

	describe('#findSource', () => {
		let walkStub;

		beforeEach(() => {
			walkStub = sandbox.stub().resolves();
			revert.push(Golang.__set__('walk', walkStub));
		});

		it('should return a list of descriptors if files are returned', async() => {
			walkStub.resolves(['FILE_1.go']);
			const descriptors = await golang.findSource('go', 'go/src/path');
			sinon.assert.calledWith(FakeLogger.debug, 'adding entry', {fqp: 'go/src/path/FILE_1.go', name: 'src/path/FILE_1.go'});
			descriptors.should.deep.equal([{fqp: 'go/src/path/FILE_1.go', name: 'src/path/FILE_1.go'}]);
		});

		it('should return a list of descriptors if no files are returned', async() => {
			walkStub.resolves();
			const descriptors = await golang.findSource('go', 'go/src/path');
			sinon.assert.notCalled(FakeLogger.debug);
			descriptors.should.deep.equal([]);
		});
	});
});
