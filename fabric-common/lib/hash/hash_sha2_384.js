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

/**
 * Implement hash primitives.
 */
const crypto = require('crypto');
const Hash = require('../Hash');

class hash_sha2_384 extends Hash {

	constructor() {
		super(1024);
	}

	hash(data, encoding = 'hex') {
		return this.reset().update(data).finalize(encoding);
	}

	reset() {
		this._hash = crypto.createHash('sha384');
		return super.reset();
	}

	finalize(encoding) {
		const hash = this._hash.digest(encoding);
		this.reset();
		return hash;
	}

}

module.exports = hash_sha2_384;