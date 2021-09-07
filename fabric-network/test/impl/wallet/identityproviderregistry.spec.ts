/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {IdentityProvider} from '../../../src/impl/wallet/identityprovider';
import {newDefaultProviderRegistry, IdentityProviderRegistry} from '../../../src/impl/wallet/identityproviderregistry';

import chai = require('chai');
const expect: Chai.ExpectStatic = chai.expect;

describe('IdentityProviderRegistry', () => {
	const fakeProvider: IdentityProvider = {
		type: 'FAKE_PROVIDER',
	} as IdentityProvider;

	it('Can add a custom provider', () => {
		const provider: IdentityProviderRegistry = new IdentityProviderRegistry();
		provider.addProvider(fakeProvider);
		const result: IdentityProvider = provider.getProvider(fakeProvider.type);

		expect(result).to.equal(fakeProvider);
	});

	it('Throws for unknown provider', () => {
		const type = 'INVALID_PROVIDER_NAME';
		const provider: IdentityProviderRegistry = new IdentityProviderRegistry();
		expect(() => provider.getProvider(type))
			.to.throw(type);
	});

	it('Default registry has X.509 provider', () => {
		const provider: IdentityProviderRegistry = newDefaultProviderRegistry();
		const result: IdentityProvider = provider.getProvider('X.509');
		expect(result).to.have.property('type', 'X.509');
	});
});
