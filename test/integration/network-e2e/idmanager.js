/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Client = require('fabric-client');
const User = require('fabric-client/lib/User');

class IDManager {

	initialize(ccp) {
		this.client = Client.loadFromConfig(ccp);
	}

	async registerUser(userID, options, issuerWallet, issuerId) {
		if (!options) {
			options = {};
		}
		const identity = await issuerWallet.setUserContext(this.client, issuerId);

		const registerRequest = {
			enrollmentID: userID,
			affiliation: options.affiliation || 'org1',  // or eg. org1.department1
			attrs: [],
			maxEnrollments: options.maxEnrollments || -1,  // infinite enrollment by default
			role: options.role || 'client'
		};

		if (options.issuer) {
			// Everyone we create can register clients.
			registerRequest.attrs.push({
				name: 'hf.Registrar.Roles',
				value: 'client'
			});

			// Everyone we create can register clients that can register clients.
			registerRequest.attrs.push({
				name: 'hf.Registrar.Attributes',
				value: 'hf.Registrar.Roles, hf.Registrar.Attributes'
			});
		}

		let idAttributes = options.attributes;
		if (typeof idAttributes === 'string') {
			try {
				idAttributes = JSON.parse(idAttributes);
			} catch (error) {
				const newError = new Error('attributes provided are not valid JSON. ' + error);
				throw newError;
			}
		}

		for (const attribute in idAttributes) {
			registerRequest.attrs.push({
				name: attribute,
				value: idAttributes[attribute]
			});
		}

		const userSecret = await this.client.getCertificateAuthority().register(registerRequest, identity);
		return userSecret;
	}

	async enrollToWallet(userID, secret, mspId, walletToImportTo) {
		await walletToImportTo.configureClientStores(this.client, userID);
		const options = {enrollmentID: userID, enrollmentSecret: secret};
		const enrollment = await this.client.getCertificateAuthority().enroll(options);
		// private key will now have been stored
		const user = new User(userID);
		user.setCryptoSuite(this.client.getCryptoSuite());
		await user.setEnrollment(enrollment.key, enrollment.certificate, mspId);
		// public key will now have been stored
		await this.client.setUserContext(user);
		// state store will now have been saved

	}

}

module.exports = IDManager;
