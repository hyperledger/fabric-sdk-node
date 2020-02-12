/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
	public readonly transactionId: string;
	public readonly callback: EventCallback;
	public readonly options: EventRegistrationOptions;
	private readonly eventService: EventService;

	public constructor(eventService: EventService, transactionId: string, callback: EventCallback, options: EventRegistrationOptions) {
		this.eventService = eventService;
		this.transactionId = transactionId;
		this.callback = callback;
		this.options = options;
	}

	public onEvent(error: Error, event: EventInfo): void {
		if (error || event.transactionId === this.transactionId) {
			if (this.options.unregister !== false) {
				this.unregisterEventListener();
			}
			this.callback(error, event);
		}
	}

	public unregisterEventListener(): void {
		this.eventService.unregisterEventListener(this);
	}
}

export class StubEventService implements EventService {
	public readonly name: string;
	public startBlock: string | Long;
	public endBlock: string | Long;

	private readonly eventListeners = new Set<EventListener>();

	public constructor(name: string) {
		this.name = name;
	}

	public setEventer(discoverer: Eventer): EventService {
		throw new Error('Method not implemented.');
	}

	public getLastBlockNumber(): Long {
		throw new Error('Method not implemented.');
	}

	public close(): void {
		throw new Error('Method not implemented.');
	}

	public build(idContext: IdentityContext, request: any): Buffer {
		throw new Error('Method not implemented.');
	}

	public send(request: any): Promise<any> {
		throw new Error('Method not implemented.');
	}

	public isListening(): boolean {
		throw new Error('Method not implemented.');
	}

	public unregisterEventListener(eventListener: EventListener): EventService {
		const removed = this.eventListeners.delete(eventListener);
		if (!removed) {
			throw new Error('unregisterEventLister called for listener that is not registered');
		}
		return this;
	}

	public registerTransactionListener(txid: string, callback: EventCallback, options: EventRegistrationOptions): EventListener {
		const listener = new StubTransactionEventListener(this, txid, callback, options);
		this.eventListeners.add(listener);
		return listener;
	}

	public registerChaincodeListener(eventName: string, callback: EventCallback, options: EventRegistrationOptions): import('fabric-common').EventListener {
		throw new Error('Method not implemented.');
	}

	public registerBlockListener(callback: EventCallback, options: EventRegistrationOptions): EventListener {
		throw new Error('Method not implemented.');
	}

	public sign(parm: IdentityContext | Buffer): ServiceAction {
		throw new Error('Method not implemented.');
	}

	public getSignedProposal() {
		throw new Error('Method not implemented.');
	}

	public getSignedEnvelope() {
		throw new Error('Method not implemented.');
	}

	public sendEvent(event: EventInfo): void {
		this.eventListeners.forEach((listener) => listener.onEvent(undefined, event));
	}

	public sendError(error: Error): void {
		this.eventListeners.forEach((listener) => listener.onEvent(error, undefined));
	}
}
