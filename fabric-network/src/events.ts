/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {BlockType, Endorser} from 'fabric-common';
import * as fabproto6 from 'fabric-protos';
import {Checkpointer} from './checkpointer';
import * as Long from 'long';

export type EventType = BlockType;

export interface BlockEvent {
	readonly blockNumber: Long;
	readonly blockData: fabproto6.protos.IFilteredBlock | fabproto6.common.IBlock;
	getTransactionEvents(): TransactionEvent[];
}

export interface TransactionEvent {
	readonly transactionId: string;
	readonly status: string;
	readonly isValid: boolean;
	readonly transactionData: fabproto6.protos.ITransaction | fabproto6.protos.IFilteredTransaction;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly privateData?: any;
	getBlockEvent(): BlockEvent;
	getContractEvents(): ContractEvent[];
}

export interface ContractEvent {
	readonly chaincodeId: string;
	readonly eventName: string;
	readonly payload?: Buffer;
	getTransactionEvent(): TransactionEvent;
}

export type BlockListener = (event: BlockEvent) => Promise<void>;
export type ContractListener = (event: ContractEvent) => Promise<void>;

export interface ListenerOptions {
	startBlock?: number | string | Long;
	type?: EventType;
	checkpointer?: Checkpointer;
}

export interface CommitError extends Error {
	peer: Endorser;
}

export interface CommitEvent extends TransactionEvent {
	readonly peer: Endorser;
}

export type CommitListener = (error?: CommitError, event?: CommitEvent) => void;
