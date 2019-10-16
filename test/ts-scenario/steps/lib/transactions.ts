/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import * as Gateway from './gateway';
import * as Listeners from './listeners';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

import { Transaction } from 'fabric-network';

const stateStore = StateStore.getInstance();

export async function createTransaction(gatewayName: string, transactionName: string, mappedFcnName: string, contractId: string, channelName: string) {
	const gateway = Gateway.getGateway(gatewayName);
	const contract = await Gateway.retrieveContractFromGateway(gateway, channelName, contractId);
	const transaction = contract.createTransaction(mappedFcnName);
	addTransactionToStateStore(transactionName, transaction);
}

export function addTransactionToStateStore(transactionName: string, transaction: Transaction) {
	// Map of maps
	let transactions = stateStore.get(Constants.TRANSACTIONS);
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
export function retrieveTransactionFromStateStore(transactionName: string) {
	const transactions = stateStore.get(Constants.TRANSACTIONS);
	if (transactions) {
		const txn = transactions.get(transactionName);
		if (!txn) {
			BaseUtils.logAndThrow(`Transaction named ${transactionName} not present in the state store`);
		} else {
			return txn;
		}
	} else {
		BaseUtils.logAndThrow('No Transactions present in the state store');
	}
}

export async function createCommitListener(transactionName: string, listenerName: string) {
	const transaction = retrieveTransactionFromStateStore(transactionName);
	await Listeners.createTransactionCommitListener(transaction, listenerName);
}

export async function submitExistingTransaction(transactionName: string, args: string) {
	const transaction = retrieveTransactionFromStateStore(transactionName);
	const argsSplit = args.slice(1, -1).split(', ');
	return await transaction.submit(...argsSplit);
}
