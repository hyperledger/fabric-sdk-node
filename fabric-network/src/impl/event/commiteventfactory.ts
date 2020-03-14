/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Endorser, EventInfo } from 'fabric-common';
import { CommitEvent, FilteredBlockEvent, FilteredTransactionEvent } from '../../events';
import * as TransactionStatus from './transactionstatus';
import { newFilteredBlockEvent } from './filteredeventfactory';
import util = require('util');

export function newCommitEvent(peer: Endorser, eventInfo: EventInfo): CommitEvent {
	if (!eventInfo.transactionId || !eventInfo.status) {
		throw new Error('Invalid event info for commit event: ' + util.inspect(eventInfo));
	}

	const transactionId = eventInfo.transactionId;

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
			transactionEvent = getBlockEvent().getTransactionEvents().find((tx) => tx.transactionId === transactionId);
			if (!transactionEvent) {
				throw new Error(`Transaction ${transactionId} does not exist in block: ${util.inspect(getBlockEvent())}`);
			}
		}
		return transactionEvent;
	}

	const commitEvent: CommitEvent = {
		type: 'filtered',
		peer,
		transactionId,
		status: eventInfo.status,
		get transactionData() {
			return getTransactionEvent().transactionData;
		},
		isValid: eventInfo.status === TransactionStatus.VALID_STATUS,
		getBlockEvent: () => getBlockEvent(),
		getContractEvents: () => getTransactionEvent().getContractEvents()
	};

	return Object.freeze(commitEvent);
}
