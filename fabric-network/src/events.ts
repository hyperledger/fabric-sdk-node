/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilteredBlock, FilteredTransaction, Endorser, EventInfo } from 'fabric-common';
import Long = require('long');

export interface BlockEvent {
	readonly type: 'filtered' | 'full' | 'private';
	readonly blockNumber: Long;
	getTransactionEvents(): TransactionEvent[];
}

export interface FilteredBlockEvent extends BlockEvent {
	readonly type: 'filtered';
	readonly blockData: FilteredBlock;
	getTransactionEvents(): FilteredTransactionEvent[];
}

export interface TransactionEvent {
	readonly transactionId: string;
	readonly status: string;
	readonly isValid: boolean;
	getBlockEvent(): BlockEvent;
	getContractEvents(): ContractEvent[];
}

export interface FilteredTransactionEvent extends TransactionEvent {
	readonly transactionData: FilteredTransaction;
	getBlockEvent(): FilteredBlockEvent;
}

export interface ContractEvent {
	readonly chaincodeId: string;
	readonly eventName: string;
	readonly payload: Buffer;
	getTransactionEvent(): TransactionEvent;
}

export type BlockListener = (event: BlockEvent) => Promise<void>;
export type ContractListener = (event: ContractEvent) => Promise<void>;

export interface ListenerOptions {
	startBlock?: number | string | Long;
}

export interface CommitError extends Error {
	peer: Endorser;
}

export interface CommitEvent extends FilteredTransactionEvent {
	readonly peer: Endorser;
}

export type CommitListener = (error?: CommitError, event?: CommitEvent) => void;
