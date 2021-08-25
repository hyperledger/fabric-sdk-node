/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Checkpointer} from '../../checkpointer';
import {BlockListener, TransactionEvent, ContractListener} from '../../events';
import * as GatewayUtils from '../gatewayutils';
import * as Logger from '../../logger';

const logger = Logger.getLogger('Listener');

type TransactionListener = (event: TransactionEvent) => Promise<void>;

export function checkpointBlockListener(listener: BlockListener, checkpointer: Checkpointer): BlockListener {
	return async (blockEvent) => {
		const checkpointBlockNumber = await checkpointer.getBlockNumber();
		if (!checkpointBlockNumber || checkpointBlockNumber.equals(blockEvent.blockNumber)) {
			await listener(blockEvent);
			const nextBlockNumber = blockEvent.blockNumber.add(1);
			await checkpointer.setBlockNumber(nextBlockNumber);
		}
	};
}

export function blockFromContractListener(listener: ContractListener, checkpointer?: Checkpointer): BlockListener {
	if (checkpointer) {
		const transactionListener = transactionFromContractListener(listener);
		const checkpointTxListener = checkpointTransactionListener(transactionListener, checkpointer);
		const blockListener = blockFromTransactionListener(checkpointTxListener);
		return checkpointBlockListener(blockListener, checkpointer);
	} else {
		const transactionListener = transactionFromContractListener(listener);
		return blockFromTransactionListener(transactionListener);
	}
}

function transactionFromContractListener(listener: ContractListener): TransactionListener {
	return async (transactionEvent) => {
		for (const contractEvent of transactionEvent.getContractEvents()) {
			await listener(contractEvent);
		}
	};
}

function checkpointTransactionListener(listener: TransactionListener, checkpointer: Checkpointer): TransactionListener {
	return async (transactionEvent) => {
		const checkpointTransactionIds = await checkpointer.getTransactionIds();
		if (!checkpointTransactionIds.has(transactionEvent.transactionId)) {
			await listener(transactionEvent);
			await checkpointer.addTransactionId(transactionEvent.transactionId);
		}
	};
}

function blockFromTransactionListener(listener: TransactionListener): BlockListener {
	return async (blockEvent) => {
		const transactionPromises = blockEvent.getTransactionEvents()
			.filter((transactionEvent) => transactionEvent.isValid)
			.map((transactionEvent) => listener(transactionEvent));

		// Don't use Promise.all() as it returns early if any promises are rejected
		const results = await GatewayUtils.allSettled(transactionPromises);
		logAndThrowErrors(results);
	};
}

function logAndThrowErrors(results: GatewayUtils.SettledPromiseResult<void>[]): void {
	const errors = results
		.filter((result) => result.status === 'rejected')
		.map((result) => (result as GatewayUtils.RejectedPromiseResult).reason);
	if (errors.length > 0) {
		errors.forEach((error) => logger.warn('Error notifying transaction listener', error));
		throw new Error(`Error notifying listener: ${errors[0].stack || errors[0].message}`);
	}
}
