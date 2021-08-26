/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Checkpointer} from '../../../src/checkpointer';
import * as Long from 'long';

export class StubCheckpointer implements Checkpointer {
	private blockNumber: Long;
	private readonly transactionIds: Set<string> = new Set();

	addTransactionId(transactionId: string): Promise<void> {
		this.transactionIds.add(transactionId);
		return Promise.resolve();
	}

	getBlockNumber(): Promise<Long | undefined> {
		return Promise.resolve(this.blockNumber);
	}

	getTransactionIds(): Promise<Set<string>> {
		return Promise.resolve(this.transactionIds);
	}

	setBlockNumber(blockNumber: Long): Promise<void> {
		this.transactionIds.clear();
		this.blockNumber = blockNumber;
		return Promise.resolve();
	}
}
