/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	BlockType,
	Eventer,
	EventCallback,
	EventListener,
	EventRegistrationOptions,
	EventService,
	IdentityContext,
	ServiceAction,
	EventInfo
} from 'fabric-common';
import Long = require('long');

// tslint:disable:max-classes-per-file

interface TransactionListenerInfo {
	readonly transactionId: string;
	readonly callback: EventCallback;
	readonly options: EventRegistrationOptions;
}

class StubTransactionEventListener implements EventListener {
	readonly transactionId: string;
	readonly callback: EventCallback;
	readonly options: EventRegistrationOptions;
	private readonly eventService: EventService;

	constructor(eventService: EventService, transactionId: string, callback: EventCallback, options: EventRegistrationOptions) {
		this.eventService = eventService;
		this.transactionId = transactionId;
		this.callback = callback;
		this.options = options;
	}

	onEvent(error: Error, event: EventInfo) {
		if (error || event.transactionId === this.transactionId) {
			if (this.options.unregister !== false) {
				this.unregisterEventListener();
			}
			this.callback(error, event);
		}
	}

	unregisterEventListener() {
		this.eventService.unregisterEventListener(this);
	}
}

class StubBlockEventListener implements EventListener {
	readonly callback: EventCallback;
	readonly options: EventRegistrationOptions;
	private readonly eventService: EventService;

	constructor(eventService: EventService, callback: EventCallback, options: EventRegistrationOptions) {
		this.eventService = eventService;
		this.callback = callback;
		this.options = options;
	}

	onEvent(error: Error, event: EventInfo) {
		if (error || event.blockNumber) {
			this.callback(error, event);
		}
	}

	unregisterEventListener() {
		this.eventService.unregisterEventListener(this);
	}
}

export class StubEventService implements EventService {
	readonly name: string;
	startBlock: string | Long;
	endBlock: string | Long;
	blockType: BlockType = 'filtered';
	inUse: boolean = false;

	started = false;

	readonly eventListeners = new Set<EventListener>();

	constructor(name: string) {
		this.name = name;
	}

	isInUse(): boolean {
		return this.inUse;
	}

	setEventer(discoverer: Eventer): EventService {
		throw new Error('Method not implemented.');
	}

	setTargets(targets: Eventer[]) {
		// No-op
	}

	getLastBlockNumber(): Long {
		throw new Error('Method not implemented.');
	}

	close() {
		this.eventListeners.clear();
	}

	build(idContext: IdentityContext, request: any): Buffer {
		return Buffer.from('');
	}

	send(request: any): Promise<any> {
		return null;
	}

	isListening(): boolean {
		throw new Error('Method not implemented.');
	}

	isStarted(): boolean {
		return this.started;
	}

	unregisterEventListener(eventListener: EventListener): EventService {
		const removed = this.eventListeners.delete(eventListener);
		if (!removed) {
			throw new Error('unregisterEventLister called for listener that is not registered');
		}
		return this;
	}

	registerTransactionListener(txid: string, callback: EventCallback, options: EventRegistrationOptions): EventListener {
		const listener = new StubTransactionEventListener(this, txid, callback, options);
		this.eventListeners.add(listener);
		return listener;
	}

	registerChaincodeListener(chaincodeId: string, eventName: string, callback: EventCallback, options: EventRegistrationOptions): import('fabric-common').EventListener {
		throw new Error('Method not implemented.');
	}

	registerBlockListener(callback: EventCallback, options: EventRegistrationOptions): EventListener {
		const listener = new StubBlockEventListener(this, callback, options);
		this.eventListeners.add(listener);
		return listener;
	}

	sign(parm: IdentityContext | Buffer): ServiceAction {
		return null;
	}

	getSignedProposal() {
		throw new Error('Method not implemented.');
	}

	getSignedEnvelope() {
		throw new Error('Method not implemented.');
	}

	sendEvent(event: EventInfo) {
		this.eventListeners.forEach((listener) => listener.onEvent(undefined, event));
	}

	sendError(error: Error) {
		this.eventListeners.forEach((listener) => listener.onEvent(error, undefined));
	}
}
