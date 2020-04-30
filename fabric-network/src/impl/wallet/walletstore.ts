/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WalletStore {
	get(label: string): Promise<Buffer | undefined>;
	list(): Promise<string[]>;
	put(label: string, data: Buffer): Promise<void>;
	remove(label: string): Promise<void>;
}
