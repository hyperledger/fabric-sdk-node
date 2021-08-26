/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {IdentityProvider} from './identityprovider';
import {X509Provider} from './x509identity';

const defaultProviders: IdentityProvider[] = [
	new X509Provider(),
];

/**
 * Registry of identity providers for use by a wallet.
 * @memberof module:fabric-network
 */
export class IdentityProviderRegistry {
	private readonly providers: Map<string, IdentityProvider> = new Map();

	/**
	 * Get the provider for a given type from the registry. Throws an error if no provider for the type exists.
	 * @param {string} type Identity type identifier.
	 * @returns {module:fabric-network.IdentityProvider} An identity provider.
	 */
	public getProvider(type: string): IdentityProvider {
		const provider: IdentityProvider | undefined = this.providers.get(type);
		if (!provider) {
			throw new Error('Unknown identity type: ' + type);
		}
		return provider;
	}

	/**
	 * Add a provider to the registry.
	 * @param {module:fabric-network.IdentityProvider} provider Identity provider.
	 */
	public addProvider(provider: IdentityProvider): void {
		this.providers.set(provider.type, provider);
	}
}

export function newDefaultProviderRegistry(): IdentityProviderRegistry {
	const registry = new IdentityProviderRegistry();
	defaultProviders.forEach((provider) => registry.addProvider(provider));
	return registry;
}
