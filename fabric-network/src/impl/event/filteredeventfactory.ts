/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventInfo, FilteredTransaction, Endorser } from 'fabric-common';
import { FilteredContractEvent, FilteredBlockEvent, FilteredTransactionEvent, CommitEvent } from '../../events';
import * as TransactionStatus from './transactionstatus';
import util = require('util');

export function newFilteredBlockEvent(eventInfo: EventInfo): FilteredBlockEvent {
	if (!eventInfo.filteredBlock) {
		throw new Error('No block data found: ' + util.inspect(eventInfo));
	}

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
		blockData: eventInfo.filteredBlock,
		getTransactionEvents: () => getTransactionEvents(blockEvent)
	};

	return Object.freeze(blockEvent);
}

function newFilteredTransactionEvents(blockEvent: FilteredBlockEvent): FilteredTransactionEvent[] {
	const filteredTransactions = blockEvent.blockData.filtered_transactions || [];
	return filteredTransactions.map((tx) => newFilteredTransactionEvent(blockEvent, tx));
}

function newFilteredTransactionEvent(blockEvent: FilteredBlockEvent, filteredTransaction: FilteredTransaction): FilteredTransactionEvent {
	let contractEvents: FilteredContractEvent[] | undefined;
	function getContractEvents(transaction: FilteredTransactionEvent) {
		if (!contractEvents) {
			contractEvents = newFilteredContractEvents(transaction);
		}
		return contractEvents;
	}

	const transactionEvent: FilteredTransactionEvent = {
		type: 'filtered',
		transactionId: filteredTransaction.txid,
		status: filteredTransaction.tx_validation_code,
		transactionData: filteredTransaction,
		isValid: filteredTransaction.tx_validation_code === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => blockEvent,
		getContractEvents: () => getContractEvents(transactionEvent)
	};

	return Object.freeze(transactionEvent);
}

function newFilteredContractEvents(transactionEvent: FilteredTransactionEvent): FilteredContractEvent[] {
	const chaincodeActions: any[] = transactionEvent.transactionData.transaction_actions?.chaincode_actions || [];
	return chaincodeActions.map((ccAction) => newFilteredContractEvent(transactionEvent, ccAction.chaincode_event));
}

function newFilteredContractEvent(transactionEvent: FilteredTransactionEvent, chaincodeEvent: any): FilteredContractEvent {
	const contractEvent: FilteredContractEvent = {
		type: 'filtered',
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		getTransactionEvent: () => transactionEvent
	};
	return Object.freeze(contractEvent);
}
