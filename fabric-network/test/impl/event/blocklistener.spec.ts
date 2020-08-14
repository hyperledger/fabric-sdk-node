/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

import { Channel, Client, Endorser, Eventer, EventInfo, IdentityContext } from 'fabric-common';
import { BlockEvent, BlockListener, ListenerOptions } from '../../../src/events';
import { EventServiceManager } from '../../../src/impl/event/eventservicemanager';
import { Network, NetworkImpl } from '../../../src/network';
import * as testUtils from '../../testutils';
import { StubEventService } from './stubeventservice';

import Long = require('long');

import { Gateway } from '../../../src/gateway';
import { StubCheckpointer } from './stubcheckpointer';

interface StubBlockListener extends BlockListener {
	completePromise: Promise<BlockEvent[]>;
}

describe('block listener', () => {
	let eventServiceManager: EventServiceManager;
	let eventService: StubEventService;
	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: Network;
	let channel: sinon.SinonStubbedInstance<Channel>;
	let listener: StubBlockListener;
	let listenerOptions: ListenerOptions;

	beforeEach(async () => {
		eventService = new StubEventService('stub');

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getIdentity.returns({
			mspId: 'mspId',
			type: 'stub'
		});

		channel = sinon.createStubInstance(Channel);
		channel.newEventService.returns(eventService);

		const endorser = sinon.createStubInstance(Endorser);
		(endorser as any).name = 'endorser';
		channel.getEndorsers.returns([endorser]);

		const client = sinon.createStubInstance(Client);
		const eventer = sinon.createStubInstance(Eventer);
		client.newEventer.returns(eventer);
		(channel as any).client = client;

		network = new NetworkImpl(gateway as unknown as Gateway, channel);

		eventServiceManager = (network as any).eventServiceManager;

		listener = testUtils.newAsyncListener<BlockEvent>();
		listenerOptions = {
			type: 'filtered'
		};
	});

	afterEach(() => {
		sinon.restore();
	});

	function newFilteredBlockEventInfo(blockNumber: number | Long): EventInfo {
		const longBlockNumber = Long.fromValue(blockNumber);
		return {
			eventService: null,
			blockNumber: longBlockNumber,
			filteredBlock: {
				channel_id: 'channel',
				number: longBlockNumber,
				filtered_transactions: []
			}
		};
	}

	function newFullBlockEventInfo(blockNumber: number | Long): EventInfo {
		const longBlockNumber = Long.fromValue(blockNumber);
		return {
			eventService: null,
			blockNumber: longBlockNumber,
			block: {
				header: undefined,
				data: {
					data: []
				},
				metadata: undefined
			}
		};
	}

	function newPrivateBlockEventInfo(blockNumber: number | Long): EventInfo {
		return Object.assign(newFullBlockEventInfo(blockNumber), {
			privateData: [
				'PRIVATE_DATA'
			]
		});
	}

	describe('common behavior', () => {
		it('add listener returns the listener', async () => {
			const result = await network.addBlockListener(listener, listenerOptions);
			expect(result).to.equal(listener);
		});

		it('listener receives events', async () => {
			const event = newFilteredBlockEventInfo(1);
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event);

			const actual = await listener.completePromise;
			expect(actual[0].blockNumber).to.equal(event.blockNumber);
		});

		it('removed listener does not receive events', async () => {
			const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

			await network.addBlockListener(listener, listenerOptions);
			await network.addBlockListener(removedListener, listenerOptions);
			network.removeBlockListener(removedListener);
			eventService.sendEvent(newFilteredBlockEventInfo(1));

			await listener.completePromise;
			sinon.assert.notCalled(removedListener);
		});

		it('add listener multiple times has no effect', async () => {
			const spy = sinon.spy(listener);

			await network.addBlockListener(spy, listenerOptions);
			await network.addBlockListener(spy, listenerOptions);
			eventService.sendEvent(newFilteredBlockEventInfo(1));

			await listener.completePromise;
			sinon.assert.calledOnce(spy);
		});

		it('remove listener multiple times has no effect', async () => {
			const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

			await network.addBlockListener(listener, listenerOptions);
			await network.addBlockListener(removedListener, listenerOptions);
			network.removeBlockListener(removedListener);
			network.removeBlockListener(removedListener);
			eventService.sendEvent(newFilteredBlockEventInfo(1));

			await listener.completePromise;
			sinon.assert.notCalled(removedListener);
		});

		it('listener can remove itself when receiving event', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const fake = sinon.fake(async (event: BlockEvent) => {
				network.removeBlockListener(fake);
			});

			await network.addBlockListener(listener, listenerOptions);
			await network.addBlockListener(fake, listenerOptions);
			eventService.sendEvent(newFilteredBlockEventInfo(1));
			// fake listener should have removed itself
			eventService.sendEvent(newFilteredBlockEventInfo(2));

			await listener.completePromise;
			sinon.assert.calledOnce(fake);
		});

		it('listener does not auto-unregister when receiving events', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);

			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event2);

			const actual = await listener.completePromise;
			network.removeBlockListener(listener);

			const blockNumbers = actual.map((e) => e.blockNumber);
			expect(blockNumbers).to.deep.equal([event1.blockNumber, event2.blockNumber]);
		});

		it('error thrown by listener does not stop subsequent events being delivered', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const errorListener = sinon.fake(async (event) => {
				await listener(event);
				throw new Error('LISTENER_ERROR');
			});
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);

			await network.addBlockListener(errorListener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event2);

			const actual = await listener.completePromise;
			const blockNumbers = actual.map((e) => e.blockNumber);
			expect(blockNumbers).to.deep.equal([event1.blockNumber, event2.blockNumber]);
		});

		it('error thrown by listener does not stop other listeners being notified', async () => {
			const listener2 = testUtils.newAsyncListener<BlockEvent>();
			const errorListener = sinon.fake.rejects(new Error('LISTENER_ERROR'));
			const event = newFilteredBlockEventInfo(1);

			await network.addBlockListener(listener, listenerOptions);
			await network.addBlockListener(errorListener, listenerOptions);
			await network.addBlockListener(listener2, listenerOptions);
			eventService.sendEvent(event);

			const [actual1] = await listener.completePromise;
			const [actual2] = await listener2.completePromise;
			expect(actual1.blockNumber).to.deep.equal(event.blockNumber);
			expect(actual2.blockNumber).to.deep.equal(event.blockNumber);
		});

		it('listener receives blocks in order', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(3);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);
			const event3 = newFilteredBlockEventInfo(3);

			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event3);
			eventService.sendEvent(event2);

			const actual = await listener.completePromise;
			const blockNumbers = actual.map((e) => e.blockNumber);
			expect(blockNumbers).to.deep.equal([event1.blockNumber, event2.blockNumber, event3.blockNumber]);
		});

		it('listener does not receive old blocks', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);
			const event3 = newFilteredBlockEventInfo(3);

			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event2);
			eventService.sendEvent(event1); // Ignored as older than first block received
			eventService.sendEvent(event3);

			const actual = await listener.completePromise;
			const blockNumbers = actual.map((e) => e.blockNumber);
			expect(blockNumbers).to.deep.equal([event2.blockNumber, event3.blockNumber]);
		});

		it('errors trigger reconnect of event service with no start block if no events received', async () => {
			await network.addBlockListener(listener, listenerOptions);
			const startListener = testUtils.newAsyncListener<void>();
			const stub = sinon.stub(eventServiceManager, 'startEventService').callsFake(() => startListener());

			eventService.sendError(new Error('DISCONNECT'));

			await startListener.completePromise;
			sinon.assert.calledWith(stub, eventService);
			sinon.assert.neverCalledWith(stub, sinon.match.any, sinon.match.has('startBlock', sinon.match.defined));
		});

		it('errors trigger reconnect of event service with last received block as start block if events received', async () => {
			await network.addBlockListener(listener, listenerOptions);
			const startListener = testUtils.newAsyncListener<void>();
			const stub = sinon.stub(eventServiceManager, 'startEventService').callsFake(() => startListener());

			eventService.sendEvent(newFilteredBlockEventInfo(1));
			eventService.sendError(new Error('DISCONNECT'));

			await startListener.completePromise;
			sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.ONE));
		});

		it('listener does not receive old blocks on reconnect', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);
			const startListener = testUtils.newAsyncListener<void>(2);
			const stub = sinon.stub(eventServiceManager, 'startEventService').callsFake(() => startListener());

			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendError(new Error('DISCONNECT'));

			await startListener.completePromise;

			eventService.sendEvent(event1);
			eventService.sendEvent(event2);

			const actual = await listener.completePromise;
			const blockNumbers = actual.map((e) => e.blockNumber);
			expect(blockNumbers).to.deep.equal([event1.blockNumber, event2.blockNumber]);
		});

		it('listener changing event data does not affect other listeners', async () => {
			const fake1 = sinon.fake(async (e) => {
				await listener(e);
				e.blockNumber = Long.ONE;
			});
			const listener2 = testUtils.newAsyncListener<BlockEvent>();
			const fake2 = sinon.fake(async (e) => {
				await listener2(e);
				e.blockNumber = Long.fromNumber(2);
			});
			const event = newFilteredBlockEventInfo(0);

			await network.addBlockListener(fake1, listenerOptions);
			await network.addBlockListener(fake2, listenerOptions);
			eventService.sendEvent(event);

			const [actual1] = await listener.completePromise;
			const [actual2] = await listener2.completePromise;
			expect(actual1.blockNumber).to.deep.equal(event.blockNumber);
			expect(actual2.blockNumber).to.deep.equal(event.blockNumber);
		});
	});

	describe('realtime', () => {
		it('remove of realtime filtered listener does not close shared event service', async () => {
			const stub = sinon.stub(eventService, 'close');

			await network.addBlockListener(listener, listenerOptions);
			network.removeBlockListener(listener);

			sinon.assert.notCalled(stub);
		});

		it('remove of realtime full listener does not close shared event service', async () => {
			const stub = sinon.stub(eventService, 'close');

			listenerOptions = {
				type: 'full'
			};
			await network.addBlockListener(listener, listenerOptions);
			network.removeBlockListener(listener);

			sinon.assert.notCalled(stub);
		});
	});

	describe('replay', () => {
		it('replay listener sends (startBlock - 1) to event service', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			listenerOptions.startBlock = 1;
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.ZERO));
		});

		it('replay listener does not send start block less than zero to event service', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			listenerOptions.startBlock = 0;
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.ZERO));
		});

		it('replay listener does not receive events earlier than start block', async () => {
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);

			listenerOptions.startBlock = 2;
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event2);

			const [actual] = await listener.completePromise;
			expect(actual.blockNumber).to.equal(event2.blockNumber);
		});

		it('replay listener does not miss start block if later block arrive first', async () => {
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);

			listenerOptions.startBlock = 1;
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event2);
			eventService.sendEvent(event1);

			const actual = await listener.completePromise;
			expect(actual[0].blockNumber).to.equal(event1.blockNumber);
		});

		it('remove of replay listener closes isolated event service', async () => {
			const stub = sinon.stub(eventService, 'close');

			listenerOptions.startBlock = 1;
			await network.addBlockListener(listener, listenerOptions);
			network.removeBlockListener(listener);

			sinon.assert.called(stub);
		});
	});

	describe('default options', () => {
		it('listener defaults to full blocks', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			await network.addBlockListener(listener);

			sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', 'full'));
		});

		it('listener defaults to no start block', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			await network.addBlockListener(listener);

			sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('startBlock', undefined));
		});
	});

	describe('event types', () => {
		it('listener can specify filtered blocks', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			listenerOptions = {
				type: 'filtered'
			};
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', 'filtered'));
		});

		it('listener can specify private blocks', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');

			listenerOptions = {
				type: 'private'
			};
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledOnceWithExactly(stub, sinon.match.any, sinon.match.has('blockType', 'private'));
		});

		it('listener receives full block events', async () => {
			const event = newFullBlockEventInfo(1);
			listenerOptions = {
				type: 'full'
			};
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event);

			const [actual] = await listener.completePromise;
			expect(actual.blockNumber).to.equal(event.blockNumber);
		});

		it('listener receives private block events', async () => {
			const event = newPrivateBlockEventInfo(1);
			listenerOptions = {
				type: 'private'
			};
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event);

			const [actual] = await listener.completePromise;
			expect(actual.blockNumber).to.equal(event.blockNumber);
		});
	});

	describe('checkpoint', () => {
		it('new checkpoint listener receives events', async () => {
			const event = newFilteredBlockEventInfo(1);
			listenerOptions.checkpointer = new StubCheckpointer();

			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event);

			const [actual] = await listener.completePromise;
			expect(actual.blockNumber).to.equal(event.blockNumber);
		});

		it('checkpoint listener sends (block number - 1) to event service', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');
			const checkpointer = new StubCheckpointer();
			await checkpointer.setBlockNumber(Long.fromNumber(2));

			listenerOptions.checkpointer = checkpointer;
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.ONE));
		});

		it('checkpoint block number takes precedence over startBlock option', async () => {
			const stub = sinon.stub(eventServiceManager, 'startEventService');
			const checkpointer = new StubCheckpointer();
			await checkpointer.setBlockNumber(Long.ONE);

			listenerOptions.checkpointer = checkpointer;
			listenerOptions.startBlock = 10;
			await network.addBlockListener(listener, listenerOptions);

			sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.ZERO));
		});

		it('checkpoint listener receives events from checkpoint block number', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);
			const event3 = newFilteredBlockEventInfo(3);
			const checkpointer = new StubCheckpointer();
			await checkpointer.setBlockNumber(Long.fromNumber(2));

			listenerOptions.checkpointer = checkpointer;
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event3);
			eventService.sendEvent(event2);

			const [actual1, actual2] = await listener.completePromise;
			expect(actual1.blockNumber).to.equal(event2.blockNumber);
			expect(actual2.blockNumber).to.equal(event3.blockNumber);
		});

		it('new checkpoint listener receives events from startBlock', async () => {
			listener = testUtils.newAsyncListener<BlockEvent>(2);
			const event1 = newFilteredBlockEventInfo(1);
			const event2 = newFilteredBlockEventInfo(2);
			const event3 = newFilteredBlockEventInfo(3);

			listenerOptions.checkpointer = new StubCheckpointer();
			listenerOptions.startBlock = 2;
			await network.addBlockListener(listener, listenerOptions);
			eventService.sendEvent(event1);
			eventService.sendEvent(event3);
			eventService.sendEvent(event2);

			const [actual1, actual2] = await listener.completePromise;
			expect(actual1.blockNumber).to.equal(event2.blockNumber);
			expect(actual2.blockNumber).to.equal(event3.blockNumber);
		});
	});
});
