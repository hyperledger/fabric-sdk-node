/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

import {
	Endorser,
	EventInfo,
	IdentityContext,
	Channel,
	Client,
	Eventer
} from 'fabric-common';
import Long = require('long');

import {NetworkImpl} from '../../../src/network';
import {EventServiceManager} from '../../../src/impl/event/eventservicemanager';
import {Gateway} from '../../../src/gateway';
import {StubEventService} from './stubeventservice';
import {CommitEvent} from '../../../src/events';

describe('commit listener', () => {
	let eventServiceManager: EventServiceManager;
	let eventService: StubEventService;
	let peer: Endorser;
	let peers: Endorser[];
	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: NetworkImpl;
	let channel: sinon.SinonStubbedInstance<Channel>;
	let eventInfo: EventInfo;
	const transactionId = 'TX_ID';

	beforeEach(() => {
		peer = sinon.createStubInstance(Endorser);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
		(peer as any).name = 'peer1';
		peers = [peer];

		eventService = new StubEventService(peer.name);

		eventInfo = {
			eventService,
			blockNumber: new Long(1),
			transactionId,
			status: 'VALID'
		};

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getIdentity.returns({
			mspId: 'mspId',
			type: 'stub'
		});

		channel = sinon.createStubInstance(Channel);
		channel.newEventService.returns(eventService);

		const client = sinon.createStubInstance(Client);
		const eventer = sinon.createStubInstance(Eventer);
		client.newEventer.withArgs(peer.name).returns(eventer);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
		(channel as any).client = client;

		network = new NetworkImpl(gateway as unknown as Gateway, channel);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
		eventServiceManager = (network as any).eventServiceManager as EventServiceManager;
	});

	afterEach(() => {
		sinon.restore();
	});

	it('add listener returns the listener', async () => {
		const listener = sinon.fake();

		const result = await network.addCommitListener(listener, peers, transactionId);

		expect(result).to.equal(listener);
	});

	it('listener receives events', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendEvent(eventInfo);

		sinon.assert.calledOnce(listener);
		sinon.assert.calledWith(listener, undefined, sinon.match((event: CommitEvent) => {
			return event.transactionId === eventInfo.transactionId;
		}));
	});

	it('events include endorser', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendEvent(eventInfo);

		sinon.assert.calledWith(listener, undefined, sinon.match((event: CommitEvent) => {
			return event.peer === peer;
		}));
	});

	it('listener receives errors', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_ERROR');

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendError(error);

		sinon.assert.calledOnce(listener);
		sinon.assert.calledWithMatch(listener, error, undefined);
	});

	it('errors include endorser', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_ERROR');

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendError(error);

		sinon.assert.calledWithMatch(listener, {peer}, undefined);
	});

	it('removed listener does not receive events', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		network.removeCommitListener(listener);
		eventService.sendEvent(eventInfo);

		sinon.assert.notCalled(listener);
	});

	it('removed listener does not receive errors', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_ERROR');

		await network.addCommitListener(listener, peers, transactionId);
		network.removeCommitListener(listener);
		eventService.sendError(error);

		sinon.assert.notCalled(listener);
	});

	it('add listener multiple times has no effect', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendEvent(eventInfo);

		sinon.assert.calledOnce(listener);
	});

	it('remove listener multiple times has no effect', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		network.removeCommitListener(listener);
		network.removeCommitListener(listener);
		eventService.sendEvent(eventInfo);

		sinon.assert.notCalled(listener);
	});

	it('listener receives errors starting event service', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_SERVICE_START_ERROR');
		sinon.stub(eventServiceManager, 'startEventService').rejects(error);

		await network.addCommitListener(listener, peers, transactionId);

		sinon.assert.calledWithMatch(listener, error, undefined);
	});

	it('errors starting event service include endorser', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_SERVICE_START_ERROR');
		sinon.stub(eventServiceManager, 'startEventService').rejects(error);

		await network.addCommitListener(listener, peers, transactionId);

		sinon.assert.calledWithMatch(listener, {peer}, undefined);
	});

	it('listener can remove itself on error starting event service', async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const listener = sinon.fake((err, event) => {
			if (err) {
				network.removeCommitListener(listener);
			}
		});
		const error = new Error('EVENT_SERVICE_START_ERROR');
		sinon.stub(eventServiceManager, 'startEventService').rejects(error);

		await network.addCommitListener(listener, peers, transactionId);
		// listener should have removed itself
		eventService.sendEvent(eventInfo);

		sinon.assert.alwaysCalledWithMatch(listener, error, undefined);
	});

	it('listener does not auto-unregister when receiving events', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendEvent(eventInfo);
		eventService.sendEvent(eventInfo);
		network.removeCommitListener(listener);

		sinon.assert.calledTwice(listener);
	});

	it('error thrown by listener is handled', async () => {
		const listener = sinon.fake.throws(new Error('LISTENER_ERROR'));

		await network.addCommitListener(listener, peers, transactionId);
		const f = () => eventService.sendEvent(eventInfo);

		expect(f).to.not.throw();
	});
});
