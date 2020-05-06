/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ListenerSession } from './listenersession';
import { BlockListener } from '../../events';
import { BlockEventSource } from './blockeventsource';

export class IsolatedBlockListenerSession implements ListenerSession {
	private readonly listener: BlockListener;
	private readonly eventSource: BlockEventSource;

	constructor(listener: BlockListener, eventSource: BlockEventSource) {
		this.listener = listener;
		this.eventSource = eventSource;
	}

	public async start() {
		await this.eventSource.addBlockListener(this.listener);
	}

	public close() {
		this.eventSource.removeBlockListener(this.listener);
		this.eventSource.close(); // Close non-shared event source
	}
}
