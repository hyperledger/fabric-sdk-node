/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('../../logger').getLogger('X509WalletMixin');

/**
 * @memberof module:fabric-network
 */
class X509WalletMixin {

	/**
	 * Create an identity object using X509 credentials.
	 * @param {string} mspId
	 * @param {string} certificate Certificate containing the public key in PEM format.
	 * @param {string} privateKey Private key in PEM format.
	 */
	static createIdentity(mspId, certificate, privateKey) {
		logger.debug('in createIdentity: mspId = ' + mspId);
		return {
			type: 'X509',
			mspId,
			certificate,
			privateKey
		};
	}

	async importIdentity(client, label, identity) {
		logger.debug('in importIdentity, label = %s', label);
		// check identity type
		const cryptoContent = {
			signedCertPEM: identity.certificate,
			privateKeyPEM: identity.privateKey
		};

		await client.createUser(
			{
				username: label,
				mspid: identity.mspId,
				cryptoContent: cryptoContent
			});
	}

	async exportIdentity(client, label) {
		logger.debug('in exportIdentity, label = %s', label);
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = X509WalletMixin.createIdentity(
				user._mspId,
				user.getIdentity()._certificate,
				user.getSigningIdentity()._signer._key.toBytes()
			);
		}
		return result;
	}

	async getIdentityInfo(client, label) {
		logger.debug('in getIdentityInfo, label = %s', label);
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

module.exports = X509WalletMixin;
