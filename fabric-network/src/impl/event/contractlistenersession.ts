/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockEvent, BlockListener, ContractEvent, ContractListener, ListenerOptions } from '../../events';
import * as Logger from '../../logger';
import { Network } from '../../network';
import { ListenerSession } from './listenersession';
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
		this.blockListener = (blockEvent: BlockEvent) => this.onBlockEvent(blockEvent);
		this.options = options;
	}

	public async start() {
		await this.network.addBlockListener(this.blockListener, this.options);
	}

	public close() {
		this.network.removeBlockListener(this.blockListener);
	}

	private async onBlockEvent(blockEvent: BlockEvent): Promise<void> {
		for (const transactionEvent of blockEvent.getTransactionEvents()) {
			for (const contractEvent of transactionEvent.getContractEvents()) {
				if (this.isMatch(contractEvent)) {
					await this.notifyListener(contractEvent);
				}
			}
		}
	}

	private isMatch(event: ContractEvent): boolean {
		return event.getChaincodeId() === this.chaincodeId;
	}

	private async notifyListener(event: ContractEvent): Promise<void> {
		try {
			await this.listener(event);
		} catch (error) {
			logger.warn('Error notifying contract listener', error);
		}
	}
}
