/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ICryptoSuite, Pkcs11EcdsaKey, User } from 'fabric-common';

import { Identity } from './identity';
import { IdentityData } from './identitydata';
import { IdentityProvider } from './identityprovider';

import * as Logger from '../../logger';
const logger = Logger.getLogger('HsmX509Identity');

export interface HsmX509Identity extends Identity {
	type: 'HSM-X.509';
	credentials: {
		certificate: string;
		privateKey: string;
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

interface HsmX509IdentityDataV2 extends IdentityData {
	type: 'HSM-X.509';
	version: 2;
	credentials: {
		certificate: string;
		privateKey: string; // the HSM handle to the key
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
	public readonly type: string = 'HSM-X.509';
	private readonly options: any;
	private readonly cryptoSuite: ICryptoSuite;

	/**
	 * Create a provider instance.
	 * @param {module:fabric-network.HsmOptions} [options={}] Options specifying how to connect to the HSM. Mandatory
	 * unless this information is provided through external configuration.
	 */
	public constructor(options: HsmOptions = {}) {
		this.options = {};
		Object.assign(this.options, options);
		this.options.software = false; // Must be set to enable HSM
		this.cryptoSuite = User.newCryptoSuite(this.options);
	}

	public getCryptoSuite(): ICryptoSuite {
		return this.cryptoSuite;
	}

	public fromJson(data: IdentityData): HsmX509Identity {
		if (data.type !== this.type) {
			throw new Error('Invalid identity type: ' + data.type);
		}

		if (data.version === 2) {
			const x509Data: HsmX509IdentityDataV2 = data as HsmX509IdentityDataV2;
			return {
				credentials: {
					certificate: x509Data.credentials.certificate,
					privateKey: x509Data.credentials.privateKey,
				},
				mspId: x509Data.mspId,
				type: 'HSM-X.509',
			};
		} else if (data.version === 1) {
			const x509Data: HsmX509IdentityDataV1 = data as HsmX509IdentityDataV1;
			logger.error('HSM-X.509 identity data is missing the privateKey handle. This credential must be saved using v2 format');
			return {
				credentials: {
					certificate: x509Data.credentials.certificate,
					privateKey: '' // force dummy in to fail later
				},
				mspId: x509Data.mspId,
				type: 'HSM-X.509',
			};
		} else {
			throw new Error('Unsupported identity version: ' + data.version);
		}
	}

	public toJson(identity: HsmX509Identity): IdentityData {
		const data: HsmX509IdentityDataV2 = {
			credentials: {
				certificate: identity.credentials.certificate,
				privateKey: identity.credentials.privateKey
			},
			mspId: identity.mspId,
			type: 'HSM-X.509',
			version: 2,
		};
		return data;
	}

	public async getUserContext(identity: HsmX509Identity, name: string): Promise<User> {
		if (!identity) {
			throw Error('HSM X.509 identity is missing');
		} else if (!identity.credentials) {
			throw Error('HSM X.509 identity is missing the credential data.');
		} else if (!identity.credentials.privateKey) {
			throw Error('HSM X.509 identity data is missing the private key handle. Check that the data has been saved to the wallet in v2 format');
		}
		const user = new User(name);
		user.setCryptoSuite(this.cryptoSuite);
		const handle = Buffer.from(identity.credentials.privateKey, 'hex');
		const privateKey = new Pkcs11EcdsaKey({priv: handle}, this.cryptoSuite.getKeySize());
		await user.setEnrollment(privateKey, identity.credentials.certificate, identity.mspId);

		return user;
	}
}
