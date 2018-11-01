/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


'use strict';

const utils = require('./utils.js');
const logger = utils.getLogger('CertificateAuthority.js');

/**
 * The CertificateAuthority class represents a Certificate Authority configuration
 * as defined in a Connection Profile. This class will wrapper a FabricCAClientImpl
 * fabric-ca-client implementation as a FabricCAServices instance when this class
 * is returned from the {@link Client#getCertificateAuthority} method. This class
 * has all the same methods as the {@link FabricCAServices} so that this class
 * may be used directly or use this class's {@link CertificateAuthority#getFabricCAServices}
 * method to get the actual FabricCAServices instance.
 *
 * @class
 */
const CertificateAuthority = class {

	/**
	 * Construct a CertificateAuthority object
	 * @param {string} name - The name of this Certificate Authority
	 * @returns {string} The url of this CertificateAuthority

	 * @returns {CertificateAuthority} The CertificateAuthority instance.
	 */
	constructor(name, caname, url, connection_options, tlsCACerts, registrar) {
		logger.debug('CertificateAuthority.const');
		if (!name) {
			throw new Error('Missing name parameter');
		}
		if (!url) {
			throw new Error('Missing url parameter');
		}
		this._name = name;
		if (caname) {
			this._caname = caname;
		} else {
			this._caname = name;
		}
		this._url = url;
		this._connection_options = connection_options;
		this._tlsCACerts = tlsCACerts;
		this._registrar = registrar;

		this.fabricCAServices = null;
	}

	/**
	 * Gets the name of this CertificateAuthority
	 *
	 * @returns {string} The name of this CertificateAuthority
	 */
	getName() {
		return this._name;
	}

	/**
	 * Gets the name of this CertificateAuthority to use in request
	 *
	 * @returns {string} The ca name of this CertificateAuthority
	 */
	getCaName() {
		return this._caname;
	}

	/**
	 * Gets the url of this CertificateAuthority
	 *
	 * @returns {string} The url of this CertificateAuthority
	 */
	getUrl() {
		return this._url;
	}

	/**
	 * Gets the connection options of this CertificateAuthority
	 *
	 * @returns {object} The connection options of this CertificateAuthority
	 */
	getConnectionOptions() {
		return this._connection_options;
	}

	/**
	 * Gets the TLS CA Cert of this CertificateAuthority
	 *
	 * @returns {string} The TLS CA Cert PEM string of this CertificateAuthority
	 */
	getTlsCACerts() {
		return this._tlsCACerts;
	}

	/**
	 * Gets the registrar of this CertificateAuthority
	 *
	 * @returns {object} The registrar of this CertificateAuthority
	 */
	getRegistrar() {
		return this._registrar;
	}

	/**
	 * Set the FabricCAServices implementation
	 *
	 * @param {FabricCAServices} ca_services {@link FabricCAServices}
	 */
	setFabricCAServices(ca_services) {
		this.fabricCAServices = ca_services;
	}

	/**
	 * Get the FabricCAServices implementation
	 *
	 * @return  {@link FabricCAServices}
	 */
	getFabricCAServices() {
		return this.fabricCAServices;
	}

	/**
	 * see {@link FabricCAServices#register}
	 */
	register(req, registrar) {
		return this.fabricCAServices.register(req, registrar);
	}

	/**
	 * see {@link FabricCAServices#enroll}
	 */
	enroll(req) {
		return this.fabricCAServices.enroll(req);
	}

	/**
	 * see {@link FabricCAServices#reenroll}
	 */
	reenroll(currentUser, attr_reqs) {
		return this.fabricCAServices.reenroll(currentUser, attr_reqs);
	}

	/**
	 * see {@link FabricCAServices#revoke}
	 */
	revoke(request, registrar) {
		return this.fabricCAServices.revoke(request, registrar);
	}

	/**
	 * see {@link FabricCAServices#generateCRL}
	 */
	generateCRL(request, registrar) {
		return this.fabricCAServices.generateCRL(request, registrar);
	}

	/**
	 * see {@link FabricCAServices#newCertificateService}
	 */
	newCertificateService() {
		return this.fabricCAServices.newCertificateService();
	}

	/**
	 * see {@link FabricCAServices#newIdentityService}
	 */
	newIdentityService() {
		return this.fabricCAServices.newIdentityService();
	}

	/**
	 * see {@link FabricCAServices#newAffiliationService}
	 */
	newAffiliationService() {
		return this.fabricCAServices.newAffiliationService();
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return 'CertificateAuthority : {' +
		'name : ' +  this._name +
		', url : ' +  this._url +
		'}';
	}

};

module.exports = CertificateAuthority;
