/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const Car = rewire('../../lib/packager/Car');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Car', () => {

	let revert;
	let sandbox;
	let FakeLogger;
	let readFileSyncStub;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		FakeLogger = {
			error: () => {},
			debug: () => {}
		};
		sinon.stub(FakeLogger);
		revert.push(Car.__set__('logger', FakeLogger));
		readFileSyncStub = sandbox.stub();
		revert.push(Car.__set__('fs.readFileSync', readFileSyncStub));
	});

	describe('#package', () => {
		it('should log and return the file', () => {
			const car = new Car();
			readFileSyncStub.returns('car-file');
			car.package('path').should.equal('car-file');
			sinon.assert.calledWith(FakeLogger.debug, 'Packaging CAR file from path');
			sinon.assert.calledWith(readFileSyncStub, 'path');
		});
	});
});
