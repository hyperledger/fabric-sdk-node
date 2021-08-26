/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {BlockEvent} from '../../../src/events';
import {OrderedBlockQueue} from '../../../src/impl/event/orderedblockqueue';
import * as Long from 'long';

import chai = require('chai');
const expect = chai.expect;



describe('OrderedBlockQueue', () => {
	let queue: OrderedBlockQueue;

	beforeEach(() => {
		queue = new OrderedBlockQueue();
	});

	function newBlock(blockNumber: number): BlockEvent {
		return {
			blockNumber: Long.fromNumber(blockNumber),
			blockData: {
				channel_id: 'channel_id',
				number: 10,
				filtered_transactions: []
			},
			getTransactionEvents: () => []
		};
	}

	it('next block for empty queue is undefined', () => {
		const result = queue.getNextBlock();
		expect(result).to.be.undefined;
	});

	it('first block added can be retrieved', () => {
		const block = newBlock(1);

		queue.addBlock(block);
		const result = queue.getNextBlock();

		expect(result).to.equal(block);
	});

	it('lower block numbers are ignored', () => {
		const block1 = newBlock(1);
		const block2 = newBlock(2);

		queue.addBlock(block2);
		queue.addBlock(block1);
		const result1 = queue.getNextBlock();
		const result2 = queue.getNextBlock();

		expect(result1).to.equal(block2);
		expect(result2).to.be.undefined;
	});

	it('orders out-of-order blocks', () => {
		const block1 = newBlock(1);
		const block2 = newBlock(2);
		const block3 = newBlock(3);

		queue.addBlock(block1);
		queue.addBlock(block3);
		queue.addBlock(block2);
		const result1 = queue.getNextBlock();
		const result2 = queue.getNextBlock();
		const result3 = queue.getNextBlock();

		expect(result1).to.equal(block1);
		expect(result2).to.equal(block2);
		expect(result3).to.equal(block3);
	});

	it('empty queue has size zero', () => {
		const result = queue.size();
		expect(result).to.equal(0);
	});

	it('add block increases queue size', () => {
		queue.addBlock(newBlock(1));
		const result = queue.size();

		expect(result).to.equal(1);
	});

	it('retrieve block decreases queue size', () => {
		queue.addBlock(newBlock(1));
		queue.getNextBlock();
		const result = queue.size();

		expect(result).to.equal(0);
	});

	it('queue size does not go below zero', () => {
		queue.getNextBlock();
		const result = queue.size();

		expect(result).to.equal(0);
	});

	it('ignores block numbers lower than start block', () => {
		queue = new OrderedBlockQueue(Long.fromNumber(2));

		queue.addBlock(newBlock(1));
		const result = queue.size();

		expect(result).to.equal(0);
	});

	it('accepts block numbers same or higher than start block', () => {
		queue = new OrderedBlockQueue(Long.ONE);

		queue.addBlock(newBlock(2));
		queue.addBlock(newBlock(1));
		const result = queue.size();

		expect(result).to.equal(2);
	});

	it('next block number for empty queue without start block is undefined', () => {
		const result = queue.getNextBlockNumber();
		expect(result).to.be.undefined;
	});

	it('next block number for empty queue with start block is start block', () => {
		const startBlock = Long.ONE;
		queue = new OrderedBlockQueue(startBlock);

		const result = queue.getNextBlockNumber();

		expect(result?.toString()).to.equal(startBlock.toString());
	});

	it('next block number is first added block number', () => {
		const block = newBlock(1);

		queue.addBlock(block);
		const result = queue.getNextBlockNumber();

		expect(result?.toString()).to.equal(block.blockNumber.toString());
	});

	it('next block number is last retrieved block number plus one', () => {
		const block = newBlock(1);

		queue.addBlock(block);
		queue.getNextBlock();
		const result = queue.getNextBlockNumber();

		const expected = block.blockNumber.add(1);
		expect(result?.toString()).to.equal(expected.toString());
	});
});
