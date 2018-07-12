/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const logger = require('./utils').getLogger('AffiliationService');
const checkRegistrar = require('./helper').checkRegistrar;

/**
 * This is an implementation of the Affiliation service which communicates with
 * the Fabric CA server using the Fabric CA client {@link FabricCAClient}.
 * @class
 */
class AffiliationService {
	constructor(client) {
		this.client = client;
	}

	/**
	 * @typedef {Object} AffiliationRequest
	 * @property {string} name - Required. The affiliation path to create
	 * @property {string} caname - Optional. Name of the CA to send the request to within the Fabric CA server
	 * @property {boolean} force - Optional.
	 *   <ul>
	 *     <li>
	 *       For create affiliation request, if any of the parent affiliations do not exist and 'force' is true,
	 *       create all parent affiliations also.
	 *     </li>
	 *     <li>
	 *       For delete affiliation request, if force is true and there are any child affiliations or any identities
	 *       are associated with this affiliation or child affiliations, these identities and child affiliations
	 *       will be deleted; otherwise, an error is returned.
	 *     </li>
	 *     <li>
	 *       For update affiliation request, if any identities are associated with this affiliation, 'force' is true
	 *       causes these identities' affiliations to be renamed; otherwise, an error is returned.
	 *     </li>
	 *   </ul>
	 */

	/**
	 * Create a new affiliation.
	 * The caller must have hf.AffiliationMgr authority.
	 *
	 * @param {AffiliationRequest} req - Required. The {@link AffiliationRequest}
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	create(req, registrar) {
		if (typeof req === 'undefined' || req === null) {
			throw new Error('Missing required argument "req"');
		}

		if (!req.name) {
			throw new Error('Missing required parameters. "req.name" is required.');
		}
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		let url = 'affiliations';
		if (req.force === true) {
			url = url + '?force=true';
		}
		logger.debug('create new affiliation with url ' + url);
		const request = {
			name: req.name,
			caname: req.caname
		};
		return this.client.post(url, request, signingIdentity);
	}

	/**
	 * List a specific affiliation at or below the caller's affinity.
	 * The caller must have hf.AffiliationMgr authority.
	 *
	 * @param {string} affiliation - The affiliation path to be queried.
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	getOne(affiliation, registrar) {
		if (!affiliation || typeof affiliation !== 'string') {
			throw new Error('Missing required argument "affiliation", or argument "affiliation" is not a valid string');
		}
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		const url = 'affiliations/' + affiliation;
		return this.client.get(url, signingIdentity);
	}

	/**
	 * List all affiliations equal to and below the caller's affiliation.
	 * The caller must have hf.AffiliationMgr authority.
	 *
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	getAll(registrar) {
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		return this.client.get('affiliations', signingIdentity);
	}

	/**
	 * Delete an affiliation.
	 * The caller must have hf.AffiliationMgr authority.
	 *
	 * @param {AffiliationRequest} req - Required. The {@link AffiliationRequest}
	 * @param {User} registrar - Required. The identity of the registrar (i.e. who is performing the registration).
	 * @return {Promise} {@link ServiceResponse}
	 */
	delete(req, registrar) {
		if (typeof req === 'undefined' || req === null) {
			throw new Error('Missing required argument "req"');
		}

		if (!req.name || typeof req.name !== 'string') {
			throw new Error('Missing required argument "req.name", or argument "req.name" is not a valid string');
		}

		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		let url = 'affiliations/' + req.name;
		if (req.force === true) {
			url = url + '?force=true';
		}
		return this.client.delete(url, signingIdentity);
	}

	/**
	 * Rename an affiliation.
	 * The caller must have hf.AffiliationMgr authority.
	 *
	 * @param {string} affiliation - The affiliation path to be updated
	 * @param {AffiliationRequest} req - Required. The {@link AffiliationRequest}
	 * @param {User} registrar
	 * @return {Promise} {@link ServiceResponse}
	 */
	update(affiliation, req, registrar) {
		if (!affiliation || typeof affiliation !== 'string') {
			throw new Error('Missing required argument "affiliation", or argument "affiliation" is not a valid string');
		}
		if (typeof req === 'undefined' || req === null) {
			throw new Error('Missing required argument "req"');
		}

		if (!req.name || typeof req.name !== 'string') {
			throw new Error('Missing required argument "req.name", or argument "req.name" is not a valid string');
		}
		checkRegistrar(registrar);

		const signingIdentity = registrar.getSigningIdentity();

		let url = 'affiliations/' + affiliation;
		if (req.force === true) {
			url = url + '?force=true';
		}
		const request = {
			name: req.name
		};
		if (req.caname && typeof req.caname === 'string') {
			request.caname = req.caname;
		}

		return this.client.put(url, request, signingIdentity);
	}
}

module.exports = AffiliationService;
