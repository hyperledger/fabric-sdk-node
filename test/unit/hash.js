/**
 * Copyright 2018 ASTRI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const { hash_sha2_256, hash_sha3_256, hash_sha2_384, hash_sha3_384 } = require('../../fabric-client/lib/hash');
const { SHA2_256, SHA3_256, SHA2_384, SHA3_384, } = require('../../fabric-client/lib/hash');
const raw = '12345';
const expected = {
	sha2_256: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
	sha3_256: '7d4e3eec80026719639ed4dba68916eb94c7a49a053e05c8f9578fe4e5a3d7ea',
	sha3_384: '161609f9697539edd5e03b6f5bfd1735f5c6037e0b00027c45a80386d5ebdcd3eb4bde062710914c7f37bd45f1c8021d',
	sha2_384: '0fa76955abfa9dafd83facca8343a92aa09497f98101086611b0bfa95dbc0dcc661d62e9568a5a032ba81960f3e55d4a'
};
test('SHA2_256', (t) => {
	const result = SHA2_256(raw);
	t.equal(result, expected.sha2_256, 'hash result match');
	const instantce = new hash_sha2_256();
	t.equal(result, instantce.hash(raw), 'prototype function, static function match ');
	t.end();
});
test('SHA2_384', (t) => {
	const result = SHA2_384(raw);
	t.equal(result, expected.sha2_384, 'hash result match');
	const instantce = new hash_sha2_384();
	t.equal(result, instantce.hash(raw), 'prototype function, static function match ');
	t.end();
});
test('SHA3_256', (t) => {
	const result = SHA3_256(raw);
	t.equal(result, expected.sha3_256, 'hash result match');
	const instantce = new hash_sha3_256();
	t.equal(result, instantce.hash(raw), 'prototype function, static function match ');
	t.equal(result, hash_sha3_256.hashSimple(raw), 'hashSimple match');
	t.end();
});
test('SHA3_384', (t) => {
	const result = SHA3_384(raw);
	t.equal(result, expected.sha3_384, 'hash result match');
	const instantce = new hash_sha3_384();
	t.equal(result, instantce.hash(raw), 'prototype function, static function match ');
	t.equal(result, hash_sha3_384.hashSimple(raw), 'hashSimple match');
	t.end();
});