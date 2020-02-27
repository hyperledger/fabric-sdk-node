/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

import * as testUtils from '../../testutils';

import {
	EventService,
	IdentityContext
} from 'fabric-common';
import Long = require('long');

import { Network, NetworkImpl, ListenerOptions } from '../../../src/network';
import { EventServiceManager } from '../../../src/impl/event/eventservicemanager';
import Gateway = require('../../../src/gateway');
import { StubEventService } from './stubeventservice';
import { BlockEvent, BlockListener } from '../../../src/impl/event/blocklistener';
import { BlockEventSource } from '../../../src/impl/event/blockeventsource';

interface StubBlockListener extends BlockListener {
	completePromise: Promise<BlockEvent[]>;
}

describe('block listener', () => {
	let eventServiceManager: sinon.SinonStubbedInstance<EventServiceManager>;
	let eventService: StubEventService;
	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: Network;
	let listener: StubBlockListener;

	beforeEach(async () => {
		eventService = new StubEventService('stub');

		eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.newFailoverEventService.returns(eventService);

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getIdentity.returns({
			mspId: 'mspId'
		});

		network = new NetworkImpl(gateway, null);
		(network as any).realtimeBlockEventSource = new BlockEventSource(eventServiceManager as any);
		(network as any).eventServiceManager = eventServiceManager;

		listener = testUtils.newAsyncListener<BlockEvent>();
	});

	afterEach(() => {
		sinon.restore();
	});

	function newEvent(blockNumber: number) {
		return {
			eventService,
			blockNumber: new Long(blockNumber)
		};
	}

	it('add listener returns the listener', async () => {
		const result = await network.addBlockListener(listener);
		expect(result).to.equal(listener);
	});

	it('listener receives events', async () => {
		const event = newEvent(1);
		await network.addBlockListener(listener);
		eventService.sendEvent(event);

		const actual = await listener.completePromise;
		expect(actual).to.deep.equal([event]);
	});

	it('removed listener does not receive events', async () => {
		const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

		await network.addBlockListener(listener);
		await network.addBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		eventService.sendEvent(newEvent(1));

		await listener.completePromise;
		sinon.assert.notCalled(removedListener);
	});

	it('add listener multiple times has no effect', async () => {
		const spy = sinon.spy(listener);

		await network.addBlockListener(spy);
		await network.addBlockListener(spy);
		eventService.sendEvent(newEvent(1));

		await listener.completePromise;
		sinon.assert.calledOnce(spy);
	});

	it('remove listener multiple times has no effect', async () => {
		const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

		await network.addBlockListener(listener);
		await network.addBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		eventService.sendEvent(newEvent(1));

		await listener.completePromise;
		sinon.assert.notCalled(removedListener);
	});

	it('listener can remove itself when receiving event', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const fake = sinon.fake(async (event: BlockEvent) => {
			network.removeBlockListener(fake);
		});

		await network.addBlockListener(listener);
		await network.addBlockListener(fake);
		eventService.sendEvent(newEvent(1));
		// fake listener should have removed itself
		eventService.sendEvent(newEvent(2));

		await listener.completePromise;
		sinon.assert.calledOnce(fake);
	});

	it('listener does not auto-unregister when receiving events', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const event1 = newEvent(1);
		const event2 = newEvent(2);

		await network.addBlockListener(listener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		network.removeBlockListener(listener);

		expect(actual).to.deep.equal([event1, event2]);
	});

	it('error thrown by listener is handled', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const errorListener = sinon.fake.rejects(new Error('LISTENER_ERROR'));
		const event1 = newEvent(1);
		const event2 = newEvent(2);

		await network.addBlockListener(listener);
		await network.addBlockListener(errorListener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		expect(actual).to.deep.equal([event1, event2]);
	});

	it('listener receives blocks in order', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(3);
		const event1 = newEvent(1);
		const event2 = newEvent(2);
		const event3 = newEvent(3);

		await network.addBlockListener(listener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event3);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		expect(actual).to.deep.equal([event1, event2, event3]);
	});

	it('listener does not receive old blocks', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const event1 = newEvent(1);
		const event2 = newEvent(2);
		const event3 = newEvent(3);

		await network.addBlockListener(listener);
		eventService.sendEvent(event2);
		eventService.sendEvent(event1); // Ignored as older than first block received
		eventService.sendEvent(event3);

		const actual = await listener.completePromise;
		expect(actual).to.deep.equal([event2, event3]);
	});

	it('errors trigger reconnect of event service with no start block if no events received', async () => {
		await network.addBlockListener(listener);
		eventServiceManager.startEventService.resetHistory();
		const startListener = testUtils.newAsyncListener<void>(1);
		eventServiceManager.startEventService.callsFake(() => startListener());

		eventService.sendError(new Error('DISCONNECT'));

		await startListener.completePromise;
		sinon.assert.calledWith(eventServiceManager.startEventService, eventService);
		sinon.assert.neverCalledWith(eventServiceManager.startEventService, sinon.match.any, sinon.match.has('startBlock', sinon.match.number));
	});

	it('errors trigger reconnect of event service with next block as start block if events received', async () => {
		await network.addBlockListener(listener);
		eventServiceManager.startEventService.resetHistory();
		const startListener = testUtils.newAsyncListener<void>(1);
		eventServiceManager.startEventService.callsFake(() => startListener());

		eventService.sendEvent(newEvent(1));
		eventService.sendError(new Error('DISCONNECT'));

		await startListener.completePromise;
		sinon.assert.calledWith(eventServiceManager.startEventService, eventService, sinon.match.has('startBlock', Long.fromNumber(2)));
	});

	it('replay listener sends start block to event service', async () => {
		const options: ListenerOptions = {
			startBlock: 2
		};
		await network.addBlockListener(listener, options);

		sinon.assert.calledWith(eventServiceManager.startEventService, eventService, sinon.match.has('startBlock', Long.fromNumber(2)));
	});

	it('replay listener does not receive events earlier than start block', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(1);
		const event1 = newEvent(1);
		const event2 = newEvent(2);

		const options: ListenerOptions = {
			startBlock: 2
		};
		await network.addBlockListener(listener, options);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		expect(actual).to.deep.equal([event2]);
	});
});
