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
const jsSHA3 = require('js-sha3');
const {sha3_256, sha3_384, shake_256} = jsSHA3;
const crypto = require('crypto');
const {Hash} = require('./api');

class hash_sha2_256 extends Hash {
	constructor() {
		super(512);
	}

	hash(data) {
		return this.reset().update(data).finalize('hex');
	}

	reset() {
		this._hash = crypto.createHash('sha256');
		return super.reset();
	}

	finalize(encoding) {
		const hash = this._hash.digest(encoding);
		this.reset();
		return hash;
	}
}

class hash_sha2_384 extends Hash {
	constructor() {
		super(1024);
	}

	hash(data) {
		return this.reset().update(data).finalize('hex');
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

class hash_sha3_256 extends Hash {
	static hashSimple(data) {
		return sha3_256(data);
	}

	constructor() {
		super(1088);
	}

	reset() {
		this._hash = sha3_256.create();
		return super.reset();
	}

	finalize() {
		const hash = this._hash.hex();
		this.reset();
		return hash;
	}

}

class hash_sha3_384 extends Hash {
	static hashSimple(data) {
		return sha3_384(data);
	}

	constructor() {
		super(832);
	}

	reset() {
		this._hash = sha3_384.create();
		return super.reset();
	}

	finalize() {
		const hash = this._hash.hex();
		this.reset();
		return hash;
	}
}

exports.hash_sha3_256 = hash_sha3_256;
exports.hash_sha3_384 = hash_sha3_384;
exports.hash_sha2_256 = hash_sha2_256;
exports.hash_sha2_384 = hash_sha2_384;
exports.SHA2_256 = (data) => {
	return (new hash_sha2_256()).hash(data);
};
exports.SHA3_256 = sha3_256;
exports.SHA2_384 = (data) => {
	return (new hash_sha2_384()).hash(data);
};
exports.SHA3_384 = sha3_384;
exports.shake_256 = shake_256;// TODO
