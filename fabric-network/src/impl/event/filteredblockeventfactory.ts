/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EventInfo} from 'fabric-common';
import * as fabproto6 from 'fabric-protos';
import {BlockEvent, ContractEvent, TransactionEvent} from '../../events';
import {cachedResult} from '../gatewayutils';
import * as TransactionStatus from './transactionstatus';
import * as util from 'util';

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
	const filteredTransactions = (blockEvent.blockData as fabproto6.protos.IFilteredBlock).filtered_transactions || [];
	return filteredTransactions.map((tx) => newFilteredTransactionEvent(blockEvent, tx));
}

function newFilteredTransactionEvent(blockEvent: BlockEvent, filteredTransaction: fabproto6.protos.IFilteredTransaction): TransactionEvent {
	const status = TransactionStatus.getStatusForCode(filteredTransaction.tx_validation_code as number);
	const transactionEvent: TransactionEvent = {
		transactionId: filteredTransaction.txid as string,
		status: status,
		transactionData: filteredTransaction,
		isValid: status === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => blockEvent,
		getContractEvents: cachedResult(() => newFilteredContractEvents(transactionEvent))
	};

	return Object.freeze(transactionEvent);
}

function newFilteredContractEvents(transactionEvent: TransactionEvent): ContractEvent[] {
	const chaincodeActions: fabproto6.protos.IFilteredChaincodeAction[] =
		(transactionEvent.transactionData as fabproto6.protos.IFilteredTransaction).transaction_actions?.chaincode_actions || [];
	return chaincodeActions.map((ccAction) => newFilteredContractEvent(transactionEvent,
		ccAction.chaincode_event as fabproto6.protos.IChaincodeEvent));
}

function newFilteredContractEvent(transactionEvent: TransactionEvent, chaincodeEvent: fabproto6.protos.IChaincodeEvent): ContractEvent {
	const contractEvent: ContractEvent = {
		chaincodeId: chaincodeEvent.chaincode_id as string,
		eventName: chaincodeEvent.event_name as string,
		getTransactionEvent: () => transactionEvent
	};

	return Object.freeze(contractEvent);
}
