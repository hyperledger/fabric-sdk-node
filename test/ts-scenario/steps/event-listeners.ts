/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Listeners from './lib/listeners';

import { Given, Then, When } from 'cucumber';
import { EventType } from 'fabric-network';

Given(/^I am listening for (filtered|full) contract events named (.+?) with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (type: EventType, eventName: string, listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkContractListenerDetails(listenerName, Constants.CONTRACT, type, eventName, isActive);
});

Given(/^I am listening for (filtered|full) block events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (type: EventType, listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkBlockListenerDetails(listenerName, Constants.BLOCK, type, isActive);
});

Given(/^I am listening for transaction events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT as number }, async (listenerName: string) => {
	const isActive: boolean = true;
	Listeners.checkTransactionListenerDetails(listenerName, Constants.TRANSACTION, isActive);
});

// Contract events
When(/^I use the gateway named (.+?) to listen for (filtered|full) contract events named (.+?) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, eventType: EventType, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, eventType);
});

When(/^I use the gateway named (.+?) to replay (filtered|full) contract events named (.+?) from starting block ([0-9]+) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, eventType: EventType, eventName: string, startBlock: number, listenerName: string, ccName: string, channelName: string) => {
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, eventType, startBlock);
});

// Block events
When(/^I use the gateway named (.+?) to listen for (filtered|full) block events with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, eventType: EventType, listenerName: string, channelName: string) => {
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, eventType);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full) block events between ([0-9]+) and ([0-9]+) with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT as number}, async (gatewayName: string, eventType: EventType, startBlock: number, endBlock: number, listenerName: string, channelName: string) => {
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, eventType, startBlock, endBlock);
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
