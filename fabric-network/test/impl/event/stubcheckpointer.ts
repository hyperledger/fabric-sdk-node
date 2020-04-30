/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Checkpointer } from '../../../src/checkpointer';
import Long = require('long');

export class StubCheckpointer implements Checkpointer {
	private blockNumber: Long;
	private readonly transactionIds: Set<string> = new Set();

	async addTransactionId(transactionId: string): Promise<void> {
		this.transactionIds.add(transactionId);
	}

	async getBlockNumber(): Promise<Long | undefined> {
		return this.blockNumber;
	}

	async getTransactionIds(): Promise<Set<string>> {
		return this.transactionIds;
	}

	async setBlockNumber(blockNumber: Long): Promise<void> {
		this.transactionIds.clear();
		this.blockNumber = blockNumber;
	}
}
