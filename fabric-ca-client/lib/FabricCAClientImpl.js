/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var api = require('./api.js');
var utils = require('./utils.js');
var BaseClient = require('./BaseClient.js');
var util = require('util');
var path = require('path');
var http = require('http');
var https = require('https');
var urlParser = require('url');
var jsrsasign = require('jsrsasign');
var x509 = jsrsasign.X509;
var ASN1HEX = jsrsasign.ASN1HEX;

var logger = utils.getLogger('FabricCAClientImpl.js');

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
var FabricCAServices = class extends BaseClient {

	/**
	 * constructor
	 *
	 * @param {string} url The endpoint URL for Fabric CA services of the form: "http://host:port" or "https://host:port"
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
	constructor(url, tlsOptions, caName, cryptoSuite) {
		super();

		var endpoint = FabricCAServices._parseURL(url);

		if (!!cryptoSuite) {
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
	 * Register the member and return an enrollment secret.
	 * @param {Object} req Registration request with the following fields:
	 * <br> - enrollmentID {string}. ID which will be used for enrollment
	 * <br> - enrollmentSecret {string}. Optional enrollment secret to set for the registered user.
	 *   If not provided, the server will generate one.
	 * <br> - role {string}. An arbitrary string representing a role value for the user
	 * <br> - affiliation {string}. Affiliation with which this user will be associated, like a company or an organization
	 * <br> - maxEnrollments {number}. The maximum number of times this user will be permitted to enroll
	 * <br> - attrs {{@link KeyValueAttribute}[]}. Array of key/value attributes to assign to the user.
	 * @param registrar {User}. The identity of the registrar (i.e. who is performing the registration)
	 * @returns {Promise} The enrollment secret to use when this user enrolls
	 */
	register(req, registrar) {
		if (typeof req === 'undefined' || req === null) {
			throw new Error('Missing required argument "request"');
		}

		if (typeof req.enrollmentID === 'undefined' || req.enrollmentID === null) {
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
	 * Enroll the member and return an opaque member object.
	 * @param req Enrollment request
	 * @param {string} req.enrollmentID The registered ID to use for enrollment
	 * @param {string} req.enrollmentSecret The secret associated with the enrollment ID
	 * @returns Promise for an object with "key" for private key and "certificate" for the signed certificate
	 */
	enroll(req) {
		var self = this;

		return new Promise(function (resolve, reject) {
			if (typeof req === 'undefined' || req === null) {
				logger.error('enroll() missing required argument "request"');
				return reject(new Error('Missing required argument "request"'));
			}
			if (!req.enrollmentID) {
				logger.error('Invalid enroll request, missing enrollmentID');
				return reject(new Error('req.enrollmentID is not set'));
			}

			if (!req.enrollmentSecret) {
				logger.error('Invalid enroll request, missing enrollmentSecret');
				return reject(new Error('req.enrollmentSecret is not set'));
			}

			var enrollmentID = req.enrollmentID;
			var enrollmentSecret = req.enrollmentSecret;

			//generate enrollment certificate pair for signing
			var opts;
			if (self.getCryptoSuite()._cryptoKeyStore) {
				opts = {ephemeral: false};
			} else {
				opts = {ephemeral: true};
			}
			self.getCryptoSuite().generateKey(opts)
				.then(
				function (privateKey) {
					//generate CSR using enrollmentID for the subject
					try {
						var csr = privateKey.generateCSR('CN=' + req.enrollmentID);
						self._fabricCAClient.enroll(req.enrollmentID, req.enrollmentSecret, csr)
							.then(
							function (enrollResponse) {
								return resolve({
									key: privateKey,
									certificate: enrollResponse.enrollmentCert,
									rootCertificate: enrollResponse.caCertChain
								});
							},
							function (err) {
								return reject(err);
							}
							);

					} catch (err) {
						return reject(new Error(util.format('Failed to generate CSR for enrollmemnt due to error [%s]', err)));
					}
				},
				function (err) {
					return reject(new Error(util.format('Failed to generate key for enrollment due to error [%s]', err)));
				}
				);

		});
	}

	/**
	 * Re-enroll the member in cases such as the existing enrollment certificate is about to expire, or
	 * it has been compromised
	 * @param {User} currentUser The identity of the current user that holds the existing enrollment certificate
	 * @returns Promise for an object with "key" for private key and "certificate" for the signed certificate
	 */
	reenroll(currentUser) {
		if (!currentUser) {
			logger.error('Invalid re-enroll request, missing argument "currentUser"');
			throw new Error('Invalid re-enroll request, missing argument "currentUser"');
		}

		if (typeof currentUser.getIdentity !== 'function') {
			logger.error('Invalid re-enroll request, "currentUser" is not a valid User object, missing "getIdentity()" method');
			throw new Error('Invalid re-enroll request, "currentUser" is not a valid User object, missing "getIdentity()" method');
		}

		if (typeof currentUser.getSigningIdentity !== 'function') {
			logger.error('Invalid re-enroll request, "currentUser" is not a valid User object, missing "getSigningIdentity()" method');
			throw new Error('Invalid re-enroll request, "currentUser" is not a valid User object, missing "getSigningIdentity()" method');
		}

		var cert = currentUser.getIdentity()._certificate;
		var subject = null;
		try {
			subject = getSubjectCommonName(FabricCAServices.normalizeX509(cert));
		} catch(err) {
			logger.error(util.format('Failed to parse enrollment certificate %s for Subject. \nError: %s', cert, err));
		}

		if (subject === null)
			throw new Error('Failed to parse the enrollment certificate of the current user for its subject');

		var self = this;

		return new Promise(function (resolve, reject) {
			//generate enrollment certificate pair for signing
			self.getCryptoSuite().generateKey()
				.then(
				function (privateKey) {
					//generate CSR using the subject of the current user's certificate
					try {
						var csr = privateKey.generateCSR('CN=' + subject);
						self._fabricCAClient.reenroll(csr, currentUser.getSigningIdentity())
							.then(
							function (response) {
								return resolve({
									key: privateKey,
									certificate: Buffer.from(response.result.Cert, 'base64').toString(),
									rootCertificate: Buffer.from(response.result.ServerInfo.CAChain, 'base64').toString()
								});
							},
							function (err) {
								return reject(err);
							}
							);

					} catch (err) {
						return reject(new Error(util.format('Failed to generate CSR for enrollmemnt due to error [%s]', err)));
					}
				},
				function (err) {
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
		if (typeof request === 'undefined' || request === null) {
			throw new Error('Missing required argument "request"');
		}

		if (request.enrollmentID === null || request.enrollmentID === '') {
			if (request.aki === null || request.aki === '' || request.serial === null || request.serial === '') {
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
	 * @typedef {Object} HTTPEndpoint
	 * @property {string} hostname
	 * @property {number} port
	 * @property {string} protocol
	 */

	/**
	 * Utility function which parses an HTTP URL into its component parts
	 * @param {string} url HTTP or HTTPS url including protocol, host and port
	 * @returns {HTTPEndpoint}
	 * @throws InvalidURL for malformed URLs
	 * @ignore
	 */
	static _parseURL(url) {

		var endpoint = {};

		var purl = urlParser.parse(url, true);

		if (purl.protocol && purl.protocol.startsWith('http')) {
			if (purl.protocol.slice(0, -1) != 'https') {
				if (purl.protocol.slice(0, -1) != 'http') {
					throw new Error('InvalidURL: url must start with http or https.');
				}
			}
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

	/**
	* return a printable representation of this object
	*/
	toString() {
		return ' FabricCAServices : {' +
			'hostname: ' + this._fabricCAClient._hostname +
			', port: ' + this._fabricCAClient._port +
			'}';
	}

	/**
	 * Make sure there's a start line with '-----BEGIN CERTIFICATE-----'
	 * and end line with '-----END CERTIFICATE-----', so as to be compliant
	 * with x509 parsers
	 */
	static normalizeX509(raw) {
		var regex = /(\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-)([\s\S]*)(\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-)/;
		var matches = raw.match(regex);
		if (matches.length !== 4) {
			throw new Error('Failed to find start line or end line of the certificate.');
		}

		// remove the first element that is the whole match
		matches.shift();
		// remove LF or CR
		matches = matches.map((element) => {
			return element.trim();
		});

		// make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
		return matches.join('\n');
	}
};

/**
 * Client for communciating with the Fabric CA APIs
 *
 * @class
 */
var FabricCAClient = class {

	/**
	 * constructor
	 *
	 * @param {object} connect_opts Connection options for communciating with the Fabric CA server
	 * @param {string} connect_opts.protocol The protocol to use (either HTTP or HTTPS)
	 * @param {string} connect_opts.hostname The hostname of the Fabric CA server endpoint
	 * @param {number} connect_opts.port The port of the Fabric CA server endpoint
	 * @param {TLSOptions} connect_opts.tlsOptions The TLS settings to use when the Fabric CA endpoint uses "https"
	 * @param {string} connect_opts.caname The optional name of the CA. Fabric-ca servers support multiple Certificate Authorities from
	 *  a single server. If omitted or null or an empty string, then the default CA is the target of requests
	 * @throws Will throw an error if connection options are missing or invalid
	 *
	 */
	constructor(connect_opts, cryptoPrimitives) {

		//check connect_opts
		try {
			this._validateConnectionOpts(connect_opts);
		} catch (err) {
			throw new Error('Invalid connection options.  ' + err.message);
		}

		this._caName = connect_opts.caname,
		this._httpClient = (connect_opts.protocol === 'http') ? http : https;
		this._hostname = connect_opts.hostname;
		if (connect_opts.port) {
			this._port = connect_opts.port;
		} else {
			this._port = 7054;
		}
		if (typeof connect_opts.tlsOptions==='undefined' || connect_opts.tlsOptions===null){
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

		logger.debug('Successfully constructed Fabric CA client from options - %j', connect_opts);
	}

	/**
	 * @typedef {Object} KeyValueAttribute
	 * @property {string} name The key used to reference the attribute
	 * @property {string} value The value of the attribute
	 */

	/**
	 * Register a new user and return the enrollment secret
	 * @param {string} enrollmentID ID which will be used for enrollment
	 * @param {string} enrollmentSecret Optional enrollment secret to set for the registered user.
	 *   If not provided, the server will generate one.
	 * @param {string} role Type of role for this user
	 * @param {string} affiliation Affiliation with which this user will be associated
	 * @param {number} maxEnrollments The maximum number of times the user is permitted to enroll
	 * @param {KeyValueAttribute[]} attrs Array of key/value attributes to assign to the user
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @returns {Promise} The enrollment secret to use when this user enrolls
	 */
	register(enrollmentID, enrollmentSecret, role, affiliation, maxEnrollments, attrs, signingIdentity) {

		var self = this;
		var numArgs = arguments.length;
		//all arguments are required
		if (numArgs < 6) {
			throw new Error('Missing required parameters.  \'enrollmentID\', \'role\', \'affiliation\', \'attrs\', \
				and \'signingIdentity\' are all required.');
		}

		return new Promise(function (resolve, reject) {
			var regRequest = {
				'id': enrollmentID,
				'type': role ? role : 'client',
				'affiliation': affiliation,
				'max_enrollments': maxEnrollments,
				'attrs': attrs
			};

			if (typeof enrollmentSecret === 'string' && enrollmentSecret !== '') {
				regRequest.secret = enrollmentSecret;
			}

			return self.post('register', regRequest, signingIdentity)
			.then(function (response) {
				return resolve(response.result.secret);
			}).catch(function (err) {
				return reject(err);
			});
		});
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
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * signing certificate, hash algorithm and signature algorithm
	 * @returns {Promise} The revocation results
	 */
	revoke(enrollmentID, aki, serial, reason, signingIdentity) {

		var self = this;
		var numArgs = arguments.length;

		//all arguments are required
		if (numArgs < 5) {
			throw new Error('Missing required parameters.  \'enrollmentID\', \'aki\', \'serial\', \'reason\', \
				\'callerID\' and \'signingIdentity\' are all required.');
		}

		return new Promise(function (resolve, reject) {

			var regRequest = {
				'id': enrollmentID,
				'aki': aki,
				'serial': serial,
				'reason': reason
			};

			return self.post('revoke', regRequest, signingIdentity)
			.then(function (response) {
				return resolve(response);
			}).catch(function (err) {
				return reject(err);
			});
		});
	}

	/**
	 * Re-enroll an existing user.
	 * @param {string} csr PEM-encoded PKCS#10 certificate signing request
	 * @param {SigningIdentity} signingIdentity The instance of a SigningIdentity encapsulating the
	 * @returns {Promise} {@link EnrollmentResponse}
	 */
	reenroll(csr, signingIdentity) {

		var self = this;
		var numArgs = arguments.length;

		//all arguments are required
		if (numArgs < 2) {
			throw new Error('Missing required parameters.  \'csr\', \'signingIdentity\' are all required.');
		}

		return new Promise(function (resolve, reject) {

			var request = {
				certificate_request: csr
			};

			return self.post('reenroll', request, signingIdentity)
			.then(function (response) {
				return resolve(response);
			}).catch(function (err) {
				return reject(err);
			});
		});
	}

	post(api_method, requestObj, signingIdentity) {
		requestObj.caName = this._caName;

		var self = this;
		return new Promise(function (resolve, reject) {
			var requestOptions = {
				hostname: self._hostname,
				port: self._port,
				path: self._baseAPI + api_method,
				method: 'POST',
				headers: {
					Authorization: self.generateAuthToken(requestObj, signingIdentity)
				},
				ca: self._tlsOptions.trustedRoots,
				rejectUnauthorized: self._tlsOptions.verify
			};

			var request = self._httpClient.request(requestOptions, function (response) {

				const responseBody = [];
				response.on('data', function (chunk) {
					responseBody.push(chunk);
				});

				response.on('end', function () {

					var payload = responseBody.join('');

					if (!payload) {
						reject(new Error(
							util.format('fabric-ca request %s failed with HTTP status code %s', api_method, response.statusCode)));
					}
					//response should be JSON
					var responseObj;
					try {
						responseObj = JSON.parse(payload);
						if (responseObj.success) {
							return resolve(responseObj);
						} else {
							return reject(new Error(
								util.format('fabric-ca request %s failed with errors [%s]', api_method, JSON.stringify(responseObj && responseObj.errors ? responseObj.errors : responseObj))));
						}

					} catch (err) {
						reject(new Error(
							util.format('Could not parse %s response [%s] as JSON due to error [%s]', api_method, payload, err)));
					}
				});

			});

			request.on('error', function (err) {
				reject(new Error(util.format('Calling %s endpoint failed with error [%s]', api_method, err)));
			});

			request.write(JSON.stringify(requestObj));
			request.end();
		});
	}

	/*
	 * Generate authorization token required for accessing fabric-ca APIs
	 */
	generateAuthToken(reqBody, signingIdentity) {
		// specific signing procedure is according to:
		// https://github.com/hyperledger/fabric-ca/blob/master/util/util.go#L213
		var cert = Buffer.from(signingIdentity._certificate).toString('base64');
		var body = Buffer.from(JSON.stringify(reqBody)).toString('base64');

		var bodyAndcert = body + '.' + cert;
		var sig = signingIdentity.sign(bodyAndcert, { hashFunction: this._cryptoPrimitives.hash.bind(this._cryptoPrimitives) });
		logger.debug(util.format('bodyAndcert: %s', bodyAndcert));

		var b64Sign = Buffer.from(sig, 'hex').toString('base64');
		return cert + '.' + b64Sign;
	}

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
	 * @returns {Promise} {@link EnrollmentResponse}
	 * @throws Will throw an error if all parameters are not provided
	 * @throws Will throw an error if calling the enroll API fails for any reason
	 */
	enroll(enrollmentID, enrollmentSecret, csr) {

		var self = this;
		var numArgs = arguments.length;

		return new Promise(function (resolve, reject) {
			//check for required args
			if (numArgs < 3) {
				return reject(new Error('Missing required parameters.  \'enrollmentID\', \'enrollmentSecret\' and \'csr\' are all required.'));
			}

			var requestOptions = {
				hostname: self._hostname,
				port: self._port,
				path: self._baseAPI + 'enroll',
				method: 'POST',
				auth: enrollmentID + ':' + enrollmentSecret,
				ca: self._tlsOptions.trustedRoots,
				rejectUnauthorized: self._tlsOptions.verify
			};

			var enrollRequest = {
				caName: self._caName,
				certificate_request: csr
			};

			var request = self._httpClient.request(requestOptions, function (response) {

				const responseBody = [];
				response.on('data', function (chunk) {
					responseBody.push(chunk);
				});

				response.on('end', function () {

					var payload = responseBody.join('');

					if (!payload) {
						reject(new Error(
							util.format('Enrollment failed with HTTP status code ', response.statusCode)));
					}
					//response should be JSON
					try {
						var res = JSON.parse(payload);
						if (res.success) {
							//we want the result field which is Base64-encoded PEM
							var enrollResponse = new Object();
							// Cert field is Base64-encoded PEM
							enrollResponse.enrollmentCert = Buffer.from(res.result.Cert, 'base64').toString();
							enrollResponse.caCertChain = Buffer.from(res.result.ServerInfo.CAChain, 'base64').toString();
							return resolve(enrollResponse);
						} else {
							return reject(new Error(
								util.format('Enrollment failed with errors [%s]', JSON.stringify(res.errors))));
						}

					} catch (err) {
						reject(new Error(
							util.format('Could not parse enrollment response [%s] as JSON due to error [%s]', payload, err)));
					}
				});

			});

			request.on('error', function (err) {
				reject(new Error(util.format('Calling enrollment endpoint failed with error [%s]', err)));
			});

			request.write(JSON.stringify(enrollRequest));
			request.end();

		});

	}

	/**
	 * Convert a PEM encoded certificate to DER format
	 * @param {string) pem PEM encoded public or private key
	 * @returns {string} hex Hex-encoded DER bytes
	 * @throws Will throw an error if the conversation fails
	 */
	static pemToDER(pem) {

		//PEM format is essentially a nicely formatted base64 representation of DER encoding
		//So we need to strip "BEGIN" / "END" header/footer and string line breaks
		//Then we simply base64 decode it and convert to hex string
		var contents = pem.toString().trim().split(/\r?\n/);
		//check for BEGIN and END tags
		if (!(contents[0].match(/\-\-\-\-\-\s*BEGIN ?([^-]+)?\-\-\-\-\-/) &&
			contents[contents.length - 1].match(/\-\-\-\-\-\s*END ?([^-]+)?\-\-\-\-\-/))) {
			throw new Error('Input parameter does not appear to be PEM-encoded.');
		};
		contents.shift(); //remove BEGIN
		contents.pop(); //remove END
		//base64 decode and encode as hex string
		var hex = Buffer.from(contents.join(''), 'base64').toString('hex');
		return hex;
	}

	/**
	 * Validate the connection options
	 * @throws Will throw an error if any of the required connection options are missing or invalid
	 * @ignore
	 */
	_validateConnectionOpts(connect_opts) {
		//check for protocol
		if (!connect_opts.protocol) {
			throw new Error('Protocol must be set to \'http\' or \'https\'');
		};

		if (connect_opts.protocol != 'http') {
			if (connect_opts.protocol != 'https') {
				throw new Error('Protocol must be set to \'http\' or \'https\'');
			}
		};

		if (!connect_opts.hostname) {
			throw new Error('Hostname must be set');
		};

		if (connect_opts.port) {
			if (!Number.isInteger(connect_opts.port)) {
				throw new Error('Port must be an integer');
			}
		}

	}
};

function checkRegistrar(registrar) {
	if (typeof registrar === 'undefined' || registrar === null) {
		throw new Error('Missing required argument "registrar"');
	}

	if (typeof registrar.getSigningIdentity !== 'function') {
		throw new Error('Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity()"');
	}
}

// This utility is based on jsrsasign.X509.getSubjectString() implementation
// we can not use that method directly because it requires calling readCertPEM()
// first which as of jsrsasign@6.2.3 always assumes RSA based certificates and
// fails to parse certs that includes ECDSA keys.
function getSubjectCommonName(pem) {
	var hex = x509.pemToHex(pem);
	var d = ASN1HEX.getDecendantHexTLVByNthList(hex, 0, [0, 5]);
	var subject = x509.hex2dn(d); // format: '/C=US/ST=California/L=San Francisco/CN=Admin@org1.example.com/emailAddress=admin@org1.example.com'
	var m = subject.match(/CN=.+[^\/]/);
	if (!m)
		throw new Error('Certificate PEM does not seem to contain a valid subject with common name "CN"');
	else
		return m[0].substring(3);
}

module.exports = FabricCAServices;
module.exports.FabricCAClient = FabricCAClient;
