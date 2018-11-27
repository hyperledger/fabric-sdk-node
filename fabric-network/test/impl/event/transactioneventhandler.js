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

const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

describe('TransactionEventHandler', () => {
	let stubEventHub;
	let stubStrategy;
	const transactionId = 'TRANSACTION_ID';
	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub._stubInfo = 'eventHub';
		stubEventHub.getName.returns('eventHub');
		stubEventHub.getPeerAddr.returns('eventHubAddress');
		stubEventHub.registerTxEvent.callsFake((transaction_Id, onEventFn, onErrorFn) => {
			stubEventHub._transactionId = transaction_Id;
			stubEventHub._onEventFn = onEventFn;
			stubEventHub._onErrorFn = onErrorFn;
		});

		stubStrategy = {
			getEventHubs: sinon.stub(),
			eventReceived: sinon.stub(),
			errorReceived: sinon.stub()
		};
		stubStrategy.getEventHubs.returns([stubEventHub]);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('has a default timeout of zero if no options supplied', () => {
			const handler = new TransactionEventHandler(transactionId, stubStrategy);
			expect(handler.options.commitTimeout).to.equal(0);
		});

		it('uses timeout from supplied options', () => {
			const options = {commitTimeout: 1};
			const handler = new TransactionEventHandler(transactionId, stubStrategy, options);
			expect(handler.options.commitTimeout).to.equal(options.commitTimeout);
		});
	});

	describe('event handling:', () => {
		let handler;

		beforeEach(() => {
			handler = new TransactionEventHandler(transactionId, stubStrategy);
		});

		afterEach(() => {
			handler.cancelListening();
		});

		describe('#startListening', () => {
			it('calls registerTxEvent() on event hub with transaction ID', async () => {
				await handler.startListening();
				sinon.assert.calledWith(stubEventHub.registerTxEvent, transactionId);
			});

			it('sets auto-unregister option when calling registerTxEvent() on event hub', async () => {
				await handler.startListening();
				sinon.assert.calledWith(
					stubEventHub.registerTxEvent,
					sinon.match.any,
					sinon.match.any,
					sinon.match.any,
					sinon.match.has('unregister', true)
				);
			});

			it('calls connect() on event hub', async () => {
				await handler.startListening();
				sinon.assert.called(stubEventHub.connect);
			});
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

		it('fails when event hub sends an invalid event', async () => {
			const code = 'ERROR_CODE';
			await handler.startListening();
			stubEventHub._onEventFn(transactionId, code);
			return expect(handler.waitForEvents()).to.be.rejectedWith(code);
		});

		it('succeeds when strategy calls success function after event received', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

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
			stubStrategy.errorReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

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

		it('succeeds immediately with no event hubs', async () => {
			stubStrategy.getEventHubs.returns([]);
			handler = new TransactionEventHandler(transactionId, stubStrategy);
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.fulfilled;
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
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, stubStrategy, options);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			return expect(promise).to.be.rejectedWith('Event strategy not satisfied within the timeout period');
		});

		it('does not timeout if timeout set to zero', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

			const options = {commitTimeout: 0};
			handler = new TransactionEventHandler(transactionId, stubStrategy, options);
			await handler.startListening();
			clock.runAll();
			stubEventHub._onEventFn(transactionId, 'VALID');
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure message includes event hubs that have not responded', async () => {
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, stubStrategy, options);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			const eventHubName = stubEventHub.getName();
			return expect(promise).to.be.rejectedWith(eventHubName);
		});

		it('does not timeout if no event hubs', async () => {
			stubStrategy.getEventHubs.returns([]);
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transactionId, stubStrategy, options);
			await handler.startListening();
			clock.runAll();
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});
	});
});
