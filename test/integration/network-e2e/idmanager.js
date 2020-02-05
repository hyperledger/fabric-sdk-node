/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Client = require('fabric-client');
const Utils = require('fabric-common/lib/Utils.js');

class IDManager {
	constructor(ccp, hsmOptions) {
		this.ccp = ccp;
		this.hsmOptions = hsmOptions;
		this.hsmOptions.software = false;
	}

	async initialize() {
		this.defaultClient = await Client.loadFromConfig(this.ccp);
		this.defaultClient.setCryptoSuite(Utils.newCryptoSuite());

		this.hsmClient = await Client.loadFromConfig(this.ccp);
		const hsmCryptoSuite = Utils.newCryptoSuite(this.hsmOptions);
		// Setting a key store triggers enrollment using this crypto suite to store the generated private key in the HSM
		hsmCryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: '/tmp'}));
		this.hsmClient.setCryptoSuite(hsmCryptoSuite);
	}

	async registerUser(userID, issuerWallet, issuerId, options = {}) {
		const identity = await issuerWallet.get(issuerId);
		const provider = issuerWallet.getProviderRegistry().getProvider(identity.type);
		const user = await provider.getUserContext(identity, issuerId);

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

		const userSecret = await this.defaultClient.getCertificateAuthority().register(registerRequest, user);
		return userSecret;
	}

	async enroll(userID, secret) {
		const options = {enrollmentID: userID, enrollmentSecret: secret};
		return await this.defaultClient.getCertificateAuthority().enroll(options);
	}

	async enrollToHsm(userID, secret) {
		const options = {enrollmentID: userID, enrollmentSecret: secret};
		// Enrollment also stores the generated private key in the HSM
		return await this.hsmClient.getCertificateAuthority().enroll(options);
	}

	closeHsmSession() {
		this.hsmClient.getCryptoSuite().closeSession();
	}
}

module.exports = IDManager;
