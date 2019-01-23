/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const Config = require('./lib/Config');
const CryptoAlgorithms = require('./lib/CryptoAlgorithms');
const CryptoSuite = require('./lib/CryptoSuite');
const HashPrimitives = require('./lib/HashPrimitives');
const Identity = require('./lib/Identity');
const Key = require('./lib/Key');
const KeyValueStore = require('./lib/KeyValueStore');
const Signer = require('./lib/Signer');
const SigningIdentity = require('./lib/SigningIdentity');

module.exports = {
	Config,
	CryptoAlgorithms,
	CryptoSuite,
	HashPrimitives,
	Identity,
	Key,
	KeyValueStore,
	Signer,
	SigningIdentity
};
