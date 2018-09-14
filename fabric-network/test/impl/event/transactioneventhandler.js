/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const sinon = require('sinon');

const ChannelEventHub = require('fabric-client').ChannelEventHub;

const TransactionEventHandler = require('../../../lib/impl/event/transactioneventhandler');
const DefaultEventHandlerManager = require('../../../lib/impl/event/defaulteventhandlermanager');

describe('TransactionEventHandler', () => {
	const transactionId = 'TRANSACTION_ID';
	let stubEventHub;
	let stubStrategy;
	let stubEventHandlerManager;

	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub._stubInfo = 'eventHub';
		stubEventHub.getName.returns('eventHub');
		stubEventHub.getPeerAddr.returns('eventHubAddress');
		stubEventHub.registerTxEvent.callsFake((transactionId, onEventFn, onErrorFn) => {
			stubEventHub._transactionId = transactionId;
			stubEventHub._onEventFn = onEventFn;
			stubEventHub._onErrorFn = onErrorFn;
		});

		stubStrategy = {
			getConnectedEventHubs: async () => {
				return [stubEventHub];
			},
			eventReceived: sinon.stub(),
			errorReceived: sinon.stub()
		};

		stubEventHandlerManager = sinon.createStubInstance(DefaultEventHandlerManager);
		stubEventHandlerManager.getEventHubs.returns([stubEventHub]);
		stubEventHandlerManager.options = {
			commitTimeout: 300
		};
		stubEventHandlerManager.eventStrategy = stubStrategy;
		stubEventHandlerManager.availableEventHubs = [stubEventHub];
	});

	describe('#constructor', () => {
		it('has a default timeout if no options supplied', () => {
			const handler = new TransactionEventHandler(stubEventHandlerManager, transactionId);
			expect(handler.options.commitTimeout).to.be.a('Number');
			handler.strategy.should.equal(stubStrategy);
		});

	});

	describe('event handling:', () => {
		let handler;

		beforeEach(() => {
			handler = new TransactionEventHandler(stubEventHandlerManager, transactionId);
		});

		afterEach(() => {
			handler.cancelListening();
		});

		it('calls registerTxEvent() on event hub with transaction ID', async () => {
			await handler.startListening();
			sinon.assert.calledWith(stubEventHub.registerTxEvent, transactionId);
		});

		it('calls eventReceived() on strategy when event hub sends valid event', async () => {
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			sinon.assert.calledWith(stubStrategy.eventReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call errorReceived() on strategy when event hub sends valid event', async () => {
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			sinon.assert.notCalled(stubStrategy.errorReceived);
		});

		it('calls errorReceived() on strategy when event hub sends an error', async () => {
			await handler.startListening();
			stubEventHub._onErrorFn(new Error('EVENT HUB ERROR'));
			sinon.assert.calledWith(stubStrategy.errorReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call eventReceived() on strategy when event hub sends an error', async () => {
			await handler.startListening();
			stubEventHub._onErrorFn(new Error('EVENT_HUB_ERROR'));
			sinon.assert.notCalled(stubStrategy.eventReceived);
		});

		it('calls unregisterTxEvent() on event hub when event hub sends an event', async () => {
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			sinon.assert.calledWith(stubEventHub.unregisterTxEvent, transactionId);
		});

		it('calls unregisterTxEvent() on event hub when event hub sends an error', async () => {
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			sinon.assert.calledWith(stubEventHub.unregisterTxEvent, transactionId);
		});

		it('fails when event hub sends an invalid event', async () => {
			const code = 'ERROR_CODE';
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, code);
			return expect(handler.waitForEvents()).to.be.rejectedWith(code);
		});

		it('succeeds when strategy calls success function after event received', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn());

			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after event received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.eventReceived = ((successFn, failFn) => failFn(error));

			await handler.startListening();
			stubEventHub._onEventFn(transactionId, 'VALID');
			return expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds when strategy calls success function after error received', async () => {
			stubStrategy.errorReceived = ((successFn, failFn) => successFn());

			await handler.startListening();
			stubEventHub._onErrorFn(new Error('EVENT_HUB_ERROR'));
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after error received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.errorReceived = ((successFn, failFn) => failFn(error));

			await handler.startListening();
			stubEventHub._onErrorFn(new Error('EVENT_HUB_ERROR'));
			return expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});
	});

	describe('timeouts:', () => {
		let clock;
		let handler;

		beforeEach(() => {
			clock = sinon.useFakeTimers();
		});

		afterEach(() => {
			handler.cancelListening();
			clock.restore();
		});

		it('fails on timeout if timeout set', async () => {
			stubEventHandlerManager.options = {
				strategy: stubStrategy,
				commitTimeout: 418
			};
			handler = new TransactionEventHandler(stubEventHandlerManager, transactionId);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			return expect(promise).to.be.rejectedWith('Event strategy not satisfied within the timeout period');
		});

		it('does not timeout if timeout set to zero', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn());

			stubEventHandlerManager.options = {
				strategy: stubStrategy,
				commitTimeout: 0
			};
			handler = new TransactionEventHandler(stubEventHandlerManager, transactionId);
			await handler.startListening();
			clock.runAll();
			stubEventHub._onEventFn(transactionId, 'VALID');
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure message includes event hubs that have not responded', async () => {
			stubEventHandlerManager.options = {
				strategy: stubStrategy,
				commitTimeout: 418
			};
			handler = new TransactionEventHandler(stubEventHandlerManager, transactionId);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			const eventHubName = stubEventHub.getName();
			return expect(promise).to.be.rejectedWith(eventHubName);
		});
	});
});
