/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { WalletStore } from './walletstore';

export class InMemoryWalletStore implements WalletStore {
	private readonly map: Map<string, Buffer> = new Map();

	public async remove(label: string): Promise<void> {
		this.map.delete(label);
	}

	public async get(label: string): Promise<Buffer|undefined> {
		return this.map.get(label);
	}

	public async list(): Promise<string[]> {
		return Array.from(this.map.keys());
	}

	public async put(label: string, data: Buffer): Promise<void> {
		this.map.set(label, data);
	}
}
