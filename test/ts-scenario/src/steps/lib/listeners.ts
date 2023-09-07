/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {BlockEvent, BlockListener, Checkpointer, Contract, ContractEvent, ContractListener, EventType, ListenerOptions, Network, DefaultCheckpointers, TransactionEvent} from 'fabric-network';
import * as Constants from '../constants';
import * as GatewayHelper from './gateway';
import * as BaseUtils from './utility/baseUtils';
import {StateStore} from './utility/stateStore';
import Long = require('long');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as util from 'util';


const stateStore: StateStore = StateStore.getInstance();
const CHECKPOINT_FILE_KEY = 'checkpointFile';



export async function createContractListener(gatewayName: string, channelName: string, ccName: string,
	eventName: string, listenerName: string, listenerOptions: ListenerOptions): Promise<void> {
	const gateways = stateStore.get(Constants.GATEWAYS) as  Map<string, GatewayHelper.GatewayData>;
	const gateway = GatewayHelper.getGateway(gateways, gatewayName);
	const contract: Contract = await GatewayHelper.retrieveContractFromGateway(gateway.gateway, channelName, ccName);
	const payloads: ContractEvent[] = [];
	const listener: ContractListener = (event: ContractEvent) => {
		BaseUtils.logMsg(`-> Received a contract event for listener [${listenerName}] of eventName ${eventName}`);
		if (event.eventName === eventName) {
			payloads.push(event);
		}
		return Promise.resolve();
	};
	await contract.addContractListener(listener, listenerOptions);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const listenerObject: any = {
		active: true,
		eventName,
		eventType: listenerOptions.type,
		listener,
		payloads,
		type: Constants.CONTRACT,
		remove: () => contract.removeContractListener(listener),
	};
	putListenerObject(listenerName, listenerObject);
}

export async function createBlockListener(gatewayName: string, channelName: string, listenerName: string,
	listenerOptions: ListenerOptions, endBlock?: number): Promise<void> {
	const gateways = stateStore.get(Constants.GATEWAYS) as Map<string, GatewayHelper.GatewayData>;

	const gateway = GatewayHelper.getGateway(gateways, gatewayName);

	const network: Network = await gateway.gateway.getNetwork(channelName);

	const payloads: BlockEvent[] = [];
	const startBlock = listenerOptions.startBlock ? Long.fromValue(listenerOptions.startBlock).toNumber() : undefined;

	// Create the listener
	const listener: BlockListener = (blockEvent: BlockEvent) => {
		BaseUtils.logMsg('->Received a block event', listenerName);
		if (startBlock) {
			BaseUtils.checkSizeEquality(blockEvent.blockNumber.toNumber(), startBlock - 1, true, true);
		}
		if (endBlock) {
			BaseUtils.checkSizeEquality(blockEvent.blockNumber.toNumber(), endBlock + 1, false, true);
		}

		payloads.push(blockEvent);
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
		return Promise.resolve();
	};
	await network.addBlockListener(listener, listenerOptions);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const listenerObject: any = {
		active: true,
		eventType: listenerOptions.type,
		listener,
		payloads,
		type: Constants.BLOCK,
		remove: () => {
			network.removeBlockListener(listener);
		}
	};
	putListenerObject(listenerName, listenerObject);
	BaseUtils.logMsg('->Stored a block event listener:', listenerName);
}

export async function newFileCheckpointer(): Promise<Checkpointer> {
	const prefix = `${os.tmpdir()}${path.sep}`;
	const tmpDir = await fs.promises.mkdtemp(prefix);
	const file = path.join(tmpDir, 'checkpoint.json');
	const checkpointer = await DefaultCheckpointers.file(file);
	stateStore.set(CHECKPOINT_FILE_KEY, file);
	return checkpointer;
}

export async function getFileCheckpointer(): Promise<Checkpointer> {
	const file = stateStore.get(CHECKPOINT_FILE_KEY) as string;
	if (!file) {
		throw new Error('Checkpointer does not exist');
	}
	const checkpointer = await DefaultCheckpointers.file(file);
	return checkpointer;
}

function getListenerObject(listenerName: string): any {
	const listener = getListeners().get(listenerName);
	if (!listener) {
		const msg = `Unable to find listener with name ${listenerName}`;
		BaseUtils.logAndThrow(msg);
	} else {
		return listener;
	}
}

function putListenerObject(name: string, listener: any): void {
	getListeners().set(name, listener);
}

function getListeners(): Map<string, any> {
	let listeners = stateStore.get(Constants.LISTENERS) as  Map<string, any>;
	if (!listeners) {
		listeners = new Map();
		stateStore.set(Constants.LISTENERS, listeners);
	}

	return listeners;
}

export async function checkListenerCallNumber(listenerName: string, compareNumber: number, type: string): Promise<void> {
	await new Promise<void>((resolve): any => {
		const interval = setInterval(() => {
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
		const timeout = setTimeout(() => {
			clearInterval(interval);
			resolve();
		}, Constants.STEP_SHORT);
	});

	const gatewayListenerCalls: number = getListenerObject(listenerName).payloads.length;
	switch (type) {
		case Constants.EXACT:
			if (Number(gatewayListenerCalls) !== Number(compareNumber)) {
				const msg = `Expected ${listenerName} to be called ${compareNumber} times, but was called ${gatewayListenerCalls} times`;
				BaseUtils.logAndThrow(msg);
			} else {
				const msg = `Verified that the listener was called exactly ${compareNumber} times`;
				BaseUtils.logMsg(msg);
			}
			break;
		case Constants.GREATER_THAN:
			if (Number(gatewayListenerCalls) < Number(compareNumber)) {
				throw new Error(`Expected ${listenerName} to be called a minimum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
			} else {
				const msg = `Verified that the listener was called at least ${compareNumber} times`;
				BaseUtils.logMsg(msg);
			}
			break;
		case Constants.LESS_THAN:
			if (Number(gatewayListenerCalls) > Number(compareNumber)) {
				throw new Error(`Expected ${listenerName} to be called a maximum ${compareNumber} times, but called ${gatewayListenerCalls} times`);
			} else {
				const msg = `Verified that the listener was called a maximum ${compareNumber} times`;
				BaseUtils.logMsg(msg);
			}
			break;
		default:
			throw new Error(`Unknown condition type ${type} passed to checkListenerCallNumber()`);
	}
}

export function checkContractListenerDetails(listenerName: string, listenerType: string, eventType: EventType,
	eventName: string, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ((listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) ||
	(listenerObject.eventName.localeCompare(eventName) !== 0) || (listenerObject.eventType !== eventType)) {
		const msg = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, eventName: ${eventName}, eventType: ${eventType}, active: ${util.inspect(isActive)}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkBlockListenerDetails(listenerName: string, listenerType: string, eventType: EventType, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ((listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0) || (listenerObject.eventType !== eventType)) {
		const msg = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, eventType: ${eventType}, active: ${String(isActive)}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkBlockListenerPrivatePayloads(listenerName: string, checkData: string): void {
	const listenerObject = getListenerObject(listenerName);
	const blockEvents: BlockEvent[] = listenerObject.payloads;

	const found = blockEvents.some((blockEvent) => {
		return blockEvent.getTransactionEvents()
			.filter((transactionEvent:TransactionEvent) => transactionEvent.privateData)
			.map((transactionEvent:TransactionEvent) => {
				BaseUtils.logMsg('->Transaction Payload has privateData', JSON.stringify(transactionEvent.privateData));
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return transactionEvent.privateData?.ns_pvt_rwset[0]?.collection_pvt_rwset[0]?.rwset.writes[0]?.value?.toString('utf-8');
			})
			.some((privateDataValue) => {
				BaseUtils.logMsg('->privateData', privateDataValue);
				return privateDataValue.includes(checkData);
			});
	});

	if (found) {
		BaseUtils.logMsg('->Transaction Payload privateData checks out', listenerName);
	} else {
		const msg = `Listener named ${listenerName} does not have the expected private data payload [${checkData}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkContractListenerPayloads(listenerName: string, checkData: string): void {
	const listenerObject = getListenerObject(listenerName);
	const contractEvents: ContractEvent[] = listenerObject.payloads;

	const found = contractEvents.some((contractEvent) => {
		// Check a contract event payload is what we expect
		return contractEvent.payload?.toString() === checkData;
	});

	if (found) {
		BaseUtils.logMsg('->Contract Event payload matches what we expect:', checkData);
	} else {
		const msg = `Listener named ${listenerName} does not have the expected contract event payload [${checkData}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function checkTransactionListenerDetails(listenerName: string, listenerType: string, isActive: boolean): void {
	const listenerObject: any = getListenerObject(listenerName);

	// Check the listener properties
	if ((listenerObject.active !== isActive) || (listenerObject.type.localeCompare(listenerType) !== 0)) {
		const msg = `Listener named ${listenerName} does not have the expected properties [type: ${listenerType}, active: ${String(isActive)}]`;
		BaseUtils.logAndThrow(msg);
	}
}

export function unregisterListener(listenerName: string):void {
	const listenerObject = getListenerObject(listenerName);
	listenerObject.remove();
	listenerObject.active = false;
	listenerObject.payloads = [];
}
