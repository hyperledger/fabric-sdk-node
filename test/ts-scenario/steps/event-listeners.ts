/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Listeners from './lib/listeners';
import * as Transactions from './lib/transactions';

import { Given, Then, When } from 'cucumber';

Then(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) contract events of type (.+?) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	const replay: boolean = true;
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, isFiltered === 'unfiltered', replay);
});

Then(/^I receive ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.EXACT);
	Listeners.resetListenerCalls(listenerName);
});

Then(/^I receive a minimum ([0-9]+) events from the listener (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.GREATER_THAN);
	Listeners.resetListenerCalls(listenerName);
});

Then(/^I receive a maximum ([0-9]+) events from the listener (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.LESS_THAN);
	Listeners.resetListenerCalls(listenerName);
});

Given(/^I am listening for (filtered|unfiltered) contract events of type (.+?) with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (isFiltered: string, eventName: string, listenerName: string) => {
	const isActive: boolean = true;
	await Listeners.checkContractListenerDetails(listenerName, Constants.CONTRACT, isFiltered === 'unfiltered', eventName, isActive);
});

Given(/^I am listening for (filtered|unfiltered) block events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (isFiltered: string, listenerName: string) => {
	const isActive: boolean = true;
	await Listeners.checkBlockListenerDetails(listenerName, Constants.BLOCK, isFiltered === 'unfiltered', isActive);
});

Given(/^I am listening for transaction events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (listenerName: string) => {
	const isActive: boolean = true;
	await Listeners.checkTransactionListenerDetails(listenerName, Constants.TRANSACTION, isActive);
});

When(/^I unregister the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, (listenerName: string) => {
	Listeners.unregisterListener(listenerName);
});

Then(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) block events with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, listenerName: string, channelName: string) => {
	const replay: boolean = true;
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, isFiltered === 'unfiltered', replay, undefined, undefined);
});

Then(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) block events between ([0-9]+) and ([0-9]+) with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, startBlock: number, endBlock: number, listenerName: string, channelName: string) => {
	const replay: boolean = true;
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, isFiltered === 'unfiltered', replay, startBlock, endBlock);
});

When(/^I use the gateway named (.+?) to create a transaction named (.+?) that calls (.+?) using contract (.+?) instantiated on channel (.+?)$/, async (gatewayName: string, transactionName: string, fcnName: string, ccName: string, channelName: string) => {
	return Transactions.createTransaction(gatewayName, transactionName, fcnName, ccName, channelName);
});

When(/^I use the transaction named (.+?) to create a commit listener called (.+?)$/, (transactionName: string, listenerName: string) => {
	return Transactions.createCommitListener(transactionName, listenerName);
});

Then(/^I use the transaction named (.+?) to submit a transaction with args (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (transactionName: string, args: string) => {
	return Transactions.submitExistingTransaction(transactionName, args);
});
