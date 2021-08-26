/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {WalletStore} from './walletstore';

export class InMemoryWalletStore implements WalletStore {
	private readonly map: Map<string, Buffer> = new Map();

	public remove(label: string): Promise<void> {
		this.map.delete(label);
		return Promise.resolve();
	}

	public get(label: string): Promise<Buffer|undefined> {
		return Promise.resolve(this.map.get(label));
	}

	public list(): Promise<string[]> {
		return Promise.resolve(Array.from(this.map.keys()));
	}

	public put(label: string, data: Buffer): Promise<void> {
		this.map.set(label, data);
		return Promise.resolve();
	}
}
