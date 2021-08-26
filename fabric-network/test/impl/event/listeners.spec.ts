/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Listeners from '../../../src/impl/event/listeners';
import {StubCheckpointer} from './stubcheckpointer';
import {BlockEvent, BlockListener, TransactionEvent, ContractEvent} from '../../../src/events';
import * as Long from 'long';
import chai = require('chai');
import sinon = require('sinon');

const expect = chai.expect;

describe('listeners', () => {
	const contractEvent: ContractEvent = Object.freeze({
		chaincodeId: 'CHAINCODE_ID',
		eventName: 'EVENT_NAME',
		getTransactionEvent: () => undefined
	});

	const transactionId = 'TRANSACTION_ID';
	const transactionEvent: TransactionEvent = Object.freeze({
		transactionId,
		status: 'VALID',
		isValid: true,
		transactionData: undefined,
		getBlockEvent: () => undefined,
		getContractEvents: () => [contractEvent]
	});

	const currentBlockNumber = Long.ONE;
	const nextBlockNumber = currentBlockNumber.add(1);
	const blockEvent: BlockEvent = Object.freeze({
		blockNumber: currentBlockNumber,
		blockData: undefined,
		getTransactionEvents: () => [transactionEvent]
	});

	const noOpListener = () => undefined;

	let checkpointer:StubCheckpointer;

	beforeEach(() => {
		checkpointer = new StubCheckpointer();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#checkpointBlockListener', () => {
		it('new checkpoint block number set after processing event', async () => {
			const checkpointListener = Listeners.checkpointBlockListener(noOpListener, checkpointer);

			await checkpointListener(blockEvent);

			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(nextBlockNumber.toNumber());
		});

		it('checkpoint block number incremented after processing event', async () => {
			await checkpointer.setBlockNumber(currentBlockNumber);
			const checkpointListener = Listeners.checkpointBlockListener(noOpListener, checkpointer);

			await checkpointListener(blockEvent);

			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(nextBlockNumber.toNumber());
		});

		it('checkpoint block number not incremented on listener failure', async () => {
			const listener: BlockListener = () => Promise.reject(new Error('LISTENER_FAIL'));
			await checkpointer.setBlockNumber(currentBlockNumber);
			const checkpointListener = Listeners.checkpointBlockListener(listener, checkpointer);

			try {
				await checkpointListener(blockEvent);
			} catch (err) {
				// Ignore errors
			}

			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(currentBlockNumber.toNumber());
		});

		it('ignores events with unexpected block numbers', async () => {
			const listener = sinon.fake();
			await checkpointer.setBlockNumber(Long.ZERO);
			const checkpointListener = Listeners.checkpointBlockListener(listener, checkpointer);

			await checkpointListener(blockEvent);

			sinon.assert.notCalled(listener);
			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(0);
		});
	});

	describe('#blockFromContractListener', () => {
		it('received transaction IDs registered with checkpointer', async () => {
			const spy = sinon.spy(checkpointer, 'addTransactionId');
			const checkpointListener = Listeners.blockFromContractListener(noOpListener, checkpointer);

			await checkpointListener(blockEvent);

			sinon.assert.calledOnceWithExactly(spy, transactionId);
		});

		it('checkpoint block number incremented after processing event', async () => {
			await checkpointer.setBlockNumber(currentBlockNumber);
			const checkpointListener = Listeners.blockFromContractListener(noOpListener, checkpointer);

			await checkpointListener(blockEvent);

			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(nextBlockNumber.toNumber());
		});

		it('ignores previously seen transaction IDs', async () => {
			const listener = sinon.fake();
			const checkpointListener = Listeners.blockFromContractListener(listener, checkpointer);
			await checkpointer.addTransactionId(transactionId);

			await checkpointListener(blockEvent);

			sinon.assert.notCalled(listener);
		});

		it('transaction ID not registered with checkpointer on listener failure', async () => {
			const spy = sinon.spy(checkpointer, 'addTransactionId');
			const listener = () => {
				throw new Error('LISTENER_FAIL');
			};
			const checkpointListener = Listeners.blockFromContractListener(listener, checkpointer);

			try {
				await checkpointListener(blockEvent);
			} catch (err) {
				// Ignore error
			}

			sinon.assert.notCalled(spy);
		});

		it('checkpoint block number not incremented on listener failure', async () => {
			const listener = () => {
				throw new Error('LISTENER_FAIL');
			};
			await checkpointer.setBlockNumber(currentBlockNumber);
			const checkpointListener = Listeners.blockFromContractListener(listener, checkpointer);

			try {
				await checkpointListener(blockEvent);
			} catch (err) {
				// Ignore error
			}

			const blockNumber = await checkpointer.getBlockNumber();
			expect(blockNumber.toNumber()).to.equal(currentBlockNumber.toNumber());
		});
	});
});
