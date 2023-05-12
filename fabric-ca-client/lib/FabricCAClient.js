/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const {Utils: utils} = require('fabric-common');
const config = utils.getConfig();
const logger = utils.getLogger('FabricCAClient.js');
const http = require('http');
const https = require('https');
const util = require('util');
const IdentityService = require('./IdentityService');
const AffiliationService = require('./AffiliationService');
const CertificateService = require('./CertificateService');

/**
 * Client for communicating with the Fabric CA APIs
 *
 * @class
 */
const FabricCAClient = class {

	/**
	 * @typedef {Object} ConnectOpts
	 * @property {string} protocol - The protocol to use (either HTTP or HTTPS)
	 * @property {string} hostname - The hostname of the Fabric CA server endpoint
	 * @property {number} [port] - The port of the Fabric CA server endpoint, Default is 7054
	 * @property {TLSOptions} [tlsOptions] - The TLS settings to use when the Fabric CA endpoint uses "https"
	 * @property {string} [caname] - The optional name of the CA. Fabric-ca servers support multiple Certificate Authorities from
	 *  a single server. If omitted or null or an empty string, then the default CA is the target of requests
	 */

	/**
	 *
	 * @constructor
	 * @param {ConnectOpts} connect_opts Connection options for communicating with the Fabric CA server
	 * @param cryptoPrimitives
	 * @throws Will throw an error if connection options are missing or invalid
	 *
	 */
	constructor(connect_opts, cryptoPrimitives) {

		// check connect_opts
		this._validateConnectionOpts(connect_opts);

		this._caName = connect_opts.caname;
		this._httpClient = (connect_opts.protocol === 'http') ? http : https;
		this._hostname = connect_opts.hostname;
		if (connect_opts.port) {
			this._port = connect_opts.port;
		} else {
			this._port = 7054;
		}
		if (typeof connect_opts.tlsOptions === 'undefined' || connect_opts.tlsOptions === null) {
			this._tlsOptions = {
				trustedRoots: [],
				verify: false
			};
		} else {
			this._tlsOptions = connect_opts.tlsOptions;
			if (typeof this._tlsOptions.verify === 'undefined') {
				this._tlsOptions.verify = true;
			}
			if (typeof this._tlsOptions.trustedRoots === 'undefined') {
				this._tlsOptions.trustedRoots = [];
			}
		}
		this._baseAPI = '/api/v1/';

		this._cryptoPrimitives = cryptoPrimitives;

		logger.debug(`Successfully constructed Fabric CA client from options - ${util.inspect(connect_opts)}`);
	}

	/**
	 * @typedef {Object} KeyValueAttribute
	 * @property {string} name The key used to reference the attribute
	 * @property {string} value The value of the attribute
	 * @property {boolean} [ecert] Optional, A value of true indicates that this attribute
	 *  should be included in an enrollment certificate by default
	 */

	/**
	 * Register a new user and return the enrollment secret
	 * @param {string} enrollmentID ID which will be used for enrollment
	 * @param {string} [enrollmentSecret] Optional enrollment secret to set for the registered user.
	 *        If not provided, the server will generate one.
	 *        When not including, use a null for this parameter.
	 * @param {string} [role] Optional type of role for this user.
	 *        When not including, use a null for this parameter.
	 * @param {string} affiliation Affiliation with which this user will be associated
	 * @param {number} maxEnrollments The maximum number of times the user is permitted to enroll
	 * @param {KeyValueAttribute[]} [attrs] Array of key/value attributes to assign to the user
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @returns {Promise<string>} The enrollment secret to use when this user enrolls
	 */
	async register(enrollmentID, enrollmentSecret, role, affiliation, maxEnrollments, attrs, signingIdentity) {

		// all arguments are required
		if (arguments.length < 7) {
			throw new Error('Missing required parameters. \'enrollmentID\', \'enrollmentSecret\', \'role\', \'affiliation\', ' +
				'\'maxEnrollments\', \'attrs\' and \'signingIdentity\' are all required.');
		}
		if (typeof maxEnrollments !== 'number') {
			throw new Error('Parameter \'maxEnrollments\' must be a number');
		}

		const regRequest = {
			id: enrollmentID,
			affiliation,
			max_enrollments: maxEnrollments
		};

		if (role) {
			regRequest.type = role;
		}

		if (attrs) {
			regRequest.attrs = attrs;
		}

		if (typeof enrollmentSecret === 'string' && enrollmentSecret !== '') {
			regRequest.secret = enrollmentSecret;
		}

		const response = await this.post('register', regRequest, signingIdentity);
		return response.result.secret;
	}

	/**
	 * Revoke an existing certificate (enrollment certificate or transaction certificate), or revoke
	 * all certificates issued to an enrollment id. If revoking a particular certificate, then both
	 * the Authority Key Identifier and serial number are required. If revoking by enrollment id,
	 * then all future requests to enroll this id will be rejected.
	 * @param {string} enrollmentID ID to revoke
	 * @param {string} aki Authority Key Identifier string, hex encoded, for the specific certificate to revoke
	 * @param {string} serial Serial number string, hex encoded, for the specific certificate to revoke
	 * @param {string} reason The reason for revocation. See https://godoc.org/golang.org/x/crypto/ocsp
	 *  for valid values
	 * @param {bool} gencrl GenCRL specifies whether to generate a CRL
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @returns {Promise} The revocation results
	 */
	async revoke(enrollmentID, aki, serial, reason, gencrl, signingIdentity) {

		// all arguments are required
		if (arguments.length < 5) {
			throw new Error('Missing required parameters. \'enrollmentID\', \'aki\', \'serial\', \'reason\', ' +
				'\'callerID\' and \'signingIdentity\' are all required.');
		}


		const regRequest = {
			id: enrollmentID,
			aki,
			serial,
			reason,
			gencrl,
		};
		return await this.post('revoke', regRequest, signingIdentity);
	}

	/**
	 * Re-enroll an existing user.
	 * @param {string} csr PEM-encoded PKCS#10 certificate signing request
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @param {AttributeRequest[]} [attr_reqs] An array of {@link AttributeRequest}
	 * @returns {Promise<EnrollmentResponse>}
	 */
	async reenroll(csr, signingIdentity, attr_reqs) {

		// First two arguments are required
		if (arguments.length < 2) {
			throw new Error('Missing required parameters.  \'csr\', \'signingIdentity\' are all required.');
		}


		const request = {
			certificate_request: csr
		};

		if (attr_reqs) {
			request.attr_reqs = attr_reqs;
		}

		return await this.post('reenroll', request, signingIdentity);
	}

	/**
	 * Creates a new {@link IdentityService} instance
	 *
	 * @returns {IdentityService} instance
	 */
	newIdentityService() {
		return new IdentityService(this);
	}

	/**
	 * Create a new {@link AffiliationService} instance
	 *
	 * @returns {AffiliationService} instance
	 */
	newAffiliationService() {
		return new AffiliationService(this);
	}

	/**
	 * Create a new {@link CertificateService} instance
	 *
	 * @returns {CertificateService} instance
	 */
	newCertificateService() {
		return new CertificateService(this);
	}

	async post(api_method, requestObj, signingIdentity) {
		return this.request('POST', api_method, signingIdentity, requestObj);
	}

	async delete(api_method, signingIdentity) {
		return this.request('DELETE', api_method, signingIdentity);
	}

	async get(api_method, signingIdentity) {
		return this.request('GET', api_method, signingIdentity);
	}

	async put(api_method, requestObj, signingIdentity) {
		return this.request('PUT', api_method, signingIdentity, requestObj);
	}

	async request(http_method, api_method, signingIdentity, requestObj, extraRequestOptions) {

		// Check for required args (requestObj optional)
		if (arguments.length < 3) {
			return Promise.reject('Missing required parameters.  \'http_method\', \'api_method\' and \'signingIdentity\' are all required.');
		}

		if (requestObj) {
			requestObj.caname = this._caName;
		}
		// establish socket timeout
		// default: 3000ms
		const CONNECTION_TIMEOUT = config.get('connection-timeout', 3000);
		// SO_TIMEOUT is the timeout that a read() call will block,
		// it means that if no data arrives within SO_TIMEOUT,
		// socket will throw an error
		// default: infinite
		const SO_TIMEOUT = config.get('socket-operation-timeout');
		logger.debug(`CONNECTION_TIMEOUT = ${CONNECTION_TIMEOUT}, SO_TIMEOUT = ${SO_TIMEOUT || 'infinite'}`);

		const path = this._baseAPI + api_method;

		const requestOptions = {
			hostname: this._hostname,
			port: this._port,
			path,
			method: http_method,
			ca: this._tlsOptions.trustedRoots,
			rejectUnauthorized: this._tlsOptions.verify,
			timeout: CONNECTION_TIMEOUT
		};
		if (signingIdentity) {
			requestOptions.headers = {
				Authorization: this.generateAuthToken(requestObj, signingIdentity, path, http_method)
			};
		}
		Object.assign(requestOptions, extraRequestOptions);
		return new Promise(((resolve, reject) => {

			const request = this._httpClient.request(requestOptions, (response) => {

				const responseBody = [];
				response.on('data', (data) => {
					responseBody.push(data);
				});

				response.on('end', () => {
					const payload = responseBody.join('');

					if (!payload) {
						return reject(Error(`fabric-ca request ${api_method} failed with HTTP status code ${response.statusCode}`));
					}
					// response should be JSON
					let responseObj;
					try {
						responseObj = JSON.parse(payload);
					} catch (err) {
						return reject(Error(`Could not parse ${api_method} response [${payload}] as JSON due to error [${err}]`));
					}
					if (responseObj.success) {
						return resolve(responseObj);
					} else {
						const err = Error(`fabric-ca request ${api_method} failed with errors [${util.inspect(responseObj.errors || responseObj)}]`);
						Object.assign(err, responseObj);
						return reject(err);
					}

				});
				response.on('error', (err) => {
					const error = Error(`Calling ${api_method} endpoint failed with error [${err}]`);
					Object.assign(error, err);
					reject(error);
				});
			});

			request.on('socket', (socket) => {
				socket.setTimeout(CONNECTION_TIMEOUT);
				socket.on('timeout', () => {
					request.destroy();
					reject(new Error(`Calling ${api_method} endpoint failed, CONNECTION Timeout`));
				});
			});

			// If socket-operation-timeout is not set, read operations will not time out (infinite timeout).
			if (SO_TIMEOUT && Number.isInteger(SO_TIMEOUT) && SO_TIMEOUT > 0) {
				request.setTimeout(SO_TIMEOUT, () => {
					reject(new Error(`Calling ${api_method} endpoint failed, READ Timeout`));
				});
			}

			request.on('error', (err) => {
				const error = Error(`Calling ${api_method} endpoint failed with error [${err}]`);
				Object.assign(error, err);
				reject(error);
			});

			if (requestObj) {
				request.write(JSON.stringify(requestObj));
			}
			request.end();
		}));
	}

	/**
	 * @typedef {Object} CAInfoResponse
	 * @property {string} caName The name of the CA.
	 * @property {string} caChain PEM-encoded certificate chain of the server's signing certificate
	 * @property {string} issuerPublicKey Proto bytes of the CA's Idemix issuer public key
	 * @property {string} issuerRevocationPublicKey PEM-encoded bytes of the CA's Idemix issuer
	 * revocation public key
	 * @property {string} version Version of the server
	 */

	/**
	 * Get info on the CA
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @returns {Promise<CAInfoResponse>}
	 */
	async getCaInfo(signingIdentity) {

		if (arguments.length !== 1) {
			return Promise.reject(new Error('Missing required parameters. \'signingIdentity\' is required.'));
		}
		const request = {
			caname: this._caName
		};
		const response = await this.post('cainfo', request, signingIdentity);
		return {
			caName: response.result.CAName,
			caChain: Buffer.from(response.result.CAChain, 'base64').toString(),
			issuerPublicKey: Buffer.from(response.result.IssuerPublicKey, 'base64').toString(),
			issuerRevocationPublicKey: Buffer.from(response.result.IssuerRevocationPublicKey, 'base64').toString(),
			version: response.result.Version,
		};
	}

	/*
	 * Generate authorization token required for accessing fabric-ca APIs
	 */
	generateAuthToken(reqBody, signingIdentity, path, method) {
		// specific signing procedure is according to:
		// https://github.com/hyperledger/fabric-ca/blob/main/util/util.go#L168
		const cert = Buffer.from(signingIdentity._certificate).toString('base64');
		let signString;
		if (reqBody) {
			const body = Buffer.from(JSON.stringify(reqBody)).toString('base64');
			signString = `${body}.${cert}`;
		} else {
			signString = `.${cert}`;
		}

		if (path && method) {
			const s = Buffer.from(path).toString('base64');
			signString = `${method}.${s}.${signString}`;
		}

		const sig = signingIdentity.sign(signString, {hashFunction: this._cryptoPrimitives.hash.bind(this._cryptoPrimitives)});
		logger.debug(`signString: ${signString}`);

		const b64Sign = Buffer.from(sig, 'hex').toString('base64');
		return `${cert}.${b64Sign}`;
	}

	/**
	 * @typedef {Object} AttributeRequest
	 * @property {string} name - The name of the attribute to include in the certificate
	 * @property {boolean} optional - throw an error if the identity does not have the attribute
	 */

	/**
	 * @typedef {Object} EnrollmentResponse
	 * @property {string} enrollmentCert PEM-encoded X509 enrollment certificate
	 * @property {string} caCertChain PEM-encoded X509 certificate chain for the issuing
	 * certificate authority
	 */

	/**
	 * Enroll a registered user in order to receive a signed X509 certificate
	 * @param {string} enrollmentID The registered ID to use for enrollment
	 * @param {string} enrollmentSecret The secret associated with the enrollment ID
	 * @param {string} csr PEM-encoded PKCS#10 certificate signing request
	 * @param {string} [profile] The profile name.  Specify the 'tls' profile for a TLS certificate; otherwise, an enrollment certificate is issued.
	 * @param {AttributeRequest[]} [attr_reqs] An array of {@link AttributeRequest}
	 * @returns {Promise<EnrollmentResponse>}
	 */
	async enroll(enrollmentID, enrollmentSecret, csr, profile, attr_reqs) {

		// check for required args
		if (arguments.length < 3) {
			return Promise.reject('Missing required parameters.  \'enrollmentID\', \'enrollmentSecret\' and \'csr\' are all required.');
		}

		const requestOptions = {
			auth: `${enrollmentID}:${enrollmentSecret}`,
		};

		const enrollRequest = {
			certificate_request: csr
		};

		if (profile) {
			enrollRequest.profile = profile;
		}

		if (attr_reqs) {
			enrollRequest.attr_reqs = attr_reqs;
		}

		const res = await this.request('POST', 'enroll', undefined, enrollRequest, requestOptions);
		// we want the result field which is Base64-encoded PEM
		return {
			enrollmentCert: Buffer.from(res.result.Cert, 'base64').toString(),
			caCertChain: Buffer.from(res.result.ServerInfo.CAChain, 'base64').toString(),
		};
	}

	async generateCRL(revokedBefore, revokedAfter, expireBefore, expireAfter, signingIdentity) {

		if (arguments.length !== 5) {
			return Promise.reject(new Error('Missing required parameters. \'revokedBefore\', \'revokedAfter\' ,' +
				'\'expireBefore\', \'expireAfter\' and \'signingIdentity\' are all required.'));
		}

		const request = {
			revokedBefore,
			revokedAfter,
			expireBefore,
			expireAfter,
			caname: this._caName,
		};

		const response = await this.post('gencrl', request, signingIdentity);
		// assert all success response have non-empty response.result
		return response.result.CRL;
	}

	/**
	 * Validate the connection options
	 * @throws Will throw an error if any of the required connection options are missing or invalid
	 * @ignore
	 */
	_validateConnectionOpts(connect_opts) {
		// check for protocol
		if (connect_opts.protocol !== 'http' && connect_opts.protocol !== 'https') {
			throw new Error('Invalid connection options. Protocol must be set to \'http\' or \'https\'');
		}

		if (!connect_opts.hostname) {
			throw new Error('Invalid connection options. Hostname must be set');
		}

		if (connect_opts.port) {
			if (!Number.isInteger(connect_opts.port)) {
				throw new Error('Invalid connection options. Port must be an integer');
			}
		}

	}
};

module.exports = FabricCAClient;
