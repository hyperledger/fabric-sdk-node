/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const CryptoAlgorithms = {
	// ECDSA Elliptic Curve Digital Signature Algorithm (key gen, import, sign, verify),
	// at default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	ECDSA: 'ECDSA',
	// ECDSA Elliptic Curve Digital Signature Algorithm over P-256 curve
	ECDSAP256: 'ECDSAP256',
	// ECDSA Elliptic Curve Digital Signature Algorithm over P-384 curve
	ECDSAP384: 'ECDSAP384',
	// ECDSAReRand ECDSA key re-randomization
	ECDSAReRand: 'ECDSA_RERAND',

	// RSA at the default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	RSA: 'RSA',
	// RSA at 1024 bit security level.
	RSA1024: 'RSA1024',
	// RSA at 2048 bit security level.
	RSA2048: 'RSA2048',
	// RSA at 3072 bit security level.
	RSA3072: 'RSA3072',
	// RSA at 4096 bit security level.
	RSA4096: 'RSA4096',

	// AES Advanced Encryption Standard at the default security level.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	AES: 'AES',
	// AES Advanced Encryption Standard at 128 bit security level
	AES128: 'AES128',
	// AES Advanced Encryption Standard at 192 bit security level
	AES192: 'AES192',
	// AES Advanced Encryption Standard at 256 bit security level
	AES256: 'AES256',

	// HMAC keyed-hash message authentication code
	HMAC: 'HMAC',
	// HMACTruncated256 HMAC truncated at 256 bits.
	HMACTruncated256: 'HMAC_TRUNCATED_256',

	// SHA Secure Hash Algorithm using default family.
	// Each BCCSP may or may not support default security level. If not supported than
	// an error will be returned.
	SHA: 'SHA',
	// SHA256
	SHA256: 'SHA256',
	// SHA384
	SHA384: 'SHA384',
	// SHA256
	SHA2_256: 'SHA256',
	// SHA384
	SHA2_384: 'SHA384',
	// SHA3_256
	SHA3_256: 'SHA3_256',
	// SHA3_384
	SHA3_384: 'SHA3_384',

	// X509Certificate Label for X509 certificate related operation
	X509Certificate: 'X509Certificate'
};

module.exports = CryptoAlgorithms;
