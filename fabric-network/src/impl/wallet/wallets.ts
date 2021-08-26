/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {CouchDBWalletStore} from './couchdbwalletstore';
import {FileSystemWalletStore} from './filesystemwalletstore';
import {InMemoryWalletStore} from './inmemorywalletstore';
import {Wallet} from './wallet';

import * as nano from 'nano';

/**
 * Factory for creating wallets backed by default store implementations.
 * @memberof module:fabric-network
 */
export class Wallets {
	/**
	 * Create a wallet backed by an in-memory (non-persistent) store. Each wallet instance created will have its own
	 * private in-memory store.
	 * @returns {Promise<module:fabric-network.Wallet>} A wallet.
	 */
	public static  newInMemoryWallet(): Promise<Wallet> {
		const store = new InMemoryWalletStore();
		return Promise.resolve(new Wallet(store));
	}

	/**
	 * Create a wallet backed by the provided file system directory.
	 * @param {string} directory A directory path.
	 * @returns {Promise<module:fabric-network.Wallet>} A wallet.
	 */
	public static async newFileSystemWallet(directory: string): Promise<Wallet> {
		const store = await FileSystemWalletStore.newInstance(directory);
		return new Wallet(store);
	}

	/**
	 * Create a wallet backed by a CouchDB database.
	 * @param {string | nano.Configuration} config URL string or configuration for a CouchDB server.
	 * @param {string} [dbName=wallet] Name of a database hosted on the CouchDB server.
	 * @returns {Promise<module:fabric-network.Wallet>} A wallet.
	 */
	public static async newCouchDBWallet(config: string | nano.Configuration, dbName = 'wallet'): Promise<Wallet> {
		const store = await CouchDBWalletStore.newInstance(config, dbName);
		return new Wallet(store);
	}
}
