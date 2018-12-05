/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const utils = require('./utils.js');
const BaseClient = require('./BaseClient');
const FabricCAClient = require('./FabricCAClient');

const normalizeX509 = require('./BaseClient').normalizeX509;
const util = require('util');
const parseURL = require('./helper').parseURL;
const path = require('path');
const checkRegistrar = require('./helper').checkRegistrar;
const getSubjectCommonName = require('./helper').getSubjectCommonName;
const config = utils.getConfig();
const logger = utils.getLogger('FabricCAClientService.js');

// setup the location of the default config shipped with code
const default_config = path.resolve(__dirname, '../config/default.json');
config.reorderFileStores(default_config, true); // make sure this one is under the fabric-client

/**
 * @typedef {Object} TLSOptions
 * @property {string[]} trustedRoots Array of PEM-encoded trusted root certificates
 * @property {boolean} [verify=true] Determines whether or not to verify the server certificate when using TLS
 */

/**
 * This is an implementation of the member service client which communicates with the Fabric CA server.
 * @class
 * @extends BaseClient
 */
const FabricCAServices = class extends BaseClient {

	/**
	 * constructor
	 *
	 * @param {string | object} url The endpoint URL for Fabric CA services of the form: "http://host:port" or "https://host:port"
	 	When this parameter is an object then it must include the parameters listed as key value pairs.
	 * @param {TLSOptions} tlsOptions The TLS settings to use when the Fabric CA services endpoint uses "https"
	 * @param {string} caName The optional name of the CA. Fabric-ca servers support multiple Certificate Authorities from
	 *  a single server. If omitted or null or an empty string, then the default CA is the target of requests
	 * @param {CryptoSuite} cryptoSuite The optional cryptoSuite instance to be used if options other than defaults are needed.
	 * If not specified, an instance of {@link CryptoSuite} will be constructed based on the current configuration settings:
	 * <br> - crypto-hsm: use an implementation for Hardware Security Module (if set to true) or software-based key management (if set to false)
	 * <br> - crypto-keysize: security level, or key size, to use with the digital signature public key algorithm. Currently ECDSA
	 *  is supported and the valid key sizes are 256 and 384
	 * <br> - crypto-hash-algo: hashing algorithm
	 * <br> - key-value-store: some CryptoSuite implementation requires a key store to persist private keys. A {@link CryptoKeyStore}
	 *  is provided for this purpose, which can be used on top of any implementation of the {@link KeyValueStore} interface,
	 *  such as a file-based store or a database-based one. The specific implementation is determined by the value of this configuration setting.
	 */
	constructor(url_p, tlsOptions_p, caName_p, cryptoSuite_p) {
		super();
		let url, tlsOptions, caName, cryptoSuite;
		if (typeof url_p === 'object') {
			url = url_p.url;
			tlsOptions = url_p.tlsOptions;
			caName = url_p.caName;
			cryptoSuite = url_p.cryptoSuite;
		} else {
			url = url_p;
			tlsOptions = tlsOptions_p;
			caName = caName_p;
			cryptoSuite = cryptoSuite_p;
		}

		this.caName = caName;

		const endpoint = parseURL(url);

		if (cryptoSuite) {
			this.setCryptoSuite(cryptoSuite);
		} else {
			this.setCryptoSuite(utils.newCryptoSuite());
			this.getCryptoSuite().setCryptoKeyStore(utils.newCryptoKeyStore());
		}

		this._fabricCAClient = new FabricCAClient({
			caname: caName,
			protocol: endpoint.protocol,
			hostname: endpoint.hostname,
			port: endpoint.port,
			tlsOptions: tlsOptions
		}, this.getCryptoSuite());

		logger.debug('Successfully constructed Fabric CA service client: endpoint - %j', endpoint);

	}
	/**
	 * Returns the name of the certificate authority.
	 *
	 * @returns {string} caName
	 */
	getCaName() {
		return this.caName;
	}

	/**
	 * @typedef {Object} RegisterRequest
	 * @property {string} enrollmentID - ID which will be used for enrollment
	 * @property {string} enrollmentSecret - Optional enrollment secret to set for the registered user.
	 *                    If not provided, the server will generate one.
	 * @property {string} role - Optional arbitrary string representing a role value for the user
	 * @property {string} affiliation - Affiliation with which this user will be associated,
	 *                    like a company or an organization
	 * @property {number} maxEnrollments - The maximum number of times this user will be permitted to enroll
	 * @property {KeyValueAttribute[]} attrs - Array of {@link KeyValueAttribute} attributes to assign to the user
	 */

	/**
	 * Register the member and return an enrollment secret.
	 * @param {RegisterRequest} req - The {@link RegisterRequest}
	 * @param registrar {User}. The identity of the registrar (i.e. who is performing the registration)
	 * @returns {Promise} The enrollment secret to use when this user enrolls
	 */
	register(req, registrar) {
		if (!req) {
			throw new Error('Missing required argument "request"');
		}

		if (!req.enrollmentID) {
			throw new Error('Missing required argument "request.enrollmentID"');
		}

		if (typeof req.maxEnrollments === 'undefined' || req.maxEnrollments === null) {
			// set maxEnrollments to 1
			req.maxEnrollments = 1;
		}

		checkRegistrar(registrar);

		return this._fabricCAClient.register(req.enrollmentID, req.enrollmentSecret, req.role, req.affiliation, req.maxEnrollments, req.attrs,
			registrar.getSigningIdentity());
	}

	/**
	 * @typedef {Object} EnrollmentRequest
	 * @property {string} enrollmentID - The registered ID to use for enrollment
	 * @property {string} enrollmentSecret - The secret associated with the enrollment ID
	 * @property {string} profile - The profile name.  Specify the 'tls' profile for a TLS certificate;
	 *                   otherwise, an enrollment certificate is issued.
	 * @property {string} csr - Optional. PEM-encoded PKCS#10 Certificate Signing Request. The message sent from client side to
	 *                   Fabric-ca for the digital identity certificate.
	 * @property {AttributeRequest[]} attr_reqs - An array of {@link AttributeRequest}
	 */

	/**
	 * @typedef {Object} Enrollment
	 * @property {Object} key - the private key
	 * @property {string} certificate - The enrollment certificate in base 64 encoded PEM format
	 * @property {string} rootCertificate - Base 64 encoded PEM-encoded certificate chain of the CA's signing certificate
	 */

	/**
	 * Enroll the member and return an opaque member object.
	 *
	 * @param req the {@link EnrollmentRequest} If the request contains the field "csr", this csr will be used for
	 *     getting the certificate from Fabric-CA. Otherwise , a new private key will be generated and be used to
	 *     generate a csr later.
	 * @returns {Promise<Enrollment>} If the request does not contain the field "csr", the returned promise resolves an
	 *     {@link Enrollment} object with "key" for the new generated private key. If the request contains the field "csr",
	 *     the resolved {@link Enrollment} object does not contain the property "key".
	 */
	async enroll(req) {
		if (!req) {
			logger.error('enroll() missing required argument "request"');
			throw new Error('Missing required argument "request"');
		}

		if (!req.enrollmentID) {
			logger.error('Invalid enroll request, missing enrollmentID');
			throw new Error('req.enrollmentID is not set');
		}

		if (!req.enrollmentSecret) {
			logger.error('Invalid enroll request, missing enrollmentSecret');
			throw new Error('req.enrollmentSecret is not set');
		}

		if (req.attr_reqs) {
			if (!Array.isArray(req.attr_reqs)) {
				logger.error('Invalid enroll request, attr_reqs must be an array of AttributeRequest objects');
				throw new Error('req.attr_reqs is not an array');
			} else {
				for (const i in req.attr_reqs) {
					const attr_req = req.attr_reqs[i];
					if (!attr_req.name) {
						logger.error('Invalid enroll request, attr_reqs object is missing the name of the attribute');
						throw new Error('req.att_regs is missing the attribute name');
					}
				}
			}
		}

		let opts;
		if (this.getCryptoSuite()._cryptoKeyStore) {
			opts = {ephemeral: false};
		} else {
			opts = {ephemeral: true};
		}

		try {
			let csr;
			let privateKey;
			if (req.csr) {
				logger.debug('try to enroll with a csr');
				csr = req.csr;
			} else {
				try {
					privateKey = await this.getCryptoSuite().generateKey(opts);
					logger.debug('successfully generated key pairs');
				} catch (err) {
					throw new Error(util.format('Failed to generate key for enrollment due to error [%s]', err));
				}
				try {
					csr = privateKey.generateCSR('CN=' + req.enrollmentID);
					logger.debug('successfully generated csr');
				} catch (err) {
					throw new Error(util.format('Failed to generate CSR for enrollmemnt due to error [%s]', err));
				}
			}

			const enrollResponse = await this._fabricCAClient.enroll(req.enrollmentID, req.enrollmentSecret, csr, req.profile, req.attr_reqs);
			logger.debug('successfully enrolled %s', req.enrollmentID);

			const enrollment = {
				certificate: enrollResponse.enrollmentCert,
				rootCertificate: enrollResponse.caCertChain,
			};
			if (!req.csr) {
				enrollment.key = privateKey;
			}
			return enrollment;
		} catch (error) {
			logger.error('Failed to enroll %s, error:%o', req.enrollmentID, error);
			throw error;
		}
	}

	/**
	 * Re-enroll the member in cases such as the existing enrollment certificate is about to expire, or
	 * it has been compromised
	 * @param {User} currentUser The identity of the current user that holds the existing enrollment certificate
	 * @param {AttributeRequest[]} Optional an array of {@link AttributeRequest} that indicate attributes to
	 *                             be included in the certificate
	 * @returns Promise for an object with "key" for private key and "certificate" for the signed certificate
	 */
	reenroll(currentUser, attr_reqs) {
		if (!currentUser) {
			logger.error('Invalid re-enroll request, missing argument "currentUser"');
			throw new Error('Invalid re-enroll request, missing argument "currentUser"');
		}

		if (!currentUser.constructor || currentUser.constructor.name !== 'User') {
			logger.error('Invalid re-enroll request, "currentUser" is not a valid User object');
			throw new Error('Invalid re-enroll request, "currentUser" is not a valid User object');
		}

		if (attr_reqs) {
			if (!Array.isArray(attr_reqs)) {
				logger.error('Invalid re-enroll request, attr_reqs must be an array of AttributeRequest objects');
				throw new Error('Invalid re-enroll request, attr_reqs must be an array of AttributeRequest objects');
			} else {
				for (const i in attr_reqs) {
					const attr_req = attr_reqs[i];
					if (!attr_req.name) {
						logger.error('Invalid re-enroll request, attr_reqs object is missing the name of the attribute');
						throw new Error('Invalid re-enroll request, attr_reqs object is missing the name of the attribute');
					}
				}
			}
		}

		const cert = currentUser.getIdentity()._certificate;
		let subject = null;
		try {
			subject = getSubjectCommonName(normalizeX509(cert));
		} catch (err) {
			logger.error(util.format('Failed to parse enrollment certificate %s for Subject. \nError: %s', cert, err));
		}

		if (!subject) {
			throw new Error('Failed to parse the enrollment certificate of the current user for its subject');
		}
		const self = this;

		return new Promise((resolve, reject) => {
			// generate enrollment certificate pair for signing
			self.getCryptoSuite().generateKey()
				.then(
					(privateKey) => {
						// generate CSR using the subject of the current user's certificate
						try {
							const csr = privateKey.generateCSR('CN=' + subject);
							self._fabricCAClient.reenroll(csr, currentUser.getSigningIdentity(), attr_reqs)
								.then(
									(response) => {
										return resolve({
											key: privateKey,
											certificate: Buffer.from(response.result.Cert, 'base64').toString(),
											rootCertificate: Buffer.from(response.result.ServerInfo.CAChain, 'base64').toString()
										});
									},
									(err) => {
										return reject(err);
									}
								);

						} catch (err) {
							return reject(new Error(util.format('Failed to generate CSR for enrollmemnt due to error [%s]', err)));
						}
					},
					(err) => {
						return reject(new Error(util.format('Failed to generate key for enrollment due to error [%s]', err)));
					}
				);

		});
	}

	/**
	 * Revoke an existing certificate (enrollment certificate or transaction certificate), or revoke
	 * all certificates issued to an enrollment id. If revoking a particular certificate, then both
	 * the Authority Key Identifier and serial number are required. If revoking by enrollment id,
	 * then all future requests to enroll this id will be rejected.
	 * @param {Object} request Request object with the following fields:
	 * <br> - enrollmentID {string}. ID to revoke
	 * <br> - aki {string}. Authority Key Identifier string, hex encoded, for the specific certificate to revoke
	 * <br> - serial {string}. Serial number string, hex encoded, for the specific certificate to revoke
	 * <br> - reason {string}. The reason for revocation. See https://godoc.org/golang.org/x/crypto/ocsp
	 *  for valid values. The default value is 0 (ocsp.Unspecified).
	 * @param {User} registrar The identity of the registrar (i.e. who is performing the revocation)
	 * @returns {Promise} The revocation results
	 */
	revoke(request, registrar) {
		if (!request) {
			throw new Error('Missing required argument "request"');
		}

		if (!request.enrollmentID || request.enrollmentID === '') {
			if (!request.aki || request.aki === '' || !request.serial || request.serial === '') {
				throw new Error('Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values');
			}
		}

		checkRegistrar(registrar);

		return this._fabricCAClient.revoke(
			request.enrollmentID,
			request.aki,
			request.serial,
			(request.reason) ? request.reason : null,
			registrar.getSigningIdentity());
	}

	/**
	 * @typedef {Object} Restriction
	 * @property {Date} revokedBefore - Include certificates that were revoked before this UTC timestamp (in RFC3339 format) in the CRL
	 * @property {Date} revokedAfter - Include certificates that were revoked after this UTC timestamp (in RFC3339 format) in the CRL
	 * @property {Date} expireBefore - Include revoked certificates that expire before this UTC timestamp (in RFC3339 format) in the CRL
	 * @property {Date} expireAfter - Include revoked certificates that expire after this UTC timestamp (in RFC3339 format) in the CRL
	 */

	/**
	 *
	 * @param {Restriction} request
	 * @param {User} registrar The identity of the registrar (i.e. who is performing the revocation)
	 * @returns {Promise} The Certificate Revocation List (CRL)
	 */
	generateCRL(request, registrar) {
		if (!request) {
			throw new Error('Missing required argument "request"');
		}

		checkRegistrar(registrar);

		return this._fabricCAClient.generateCRL(
			request.revokedBefore ? request.revokedBefore.toISOString() : null,
			request.revokedAfter ? request.revokedAfter.toISOString() : null,
			request.expireBefore ? request.expireBefore.toISOString() : null,
			request.expireAfter ? request.expireAfter.toISOString() : null,
			registrar.getSigningIdentity());
	}

	/**
	 * Create a new {@link CertificateService} instance
	 *
	 * @returns {CertificateService} object
	 */
	newCertificateService() {
		return this._fabricCAClient.newCertificateService();
	}

	/**
	 * Creates a new {@link IdentityService} object
	 *
	 * @returns {IdentityService} object
	 */
	newIdentityService() {
		return this._fabricCAClient.newIdentityService();
	}

	/**
	 * Create a new {@link AffiliationService} object
	 *
	 * @returns {AffiliationService} object
	 */
	newAffiliationService() {
		return this._fabricCAClient.newAffiliationService();
	}

	/**
	 * @typedef {Object} HTTPEndpoint
	 * @property {string} hostname
	 * @property {number} port
	 * @property {string} protocol
	 */

	/**
	* return a printable representation of this object
	*/
	toString() {
		return 'FabricCAServices : {' +
			'hostname: ' + this._fabricCAClient._hostname +
			', port: ' + this._fabricCAClient._port +
			'}';
	}

	/**
	 * Utility function that exposes the helper.parseURL() function
	 * @param {string} url HTTP or HTTPS url including protocol, host and port
	 * @returns {HTTPEndpoint}
	 * @throws InvalidURL for malformed URLs
	 * @ignore
	 */
	static _parseURL(url) {
		return parseURL(url);
	}
};

module.exports = FabricCAServices;
