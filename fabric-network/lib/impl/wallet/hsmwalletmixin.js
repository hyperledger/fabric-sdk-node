/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Client = require('fabric-client');
const {KEYUTIL} = require('jsrsasign');
const ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');

const HSMSuite = new Map();

/**
 * @memberof module:fabric-network
 */
class HSMWalletMixin {

	static createIdentity(mspId, certificate) {
		return {
			type: 'HSMX509',
			mspId,
			certificate
		};
	}


	static clearHSMCache() {
		HSMSuite.clear();
	}

	static closeDown() {
		for (const suite of HSMSuite.values()) {
			suite.closeSession();
			suite.finalize();
		}
	}

	// can either pass values on construction, or let sdk pick up info from env vars
	constructor(library = null, slot = null, pin = null, usertype = null) {
		this.library = library;
		this.slot = slot ? slot * 1 : null;
		this.pin = pin ? pin + '' : null;
		this.usertype = usertype;
		this.cryptoSuite = null;
	}

	getCryptoSuite(label, wallet) {
		const key = '' + this.slot + '-' + this.pin;
		this.cryptoSuite = HSMSuite.get(key);
		if (!this.cryptoSuite) {
			this.cryptoSuite = Client.newCryptoSuite({software: false, lib: this.library, slot: this.slot, pin: this.pin, usertype: this.usertype});
			// we need to set a path in the CryptoKeyStore even though it is using HSM otherwise
			// it will make the private key ephemeral and not store it in the HSM
			this.cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: '/tmp'}));
			HSMSuite.set(key, this.cryptoSuite);
		}
		return this.cryptoSuite;
	}

	// so similar to X509, can we do something about it ?
	async importIdentity(client, label, identity) {
		// check the identity type
		const cryptoContent = {
			signedCertPEM: identity.certificate
		};
		const publicKey = KEYUTIL.getKey(identity.certificate);
		const ecdsakey = new ecdsaKey(publicKey);
		cryptoContent.privateKeyObj = await this.cryptoSuite.getKey(Buffer.from(ecdsakey.getSKI(), 'hex'));

		await client.createUser({
			username: label,
			mspid: identity.mspId,
			cryptoContent: cryptoContent
		});

	}

	// so similar to X509 can we do something about it.
	async exportIdentity(client, label) {
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = HSMWalletMixin.createIdentity(
				user._mspId,
				user.getIdentity()._certificate
			);
		}
		return result;
	}

	async getIdentityInfo(client, label) {
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = {
				label,
				mspId: user._mspId,
				identifier: user.getIdentity()._publicKey.getSKI()
			};
		}
		return result;
	}
}

module.exports = HSMWalletMixin;
