/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

import {
	Endorser,
	EventInfo,
	IdentityContext
} from 'fabric-common';
import Long = require('long');

import Network = require('../../../src/network');
import EventServiceManager = require('../../../src/impl/event/eventservicemanager');
import { Gateway } from 'fabric-network';
import { StubEventService } from './stubeventservice';

describe('commit listener', () => {
	let eventServiceManager: sinon.SinonStubbedInstance<EventServiceManager>;
	let eventService: StubEventService;
	let peer: Endorser;
	let peers: Endorser[];
	let gateway: Gateway;
	let network: Network;
	let eventInfo: EventInfo;
	const transactionId = 'TX_ID';

	beforeEach(async () => {
		peer = sinon.createStubInstance(Endorser);
		(peer as any).name = 'peer1';
		peers = [peer];

		eventService = new StubEventService(peer.name);

		eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.getEventServices.withArgs(peers).returns([eventService]);

		eventInfo = {
			eventHub: null,
			blockNumber: new Long(1),
			transactionId
		};

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);

		network = new Network(gateway, null);
		network.eventServiceManager = eventServiceManager;
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
		sinon.assert.calledWithMatch(listener, undefined, eventInfo);
	});

	it('events include endorser', async () => {
		const listener = sinon.fake();

		await network.addCommitListener(listener, peers, transactionId);
		eventService.sendEvent(eventInfo);

		sinon.assert.calledWithMatch(listener, undefined, { peer });
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

		sinon.assert.calledWithMatch(listener, { peer }, undefined);
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
		eventServiceManager.startEventService.rejects(error);

		await network.addCommitListener(listener, peers, transactionId);

		sinon.assert.calledWithMatch(listener, error, undefined);
	});

	it('errors starting event service include endorser', async () => {
		const listener = sinon.fake();
		const error = new Error('EVENT_SERVICE_START_ERROR');
		eventServiceManager.startEventService.rejects(error);

		await network.addCommitListener(listener, peers, transactionId);

		sinon.assert.calledWithMatch(listener, { peer }, undefined);
	});

	it('listener can remove itself on error starting event service', async () => {
		const listener = sinon.fake((err, event) => {
			if (err) {
				network.removeCommitListener(listener);
			}
		});
		const error = new Error('EVENT_SERVICE_START_ERROR');
		eventServiceManager.startEventService.rejects(error);

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
});
