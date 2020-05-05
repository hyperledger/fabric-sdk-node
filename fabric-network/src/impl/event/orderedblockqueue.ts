/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockEvent } from '../../events';
import Long = require('long');

export class OrderedBlockQueue {
	private readonly queue = new Map<string, BlockEvent>();
	private nextBlockNumber?: Long;

	constructor(startBlock?: Long) {
		this.nextBlockNumber = startBlock;
	}

	addBlock(event: BlockEvent) {
		const blockNumber = event.blockNumber;
		if (!this.isNewBlockNumber(blockNumber)) {
			return;
		}

		const key = this.blockNumberToKey(blockNumber);
		this.queue.set(key, event);
		if (!this.nextBlockNumber) {
			this.nextBlockNumber = blockNumber;
		}
	}

	getNextBlock(): BlockEvent | undefined {
		if (!this.nextBlockNumber) {
			return;
		}

		const key = this.blockNumberToKey(this.nextBlockNumber);
		const event = this.queue.get(key);
		if (event) {
			this.queue.delete(key);
			this.nextBlockNumber = this.nextBlockNumber.add(Long.ONE);
		}

		return event;
	}

	getNextBlockNumber() {
		return this.nextBlockNumber;
	}

	size() {
		return this.queue.size;
	}

	private isNewBlockNumber(blockNumber: Long) {
		return !this.nextBlockNumber || this.nextBlockNumber.lessThanOrEqual(blockNumber);
	}

	private blockNumberToKey(blockNumber: Long) {
		return blockNumber.toString();
	}
}
