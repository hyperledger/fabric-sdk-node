/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon = require('sinon');
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

import {
	Channel,
	Endorser,
	EventInfo,
	IdentityContext
} from 'fabric-common';
import Long = require('long');

import { Gateway } from '../../../src/gateway';
import { Network, NetworkImpl } from '../../../src/network';
import { EventServiceManager } from '../../../src/impl/event/eventservicemanager';
import { TransactionEventStrategy } from '../../../src/impl/event/transactioneventstrategy';
import { StubEventService } from './stubeventservice';
import { TransactionEventHandler } from '../../../src/impl/event/transactioneventhandler';

describe('TransactionEventHandler', () => {
	let eventServiceManager: sinon.SinonStubbedInstance<EventServiceManager>;
	let eventService: StubEventService;
	let peer: Endorser;
	let gateway: sinon.SinonStubbedInstance<Gateway>;
	let network: Network;
	let validEventInfo: EventInfo;
	let invalidEventInfo: EventInfo;
	const transactionId = 'TX_ID';
	let stubStrategy: sinon.SinonStubbedInstance<TransactionEventStrategy>;
	let strategy: TransactionEventStrategy;
	let options: any;

	beforeEach(async () => {
		peer = sinon.createStubInstance(Endorser);
		(peer as any).name = 'peer1';

		eventService = new StubEventService(peer.name);

		eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.getCommitEventService.withArgs(peer).returns(eventService);

		validEventInfo = {
			eventService: null,
			blockNumber: new Long(1),
			transactionId,
			status: 'VALID'
		};
		invalidEventInfo = {
			eventService: null,
			blockNumber: new Long(1),
			transactionId,
			status: 'INVALID'
		};

		options = {
			transaction: {
				commitTimeout: 0
			}
		};

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = sinon.createStubInstance(IdentityContext);
		gateway.getOptions.returns(options);
		gateway.getIdentity.returns({
			mspId: 'mspId',
			type: 'stub'
		});

		const channel = sinon.createStubInstance(Channel);
		(channel as any).name = 'mychannel';
		network = new NetworkImpl(gateway as unknown as Gateway, channel);
		(network as any).eventServiceManager = eventServiceManager;

		stubStrategy = sinon.createStubInstance(TransactionEventStrategy);
		stubStrategy.getPeers.returns([peer]);
		strategy = stubStrategy as any;
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('has a default timeout', () => {
			options.eventHandlerOptions = {};
			const test: any = new TransactionEventHandler(transactionId, network, strategy);
			expect(test.options.commitTimeout).to.equal(30);
		});
	});

	describe('event handling', () => {
		let handler;

		beforeEach(() => {
			handler = new TransactionEventHandler(transactionId, network, strategy);
		});

		afterEach(() => {
			handler.cancelListening();
		});

		describe('#startListening', () => {
			it('registers listener with event service using transaction ID', async () => {
				const spy = sinon.spy(eventService, 'registerTransactionListener');

				await handler.startListening();

				sinon.assert.calledWith(spy, transactionId, sinon.match.any, sinon.match.any);
			});

			it('starts event service', async () => {
				await handler.startListening();
				sinon.assert.calledWith(eventServiceManager.startEventService, eventService);
			});
		});

		it('calls eventReceived() on strategy when event service sends valid event', async () => {
			await handler.startListening();
			eventService.sendEvent(validEventInfo);

			sinon.assert.calledWith(stubStrategy.eventReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call errorReceived() on strategy when event service sends valid event', async () => {
			await handler.startListening();
			eventService.sendEvent(validEventInfo);

			sinon.assert.notCalled(stubStrategy.errorReceived);
		});

		it('calls errorReceived() on strategy when event service sends an error', async () => {
			await handler.startListening();
			eventService.sendError(new Error('PEER_ERROR'));

			sinon.assert.calledWith(stubStrategy.errorReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call eventReceived() on strategy when peer sends an error', async () => {
			await handler.startListening();
			eventService.sendError(new Error('PEER_ERROR'));

			sinon.assert.notCalled(stubStrategy.eventReceived);
		});

		it('fails when peer sends an invalid event', async () => {
			await handler.startListening();
			eventService.sendEvent(invalidEventInfo);

			await expect(handler.waitForEvents()).to.be.rejectedWith(invalidEventInfo.status);
		});

		it('succeeds when strategy calls success function after event received', async () => {
			stubStrategy.eventReceived.callsArg(0);

			await handler.startListening();
			eventService.sendEvent(validEventInfo);

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after event received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.eventReceived.callsArgWith(1, error);

			await handler.startListening();
			eventService.sendEvent(validEventInfo);

			await expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds when strategy calls success function after error received', async () => {
			stubStrategy.errorReceived.callsArg(0);

			await handler.startListening();
			eventService.sendError(new Error('peer ERROR'));

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after error received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.errorReceived.callsArgWith(1, error);

			await handler.startListening();
			eventService.sendError(new Error('peer ERROR'));

			await expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds immediately with no peers', async () => {
			stubStrategy.getPeers.returns([]);

			handler = new TransactionEventHandler(transactionId, network, strategy);
			await handler.startListening();

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('ignores anything from peer that has already sent an event', async () => {
			await handler.startListening();
			eventService.sendEvent(validEventInfo);
			eventService.sendEvent(validEventInfo);
			eventService.sendError(new Error('PEER_ERROR'));

			sinon.assert.calledOnce(stubStrategy.eventReceived);
			sinon.assert.notCalled(stubStrategy.errorReceived);
		});

		it('ignores anything from peer that has already sent an error', async () => {
			await handler.startListening();
			eventService.sendError(new Error('one'));
			eventService.sendEvent(validEventInfo);
			eventService.sendError(new Error('two'));

			sinon.assert.calledOnce(stubStrategy.errorReceived);
			sinon.assert.notCalled(stubStrategy.eventReceived);
		});

		it('fails when receiving invalid event from peer that previously disconnected', async () => {
			await handler.startListening();
			eventService.sendError(new Error('PEER_ERROR'));
			eventService.sendEvent(invalidEventInfo);

			await expect(handler.waitForEvents()).to.be.rejectedWith(invalidEventInfo.status);
		});

		it('fails when receiving an invalid event from peer', async () => {
			await handler.startListening();
			eventService.sendEvent(invalidEventInfo);

			await expect(handler.waitForEvents()).to.be.rejectedWith(invalidEventInfo.status);
		});
	});

	describe('timeouts', () => {
		let handler;
		let clock;

		beforeEach(() => {
			clock = sinon.useFakeTimers();
		});

		afterEach(() => {
			handler.cancelListening();
			clock.restore();
		});

		it('fails on timeout if timeout set', async () => {
			options.eventHandlerOptions = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, network, strategy);

			await handler.startListening();
			const promise = handler.waitForEvents();

			await clock.runAllAsync();
			await expect(promise).to.be.rejectedWith(/timeout/i);
		});

		it('does not timeout if timeout set to zero', async () => {
			stubStrategy.eventReceived.callsArg(0);
			options.eventHandlerOptions = {commitTimeout: 0};
			handler = new TransactionEventHandler(transactionId, network, strategy);

			await handler.startListening();
			await clock.runAllAsync();
			eventService.sendEvent(validEventInfo);

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure message includes peers that have not responded', async () => {
			options.eventHandlerOptions = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, network, strategy);

			await handler.startListening();
			const promise = handler.waitForEvents();
			await clock.runAllAsync();

			await expect(promise).to.be.rejectedWith(eventService.name);
		});

		it('does not timeout if no peers', async () => {
			stubStrategy.getPeers.returns([]);
			options.eventHandlerOptions = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, network, strategy);

			await handler.startListening();
			await clock.runAllAsync();

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure error has transaction ID property', async () => {
			options.eventHandlerOptions = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, network, strategy);

			await handler.startListening();
			const promise = handler.waitForEvents();
			await clock.runAllAsync();

			try {
				await promise;
				chai.assert.fail('Expected an error');
			} catch (error) {
				expect(error.transactionId).to.equal(transactionId);
			}
		});
	});
});
