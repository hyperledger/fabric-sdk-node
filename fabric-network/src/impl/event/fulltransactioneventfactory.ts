/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Block } from 'fabric-common';
import { BlockEvent, TransactionEvent } from '../../events';
import { cachedResult } from '../gatewayutils';
import { newFullContractEvents } from './fullcontracteventfactory';
import * as TransactionStatus from './transactionstatus';
// @ts-ignore no implicit any
import protos = require('fabric-protos');

export function getTransactionEnvelopeIndexes(blockData: Block): number[] {
	const txEnvelopeIndexes: number[] = [];
	const envelopes = blockData.data.data || [];
	envelopes.forEach((envelope, index) => {
		if (isTransactionPayload(envelope.payload)) {
			txEnvelopeIndexes.push(index);
		}
	});

	return txEnvelopeIndexes;
}

function isTransactionPayload(payload: any) {
	return payload.header.channel_header.type === protos.common.HeaderType.ENDORSER_TRANSACTION;
}

export function newFullTransactionEvent(blockEvent: BlockEvent, txEnvelopeIndex: number): TransactionEvent {
	const blockMetadata: any[] = (blockEvent.blockData as Block).metadata.metadata || [];
	const transactionStatusCodes = blockMetadata[protos.common.BlockMetadataIndex.TRANSACTIONS_FILTER];

	const envelope = (blockEvent.blockData as Block).data.data[txEnvelopeIndex];
	const transactionId = envelope.payload.header.channel_header.tx_id;
	const code = transactionStatusCodes[txEnvelopeIndex];
	const status = TransactionStatus.getStatusForCode(code);

	const transactionEvent: TransactionEvent = {
		transactionId,
		status,
		transactionData: envelope.payload.data,
		isValid: status === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => blockEvent,
		getContractEvents: cachedResult(() => newFullContractEvents(transactionEvent))
	};

	return Object.freeze(transactionEvent);
}
