/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * Base class for hash primitives.
 * @abstract
 * @type {Hash}
 */
class Hash {
	constructor(blockSize) {
		this._blockSize = blockSize;
		this.reset();
	}

	hash(data) {
		return this.reset().update(data).finalize();
	}

	reset() {
		return this;
	}

	update(data) {
		this._hash.update(data);
		return this;
	}

	finalize() {
	}
}

module.exports = Hash;
