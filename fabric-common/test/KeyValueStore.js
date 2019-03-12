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

const KeyValueStore = require('../lib/KeyValueStore');

const chai = require('chai');
const should = chai.should();

describe('KeyValueStore', () => {
	let keyValueStore;

	beforeEach(() => {
		keyValueStore = new KeyValueStore();
	});

	describe('#initialize', () => {
		it('should return undefined', async () => {
			const result = await keyValueStore.initialize();
			should.equal(result, undefined);
		});
	});

	describe('#getName', () => {
		it('should return undefined', () => {
			const value1 = keyValueStore.getValue('name');
			const value2 = keyValueStore.getValue();
			should.equal(value1, undefined);
			should.equal(value2, undefined);
		});
	});

	describe('#setValue', () => {
		it('should return undefined', () => {
			should.equal(keyValueStore.setValue(), undefined);
			should.equal(keyValueStore.setValue('name'), undefined);
			should.equal(keyValueStore.setValue(null, 'value'), undefined);
		});
	});
});
