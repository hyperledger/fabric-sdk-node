
/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as fabproto6 from 'fabric-protos';
import {BlockEvent, TransactionEvent} from '../../events';
import {cachedResult} from '../gatewayutils';
import {newFullContractEvents} from './fullcontracteventfactory';
import * as TransactionStatus from './transactionstatus';

export function getTransactionEnvelopeIndexes(blockData: fabproto6.common.IBlock): number[] {
	const txEnvelopeIndexes: number[] = [];
	if (blockData.data) {
		const envelopes: any[] = blockData.data.data || [];
		envelopes.forEach((envelope: any, index: number) => {
			if (isTransactionPayload(envelope.payload)) {
				txEnvelopeIndexes.push(index);
			}
		});
	}

	return txEnvelopeIndexes;
}

function isTransactionPayload(payload: any) {
	return payload.header.channel_header.type === fabproto6.common.HeaderType.ENDORSER_TRANSACTION;
}

export function newFullTransactionEvent(blockEvent: BlockEvent, txEnvelopeIndex: number): TransactionEvent {
	const block = blockEvent.blockData as fabproto6.common.Block;
	if (block.metadata && block.data && block.data.data) {
		const blockMetadata: any[] = block.metadata.metadata || [];
		const transactionStatusCodes = blockMetadata[fabproto6.common.BlockMetadataIndex.TRANSACTIONS_FILTER] as number[];

		const envelope: any = block.data.data[txEnvelopeIndex];
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

	throw Error('Missing transaction data');
}
