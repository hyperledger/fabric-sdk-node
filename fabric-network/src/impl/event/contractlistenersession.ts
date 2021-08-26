/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {BlockListener, ContractEvent, ContractListener, ListenerOptions} from '../../events';
import * as Logger from '../../logger';
import {Network} from '../../network';
import * as Listeners from './listeners';
import {ListenerSession} from './listenersession';
const logger = Logger.getLogger('ContractListenerSession');

export class ContractListenerSession implements ListenerSession {
	private readonly listener: ContractListener;
	private chaincodeId: string;
	private network: Network;
	private blockListener: BlockListener;
	private options: ListenerOptions | undefined;

	constructor(listener: ContractListener, chaincodeId: string, network: Network, options?: ListenerOptions) {
		this.listener = listener;
		this.chaincodeId = chaincodeId;
		this.network = network;
		this.blockListener = this.newBlockListener(options);
		this.options = options;
	}

	public async start():Promise<void> {
		await this.network.addBlockListener(this.blockListener, this.options);
	}

	public close():void {
		this.network.removeBlockListener(this.blockListener);
	}

	private newBlockListener(options?: ListenerOptions): BlockListener {
		const callback = this.onContractEvent.bind(this);
		return Listeners.blockFromContractListener(callback, options?.checkpointer);
	}

	private async onContractEvent(event: ContractEvent): Promise<void> {
		if (this.isMatch(event)) {
			await this.notifyListener(event);
		}
	}

	private isMatch(event: ContractEvent): boolean {
		return event.chaincodeId === this.chaincodeId;
	}

	private async notifyListener(event: ContractEvent): Promise<void> {
		try {
			await this.listener(event);
		} catch (error) {
			logger.warn('Error notifying contract listener', error);
		}
	}
}
