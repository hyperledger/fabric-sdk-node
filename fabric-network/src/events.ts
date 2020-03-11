/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilteredBlock, FilteredTransaction, Endorser, EventInfo } from 'fabric-common';
import Long = require('long');

export interface BlockEvent {
	getType(): 'filtered' | 'full' | 'private';
	getBlockNumber(): Long;
	getTransactionEvents(): TransactionEvent[];
}

export interface FilteredBlockEvent extends BlockEvent {
	getType(): 'filtered';
	getBlockData(): FilteredBlock;
	getTransactionEvents(): FilteredTransactionEvent[];
}

export interface TransactionEvent {
	getTransactionId(): string;
	getStatus(): string;
	getBlockEvent(): BlockEvent;
	getContractEvents(): ContractEvent[];
	isValid(): boolean;
}

export interface FilteredTransactionEvent extends TransactionEvent {
	getTransactionData(): FilteredTransaction;
	getBlockEvent(): FilteredBlockEvent;
}

export interface ContractEvent {
	getChaincodeId(): string;
	getEventName(): string;
	getPayload(): Buffer;
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
	getPeer(): Endorser;
}

export type CommitListener = (error?: CommitError, event?: CommitEvent) => void;
