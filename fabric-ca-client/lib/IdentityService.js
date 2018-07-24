/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const checkRegistrar = require('./helper').checkRegistrar;

/**
 * PEER indicates that an identity is acting as a peer
 */
const PEER = 'peer';
/**
 * ORDERER indicates that an identity is acting as an orderer
 */
const ORDERER = 'orderer';
/**
 * CLIENT indicates that an identity is acting as a client
 */
const CLIENT = 'client';
/**
 * USER indicates that an identity is acting as a user
 */
const USER = 'user';

/**
 * HFREGISTRARROLES is an attribute that allows a registrar to manage identities of the specified roles
 */
const HFREGISTRARROLES = 'hf.Registrar.Roles';
/**
 * HFREGISTRARDELEGATEROLES is an attribute that allows a registrar to give the roles specified
 * to a registree for its 'hf.Registrar.Roles' attribute
 */
const HFREGISTRARDELEGATEROLES = 'hf.Registrar.DelegateRoles';
/**
 * HFREGISTRARATTRIBUTES is an attribute that has a list of attributes that the registrar is allowed to register
 * for an identity
 */
const HFREGISTRARATTRIBUTES = 'hf.Registrar.Attributes';
/**
 * HFINTERMEDIATECA is a boolean attribute that allows an identity to enroll as an intermediate CA
 */
const HFINTERMEDIATECA = 'hf.IntermediateCA';
/**
 * HFREVOKER is a boolean attribute that allows an identity to revoker a user and/or certificates
 */
const HFREVOKER = 'hf.Revoker';
/**
 * HFAFFILIATIONMGR is a boolean attribute that allows an identity to manage affiliations
 */
const HFAFFILIATIONMGR = 'hf.AffiliationMgr';
/**
 * HFGENCRL is an attribute that allows an identity to generate a CRL
 */
const HFGENCRL = 'hf.GenCRL';

/**
 * This is an implementation of the Identity service which communicates with
 * the Fabric CA server using the Fabric CA client {@link FabricCAClient}.
 * @class
 */
class IdentityService {
	constructor(client) {
		this.client = client;
	}

	/**
	 * @typedef {Object} IdentityRequest
	 * @property {string} enrollmentID - Required. The enrollment ID which uniquely identifies an identity
	 * @property {string} affiliation - Required. The affiliation path of the new identity
	 * @property {KeyValueAttribute[]} attrs - Array of {@link KeyValueAttribute} attributes to assign to the user
	 * @property {string} type - Optional. The type of the identity (e.g. *user*, *app*, *peer*, *orderer*, etc)
	 * @property {string} enrollmentSecret - Optional. The enrollment secret.  If not provided, a random secret is generated.
	 * @property {number} maxEnrollments - Optional. The maximum number of times that the secret can be used to enroll.
	 *    If 0, use the configured max_enrollments of the fabric-ca-server;
	 *    If > 0 and <= configured max enrollments of the fabric-ca-server, use max_enrollments;
	 *    If > configured max enrollments of the fabric-ca-server, error.
	 * @property {string} caname - Optional. Name of the CA to send the request to within the Fabric CA server
	 */

	/**
	 * @typedef {Object} ServiceResponseMessage
	 * @property {number} code - Integer code denoting the type of message
	 * @property {string} message - A more specific message
	 */

	/**
	 * @typedef {Object} ServiceResponse
	 * @property {boolean} Success - Boolean indicating if the request was successful
	 * @property {Object} Result - The result of this request
	 * @property {ServiceResponseMessage[]} Errors - An array of error messages (code and message)
	 * @property {ServiceResponseMessage[]} Messages - An array of information messages (code and message)
	 */

	/**
	 * Create a new identity with the Fabric CA server.
	 * An enrollment secret is returned which can then be used, along with the enrollment ID, to enroll a new identity.
	 * The caller must have `hf.Registrar` authority.
	 *
	 * @param {IdentityRequest} req - The {@link IdentityRequest}
	 * @param {User} registrar The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} Return the secret of this new identity
	 */
	create(req, registrar) {
		if (!req) {
			throw new Error('Missing required argument "req"');
		}

		if (!req.enrollmentID || !req.affiliation) {
			throw new Error('Missing required parameters. "req.enrollmentID", "req.affiliation" are all required.');
		}

		checkRegistrar(registrar);

		// set default maxEnrollments to 1
		let maxEnrollments = 1;
		if (Number.isInteger(req.maxEnrollments)) {
			maxEnrollments = req.maxEnrollments;
		}

		const self = this;
		const signingIdentity = registrar.getSigningIdentity();

		return new Promise((resolve, reject) => {
			const request = {
				id: req.enrollmentID,
				type: req.type || null,
				affiliation: req.affiliation,
				attrs: req.attrs || [],
				max_enrollments: maxEnrollments,
				secret: req.enrollmentSecret || null,
				caname: req.caname || null,
			};

			return self.client.post('identities', request, signingIdentity)
				.then((response) => {
					return resolve(response.result.secret);
				}).catch((err) => {
					return reject(err);
				});
		});
	}

	/**
	 * Get an identity. The caller must have `hf.Registrar` authority.
	 *
	 * @param {string} enrollmentID - Required. The enrollment ID which uniquely identifies an identity
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	getOne(enrollmentID, registrar) {
		if (!enrollmentID || typeof enrollmentID !== 'string') {
			throw new Error('Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string');
		}
		checkRegistrar(registrar);
		const signingIdentity = registrar.getSigningIdentity();

		const url = 'identities/' + enrollmentID + '?ca='+this.client._caName;
		return this.client.get(url, signingIdentity);
	}

	/**
	 * Get all identities that the registrar is entitled to see.
	 *
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	getAll(registrar) {
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		return this.client.get('identities?ca=' + this.client._caName, signingIdentity);
	}

	/**
	 * Delete an existing identity. The caller must have `hf.Registrar` authority.
	 *
	 * @param {string} enrollmentID
	 * @param {User} registrar
	 * @param {boolean} force - Optional. With force, some identity can delete itself
	 * @return {Promise} {@link ServiceResponse}
	 */
	delete(enrollmentID, registrar, force) {
		if (!enrollmentID || typeof enrollmentID !== 'string') {
			throw new Error('Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string');
		}
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		let url = 'identities/' + enrollmentID;
		if (force === true) {
			url = url + '?force=true';
		}
		return this.client.delete(url, signingIdentity);
	}

	/**
	 * Update an existing identity. The caller must have `hf.Registrar` authority.
	 *
	 * @param {string} enrollmentID
	 * @param {IdentityRequest} req
	 * @param {User} registrar
	 * @return {Promise} {@link ServiceResponse}
	 */
	update(enrollmentID, req, registrar) {
		if (!enrollmentID || typeof enrollmentID !== 'string') {
			throw new Error('Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string');
		}
		checkRegistrar(registrar);
		const signingIdentity = registrar.getSigningIdentity();

		const url = 'identities/' + enrollmentID;

		const request = {};
		if(req.type) {
			request.type = req.type;
		}
		if(req.affiliation) {
			request.affiliation = req.affiliation;
		}
		if (Number.isInteger(req.maxEnrollments)) {
			request.maxEnrollments = req.maxEnrollments;
		}
		if(req.attrs) {
			request.attrs = req.attrs;
		}
		if(req.enrollmentSecret) {
			request.secret = req.enrollmentSecret;
		}
		if(req.caname) {
			request.caname = req.caname;
		}

		return this.client.put(url, request, signingIdentity);
	}
}

module.exports = IdentityService;
module.exports.HFCAIdentityType = {
	PEER,
	ORDERER,
	CLIENT,
	USER,
};
module.exports.HFCAIdentityAttributes = {
	HFREGISTRARROLES,
	HFREGISTRARDELEGATEROLES,
	HFREGISTRARATTRIBUTES,
	HFINTERMEDIATECA,
	HFREVOKER,
	HFAFFILIATIONMGR,
	HFGENCRL,
};
