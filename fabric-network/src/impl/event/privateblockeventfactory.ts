/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Block, EventInfo, PrivateData } from 'fabric-common';
import { BlockEvent, TransactionEvent } from '../../events';
import { cachedResult } from '../gatewayutils';
import { newFullBlockEvent } from './fullblockeventfactory';
import { newFullContractEvents } from './fullcontracteventfactory';
import { getTransactionEnvelopeIndexes, newFullTransactionEvent } from './fulltransactioneventfactory';
// @ts-ignore no implicit any
import protos = require('fabric-protos');

import util = require('util');

export function newPrivateBlockEvent(eventInfo: EventInfo): BlockEvent {
	const privateData = eventInfo.privateData;
	if (!privateData) {
		throw new Error('No private data found: ' + util.inspect(eventInfo));
	}

	const fullBlockEvent = newFullBlockEvent(eventInfo);

	const privateBlockEvent: BlockEvent = {
		blockNumber: fullBlockEvent.blockNumber,
		blockData: fullBlockEvent.blockData,
		getTransactionEvents: cachedResult(() => newPrivateTransactionEvents(privateBlockEvent, privateData))
	};

	return Object.freeze(privateBlockEvent);
}

function newPrivateTransactionEvents(blockEvent: BlockEvent, privateData: PrivateData): TransactionEvent[] {
	return getTransactionEnvelopeIndexes(blockEvent.blockData as Block)
		.map((index) => newPrivateTransactionEvent(blockEvent, index, privateData[index]));
}

function newPrivateTransactionEvent(blockEvent: BlockEvent, index: number, privateData: any): TransactionEvent {
	const fullTransactionEvent = newFullTransactionEvent(blockEvent, index);

	const privateTransactionEvent: TransactionEvent = {
		transactionId: fullTransactionEvent.transactionId,
		status: fullTransactionEvent.status,
		transactionData: fullTransactionEvent.transactionData,
		isValid: fullTransactionEvent.isValid,
		privateData,
		getBlockEvent: () => blockEvent,
		getContractEvents: cachedResult(() => newFullContractEvents(privateTransactionEvent))
	};

	return Object.freeze(privateTransactionEvent);
}
