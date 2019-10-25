/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import * as GatewayHelper from './gateway';
import * as Listeners from './listeners';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

import { Contract, Gateway, Transaction } from 'fabric-network';

const stateStore: StateStore = StateStore.getInstance();

export async function createTransaction(gatewayName: string, transactionName: string, mappedFcnName: string, contractId: string, channelName: string): Promise<void> {
	const gateway: Gateway | undefined = GatewayHelper.getGateway(gatewayName);

	if (gateway) {
		const contract: Contract = await GatewayHelper.retrieveContractFromGateway(gateway, channelName, contractId);
		const transaction: Transaction = contract.createTransaction(mappedFcnName);
		addTransactionToStateStore(transactionName, transaction);
	} else {
		BaseUtils.logAndThrow(`Unable to retrieve Gateway named ${gatewayName}`);
	}
}

export function addTransactionToStateStore(transactionName: string, transaction: Transaction): void {
	// Map of maps
	let transactions: Map<string, Transaction> = stateStore.get(Constants.TRANSACTIONS);
	if (transactions) {
		transactions.set(transactionName, transaction);
	} else {
		// First entry: create map and add transactions
		transactions = new Map<string, Transaction>();
		transactions.set(transactionName, transaction);
	}
	stateStore.set(Constants.TRANSACTIONS, transactions);
}

/**
 * Retrieve a transaction store in the state store
 * @param transactionName the name of the transaction
 * @typedef Transaction
 */
export function retrieveTransactionFromStateStore(transactionName: string): Transaction | undefined {
	const transactions: Map<string, Transaction> = stateStore.get(Constants.TRANSACTIONS);
	if (transactions) {
		const txn: Transaction | undefined = transactions.get(transactionName);
		if (!txn) {
			BaseUtils.logAndThrow(`Transaction named ${transactionName} not present in the state store`);
		} else {
			return txn;
		}
	} else {
		throw new Error('Unable to retrieveTransactionFromStateStore');
	}
}

export async function createCommitListener(transactionName: string, listenerName: string): Promise<void> {
	const transaction: Transaction | undefined  = retrieveTransactionFromStateStore(transactionName);
	if (transaction) {
		await Listeners.createTransactionCommitListener(transaction, listenerName);
	} else {
		throw new Error(`Unable to createTransactionCommitListener on undefined Transaction`);
	}
}

export async function submitExistingTransaction(transactionName: string, args: string): Promise<Buffer> {
	const transaction: Transaction | undefined = retrieveTransactionFromStateStore(transactionName);
	const argsSplit: string[] = args.slice(1, -1).split(', ');
	if (transaction) {
		return await transaction.submit(...argsSplit);
	} else {
		throw new Error(`Unable to submit on undefined Transaction`);
	}
}
