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
const PackagerRewire = rewire('../lib/Packager');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');

describe('Packager', () => {

	describe('#package', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should log on entry', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);

			PackagerRewire.package()
				.then(() => {
					sinon.assert.fail('should have thrown');
				})
				.catch(() => {
					sinon.assert.calledWith(debugStub, 'packager: chaincodePath: %s, chaincodeType: %s, devmode: %s, metadataPath: %s');
				});
		});

		it('should log and not package if in dev mode', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);

			const response = await PackagerRewire.package('chaincodePath', 'chaincodeType', true);
			should.equal(response, null);
			sinon.assert.calledWith(debugStub, 'packager: Skipping chaincode packaging due to devmode configuration');
		});

		it('should reject if missing chaincodePath parameter', async () => {
			await PackagerRewire.package(null, 'chaincodeType', false).should.be.rejectedWith(/Missing chaincodePath parameter/);
		});

		it('should log and handle `node` chaincode types', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const FakeNode = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'node_build'});
				};
				return Fake;
			})();

			const FakeOther = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'other_build'});
				};
				return Fake;
			})();

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);
			PackagerRewire.__set__('Node', FakeNode);
			PackagerRewire.__set__('Car', FakeOther);
			PackagerRewire.__set__('Golang', FakeOther);

			const obj = await PackagerRewire.package('chaincodePath', 'node', false);

			sinon.assert.calledWith(debugStub, 'packager: type %s ');
			obj.should.deep.equal({response: 'node_build'});
		});

		it('should handle `CAR` chaincode types', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const FakeCar = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'car_build'});
				};
				return Fake;
			})();

			const FakeOther = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'other_build'});
				};
				return Fake;
			})();

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);
			PackagerRewire.__set__('Node', FakeOther);
			PackagerRewire.__set__('Car', FakeCar);
			PackagerRewire.__set__('Golang', FakeOther);

			const obj = await PackagerRewire.package('chaincodePath', 'car', false);

			sinon.assert.calledWith(debugStub, 'packager: type %s ');
			obj.should.deep.equal({response: 'car_build'});
		});

		it('should handle default `goLang` chaincode types', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const FakeGoLang = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'go_build'});
				};
				return Fake;
			})();

			const FakeOther = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'other_build'});
				};
				return Fake;
			})();

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);
			PackagerRewire.__set__('Node', FakeOther);
			PackagerRewire.__set__('Car', FakeOther);
			PackagerRewire.__set__('Golang', FakeGoLang);

			const obj = await PackagerRewire.package('chaincodePath', null, false);

			sinon.assert.calledWith(debugStub, 'packager: type %s ');
			obj.should.deep.equal({response: 'go_build'});
		});

		it('should handle `JAVA` chaincode types', async () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const FakeJava = (function() {
				function Fake() {
				}
				Fake.prototype.package = function() {
					return Promise.resolve({response: 'go_build'});
				};
				return Fake;
			})();

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			PackagerRewire.__set__('logger', FakeLogger);
			PackagerRewire.__set__('Java', FakeJava);

			const obj = await PackagerRewire.package('chaincodePath', 'java', false);

			sinon.assert.calledWith(debugStub, 'packager: type %s ');
			obj.should.deep.equal({response: 'go_build'});
		});

	});
});
