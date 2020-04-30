/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
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
