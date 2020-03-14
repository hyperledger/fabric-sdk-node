/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventInfo, FilteredTransaction } from 'fabric-common';
import { FilteredBlockEvent, FilteredContractEvent, FilteredTransactionEvent, FullBlockEvent, FullTransactionEvent, FullContractEvent } from '../../events';
import * as TransactionStatus from './transactionstatus';
import util = require('util');
// @ts-ignore no implicit any
import protos = require('fabric-protos');

export function newFullBlockEvent(eventInfo: EventInfo): FullBlockEvent {
	if (!eventInfo.block) {
		throw new Error('No block data found: ' + util.inspect(eventInfo));
	}

	let transactionEvents: FullTransactionEvent[] | undefined;
	function getTransactionEvents(block: FullBlockEvent) {
		if (!transactionEvents) {
			transactionEvents = newFullTransactionEvents(block);
		}
		return transactionEvents;
	}

	const blockEvent: FullBlockEvent = {
		type: 'full',
		blockNumber: eventInfo.blockNumber,
		blockData: eventInfo.block,
		getTransactionEvents: () => getTransactionEvents(blockEvent)
	};

	return Object.freeze(blockEvent);
}

function newFullTransactionEvents(blockEvent: FullBlockEvent): FullTransactionEvent[] {
	const txEnvelopeIndexes: number[] = [];
	const envelopes = blockEvent.blockData.data.data || [];
	envelopes.forEach((envelope, index) => {
		if (isTransactionPayload(envelope.payload)) {
			txEnvelopeIndexes.push(index);
		}
	});

	return txEnvelopeIndexes.map((index) => newFullTransactionEvent(blockEvent, index));
}

function isTransactionPayload(payload: any) {
	return payload.header.channel_header.type === protos.common.HeaderType.ENDORSER_TRANSACTION;
}

function newFullTransactionEvent(blockEvent: FullBlockEvent, txEnvelopeIndex: number): FullTransactionEvent {
	const blockMetadata: any[] = blockEvent.blockData.metadata.metadata || [];
	const transactionStatusCodes = blockMetadata[protos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];

	const envelope = blockEvent.blockData.data.data[txEnvelopeIndex];
	const transactionId = envelope.payload.header.channel_header.tx_id;
	const code = transactionStatusCodes[txEnvelopeIndex];
	const status = TransactionStatus.getStatusForCode(code);

	let contractEvents: FullContractEvent[] | undefined;
	function getContractEvents(transaction: FullTransactionEvent) {
		if (!contractEvents) {
			contractEvents = newFullContractEvents(transaction);
		}
		return contractEvents;
	}

	const transactionEvent: FullTransactionEvent = {
		type: 'full',
		transactionId,
		status,
		transactionData: envelope.payload.data,
		isValid: status === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => blockEvent,
		getContractEvents: () => getContractEvents(transactionEvent)
	};

	return Object.freeze(transactionEvent);
}

function newFullContractEvents(transactionEvent: FullTransactionEvent): FullContractEvent[] {
	const transactionActions: any[] = transactionEvent.transactionData.actions || [];
	return transactionActions.map((transactionAction) => {
		const chaincodeEvent = transactionAction.payload.action.proposal_response_payload.extension.events;
		return newFullContractEvent(transactionEvent, chaincodeEvent);
	});
}

function newFullContractEvent(transactionEvent: FullTransactionEvent, chaincodeEvent: any): FullContractEvent {
	const contractEvent: FullContractEvent = {
		type: 'full',
		chaincodeId: chaincodeEvent.chaincode_id,
		eventName: chaincodeEvent.event_name,
		payload: chaincodeEvent.payload,
		getTransactionEvent: () => transactionEvent
	};
	return Object.freeze(contractEvent);
}
