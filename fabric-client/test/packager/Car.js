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
