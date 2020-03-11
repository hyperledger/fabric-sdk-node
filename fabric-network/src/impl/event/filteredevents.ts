/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventInfo, FilteredTransaction, Endorser } from 'fabric-common';
import { ContractEvent, FilteredBlockEvent, FilteredTransactionEvent, CommitEvent } from '../../events';
// @ts-ignore no implicit any
import protos = require('fabric-protos');

function getCodeToStatusMap(): { [code: number]: string } {
	const result: { [code: number]: string } = {};
	for (const [status, code] of Object.entries(protos.protos.TxValidationCode as { [status: string]: number })) {
		result[code] = status;
	}
	return result;
}

const codeToStatusMap = getCodeToStatusMap();

export function newFilteredBlockEvent(eventInfo: EventInfo): FilteredBlockEvent {
	let transactionEvents: FilteredTransactionEvent[] | undefined;
	function getTransactionEvents(block: FilteredBlockEvent) {
		if (!transactionEvents) {
			transactionEvents = newFilteredTransactionEvents(block);
		}
		return transactionEvents;
	}

	const blockEvent: FilteredBlockEvent = {
		getType: () => 'filtered',
		getBlockNumber: () => eventInfo.blockNumber,
		getBlockData: () => eventInfo.filteredBlock!,
		getTransactionEvents: () => getTransactionEvents(blockEvent)
	};

	return blockEvent;
}

export function newCommitEvent(peer: Endorser, eventInfo: EventInfo): CommitEvent {
	const transactionId = eventInfo.transactionId!;

	let blockEvent: FilteredBlockEvent | undefined;
	function getBlockEvent() {
		if (!blockEvent) {
			blockEvent = newFilteredBlockEvent(eventInfo);
		}
		return blockEvent;
	}

	let transactionEvent: FilteredTransactionEvent | undefined;
	function getTransactionEvent() {
		if (!transactionEvent) {
			transactionEvent = getBlockEvent().getTransactionEvents().find((tx) => tx.getTransactionId() === transactionId)!;
		}
		return transactionEvent;
	}

	return {
		getPeer: () => peer,
		getBlockEvent,
		getTransactionId: () => transactionId,
		getStatus: () => eventInfo.status!,
		getContractEvents: () => getTransactionEvent().getContractEvents(),
		getTransactionData: () => getTransactionEvent().getTransactionData()
	};
}

function newFilteredTransactionEvents(blockEvent: FilteredBlockEvent): FilteredTransactionEvent[] {
	const filteredTransactions = blockEvent.getBlockData().filtered_transactions || [];
	return filteredTransactions.map((tx) => newFilteredTransactionEvent(blockEvent, tx));
}

function newFilteredTransactionEvent(blockEvent: FilteredBlockEvent, filteredTransaction: FilteredTransaction): FilteredTransactionEvent {
	const code = filteredTransaction.tx_validation_code;
	const status = codeToStatusMap[code];

	let contractEvents: ContractEvent[] | undefined;
	function getContractEvents(transaction: FilteredTransactionEvent) {
		if (!contractEvents) {
			contractEvents = newContractEvents(transaction);
		}
		return contractEvents;
	}

	const transactionEvent: FilteredTransactionEvent = {
		getBlockEvent: () => blockEvent,
		getTransactionId: () => filteredTransaction.txid,
		getStatus: () => status,
		getContractEvents: () => getContractEvents(transactionEvent),
		getTransactionData: () => filteredTransaction
	};

	return transactionEvent;
}

function newContractEvents(transactionEvent: FilteredTransactionEvent): ContractEvent[] {
	const chaincodeActions: any[] = transactionEvent.getTransactionData().transaction_actions?.chaincode_actions || [];
	return chaincodeActions.map((ccAction) => newContractEvent(transactionEvent, ccAction.chaincode_event));
}

function newContractEvent(transactionEvent: FilteredTransactionEvent, chaincodeEvent: any): ContractEvent {
	return {
		getChaincodeId: () => chaincodeEvent.chaincode_id,
		getEventName: () => chaincodeEvent.event_name,
		getPayload: () => chaincodeEvent.payload,
		getTransactionEvent: () => transactionEvent
	};
}
