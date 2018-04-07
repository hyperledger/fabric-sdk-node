/**
 * Copyright 2016, 2018 IBM All Rights Reserved.
 *
 SPDX-License-Identifier: Apache-2.0

 */

/**
 * Implement hash primitives.
 */
const logger = require('./utils').getLogger('hash');
const jsSHA3 = require('js-sha3');
const { sha3_256, sha3_384, shake_256 } = jsSHA3;
const crypto = require('crypto');

class hashBaseClass {
	constructor() {
		this.reset();
	}

	hash(data) {
		return this.reset().update(data).finalize();
	}
	reset() {
		return this;
	}
	update(data) {
		//logger.debug(`update(${typeof data})`);
		this._hash.update(data);
		return this;
	}
	finalize() {
	}
}
class hash_sha2_256 extends hashBaseClass {
	constructor() {
		super();
		this.blockSize = 512;
	}
	reset() {
		this._hash = crypto.createHash('sha256');
		return super.reset();
	}
	finalize() {
		const hash = this._hash.digest('hex');
		this.reset();
		return hash;
	}
}
class hash_sha2_384 extends hashBaseClass {
	constructor() {
		super();
		this.blockSize = 1024;
	}
	reset() {
		this._hash = crypto.createHash('sha384');
		return super.reset();
	}
	finalize() {
		const hash = this._hash.digest('hex');
		this.reset();
		return hash;
	}
}
class hash_sha3_256 extends hashBaseClass {
	static hashSimple(data) {
		return sha3_256(data);
	}
	constructor() {
		super();
		this.blockSize = 1088;
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
class hash_sha3_384 extends hashBaseClass {
	static hashSimple(data) {
		return sha3_384(data);
	}
	constructor() {
		super();
		this.blockSize = 832;
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
exports.sha2_256 = (data) => {
	return (new hash_sha2_256()).hash(data);
};
exports.sha3_256 = sha3_256;
exports.sha2_384 = (data) => {
	return (new hash_sha2_384()).hash(data);
};
exports.sha3_384 = sha3_384;
exports.shake_256 = shake_256;//TODO
