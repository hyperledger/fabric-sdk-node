/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Long from 'long';

export interface Checkpointer {
	addTransactionId(transactionId: string): Promise<void>;
	getBlockNumber(): Promise<Long | undefined>;
	getTransactionIds(): Promise<Set<string>>;
	setBlockNumber(blockNumber: Long): Promise<void>;
}
