/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

var utils = require('./utils.js');
var logger = utils.getLogger('CertificateAuthority.js');

/**
 * The CertificateAuthority class represents an Certificate Authority in the target blockchain network.
 *
 * @class
 */
var CertificateAuthority = class {

	/**
	 * Construct a CertificateAuthority object
	 * @param {string} name - The name of this Certificate Authority
	 * @returns {string} The url of this CertificateAuthority

	 * @returns {CertificateAuthority} The CertificateAuthority instance.
	 */
	constructor(name, caname, url, connection_options, tlsCACerts, registrar) {
		logger.debug('CertificateAuthority.const ');
		logger.debug('Organization.const ');
		if (typeof name === 'undefined' || name === null) {
			throw new Error('Missing name parameter');
		}
		if (typeof url === 'undefined' || url === null) {
			throw new Error('Missing url parameter');
		}
		this._name = name;
		if(caname) {
			this._caname = caname;
		} else {
			this._caname = name;
		}
		this._url = url;
		this._connection_options = connection_options;
		this._tlsCACerts = tlsCACerts;
		this._registrar = registrar;
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
	 * return a printable representation of this object
	 */
	toString() {
		return ' CertificateAuthority : {' +
		'name : ' +  this._name +
		', url : ' +  this._url +
		'}';
	}

};

module.exports = CertificateAuthority;
