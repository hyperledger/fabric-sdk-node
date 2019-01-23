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

const hash_sha2_256 = require('./hash/hash_sha2_256');
const hash_sha2_384 = require('./hash/hash_sha2_384');
const {sha3_256, sha3_384} = require('js-sha3');

const HashPrimitives = {
	SHA2_256: (data, encoding = 'hex') => {
		return (new hash_sha2_256()).hash(data, encoding);
	},
	SHA2_384: (data, encoding = 'hex') => {
		return (new hash_sha2_384()).hash(data, encoding);
	},
	SHA3_256: sha3_256,
	SHA3_384: sha3_384
};

module.exports = HashPrimitives;