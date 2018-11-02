/**
 * Copyright 2018 Zhao Chaoyi All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const querystring = require('querystring');
const logger = require('./utils.js').getLogger('CertificateService');
const checkRegistrar = require('./helper').checkRegistrar;

class CertificateService {
	constructor(client) {
		if (!client) {
			throw new Error('Missing Required Argument client<FabricCAClient>');
		}
		this.client = client;
	}

	/**
	 * @typedef {Object} GetCertificatesRequest
	 * @property {string} id The enrollment ID that uniquely identifies an identity
	 * @property {string} aki Authority Key Identifier string, hex encoded, for the specific certificate
	 * @property {string} serial The serial number for a certificate
	 * @property {string} revoked_start Get revoked certificates starting at the specified time,
	 * either as timestamp (RFC3339 format) or duration (-30d)
	 * @property {string} revoked_end Get revoked certificates before the specified time, either as timestamp
	 * (RFC3339 format) or duration (-15d)
	 * @property {string} expired_start Get expired certificates starting at the specified time,
	 * either as timestamp (RFC3339 format) or duration (-30d)
	 * @property {string} expired_end Get expired certificates before the specified time, either
	 * as timestamp (RFC3339 format) or duration (-15d)
	 * @property {boolean} notexpired Don't return expired certificates
	 * @property {boolean} notrevoked Don't return revoked certificates
	 * @property {string} ca The name of the CA to direct this request to within the server,
	 * or the default CA if not specified
	 */

	/**
	 * The caller will be able to view certificates that it owns. In addition,
	 * if the caller has **hf.Registrar.Roles** or **hf.Revoker** attribute,
	 * it will be able to view certificates for identities that have affiliations
	 * equal to or below the caller's affiliation.
	 *
	 * @param {GetCertificatesRequest} request the request filter
	 * @param {User} registrar The identity of the registrar (i.e. who is performing the revocation)
	 * signing certificate, hash algorithm and signature algorithm
	 */
	async getCertificates(request, registrar) {
		logger.debug('getCertificates by %j', request);

		checkRegistrar(registrar);

		let url = 'certificates';
		if (request) {
			const query = {};
			if (request.id && typeof request.id === 'string') {
				query.id = request.id;
			}
			if (request.aki && typeof request.aki === 'string') {
				query.aki = request.aki;
			}
			if (request.serial && typeof request.serial === 'string') {
				query.serial = request.serial;
			}
			if (request.revoked_start && typeof request.revoked_start === 'string') {
				query.revoked_start = request.revoked_start;
			}
			if (request.revoked_end && typeof request.revoked_end === 'string') {
				query.revoked_end = request.revoked_end;
			}
			if (request.expired_start && typeof request.expired_start === 'string') {
				query.expired_start = request.expired_start;
			}
			if (request.expired_end && typeof request.expired_end === 'string') {
				query.expired_end = request.expired_end;
			}
			if (request.notrevoked && typeof request.notrevoked === 'boolean') {
				query.notrevoked = request.notrevoked;
			}
			if (request.notexpired && typeof request.notexpired === 'boolean') {
				query.notexpired = request.notexpired;
			}
			if (request.ca && typeof request.ca === 'string') {
				query.ca = request.ca;
			}
			const qStr = querystring.stringify(query);
			if (qStr) {
				url += `?${qStr}`;
			}
		}
		logger.debug('getCertificates with url:%s', url);
		try {
			return this.client.get(url, registrar.getSigningIdentity());
		} catch (error) {
			logger.error('getCertificates error by %j', error);
			throw error;
		}
	}
}

module.exports = CertificateService;
