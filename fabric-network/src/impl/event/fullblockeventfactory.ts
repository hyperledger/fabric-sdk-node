/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Block, EventInfo } from 'fabric-common';
import { BlockEvent, TransactionEvent } from '../../events';
import { cachedResult } from '../gatewayutils';
import { getTransactionEnvelopeIndexes, newFullTransactionEvent } from './fulltransactioneventfactory';
import util = require('util');
// @ts-ignore no implicit any
import protos = require('fabric-protos');

export function newFullBlockEvent(eventInfo: EventInfo): BlockEvent {
	if (!eventInfo.block) {
		throw new Error('No block data found: ' + util.inspect(eventInfo));
	}

	const blockEvent: BlockEvent = {
		blockNumber: eventInfo.blockNumber,
		blockData: eventInfo.block,
		getTransactionEvents: cachedResult(() => newFullTransactionEvents(blockEvent))
	};

	return Object.freeze(blockEvent);
}

function newFullTransactionEvents(blockEvent: BlockEvent): TransactionEvent[] {
	return getTransactionEnvelopeIndexes(blockEvent.blockData as Block)
		.map((index) => newFullTransactionEvent(blockEvent, index));
}
