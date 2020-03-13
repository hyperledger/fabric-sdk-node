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
const validStatus = 'VALID';

export function newFilteredBlockEvent(eventInfo: EventInfo): FilteredBlockEvent {
	let transactionEvents: FilteredTransactionEvent[] | undefined;
	function getTransactionEvents(block: FilteredBlockEvent) {
		if (!transactionEvents) {
			transactionEvents = newFilteredTransactionEvents(block);
		}
		return transactionEvents;
	}

	const blockEvent: FilteredBlockEvent = {
		type: 'filtered',
		blockNumber: eventInfo.blockNumber,
		blockData: eventInfo.filteredBlock!,
		getTransactionEvents: () => getTransactionEvents(blockEvent)
	};

	return Object.freeze(blockEvent);
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
			transactionEvent = getBlockEvent().getTransactionEvents().find((tx) => tx.transactionId === transactionId)!;
		}
		return transactionEvent;
	}

	const commitEvent: CommitEvent = {
		peer: peer,
		transactionId: transactionId,
		status: eventInfo.status!,
		get transactionData() {
			return getTransactionEvent().transactionData;
		},
		isValid: eventInfo.status === validStatus,
		getBlockEvent: () => getBlockEvent(),
		getContractEvents: () => getTransactionEvent().getContractEvents()
	};

	return Object.freeze(commitEvent);
}

function newFilteredTransactionEvents(blockEvent: FilteredBlockEvent): FilteredTransactionEvent[] {
	const filteredTransactions = blockEvent.blockData.filtered_transactions || [];
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
		transactionId: filteredTransaction.txid,
		status,
		transactionData: filteredTransaction,
		isValid: status === validStatus,
		getBlockEvent: () => blockEvent,
		getContractEvents: () => getContractEvents(transactionEvent)
	};

	return transactionEvent;
}

function newContractEvents(transactionEvent: FilteredTransactionEvent): ContractEvent[] {
	const chaincodeActions: any[] = transactionEvent.transactionData.transaction_actions?.chaincode_actions || [];
	return chaincodeActions.map((ccAction) => newContractEvent(transactionEvent, ccAction.chaincode_event));
}

function newContractEvent(transactionEvent: FilteredTransactionEvent, chaincodeEvent: any): ContractEvent {
	return {
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		payload: chaincodeEvent.payload,
		getTransactionEvent: () => transactionEvent
	};
}
