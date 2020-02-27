/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockEvent, BlockListener } from './blocklistener';
import { OrderedBlockQueue } from './orderedblockqueue';
import { AsyncNotifier } from './asyncnotifier';
import {
	EventCallback,
	EventInfo,
	EventListener,
	EventRegistrationOptions,
	EventService
} from 'fabric-common';
// @ts-ignore no implicit any
import EventServiceManager = require('./eventservicemanager');
import Long = require('long');

import * as Logger from '../../logger';
const logger = Logger.getLogger('BlockEventSource');

function settle<T>(promise: Promise<T>): Promise<{ status: 'fulfilled', value: T } | { status: 'rejected',	reason: Error }> {
	return promise.then(
		(value: T) => {
			return { status: 'fulfilled', value };
		},
		(reason: Error) => {
			return { status: 'rejected', reason };
		}
	);
}

function allSettled<T>(promises: Promise<T>[]) {
	return Promise.all(promises.map((promise) => settle(promise)));
}

export class BlockEventSource {
	private readonly eventServiceManager: EventServiceManager;
	private eventService?: EventService;
	private listeners = new Set<BlockListener>();
	private eventListener?: EventListener;
	private readonly blockQueue: OrderedBlockQueue;
	private readonly asyncNotifier: AsyncNotifier<BlockEvent>;
	private started = false;

	constructor(eventServiceManager: EventServiceManager, startBlock?: Long) {
		this.eventServiceManager = eventServiceManager;
		this.blockQueue = new OrderedBlockQueue(startBlock);
		this.asyncNotifier = new AsyncNotifier(
			this.blockQueue.getNextBlock.bind(this.blockQueue),
			this.notifyListeners.bind(this)
		);
	}

	async addBlockListener(listener: BlockListener): Promise<BlockListener> {
		this.listeners.add(listener);
		await this.start();
		return listener;
	}

	removeBlockListener(listener: BlockListener): void {
		this.listeners.delete(listener);
	}

	close() {
		this.unregisterListener();
		this.eventService?.close();
		this.started = false;
	}

	private async start() {
		if (this.started) {
			return;
		}

		this.started = true;

		try {
			this.eventService = this.eventServiceManager.getEventService();
			this.registerListener(); // Register before start so no events are missed
			await this.startEventService();
		} catch (error) {
			logger.error('Failed to start event service', error);
			this.close();
		}
	}

	private registerListener() {
		const callback: EventCallback = this.blockEventCallback.bind(this);
		const options: EventRegistrationOptions = {
			startBlock: this.getNextBlockNumber(),
			unregister: false
		};
		this.eventListener = this.eventService!.registerBlockListener(callback, options);
	}

	private unregisterListener() {
		try {
			this.eventListener?.unregisterEventListener();
		} catch (error) {
			logger.warn('Failed to unregister listener', error);
		}
	}

	private async startEventService() {
		const options = { startBlock: this.getNextBlockNumber() };
		await this.eventServiceManager.startEventService(this.eventService, options);
	}

	private blockEventCallback(error?: Error, event?: EventInfo)  {
		if (error) {
			this.close();
			setImmediate(() => this.start()); // Must schedule after current event loop to avoid recursion in event service notification
		} else {
			this.onBlockEvent(event!);
		}
	}

	private onBlockEvent(event: EventInfo) {
		this.blockQueue.addBlock(event!);
		if (this.blockQueue.size() > 0) {
			this.asyncNotifier.notify();
		}
	}

	private async notifyListeners(event: BlockEvent) {
		const promises = Array.from(this.listeners).map((listener) => listener(event));
		const results = await allSettled(promises);

		for (const result of results) {
			if (result.status === 'rejected') {
				logger.error('Error notifying listener', result.reason);
			}
		}
	}

	private getNextBlockNumber() {
		return this.blockQueue.getNextBlockNumber();
	}
}
