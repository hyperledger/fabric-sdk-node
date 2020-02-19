/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ListenerSession } from './listenersession';
import { BlockEvent, BlockListener } from './blocklistener';
import { BlockEventSource } from './blockeventsource';
import {
	EventCallback,
	EventListener,
	EventService
} from 'fabric-common';

import * as Logger from '../../logger';
const logger = Logger.getLogger('BlockListenerSession');

export class BlockListenerSession implements ListenerSession {
	private readonly listener: BlockListener;
	private readonly eventSource: BlockEventSource;
	private readonly eventListener: BlockListener = this.notifyListener.bind(this);

	constructor(listener: BlockListener, eventSource: BlockEventSource) {
		this.listener = listener;
		this.eventSource = eventSource;
	}

	public async start() {
		await this.eventSource.addBlockListener(this.eventListener);
	}

	public close() {
		this.eventSource.removeBlockListener(this.eventListener);
	}

	private async notifyListener(blockEvent: BlockEvent) {
		try {
			await this.listener(blockEvent);
		} catch (error) {
			logger.error('Error notifying listener:', error);
		}
	}

}
