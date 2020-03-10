/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

import { Channel, Client, Endorser, Eventer, EventInfo, IdentityContext } from 'fabric-common';
import { BlockEvent, BlockListener } from '../../../src/impl/event/blocklistener';
import { EventServiceManager } from '../../../src/impl/event/eventservicemanager';
import { ListenerOptions, Network, NetworkImpl } from '../../../src/network';
import * as testUtils from '../../testutils';
import { StubEventService } from './stubeventservice';

import Long = require('long');

import Gateway = require('../../../src/gateway');

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

	beforeEach(async () => {
		eventService = new StubEventService('stub');

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getIdentity.returns({
			mspId: 'mspId'
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

		network = new NetworkImpl(gateway, channel);

		eventServiceManager = (network as any).eventServiceManager;

		listener = testUtils.newAsyncListener<BlockEvent>();
	});

	afterEach(() => {
		sinon.restore();
	});

	function newEventInfo(blockNumber: number | Long): EventInfo {
		const longBlockNumber = Long.fromValue(blockNumber);
		return {
			eventService: null,
			blockNumber: longBlockNumber,
			filteredBlock: {
				channel_id: 'channel',
				number: longBlockNumber.toString(),
				filtered_transactions: []
			}
		};
	}

	function newBlockEvent(blockNumber: number | Long): BlockEvent {
		return {
			type: 'filtered',
			blockNumber: Long.fromValue(blockNumber)
		};
	}

	it('add listener returns the listener', async () => {
		const result = await network.addBlockListener(listener);
		expect(result).to.equal(listener);
	});

	it('listener receives events', async () => {
		const event = newEventInfo(1);
		await network.addBlockListener(listener);
		eventService.sendEvent(event);

		const actual = await listener.completePromise;
		const expected = newBlockEvent(event.blockNumber);
		expect(actual[0]).to.deep.include(expected);
	});

	it('removed listener does not receive events', async () => {
		const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

		await network.addBlockListener(listener);
		await network.addBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		eventService.sendEvent(newEventInfo(1));

		await listener.completePromise;
		sinon.assert.notCalled(removedListener);
	});

	it('add listener multiple times has no effect', async () => {
		const spy = sinon.spy(listener);

		await network.addBlockListener(spy);
		await network.addBlockListener(spy);
		eventService.sendEvent(newEventInfo(1));

		await listener.completePromise;
		sinon.assert.calledOnce(spy);
	});

	it('remove listener multiple times has no effect', async () => {
		const removedListener = sinon.spy(testUtils.newAsyncListener<BlockEvent>());

		await network.addBlockListener(listener);
		await network.addBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		network.removeBlockListener(removedListener);
		eventService.sendEvent(newEventInfo(1));

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
		eventService.sendEvent(newEventInfo(1));
		// fake listener should have removed itself
		eventService.sendEvent(newEventInfo(2));

		await listener.completePromise;
		sinon.assert.calledOnce(fake);
	});

	it('listener does not auto-unregister when receiving events', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);

		await network.addBlockListener(listener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		network.removeBlockListener(listener);

		const expected1 = newBlockEvent(event1.blockNumber);
		const expected2 = newBlockEvent(event2.blockNumber);
		expect(actual[0]).to.deep.include(expected1);
		expect(actual[1]).to.deep.include(expected2);
	});

	it('error thrown by listener is handled', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const errorListener = sinon.fake.rejects(new Error('LISTENER_ERROR'));
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);

		await network.addBlockListener(listener);
		await network.addBlockListener(errorListener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		const expected1 = newBlockEvent(event1.blockNumber);
		const expected2 = newBlockEvent(event2.blockNumber);
		expect(actual[0]).to.deep.include(expected1);
		expect(actual[1]).to.deep.include(expected2);
	});

	it('listener receives blocks in order', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(3);
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);
		const event3 = newEventInfo(3);

		await network.addBlockListener(listener);
		eventService.sendEvent(event1);
		eventService.sendEvent(event3);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		const expected1 = newBlockEvent(event1.blockNumber);
		const expected2 = newBlockEvent(event2.blockNumber);
		const expected3 = newBlockEvent(event3.blockNumber);
		expect(actual[0]).to.deep.include(expected1);
		expect(actual[1]).to.deep.include(expected2);
		expect(actual[2]).to.deep.include(expected3);
	});

	it('listener does not receive old blocks', async () => {
		listener = testUtils.newAsyncListener<BlockEvent>(2);
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);
		const event3 = newEventInfo(3);

		await network.addBlockListener(listener);
		eventService.sendEvent(event2);
		eventService.sendEvent(event1); // Ignored as older than first block received
		eventService.sendEvent(event3);

		const actual = await listener.completePromise;
		const expected2 = newBlockEvent(event2.blockNumber);
		const expected3 = newBlockEvent(event3.blockNumber);
		expect(actual[0]).to.deep.include(expected2);
		expect(actual[1]).to.deep.include(expected3);
	});

	it('errors trigger reconnect of event service with no start block if no events received', async () => {
		await network.addBlockListener(listener);
		const startListener = testUtils.newAsyncListener<void>();
		const stub = sinon.stub(eventServiceManager, 'startEventService').callsFake(() => startListener());

		eventService.sendError(new Error('DISCONNECT'));

		await startListener.completePromise;
		sinon.assert.calledWith(stub, eventService);
		sinon.assert.neverCalledWith(stub, sinon.match.any, sinon.match.has('startBlock', sinon.match.number));
	});

	it('errors trigger reconnect of event service with next block as start block if events received', async () => {
		await network.addBlockListener(listener);
		const startListener = testUtils.newAsyncListener<void>();
		const stub = sinon.stub(eventServiceManager, 'startEventService').callsFake(() => startListener());

		eventService.sendEvent(newEventInfo(1));
		eventService.sendError(new Error('DISCONNECT'));

		await startListener.completePromise;
		sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.fromNumber(2)));
	});

	it('replay listener sends start block to event service', async () => {
		const stub = sinon.stub(eventServiceManager, 'startEventService');

		const options: ListenerOptions = {
			startBlock: 2
		};
		await network.addBlockListener(listener, options);

		sinon.assert.calledWith(stub, eventService, sinon.match.has('startBlock', Long.fromNumber(2)));
	});

	it('replay listener does not receive events earlier than start block', async () => {
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);

		const options: ListenerOptions = {
			startBlock: 2
		};
		await network.addBlockListener(listener, options);
		eventService.sendEvent(event1);
		eventService.sendEvent(event2);

		const actual = await listener.completePromise;
		const expected = newBlockEvent(event2.blockNumber);
		expect(actual[0]).to.deep.include(expected);
	});

	it('replay listener does not miss start block if later block arrive first', async () => {
		const event1 = newEventInfo(1);
		const event2 = newEventInfo(2);

		const options: ListenerOptions = {
			startBlock: 1
		};
		await network.addBlockListener(listener, options);
		eventService.sendEvent(event2);
		eventService.sendEvent(event1);

		const actual = await listener.completePromise;
		const expected = newBlockEvent(event1.blockNumber);
		expect(actual[0]).to.deep.include(expected);
	});

	it('remove of realtime listener does not close shared event service', async () => {
		const stub = sinon.stub(eventService, 'close');

		await network.addBlockListener(listener);
		network.removeBlockListener(listener);

		sinon.assert.notCalled(stub);
	});

	it('remove of replay listener closes isolated event service', async () => {
		const stub = sinon.stub(eventService, 'close');

		const options: ListenerOptions = {
			startBlock: 1
		};
		await network.addBlockListener(listener, options);
		network.removeBlockListener(listener);

		sinon.assert.called(stub);
	});
});
