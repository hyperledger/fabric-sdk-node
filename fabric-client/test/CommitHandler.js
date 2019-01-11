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

const CommitHandler = require('../lib/CommitHandler');

const chai = require('chai');
chai.should();

describe('CommitHandler', () => {
	let commitHandler;

	beforeEach(() => {
		commitHandler = new CommitHandler();
	});

	describe('#commit', () => {
		it('should throw when params are given', () => {
			(() => {
				commitHandler.commit('prams');
			}).should.throw('The "commit" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				commitHandler.commit();
			}).should.throw('The "commit" method must be implemented');
		});
	});

	describe('#initialize', () => {
		it('should throw when params are given', () => {
			(() => {
				commitHandler.initialize();
			}).should.throw('The "initialize" method must be implemented');
		});
	});

	describe('create', () => {
		it('should throw when params are given', () => {
			(() => {
				CommitHandler.create('params');
			}).should.throw('The "create" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				CommitHandler.create();
			}).should.throw('The "create" method must be implemented');
		});
	});
});
