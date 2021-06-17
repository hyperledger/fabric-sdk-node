/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImportMock, MockManager } from 'ts-mock-imports';
import {
	HsmX509Identity,
	HsmX509Provider
} from '../../../src/impl/wallet/hsmx509identity';
import { Identity } from '../../../src/impl/wallet/identity';
import { IdentityData } from '../../../src/impl/wallet/identitydata';
import { IdentityProvider } from '../../../src/impl/wallet/identityprovider';
import {
	X509Identity,
	X509Provider,
} from '../../../src/impl/wallet/x509identity';

import { Utils } from 'fabric-common';
const fakeCryptoSuite = {
	getKeySize: () => {
		return 256;
	}
}
ImportMock.mockFunction(Utils, 'newCryptoSuite', fakeCryptoSuite);
import chai = require('chai');
import { consoleTestResultHandler } from 'tslint/lib/test';
const expect: Chai.ExpectStatic = chai.expect;


type ProviderData = {
	dataVersions: { [version: string]: IdentityData };
	provider: IdentityProvider;
} & (
	| {identityVersions: { [version: string]: Identity}; identity?: never}
	| {identityVersions?: never; identity: Identity}
)

describe('IdentityProvider', () => {
	const hsmIdentityv3: HsmX509Identity = {
		credentials: {
			certificate: 'CERTIFICATE',
			identifier: 'PRIVATE_HANDLE'
		},
		mspId: 'alice',
		type: 'HSM-X.509',
	};

	const hsmIdentity: HsmX509Identity = {
		credentials: {
			certificate: 'CERTIFICATE',
			identifier: ''
		},
		mspId: 'alice',
		type: 'HSM-X.509',
	};


	const x509Identity: X509Identity = {
		credentials: {
			certificate: 'CERTIFICATE',
			privateKey: 'PRIVATE_KEY',
		},
		mspId: 'alice',
		type: 'X.509',
	};

	const providers: { [name: string]: ProviderData } = {
		HsmX509: {
			dataVersions: {
				v3: {
					credentials: {
						certificate: hsmIdentityv3.credentials.certificate,
						identifier: hsmIdentityv3.credentials.identifier
					},
					mspId: hsmIdentityv3.mspId,
					type: hsmIdentityv3.type,
					version: 3,
				} as IdentityData,
				v2: {
					credentials: {
						certificate: hsmIdentity.credentials.certificate,
						privateKey: 'PRIVATE_HANDLE'
					},
					mspId: hsmIdentity.mspId,
					type: hsmIdentity.type,
					version: 2,
				} as IdentityData,
				v1: {
					credentials: {
						certificate: hsmIdentity.credentials.certificate,
					},
					mspId: hsmIdentity.mspId,
					type: hsmIdentity.type,
					version: 1,
				} as IdentityData,
			},
			identityVersions: {
				v3: hsmIdentityv3,
				v2: hsmIdentity,
				v1: hsmIdentity
			},
			provider: new HsmX509Provider({
				lib: 'fakepath',
				pin: '1234',
				slot: 0,
			}),
		},
		X509: {
			dataVersions: {
				v1: {
					credentials: {
						certificate: x509Identity.credentials.certificate,
						privateKey: x509Identity.credentials.privateKey,
					},
					mspId: x509Identity.mspId,
					type: x509Identity.type,
					version: 1,
				} as IdentityData,
			},
			identity: x509Identity,
			provider: new X509Provider(),
		},
	};

	Object.keys(providers).forEach((providerName: string) => describe(providerName + ' common behaviour', () => {
		const providerData: ProviderData = providers[providerName];
		const provider: IdentityProvider = providerData.provider;

		Object.keys(providerData.dataVersions).forEach((dataVersion: string) => describe(dataVersion, () => {
			let identityData: any;
			let identity: Identity;

			beforeEach(() => {
				identityData = providerData.dataVersions[dataVersion];
				identity = providerData.identityVersions && providerData.identityVersions[dataVersion] || providerData.identity;
			});

			it('Identity created from JSON', () => {
				const result: Identity = provider.fromJson(identityData);
				expect(result).to.deep.equal(identity);
			});

			it('Throws for JSON with no version', () => {
				delete identityData.version;
				expect(() => provider.fromJson(identityData))
					.to.throw('Unsupported identity version: undefined');
			});

			it('Throws for JSON with unsupported version', () => {
				identityData.version = Number.MAX_SAFE_INTEGER;
				expect(() => provider.fromJson(identityData))
					.to.throw('Unsupported identity version: ' + Number.MAX_SAFE_INTEGER);
			});

			it('Throws for JSON with incorrect type', () => {
				identityData.type = 'not-my-type';
				expect(() => provider.fromJson(identityData))
					.to.throw(identityData.type);
			});

			it('Identity serializes to JSON that can be used to recreate the identity', () => {
				const json: IdentityData = provider.toJson(identity);
				const result: Identity = provider.fromJson(json);

				expect(result).to.deep.equal(identity);
			});

			it('getUserContext fails with message containing missing identity', async () => {
				try {
					await provider.getUserContext(undefined, 'dummy');
				} catch (error) {
					expect(error.message).to.contain('X.509 identity is missing');
				}
			});

			it('getUserContext fails with message containing missing identity credentials', async () => {
				try {
					await provider.getUserContext({} as any, 'dummy');
				} catch (error) {
					expect(error.message).to.contain('X.509 identity is missing the credential data');
				}
			});

			it('getUserContext fails with message containing missing identity credential privateKey or identifier', async () => {
				try {
					await provider.getUserContext({credentials: {}} as any, 'dummy');
				} catch (error) {
					expect(error.message).to.contain('X.509 identity data is missing the');
				}
			});

			(providerName === 'HsmX509' ? it.skip : it)('getUserContext fails with message containing missing identity credential privateKey', async () => {
				try {
					await provider.getUserContext({credentials: {privateKey: ''}} as any, 'dummy');
				} catch (error) {
					expect(error.message).to.contain('X.509 identity data is missing the private key');
				}
			});

			(providerName !== 'HsmX509' ? it.skip : it)('getUserContext fails with message containing missing identity credential identifier', async () => {
				try {
					await provider.getUserContext({credentials: {identifier: ''}} as any, 'dummy');
				} catch (error) {
					expect(error.message).to.contain('X.509 identity data is missing the identifier');
				}
			});

		}));
	}));
});
