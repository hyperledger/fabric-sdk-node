/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { IdentityProviderRegistry } from '../../../src/impl/wallet/identityproviderregistry';

import chai = require('chai');
const expect = chai.expect;

import { IdentityProvider } from 'fabric-network';

describe('IdentityProviderRegistry', () => {
	const fakeProvider: IdentityProvider = {
		type: 'FAKE_PROVIDER',
	} as IdentityProvider;

	it('Can add a custom provider', () => {
		const provider = new IdentityProviderRegistry();
		provider.addProvider(fakeProvider);
		const result = provider.getProvider(fakeProvider.type);

		expect(result).to.equal(fakeProvider);
	});

	it('Throws for unknown provider', () => {
		const type = 'INVALID_PROVIDER_NAME';
		const provider = new IdentityProviderRegistry();
		expect(() => provider.getProvider(type))
			.to.throw(type);
	});

	it('Has default X.509 provider', () => {
		const provider = new IdentityProviderRegistry();
		const result = provider.getProvider('X.509');
		expect(result).to.have.property('type', 'X.509');
	});
});
