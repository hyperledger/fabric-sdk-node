/*
 Copyright IBM Corp. All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/
const os = require('os');
const path = require('path');

const tempdir = path.join(os.tmpdir(), 'hfc');

const TEST_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIIDVDCCAvqgAwIBAgIBATAKBggqhkjOPQQDAjBOMRMwEQYDVQQKDArOoyBBY21l' +
'IENvMRkwFwYDVQQDExB0ZXN0LmV4YW1wbGUuY29tMQ8wDQYDVQQqEwZHb3BoZXIx' +
'CzAJBgNVBAYTAk5MMB4XDTE2MTIxNjIzMTAxM1oXDTE2MTIxNzAxMTAxM1owTjET' +
'MBEGA1UECgwKzqMgQWNtZSBDbzEZMBcGA1UEAxMQdGVzdC5leGFtcGxlLmNvbTEP' +
'MA0GA1UEKhMGR29waGVyMQswCQYDVQQGEwJOTDBZMBMGByqGSM49AgEGCCqGSM49' +
'AwEHA0IABFKnXh7hBdp6s9OJ/aadigT1z2WzBbSc7Hzb3rkaWFz4e+9alqqWg9lr' +
'ur/mDYzG9dudC8jFjVa7KIh+2BxgBayjggHHMIIBwzAOBgNVHQ8BAf8EBAMCAgQw' +
'JgYDVR0lBB8wHQYIKwYBBQUHAwIGCCsGAQUFBwMBBgIqAwYDgQsBMA8GA1UdEwEB' +
'/wQFMAMBAf8wDQYDVR0OBAYEBAECAwQwDwYDVR0jBAgwBoAEAQIDBDBiBggrBgEF' +
'BQcBAQRWMFQwJgYIKwYBBQUHMAGGGmh0dHA6Ly9vY0JDQ1NQLmV4YW1wbGUuY29t' +
'MCoGCCsGAQUFBzAChh5odHRwOi8vY3J0LmV4YW1wbGUuY29tL2NhMS5jcnQwRgYD' +
'VR0RBD8wPYIQdGVzdC5leGFtcGxlLmNvbYERZ29waGVyQGdvbGFuZy5vcmeHBH8A' +
'AAGHECABSGAAACABAAAAAAAAAGgwDwYDVR0gBAgwBjAEBgIqAzAqBgNVHR4EIzAh' +
'oB8wDoIMLmV4YW1wbGUuY29tMA2CC2V4YW1wbGUuY29tMFcGA1UdHwRQME4wJaAj' +
'oCGGH2h0dHA6Ly9jcmwxLmV4YW1wbGUuY29tL2NhMS5jcmwwJaAjoCGGH2h0dHA6' +
'Ly9jcmwyLmV4YW1wbGUuY29tL2NhMS5jcmwwFgYDKgMEBA9leHRyYSBleHRlbnNp' +
'b24wCgYIKoZIzj0EAwIDSAAwRQIgcguBb6FUxO+X8DbY17gpqSGuNC4NT4BddPg1' +
'UWUxIC0CIQDNyHQAwzhw+512meXRwG92GfpzSBssDKLdwlrqiHOu5A==' +
'-----END CERTIFICATE-----';

const TEST_KEY_PRIVATE_PEM = '-----BEGIN PRIVATE KEY-----' +
'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgZYMvf3w5VkzzsTQY' +
'I8Z8IXuGFZmmfjIX2YSScqCvAkihRANCAAS6BhFgW/q0PzrkwT5RlWTt41VgXLgu' +
'Pv6QKvGsW7SqK6TkcCfxsWoSjy6/r1SzzTMni3J8iQRoJ3roPmoxPLK4' +
'-----END PRIVATE KEY-----';

const TEST_KEY_PRIVATE_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw' +
'fzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
'biBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAK' +
'BgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTAzMDEyNDAw' +
'WhcNMTgwMTAzMDEyNDAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEG' +
'CCqGSM49AwEHA0IABLoGEWBb+rQ/OuTBPlGVZO3jVWBcuC4+/pAq8axbtKorpORw' +
'J/GxahKPLr+vVLPNMyeLcnyJBGgneug+ajE8srijfzB9MA4GA1UdDwEB/wQEAwIF' +
'oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd' +
'BgNVHQ4EFgQU9BUt7QfgDXx9g6zpzCyJGxXsNM0wHwYDVR0jBBgwFoAUF2dCPaqe' +
'gj/ExR2fW8OZ0bWcSBAwCgYIKoZIzj0EAwIDSAAwRQIgcWQbMzluyZsmvQCvGzPg' +
'f5B7ECxK0kdmXPXIEBiizYACIQD2x39Q4oVwO5uL6m3AVNI98C2LZWa0g2iea8wk' +
'BAHpeA==' +
'-----END CERTIFICATE-----';

const TEST_MSG = 'this is a test message';
const TEST_LONG_MSG = 'The Hyperledger project is an open source collaborative effort created to advance cross-industry blockchain technologies. ' +
	'It is a global collaboration including leaders in finance, banking, Internet of Things, supply chains, manufacturing and Technology. The Linux ' +
	'Foundation hosts Hyperledger as a Collaborative Project under the foundation. Why Create the Project? Not since the Web itself has a technology ' +
	'promised broader and more fundamental revolution than blockchain technology. A blockchain is a peer-to-peer distributed ledger forged by consensus, ' +
	'combined with a system for “smart contracts” and other assistive technologies. Together these can be used to build a new generation of transactional ' +
	'applications that establishes trust, accountability and transparency at their core, while streamlining business processes and legal constraints. ' +
	'Think of it as an operating system for marketplaces, data-sharing networks, micro-currencies, and decentralized digital communities. It has the potential ' +
	'to vastly reduce the cost and complexity of getting things done in the real world. Only an Open Source, collaborative software development approach can ' +
	'ensure the transparency, longevity, interoperability and support required to bring blockchain technologies forward to mainstream commercial adoption. That ' +
	'is what Hyperledger is about – communities of software developers building blockchain frameworks and platforms.';

const HASH_MSG_SHA384 = '6247065855a812ecd182476576c02d46a675845ef4b0056e973ca42dcf8191d3adabc8c6c4b909f20f96136032ab723a';
const HASH_MSG_SHA3_384 = '9e9c2e5edf6cbc0b512807a8efa2917daff71b83e04dee28fcc00b1a1dd935fb5afc5eafa06bf55bd64792a597e2a8f3';
const HASH_LONG_MSG_SHA3_384 = '47a90d6721523682e09b81da0a60e6ee1faf839f0503252316638daf038cf682c0a842edaf310eb0f480a2e181a07af0';
const HASH_MSG_SHA256 = '4e4aa09b6d80efbd684e80f54a70c1d8605625c3380f4cb012b32644a002b5be';
const HASH_LONG_MSG_SHA256 = '0d98987f5e4e3ea611f0e3d768c594ff9aac25404265d73554d12c86d7f6fbbc';
const HASH_MSG_SHA3_256 = '7daeff454f7e91e3cd2d1c1bd5fcd1b6c9d4d5fffc6c327710d8fae7b06ee4a3';
const HASH_LONG_MSG_SHA3_256 = '577174210438a85ae4311a62e5fccf2441b960013f5691993cdf38ed6ba0c84f';

const TEST_KEY_PRIVATE = '93f15b31e3c3f3bddcd776d9219e93d8559e31453757b79e193a793cbd239573';
const TEST_KEY_PUBLIC = '04f46815aa00fe2ba2814b906aa4ef1755caf152658de8997a6a858088296054baf45b06b2eba514bcbc37ae0c0cc7465115d36429d0e0bff23dc40e3760c10aa9';
const TEST_MSG_SIGNATURE_SHA2_256 = '3046022100a6460b29373fa16ee96172bfe04666140405fdef78182280545d451f08547736022100d9022fe620ceadabbef1714b894b8d6be4b74c0f9c573bd774871764f4f789c9';
const TEST_LONG_MSG_SIGNATURE_SHA2_256 = '3045022073266302d730b07499aabd0f88f12c8749a0f90144034dbc86a8cd742722ad29022100852346f93e50911008ab97afc452f83c5985a19fa3aa6d58f615c03bddaa90a1';

module.exports = {
	tempdir: tempdir,
	TEST_CERT_PEM: TEST_CERT_PEM,
	TEST_KEY_PRIVATE_PEM: TEST_KEY_PRIVATE_PEM,
	TEST_KEY_PRIVATE_CERT_PEM: TEST_KEY_PRIVATE_CERT_PEM,
	TEST_MSG: TEST_MSG,
	TEST_LONG_MSG: TEST_LONG_MSG,
	HASH_MSG_SHA384: HASH_MSG_SHA384,
	HASH_MSG_SHA3_384: HASH_MSG_SHA3_384,
	HASH_LONG_MSG_SHA3_384: HASH_LONG_MSG_SHA3_384,
	HASH_MSG_SHA256: HASH_MSG_SHA256,
	HASH_LONG_MSG_SHA256: HASH_LONG_MSG_SHA256,
	HASH_MSG_SHA3_256: HASH_MSG_SHA3_256,
	HASH_LONG_MSG_SHA3_256: HASH_LONG_MSG_SHA3_256,
	TEST_KEY_PRIVATE: TEST_KEY_PRIVATE,
	TEST_KEY_PUBLIC: TEST_KEY_PUBLIC,
	TEST_MSG_SIGNATURE_SHA2_256: TEST_MSG_SIGNATURE_SHA2_256,
	TEST_LONG_MSG_SIGNATURE_SHA2_256: TEST_LONG_MSG_SIGNATURE_SHA2_256
};
