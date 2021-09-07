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
	EventInfo,
	StartRequestOptions,
	StartEventRequest
} from 'fabric-common';
import Long = require('long');




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
	inUse = false;

	started = false;

	readonly eventListeners = new Set<EventListener>();

	constructor(name: string) {
		this.name = name;
	}

	isInUse(): boolean {
		return this.inUse;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	setEventer(discoverer: Eventer): EventService {
		throw new Error('Method not implemented.');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	setTargets(targets: Eventer[]) :void {
		// No-op
	}

	getLastBlockNumber(): Long {
		throw new Error('Method not implemented.');
	}

	close():void {
		this.eventListeners.clear();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	build(idContext: IdentityContext, request: StartRequestOptions): Buffer {
		return Buffer.from('');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	send(request: StartEventRequest): Promise<void> {
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	registerChaincodeListener(chaincodeId: string, eventName: string, callback: EventCallback, options: EventRegistrationOptions): import('fabric-common').EventListener {
		throw new Error('Method not implemented.');
	}

	registerBlockListener(callback: EventCallback, options: EventRegistrationOptions): EventListener {
		const listener = new StubBlockEventListener(this, callback, options);
		this.eventListeners.add(listener);
		return listener;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	sign(parm: IdentityContext | Buffer): ServiceAction {
		return null;
	}

	getSignedProposal():void {
		throw new Error('Method not implemented.');
	}

	getSignedEnvelope() :void {
		throw new Error('Method not implemented.');
	}

	sendEvent(event: EventInfo):void {
		this.eventListeners.forEach((listener) => listener.onEvent(undefined, event));
	}

	sendError(error: Error) :void {
		this.eventListeners.forEach((listener) => listener.onEvent(error, undefined));
	}
}
