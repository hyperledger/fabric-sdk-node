/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WalletStore {
	delete(label: string): Promise<void>;
	get(label: string): Promise<Buffer | undefined>;
	list(): Promise<string[]>;
	put(label: string, data: Buffer): Promise<void>;
}
