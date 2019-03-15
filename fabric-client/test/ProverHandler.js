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

const ProverHandler = require('../lib/ProverHandler');

const chai = require('chai');
chai.should();

describe('ProverHandler', () => {
	let providerHandler;

	beforeEach(() => {
		providerHandler = new ProverHandler();
	});

	describe('#processCommand', () => {

		it('should throw', () => {
			(() => {
				providerHandler.initialize();
			}).should.throw('The "initialize" method must be implemented');
		});

		it('should throw when params are given', () => {
			(() => {
				providerHandler.processCommand('params');
			}).should.throw('The "processCommand" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				providerHandler.processCommand();
			}).should.throw('The "processCommand" method must be implemented');
		});
	});

	describe('#initialize', () => {
		it('should throw', () => {
			(() => {
				providerHandler.initialize();
			}).should.throw('The "initialize" method must be implemented');
		});
	});

	describe('create', () => {
		it('should throw when params are given', () => {
			(() => {
				ProverHandler.create('channel');
			}).should.throw('The "create" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				ProverHandler.create();
			}).should.throw('The "create" method must be implemented');
		});
	});
});
