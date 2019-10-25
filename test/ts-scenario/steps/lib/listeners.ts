/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { BlockEventListener, CommitEventListener, Contract, ContractEventListener, Gateway, Network, Transaction } from 'fabric-network';
import { Constants } from '../constants';
import * as GatewayHelper from './gateway';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

const stateStore: StateStore = StateStore.getInstance();

export async function createContractListener(gatewayName: string, channelName: string, ccName: string, eventName: string, listenerName: string, filtered: boolean, replay: boolean): Promise<void> {
	if (typeof filtered === 'undefined') {
		filtered = true;
	}
	if (typeof replay === 'undefined') {
		replay = false;
	}

	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const gateway: Gateway  = gateways.get(gatewayName).gateway;
	const contract: Contract = await GatewayHelper.retrieveContractFromGateway(gateway, channelName, ccName);

	let listeners: Map<string, any> = stateStore.get(Constants.LISTENERS);
	const listenerObject: any = {
		active: true,
		calls: 0,
		eventName,
		filtered,
		listener: {},
		payloads: [],
		type: Constants.CONTRACT,
	};

	// If no listeners, then create the new map item
	if (!listeners) {
		listeners = new Map();
	}

	// Create the listener
	const listener: ContractEventListener = await contract.addContractListener(listenerName, eventName, (err: Error, ...args: any[]) => {
		if (err) {
			BaseUtils.logMsg('-> Detected a contract event error', err);
			throw err;
		} else {
			BaseUtils.logMsg(`-> Received a contract event for listener [${listenerName}] of type ${eventName}`, undefined);
		}

		if (!filtered) {
			const [event]: any = args as any;
			if (event && event.hasOwnProperty('payload')) {
				BaseUtils.checkString(event.payload.toString('utf8'), 'content', true);
			}
		}

		const listenerUpdate: any = stateStore.get(Constants.LISTENERS).get(listenerName);
		listenerUpdate.payloads.push(args);
		listenerUpdate.calls = listenerUpdate.payloads.length;
		return Promise.resolve();
	}, {replay, filtered});

	// Roll into a listener object to store
	listenerObject.listener = listener;
	listeners.set(listenerName, listenerObject);
	stateStore.set(Constants.LISTENERS, listeners);
}

export async function createBlockListener(gatewayName: string, channelName: string, listenerName: string, filtered: boolean, replay: boolean, startBlock: number | undefined, endBlock: number | undefined): Promise<void> {
	if (typeof filtered === 'undefined') {
		filtered = true;
	}
	if (typeof replay === 'undefined') {
		replay = false;
	}

	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const gateway: Gateway = gateways.get(gatewayName).gateway;
	const network: Network = await gateway.getNetwork(channelName);

	let listeners: Map<string, any> = stateStore.get(Constants.LISTENERS);
	const listenerObject: any = {
		active: true,
		calls: 0,
		filtered,
		listener: {},
		payloads: [],
		type: Constants.BLOCK,
	};

	// If no listeners, then create the new map item
	if (!listeners) {
		listeners = new Map();
	}

	// Create the listener
	const listener: BlockEventListener = await network.addBlockListener(listenerName, (err: any, block: any) => {
		if (err) {
			BaseUtils.logMsg('-> Received a block event error', err);
			throw err;
		} else {
			BaseUtils.logMsg('->Received a block event', listenerName);
		}

		if (filtered) {
			BaseUtils.checkProperty(block, 'channel_id', true);
			BaseUtils.checkProperty(block, 'number', true);
			BaseUtils.checkProperty(block, 'filtered_transactions', true);
		} else {
			BaseUtils.checkProperty(block, 'header', true);
			BaseUtils.checkProperty(block, 'data', true);
			BaseUtils.checkProperty(block, 'metadata', true);
		}
		const blockNumber: number = filtered ? block.number : block.header.number;
		if (startBlock) {
			BaseUtils.checkSizeEquality(Number(blockNumber), Number(startBlock) - 1, true, true);
		}
		if (endBlock) {
			BaseUtils.checkSizeEquality(Number(blockNumber), Number(endBlock) + 1, false, true);
		}
		const listenerInfo: any = listeners.get(listenerName);
		listenerInfo.payloads.push(block);
		listenerInfo.calls = listenerInfo.payloads.length;
		return Promise.resolve();
	}, {filtered, replay, startBlock, endBlock});

	// Roll into a listener object to store
	listenerObject.listener = listener;
	listeners.set(listenerName, listenerObject);
	stateStore.set(Constants.LISTENERS, listeners);
}

export async function createTransactionCommitListener(transaction: Transaction, listenerName: string): Promise<void> {
	let listeners: Map<string, any> = stateStore.get(Constants.LISTENERS);
	const listenerObject: any = {
		active: true,
		calls: 0,
		listener: {},
		payloads: [],
		type: Constants.TRANSACTION,
	};

	// If no listeners, then create the new map item
	if (!listeners) {
		listeners = new Map();
	}

	// Create the listener
	const listener: CommitEventListener = await transaction.addCommitListener((err: any, ...args: any[]) => {
		if (err) {
			BaseUtils.logMsg('-> Commit transaction event error', err);
			return err;
		}
		BaseUtils.logMsg('-> Received a transaction commit event', listenerName);
		const listenerInfo: any = listeners.get(listenerName);
		listenerInfo.payloads.push(args);
		listenerInfo.calls = listenerInfo.payloads.length;
	});

	// Roll into a listener object to store
	listenerObject.listener = listener;
	listeners.set(listenerName, listenerObject);
	stateStore.set(Constants.LISTENERS, listeners);
}

export function getListenerObject(listenerName: string): any {
	const listeners: Map<string, any> = stateStore.get(Constants.LISTENERS);
	if (!listeners || !listeners.has(listenerName)) {
		const msg: string = `Unable to find listener with name ${listenerName}`;
		BaseUtils.logAndThrow(msg);
	} else {
		return listeners.get(listenerName);
	}
}

export function resetListenerCalls(listenerName: string): void {
	const listener: any = getListenerObject(listenerName);
	listener.payloads = [];
	listener.calls = 0;
}

export async function checkListenerCallNumber(listenerName: string, compareNumber: number, type: string): Promise<void> {
	await new Promise( (resolve: any): any => {
		let timeout: any = null;
		const interval: NodeJS.Timeout = setInterval(() => {
			let condition: boolean;
			switch (type) {
				case Constants.EXACT:
					condition = Number(getListenerObject(listenerName).calls) === Number(compareNumber);
					break;
				case Constants.GREATER_THAN:
					condition = Number(getListenerObject(listenerName).calls) >= Number(compareNumber);
					break;
				case Constants.LESS_THAN:
					condition = Number(getListenerObject(listenerName).calls) <= Number(compareNumber);
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

	const gatewayListenerCalls: number = getListenerObject(listenerName).calls;
	switch (type) {
		case Constants.EXACT:
			if (Number(gatewayListenerCalls) !== Number(compareNumber)) {
				const msg: string = `Expected ${listenerName} to be called ${compareNumber} times, but was called ${gatewayListenerCalls} times`;
				BaseUtils.logAndThrow(msg);
			} else {
				const msg: string = `Verified that the listener was called exactly ${compareNumber} times`;
				BaseUtils.logMsg(msg, undefined);
			}
			break;
		case Constants.GREATER_THAN:
			if (Number(gatewayListenerCalls) < Number(compareNumber)) {
				throw new Error(`Expected ${listenerName} to be called a minimum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
			} else {
				const msg: string = `Verified that the listener was called at least ${compareNumber} times`;
				BaseUtils.logMsg(msg, undefined);
			}
			break;
		case Constants.LESS_THAN:
				if (Number(gatewayListenerCalls) > Number(compareNumber)) {
					throw new Error(`Expected ${listenerName} to be called a maximum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
				} else {
					const msg: string = `Verified that the listener was called a maximum ${compareNumber} times`;
					BaseUtils.logMsg(msg, undefined);
				}
				break;
		default:
			throw new Error(`Unknown condition type ${type} passed to checkListenerCallNumber()`);
	}
}

export function checkContractListenerDetails(listenerName: string, listenerType: string, filtered: boolean, eventName: string, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ( (listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) || (listenerObject.eventName.localeCompare(eventName) !== 0) || (listenerObject.filtered !== filtered)) {
		const msg: string = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, eventName: ${eventName}, filtered: ${filtered}, active: ${isActive}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkBlockListenerDetails(listenerName: string, listenerType: string, filtered: boolean, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ( (listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) || (listenerObject.filtered !== filtered)) {
		const msg: string = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, filtered: ${filtered}, active: ${isActive}]`;
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

export function unregisterListener(listenerName: string): void {
	const listenerObject: any = getListenerObject(listenerName);
	const listener: any = listenerObject.listener;
	listener.unregister();
	listenerObject.active = false;
}
