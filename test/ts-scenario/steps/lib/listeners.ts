/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { BlockEvent, BlockListener, Contract, ContractEvent, ContractListener, Gateway, Network, ListenerOptions, EventType } from 'fabric-network';
import { Constants } from '../constants';
import * as GatewayHelper from './gateway';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

const stateStore: StateStore = StateStore.getInstance();

export async function createContractListener(gatewayName: string, channelName: string, ccName: string, eventName: string, listenerName: string, type: EventType, startBlock?: number): Promise<void> {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const gateway: Gateway  = gateways.get(gatewayName).gateway;
	const contract: Contract = await GatewayHelper.retrieveContractFromGateway(gateway, channelName, ccName);

	const listenerObject: any = {
		active: true,
		eventName,
		eventType: type,
		listener: {},
		payloads: [],
		type: Constants.CONTRACT,
	};

	const contractListener: ContractListener = async (event: ContractEvent) => {
		BaseUtils.logMsg(`-> Received a contract event for listener [${listenerName}] of eventName ${eventName}`);
		if (event.eventName === eventName) {
			listenerObject.payloads.push(event);
		}
	};
	const listenerOptions: ListenerOptions = {
		startBlock,
		type
	};
	await contract.addContractListener(contractListener, listenerOptions);

	// Roll into a listener object to store
	listenerObject.listener = contractListener;
	listenerObject.remove = () => contract.removeContractListener(contractListener);
	putListenerObject(listenerName, listenerObject);
}

export async function createBlockListener(gatewayName: string, channelName: string, listenerName: string, type: EventType, startBlock?: number, endBlock?: number): Promise<void> {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const gateway: Gateway = gateways.get(gatewayName).gateway;
	const network: Network = await gateway.getNetwork(channelName);

	const listenerObject: any = {
		active: true,
		eventType: type,
		listener: {},
		payloads: [],
		type: Constants.BLOCK
	};

	// Create the listener
	const listener: BlockListener = async (blockEvent: BlockEvent) => {
		BaseUtils.logMsg('->Received a block event', listenerName);
		if (startBlock) {
			BaseUtils.checkSizeEquality(blockEvent.blockNumber.toNumber(), startBlock - 1, true, true);
		}
		if (endBlock) {
			BaseUtils.checkSizeEquality(blockEvent.blockNumber.toNumber(), endBlock + 1, false, true);
		}

		listenerObject.payloads.push(blockEvent);
		BaseUtils.logMsg('->Received a block event - added blockevent to payloads', listenerName);
		const transactionEvents = blockEvent.getTransactionEvents();
		for (const transactionEvent of transactionEvents) {
			if (transactionEvent.privateData) {
				BaseUtils.logMsg('->Received a block event - blockevent has privateData', JSON.stringify(transactionEvent.privateData));
			}
		}

		if (endBlock && blockEvent.blockNumber.greaterThanOrEqual(endBlock)) {
			network.removeBlockListener(listener);
		}
	};
	const listenerOptions: ListenerOptions = {
		startBlock,
		type
	};
	await network.addBlockListener(listener, listenerOptions);

	// Roll into a listener object to store
	listenerObject.listener = listener;
	listenerObject.remove = () => network.removeBlockListener(listener);
	putListenerObject(listenerName, listenerObject);
	BaseUtils.logMsg('->Stored a block event listener:', listenerName);
}

function getListenerObject(listenerName: string): any {
	const listener = getListeners().get(listenerName);
	if (!listener) {
		const msg: string = `Unable to find listener with name ${listenerName}`;
		BaseUtils.logAndThrow(msg);
	} else {
		return listener;
	}
}

function putListenerObject(name: string, listener: any): void {
	getListeners().set(name, listener);
}

function getListeners(): Map<string, any> {
	let listeners: Map<string, any> = stateStore.get(Constants.LISTENERS);
	if (!listeners) {
		listeners = new Map();
		stateStore.set(Constants.LISTENERS, listeners);
	}

	return listeners;
}

export async function checkListenerCallNumber(listenerName: string, compareNumber: number, type: string): Promise<void> {
	await new Promise( (resolve: any): any => {
		let timeout: any = null;
		const interval: NodeJS.Timeout = setInterval(() => {
			let condition: boolean;
			switch (type) {
				case Constants.EXACT:
					condition = Number(getListenerObject(listenerName).payloads.length) === Number(compareNumber);
					break;
				case Constants.GREATER_THAN:
					condition = Number(getListenerObject(listenerName).payloads.length) >= Number(compareNumber);
					break;
				case Constants.LESS_THAN:
					condition = Number(getListenerObject(listenerName).payloads.length) <= Number(compareNumber);
					break;
				default:
					throw new Error(`Unknown condition type ${type} passed to checkListenerCallNumber()`);
			}

			if (condition)  {
				clearInterval(interval);
				clearTimeout(timeout);
				resolve();
			}
		}, Constants.INC_TINY);

		// Make sure this doesn't run forever! We condition actual errors in the following code block
		timeout = setTimeout(() => {
			clearInterval(interval);
			resolve();
		}, Constants.STEP_SHORT);
	});

	const gatewayListenerCalls: number = getListenerObject(listenerName).payloads.length;
	switch (type) {
		case Constants.EXACT:
			if (Number(gatewayListenerCalls) !== Number(compareNumber)) {
				const msg: string = `Expected ${listenerName} to be called ${compareNumber} times, but was called ${gatewayListenerCalls} times`;
				BaseUtils.logAndThrow(msg);
			} else {
				const msg: string = `Verified that the listener was called exactly ${compareNumber} times`;
				BaseUtils.logMsg(msg);
			}
			break;
		case Constants.GREATER_THAN:
			if (Number(gatewayListenerCalls) < Number(compareNumber)) {
				throw new Error(`Expected ${listenerName} to be called a minimum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
			} else {
				const msg: string = `Verified that the listener was called at least ${compareNumber} times`;
				BaseUtils.logMsg(msg);
			}
			break;
		case Constants.LESS_THAN:
				if (Number(gatewayListenerCalls) > Number(compareNumber)) {
					throw new Error(`Expected ${listenerName} to be called a maximum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
				} else {
					const msg: string = `Verified that the listener was called a maximum ${compareNumber} times`;
					BaseUtils.logMsg(msg);
				}
				break;
		default:
			throw new Error(`Unknown condition type ${type} passed to checkListenerCallNumber()`);
	}
}

export function checkContractListenerDetails(listenerName: string, listenerType: string, eventType: EventType, eventName: string, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ( (listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) || (listenerObject.eventName.localeCompare(eventName) !== 0) || (listenerObject.eventType !== eventType)) {
		const msg: string = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, eventName: ${eventName}, eventType: ${eventType}, active: ${isActive}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkBlockListenerDetails(listenerName: string, listenerType: string, eventType: EventType, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ( (listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) || (listenerObject.eventType !== eventType)) {
		const msg: string = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, eventType: ${eventType}, active: ${isActive}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkBlockListenerPrivatePayloads(listenerName: string, checkData: string): void {
	const listenerObject = getListenerObject(listenerName);
	const blockEvents: BlockEvent[] = listenerObject.payloads;

	const found = blockEvents.some((blockEvent) => {
		return blockEvent.getTransactionEvents()
			.filter((transactionEvent) => transactionEvent.privateData)
			.map((transactionEvent) => JSON.stringify(transactionEvent.privateData))
			.some((privateDataJson) => {
				BaseUtils.logMsg('->Transaction Payload has privateData', privateDataJson);
				return privateDataJson.includes(checkData);
			});
	});

	if (found) {
		BaseUtils.logMsg('->Transaction Payload privateData checks out', listenerName);
	} else {
		const msg: string = `Listener named ${listenerName} does not have the expected private data payload [${checkData}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkTransactionListenerDetails(listenerName: string, listenerType: string, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ( (listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) ) {
		const msg: string = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, active: ${isActive}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function unregisterListener(listenerName: string) {
	const listenerObject = getListenerObject(listenerName);
	listenerObject.remove();
	listenerObject.active = false;
	listenerObject.payloads = [];
}
