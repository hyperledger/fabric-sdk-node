/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventCallback, EventInfo, EventListener, EventRegistrationOptions, EventService, StartRequestOptions } from 'fabric-common';
import { BlockEvent, BlockListener, EventType, ListenerOptions } from '../../events';
import * as Logger from '../../logger';
import * as GatewayUtils from '../gatewayutils';
import { AsyncNotifier } from './asyncnotifier';
import { EventServiceManager } from './eventservicemanager';
import { newFilteredBlockEvent } from './filteredblockeventfactory';
import { newFullBlockEvent } from './fullblockeventfactory';
import { OrderedBlockQueue } from './orderedblockqueue';
import { newPrivateBlockEvent } from './privateblockeventfactory';
import { notNullish } from '../gatewayutils';
import Long = require('long');

const logger = Logger.getLogger('BlockEventSource');

const defaultBlockType: EventType = 'filtered';

function newBlockQueue(options: ListenerOptions): OrderedBlockQueue {
	const startBlock = asLong(options.startBlock);
	return new OrderedBlockQueue(startBlock);
}

function asLong(value?: string | number | Long): Long | undefined {
	if (notNullish(value)) {
		return Long.fromValue(value);
	}
	return undefined;
}

export class BlockEventSource {
	private readonly eventServiceManager: EventServiceManager;
	private eventService?: EventService;
	private readonly listeners = new Set<BlockListener>();
	private eventListener?: EventListener;
	private readonly blockQueue: OrderedBlockQueue;
	private readonly asyncNotifier: AsyncNotifier<BlockEvent>;
	private readonly blockType: EventType;
	private state: 'ready' | 'started' | 'stopped' = 'ready';
	private restart?: NodeJS.Immediate;

	constructor(eventServiceManager: EventServiceManager, options: ListenerOptions = {}) {
		this.eventServiceManager = eventServiceManager;
		this.blockQueue = newBlockQueue(options);
		this.asyncNotifier = new AsyncNotifier(
			this.blockQueue.getNextBlock.bind(this.blockQueue),
			this.notifyListeners.bind(this)
		);
		this.blockType = options.type || defaultBlockType;
		logger.debug('constructor - blockType:%s', this.blockType);
	}

	async addBlockListener(listener: BlockListener): Promise<BlockListener> {
		this.listeners.add(listener);
		await this.start();
		return listener;
	}

	removeBlockListener(listener: BlockListener): void {
		this.listeners.delete(listener);
	}
	setState(state: 'ready' | 'started' | 'stopped') { if (this.state !== 'stopped') this.state = state; }

	 close(){
		 this.setState('stopped')
		 logger.debug(' state set to  - :%s', this.state);
		 this._close();

	}
	private _close(){
			this.unregisterListener();
			this.eventService?.close();
			this.setState('ready')
			logger.debug(' state set to  - :%s', this.state);
			if (this.restart) {
			clearImmediate(this.restart)
		}
	}


	private async start() {
		logger.debug('state - :%s', this.state);
		if (this.state !== 'ready') {
			return;
		}
		this.state = 'started';

		try {
			this.eventService = this.eventServiceManager.newDefaultEventService();
			this.registerListener(); // Register before start so no events are missed
			logger.debug('start - calling startEventService');
			await this.startEventService();
		} catch (error) {
			logger.error('Failed to start event service', error);
			this._close();
			this.restart = setImmediate(() => this.start());
			return;

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
		let startBlock = this.getNextBlockNumber();
		if (startBlock) {
			startBlock = startBlock.subtract(Long.ONE);
			if (startBlock.isNegative()) {
				startBlock = Long.ZERO;
			}
		}

		const options: StartRequestOptions = {
			blockType: this.blockType,
			startBlock
		};

		await this.eventServiceManager.startEventService(this.eventService!, options);
	}

	private blockEventCallback(error?: Error, event?: EventInfo)  {
		if (error) {
			this._close();
			this.restart = setImmediate(() => this.start()); // Must schedule after current event loop to avoid recursion in event service notification
		} else {
			this.onBlockEvent(event!);
		}
	}

	private onBlockEvent(eventInfo: EventInfo) {
		const blockEvent = this.newBlockEvent(eventInfo);
		this.blockQueue.addBlock(blockEvent);
		if (this.blockQueue.size() > 0) {
			this.asyncNotifier.notify();
		}
	}

	private newBlockEvent(eventInfo: EventInfo): BlockEvent {
		if (this.blockType === 'filtered') {
			return newFilteredBlockEvent(eventInfo);
		} else if (this.blockType === 'full') {
			return newFullBlockEvent(eventInfo);
		} else if (this.blockType === 'private') {
			return newPrivateBlockEvent(eventInfo);
		} else {
			throw new Error('Unsupported event type: ' + this.blockType);
		}
	}

	private async notifyListeners(event: BlockEvent) {
		const promises = Array.from(this.listeners).map((listener) => listener(event));
		const results = await GatewayUtils.allSettled(promises);

		for (const result of results) {
			if (result.status === 'rejected') {
				logger.warn('Error notifying listener', result.reason);
			}
		}
	}

	private getNextBlockNumber() {
		return this.blockQueue.getNextBlockNumber();
	}
}
