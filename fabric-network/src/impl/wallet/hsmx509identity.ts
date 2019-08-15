/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Client from 'fabric-client';

import {
	Identity,
	IdentityData,
	IdentityProvider,
} from 'fabric-network';

export interface HsmX509Identity extends Identity {
	type: 'HSM-X.509';
	credentials: {
		certificate: string;
	};
}

interface HsmX509IdentityDataV1 extends IdentityData {
	type: 'HSM-X.509';
	version: 1;
	credentials: {
		certificate: string;
	};
	mspId: string;
}

export interface HsmOptions {
	lib?: string;
	pin?: string;
	slot?: number;
	usertype?: number;
	readwrite?: boolean;
}

/**
 * Identity provider to handle X.509 identities where the private key is stored in a hardware security module.
 * @memberof module:fabric-network
 * @implements module:fabric-network.IdentityProvider
 */
export class HsmX509Provider implements IdentityProvider {
	public readonly type = 'HSM-X.509';
	private readonly options: any;

	/**
	 * Create a provider instance.
	 * @param {module:fabric-network.HsmOptions} [options={}] Options specifying how to connect to the HSM. Mandatory
	 * unless this information is provided through external configuration.
	 */
	public constructor(options: HsmOptions = {}) {
		this.options = {};
		Object.assign(this.options, options);
		this.options.software = false; // Must be set to enable HSM
	}

	public fromJson(data: IdentityData): HsmX509Identity {
		if (data.type !== this.type) {
			throw new Error('Invalid identity type: ' + data.type);
		}

		if (data.version === 1) {
			const x509Data = data as HsmX509IdentityDataV1;
			return {
				credentials: {
					certificate: x509Data.credentials.certificate,
				},
				mspId: x509Data.mspId,
				type: 'HSM-X.509',
			};
		} else {
			throw new Error('Unsupported identity version: ' + data.version);
		}
	}

	public toJson(identity: HsmX509Identity): IdentityData {
		const data: HsmX509IdentityDataV1 = {
			credentials: {
				certificate: identity.credentials.certificate,
			},
			mspId: identity.mspId,
			type: 'HSM-X.509',
			version: 1,
		};
		return data;
	}

	public async setUserContext(client: Client, identity: HsmX509Identity, name: string): Promise<void> {
		const cryptoSuite = Client.newCryptoSuite(this.options);
		client.setCryptoSuite(cryptoSuite);

		const publicKey = await cryptoSuite.importKey(identity.credentials.certificate);
		const privateKeyObj = await cryptoSuite.getKey(publicKey.getSKI());

		const userData: Client.UserOpts = {
			cryptoContent: {
				privateKeyObj,
				signedCertPEM: identity.credentials.certificate,
			},
			mspid: identity.mspId,
			skipPersistence: true,
			username: name,
		};
		const user = await client.createUser(userData);
		client.setUserContext(user, true);
	}
}
