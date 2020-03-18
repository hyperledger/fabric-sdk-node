/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventInfo, FilteredBlock, FilteredTransaction } from 'fabric-common';
import { BlockEvent, ContractEvent, TransactionEvent } from '../../events';
import { cachedResult } from '../gatewayutils';
import * as TransactionStatus from './transactionstatus';
import util = require('util');

export function newFilteredBlockEvent(eventInfo: EventInfo): BlockEvent {
	if (!eventInfo.filteredBlock) {
		throw new Error('No block data found: ' + util.inspect(eventInfo));
	}

	const blockEvent: BlockEvent = {
		blockNumber: eventInfo.blockNumber,
		blockData: eventInfo.filteredBlock,
		getTransactionEvents: cachedResult(() => newFilteredTransactionEvents(blockEvent))
	};

	return Object.freeze(blockEvent);
}

function newFilteredTransactionEvents(blockEvent: BlockEvent): TransactionEvent[] {
	const filteredTransactions = (blockEvent.blockData as FilteredBlock).filtered_transactions || [];
	return filteredTransactions.map((tx) => newFilteredTransactionEvent(blockEvent, tx));
}

function newFilteredTransactionEvent(blockEvent: BlockEvent, filteredTransaction: FilteredTransaction): TransactionEvent {
	const transactionEvent: TransactionEvent = {
		transactionId: filteredTransaction.txid,
		status: filteredTransaction.tx_validation_code,
		transactionData: filteredTransaction,
		isValid: filteredTransaction.tx_validation_code === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => blockEvent,
		getContractEvents: cachedResult(() => newFilteredContractEvents(transactionEvent))
	};

	return Object.freeze(transactionEvent);
}

function newFilteredContractEvents(transactionEvent: TransactionEvent): ContractEvent[] {
	const chaincodeActions: any[] = transactionEvent.transactionData.transaction_actions?.chaincode_actions || [];
	return chaincodeActions.map((ccAction) => newFilteredContractEvent(transactionEvent, ccAction.chaincode_event));
}

function newFilteredContractEvent(transactionEvent: TransactionEvent, chaincodeEvent: any): ContractEvent {
	const contractEvent: ContractEvent = {
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		getTransactionEvent: () => transactionEvent
	};

	return Object.freeze(contractEvent);
}
