/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Client from 'fabric-client';

import { Identity } from './identity';
import { IdentityData } from './identitydata';
import { IdentityProvider } from './identityprovider';

export interface X509Identity extends Identity {
	type: 'X.509';
	credentials: {
		certificate: string;
		privateKey: string;
	};
}

interface X509IdentityDataV1 extends IdentityData {
	type: 'X.509';
	version: 1;
	credentials: {
		certificate: string;
		privateKey: string;
	};
	mspId: string;
}

export class X509Provider implements IdentityProvider {
	public readonly type: string = 'X.509';

	public fromJson(data: IdentityData): X509Identity {
		if (data.type !== this.type) {
			throw new Error('Invalid identity type: ' + data.type);
		}

		if (data.version === 1) {
			const x509Data: X509IdentityDataV1 = data as X509IdentityDataV1;
			return {
				credentials: {
					certificate: x509Data.credentials.certificate,
					privateKey: x509Data.credentials.privateKey,
				},
				mspId: x509Data.mspId,
				type: 'X.509',
			};
		} else {
			throw new Error('Unsupported identity version: ' + data.version);
		}
	}

	public toJson(identity: X509Identity): IdentityData {
		const data: X509IdentityDataV1 = {
			credentials: {
				certificate: identity.credentials.certificate,
				privateKey: identity.credentials.privateKey,
			},
			mspId: identity.mspId,
			type: 'X.509',
			version: 1,
		};
		return data;
	}

	public async setUserContext(client: Client, identity: X509Identity, name: string): Promise<void> {
		const userData: Client.UserOpts = {
			cryptoContent: {
				privateKeyPEM: identity.credentials.privateKey,
				signedCertPEM: identity.credentials.certificate,
			},
			mspid: identity.mspId,
			skipPersistence: true,
			username: name,
		};
		const user: Client.User = await client.createUser(userData);
		client.setUserContext(user, true);
	}
}
