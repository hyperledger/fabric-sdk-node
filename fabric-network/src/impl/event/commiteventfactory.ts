/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Endorser, EventInfo} from 'fabric-common';
import {CommitEvent} from '../../events';
import {cachedResult} from '../gatewayutils';
import {newFilteredBlockEvent} from './filteredblockeventfactory';
import * as TransactionStatus from './transactionstatus';
import * as util from 'util';

export function newCommitEvent(peer: Endorser, eventInfo: EventInfo): CommitEvent {
	if (!eventInfo.transactionId || !eventInfo.status) {
		throw new Error('Invalid event info for commit event: ' + util.inspect(eventInfo));
	}

	const transactionId = eventInfo.transactionId;
	const getBlockEvent = cachedResult(() => newFilteredBlockEvent(eventInfo));
	const getTransactionEvent = cachedResult(() => {
		const blockEvent = getBlockEvent();
		const transactionEvent = blockEvent.getTransactionEvents().find((tx) => tx.transactionId === transactionId);
		if (!transactionEvent) {
			throw new Error(`Transaction ${transactionId} does not exist in block: ${util.inspect(blockEvent)}`);
		}
		return transactionEvent;
	});

	const commitEvent: CommitEvent = {
		peer,
		transactionId,
		status: eventInfo.status,
		get transactionData() {
			return getTransactionEvent().transactionData;
		},
		isValid: eventInfo.status === TransactionStatus.VALID_STATUS,
		getBlockEvent,
		getContractEvents: () => getTransactionEvent().getContractEvents()
	};

	return Object.freeze(commitEvent);
}
