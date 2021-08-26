/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as Listeners from './lib/listeners';

import {Given, Then, When} from 'cucumber';
import {EventType, ListenerOptions} from 'fabric-network';

Given(/^I am listening for (filtered|full) contract events named (.+?) with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, (type: EventType, eventName: string, listenerName: string) => {
	const isActive = true;
	Listeners.checkContractListenerDetails(listenerName, Constants.CONTRACT, type, eventName, isActive);
});

Given(/^I am listening for (filtered|full|private) block events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, (type: EventType, listenerName: string) => {
	const isActive = true;
	Listeners.checkBlockListenerDetails(listenerName, Constants.BLOCK, type, isActive);
});

Given(/^I am listening for transaction events with a listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, (listenerName: string) => {
	const isActive = true;
	Listeners.checkTransactionListenerDetails(listenerName, Constants.TRANSACTION, isActive);
});

// Contract events
When(/^I use the gateway named (.+?) to listen for (filtered|full) contract events named (.+?) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType
	};
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, options);
});

When(/^I use the gateway named (.+?) to replay (filtered|full) contract events named (.+?) from starting block ([0-9]+) with a listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, eventName: string, startBlock: number, listenerName: string, ccName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		startBlock
	};
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, options);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full) contract events named (.+?) with a new file checkpoint listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		checkpointer: await Listeners.newFileCheckpointer()
	};
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, options);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full) contract events named (.+?) with an existing file checkpoint listener named (.+?) for the smart contract named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, eventName: string, listenerName: string, ccName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		checkpointer: await Listeners.getFileCheckpointer()
	};
	return await Listeners.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, options);
});

// Block events
When(/^I use the gateway named (.+?) to listen for (filtered|full|private) block events with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, listenerName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType
	};
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, options);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full|private) block events between ([0-9]+) and ([0-9]+) with a listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, startBlock: number, endBlock: number, listenerName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		startBlock
	};
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, options, endBlock);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full|private) block events with a new file checkpoint listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, listenerName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		checkpointer: await Listeners.newFileCheckpointer()
	};
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, options);
});

When(/^I use the gateway named (.+?) to listen for (filtered|full|private) block events with an existing file checkpoint listener named (.+?) on channel (.+?)$/, {timeout: Constants.STEP_SHORT}, async (gatewayName: string, eventType: EventType, listenerName: string, channelName: string) => {
	const options: ListenerOptions = {
		type: eventType,
		checkpointer: await Listeners.getFileCheckpointer()
	};
	return await Listeners.createBlockListener(gatewayName, channelName, listenerName, options);
});

// Unregister
When(/^I unregister the listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, (listenerName: string) => {
	Listeners.unregisterListener(listenerName);
});

Then(/^I receive ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.EXACT);
});

Then(/^I receive a minimum ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.GREATER_THAN);
});

Then(/^I receive a maximum ([0-9]+) events from the listener named (.+?)$/, {timeout: Constants.STEP_SHORT}, async (calls: number, listenerName: string) => {
	await Listeners.checkListenerCallNumber(listenerName, calls, Constants.LESS_THAN);
});

Then('the listener named {word} should have private data containing {string}', {timeout: Constants.STEP_SHORT}, (listenerName: string, privateData: string) => {
	Listeners.checkBlockListenerPrivatePayloads(listenerName, privateData);
});

Then('the listener named {word} should have contract events with payload containing {string}', {timeout: Constants.STEP_SHORT}, (listenerName: string, payload: string) => {
	Listeners.checkContractListenerPayloads(listenerName, payload);
});
