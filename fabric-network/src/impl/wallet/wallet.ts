/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Identity} from './identity';
import {IdentityData} from './identitydata';
import {IdentityProviderRegistry, newDefaultProviderRegistry} from './identityproviderregistry';
import {WalletStore} from './walletstore';

const encoding = 'utf8';

/**
 * Stores identity information for use when connecting a Gateway. The wallet is backed by a store that handles
 * persistence of identity information. Default implementations using various stores can be obtained using static
 * factory functions on [Wallets]{@link module:fabric-network.Wallets}.
 * @memberof module:fabric-network
 */
export class Wallet {
	private readonly providerRegistry = newDefaultProviderRegistry();
	private readonly store: WalletStore;

	/**
	 * Create a wallet instance backed by a given store. This can be used to create a wallet using your own
	 * custom store implementation.
	 * @param {module:fabric-network.WalletStore} store Backing store implementation.
	 */
	public constructor(store: WalletStore) {
		this.store = store;
	}

	/**
	 * Put an identity in the wallet.
	 * @param {string} label Label used to identify the identity within the wallet.
	 * @param {module:fabric-network.Identity} identity Identity to store in the wallet.
	 * @returns {Promise<void>}
	 */
	public async put(label: string, identity: Identity): Promise<void> {
		const json = this.providerRegistry.getProvider(identity.type).toJson(identity);
		const jsonString = JSON.stringify(json);
		const buffer = Buffer.from(jsonString, encoding) ;
		await this.store.put(label, buffer);
	}

	/**
	 * Get an identity from the wallet. The actual properties of this identity object will vary depending on its type.
	 * @param label Label used to identify the identity within the wallet.
	 * @returns {Promise<module:fabric-network.Identity|undefined>} An identity if it exists; otherwise undefined.
	 */
	public async get(label: string): Promise<Identity|undefined> {
		const buffer = await this.store.get(label);
		if (!buffer) {
			return undefined;
		}
		const jsonString = buffer.toString(encoding);
		const json = JSON.parse(jsonString) as IdentityData;
		return this.providerRegistry.getProvider(json.type).fromJson(json);
	}

	/**
	 * Get the labels of all identities in the wallet.
	 * @returns {Promise<string[]>} Identity labels.
	 */
	public async list(): Promise<string[]> {
		return await this.store.list();
	}

	/**
	 * Remove an identity from the wallet.
	 * @param label Label used to identify the identity within the wallet.
	 * @returns {Promise<void>}
	 */
	public async remove(label: string): Promise<void> {
		await this.store.remove(label);
	}

	/**
	 * Get the identity provider registry for this wallet. All identity types stored in the wallet must have a
	 * corresponding provider in the registry.
	 * @returns {module:fabric-network.IdentityProviderRegistry} An identity provider registry.
	 */
	public getProviderRegistry(): IdentityProviderRegistry {
		return this.providerRegistry;
	}
}
