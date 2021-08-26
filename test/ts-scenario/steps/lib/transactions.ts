/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from '../constants';
import * as BaseUtils from './utility/baseUtils';
import {StateStore} from './utility/stateStore';

import {Transaction} from 'fabric-network';

const stateStore: StateStore = StateStore.getInstance();

export function addTransactionToStateStore(transactionName: string, transaction: Transaction): void {
	// Map of maps
	let transactions = stateStore.get(Constants.TRANSACTIONS) as Map<string, Transaction> ;
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
	const transactions : Map<string, Transaction> = stateStore.get(Constants.TRANSACTIONS) as Map<string, Transaction>;
	if (transactions) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const txn : Transaction | undefined = transactions.get(transactionName) ;
		if (!txn) {
			BaseUtils.logAndThrow(`Transaction named ${transactionName} not present in the state store`);
		} else {
			return txn;
		}
	} else {
		throw new Error('Unable to retrieveTransactionFromStateStore');
	}
}
