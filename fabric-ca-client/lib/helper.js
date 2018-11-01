/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const jsrsasign = require('jsrsasign');
const {X509, ASN1HEX} = jsrsasign;
const urlParser = require('url');

function checkRegistrar(registrar) {

	if (!registrar) {
		throw new Error('Missing required argument "registrar"');
	}

	if (!registrar.constructor || registrar.constructor.name !== 'User') {
		throw new Error('Argument "registrar" must be an instance of the class "User" but is of type: ' + registrar.constructor.name);
	}

	if (typeof registrar.getSigningIdentity !== 'function') {
		throw new Error('Argument "registrar" is found to be missing a method "getSigningIdentity()"');
	}

	if (!registrar.getSigningIdentity()) {
		throw new Error('Can not get signingIdentity from registrar');
	}
}

// This utility is based on jsrsasign.X509.getSubjectString() implementation
// we can not use that method directly because it requires calling readCertPEM()
// first which as of jsrsasign@6.2.3 always assumes RSA based certificates and
// fails to parse certs that includes ECDSA keys.
function getSubjectCommonName(pem) {
	const hex = X509.pemToHex(pem);
	const d = ASN1HEX.getDecendantHexTLVByNthList(hex, 0, [0, 5]);
	const subject = X509.hex2dn(d); // format: '/C=US/ST=California/L=San Francisco/CN=Admin@org1.example.com/emailAddress=admin@org1.example.com'
	const m = subject.match(/CN=.+[^/]/);
	if (!m) {
		throw new Error('Certificate PEM does not seem to contain a valid subject with common name "CN"');
	} else {
		return m[0].substring(3);
	}
}

/**
 * Utility function which parses an HTTP URL into its component parts
 * @param {string} url HTTP or HTTPS url including protocol, host and port
 * @returns {HTTPEndpoint}
 * @throws InvalidURL for malformed URLs
 * @ignore
 */
function parseURL(url) {

	const endpoint = {};

	const purl = urlParser.parse(url, true);

	if (purl.protocol && purl.protocol.startsWith('http')) {
		endpoint.protocol = purl.protocol.slice(0, -1);
		if (purl.hostname) {
			endpoint.hostname = purl.hostname;

			if (purl.port) {
				endpoint.port = parseInt(purl.port);
			}

		} else {
			throw new Error('InvalidURL: missing hostname.');
		}

	} else {
		throw new Error('InvalidURL: url must start with http or https.');
	}

	return endpoint;
}

module.exports.checkRegistrar = checkRegistrar;
module.exports.getSubjectCommonName = getSubjectCommonName;
module.exports.parseURL = parseURL;
