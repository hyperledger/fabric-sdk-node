/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */


const crypto = require('crypto');
const Hash = require('../Hash');
/*
 * Implement hash primitives.
 */
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
