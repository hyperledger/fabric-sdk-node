/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Listeners from './lib/listeners';

import { Given, Then, When } from 'cucumber';

Given(/^I am listening for (filtered|unfiltered) contract events named (.+?) with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (isFiltered: string, eventName: string, listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkContractListenerDetails(listenerName, Constants.CONTRACT, isFiltered === 'unfiltered', eventName, isActive);
});

Given(/^I am listening for (filtered|unfiltered) block events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (isFiltered: string, listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkBlockListenerDetails(listenerName, Constants.BLOCK, isFiltered === 'unfiltered', isActive);
});

Given(/^I am listening for transaction events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkTransactionListenerDetails(listenerName, Constants.TRANSACTION, isActive);
});

// Contract events
When(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) contract events named (.+?) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, isFiltered === 'unfiltered', false);
});

When(/^I use the gateway named (.+?) to replay (filtered|unfiltered) contract events named (.+?) from starting block ([0-9]+) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, eventName: string, startBlock: number, listenerName: string, ccName: string, channelName: string) => {
	const replay: boolean = true;
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, isFiltered === 'unfiltered', replay, startBlock);
});

// Block events
When(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) block events with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, listenerName: string, channelName: string) => {
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, isFiltered === 'unfiltered', false);
});

When(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) block events between ([0-9]+) and ([0-9]+) with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, isFiltered: string, startBlock: number, endBlock: number, listenerName: string, channelName: string) => {
	const replay: boolean = true;
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, isFiltered === 'unfiltered', replay, startBlock, endBlock);
});

// Unregister
When(/^I unregister the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, (listenerName: string) => {
	Listeners.unregisterListener(listenerName);
});

Then(/^I receive ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.EXACT);
	Listeners.resetListenerCalls(listenerName);
});

Then(/^I receive a minimum ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.GREATER_THAN);
	Listeners.resetListenerCalls(listenerName);
});

Then(/^I receive a maximum ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.LESS_THAN);
	Listeners.resetListenerCalls(listenerName);
});
