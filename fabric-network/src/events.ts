/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilteredBlock, FilteredTransaction, Endorser, Block, BlockType } from 'fabric-common';
import Long = require('long');

export type EventType = BlockType;

export interface BlockEvent {
	readonly type: EventType;
	readonly blockNumber: Long;
	getTransactionEvents(): TransactionEvent[];
}

export interface FilteredBlockEvent extends BlockEvent {
	readonly type: 'filtered';
	readonly blockData: FilteredBlock;
	getTransactionEvents(): FilteredTransactionEvent[];
}

export interface FullBlockEvent extends BlockEvent {
	readonly type: 'full';
	readonly blockData: Block;
	getTransactionEvents(): FullTransactionEvent[];
}

export interface TransactionEvent {
	readonly type: EventType;
	readonly transactionId: string;
	readonly status: string;
	readonly isValid: boolean;
	getBlockEvent(): BlockEvent;
	getContractEvents(): ContractEvent[];
}

export interface FilteredTransactionEvent extends TransactionEvent {
	readonly type: 'filtered';
	readonly transactionData: FilteredTransaction;
	getBlockEvent(): FilteredBlockEvent;
	getContractEvents(): FilteredContractEvent[];
}

export interface FullTransactionEvent extends TransactionEvent {
	readonly type: 'full';
	readonly transactionData: any;
	getBlockEvent(): FullBlockEvent;
	getContractEvents(): FullContractEvent[];
}

export interface ContractEvent {
	readonly type: EventType;
	readonly chaincodeId: string;
	readonly eventName: string;
	readonly payload?: Buffer;
	getTransactionEvent(): TransactionEvent;
}

export interface FilteredContractEvent extends ContractEvent {
	readonly type: 'filtered';
	readonly payload: undefined;
	getTransactionEvent(): FilteredTransactionEvent;
}

export interface FullContractEvent extends ContractEvent {
	readonly type: 'full';
	readonly payload: Buffer;
	getTransactionEvent(): FullTransactionEvent;
}

export type BlockListener = (event: BlockEvent) => Promise<void>;
export type ContractListener = (event: ContractEvent) => Promise<void>;

export interface ListenerOptions {
	startBlock?: number | string | Long;
	type?: EventType;
}

export interface CommitError extends Error {
	peer: Endorser;
}

export interface CommitEvent extends FilteredTransactionEvent {
	readonly peer: Endorser;
}

export type CommitListener = (error?: CommitError, event?: CommitEvent) => void;
