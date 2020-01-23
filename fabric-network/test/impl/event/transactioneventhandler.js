/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const sinon = require('sinon');

const EventService = require('fabric-common/lib/EventService');

const Transaction = require('fabric-network/lib/transaction');
const Network = require('fabric-network/lib/network');
const Contract = require('fabric-network/lib/contract');
const EventServiceManager = require('fabric-network/lib/impl/event/eventservicemanager');
const EventStrategy = require('fabric-network/lib/impl/event/baseeventstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const TimeoutError = require('fabric-network/lib/errors/timeouterror');

describe('TransactionEventHandler', () => {
	let strategy;
	let transaction;
	let network;
	let contract;
	let eventService;
	let eventServiceManager;
	let baseListener;
	const transactionId = 'TRANSACTION_ID';

	beforeEach(() => {
		eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.startEventService.resolves();
		network = sinon.createStubInstance(Network);
		network.eventServiceManager = eventServiceManager;

		transaction = sinon.createStubInstance(Transaction);
		transaction.transactionId = transactionId;
		contract = sinon.createStubInstance(Contract);
		contract.network = network;
		transaction.contract = contract;
		transaction.getNetwork.returns(network);

		eventService = sinon.createStubInstance(EventService);
		eventService.name = 'eventService';
		baseListener = sinon.stub();
		baseListener.eventService = eventService;
		eventService.registerTransactionListener.callsFake((txId, listenerFn) => {
			eventService._listenerFn = listenerFn;
			return baseListener;
		});
		strategy = sinon.createStubInstance(EventStrategy);
		strategy.getEventServices.returns([eventService]);
	});


	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('has a default timeout', () => {
			const test = new TransactionEventHandler(transaction, strategy);
			expect(test.options.commitTimeout).to.equal(30);
		});
		it('get transaction id from the incoming transaction', () => {
			const test = new TransactionEventHandler(transaction, strategy);
			expect(test.transactionId).to.be.equal(transactionId);
		});
		it('has a event service once constructed', () => {
			const test = new TransactionEventHandler(transaction, strategy);
			expect(test.eventServices.length).to.be.equal(1);
		});

		it('uses timeout from supplied options', () => {
			const options = {commitTimeout: 1};

			const test = new TransactionEventHandler(transaction, strategy, options);
			expect(test.options.commitTimeout).to.equal(options.commitTimeout);
		});
	});

	describe('event handling', () => {
		let handler;

		beforeEach(() => {
			handler = new TransactionEventHandler(transaction, strategy, {commitTimeout: 0});
		});

		afterEach(() => {
			handler.cancelListening();
		});

		describe('#startListening', () => {
			it('registers listener with event service using transaction ID', async () => {
				await handler.startListening();
				sinon.assert.calledWith(eventService.registerTransactionListener, transactionId);
			});

			it('starts event service', async () => {
				await handler.startListening();
				sinon.assert.calledWith(eventServiceManager.startEventService, eventService);
			});
		});

		it('calls eventReceived() on strategy when event service sends valid event', async () => {
			await handler.startListening();
			eventService._listenerFn(null, {
				transactionId,
				status: 'VALID'
			});
			sinon.assert.calledWith(strategy.eventReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call errorReceived() on strategy when event service sends valid event', async () => {
			await handler.startListening();
			eventService._listenerFn(null, {
				transactionId,
				status: 'VALID'
			});
			sinon.assert.notCalled(strategy.errorReceived);
		});

		it('calls errorReceived() on strategy when event service sends an error', async () => {
			await handler.startListening();
			eventService._listenerFn(new Error('EVENT HUB ERROR'), null);
			sinon.assert.calledWith(strategy.errorReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call eventReceived() on strategy when event hub sends an error', async () => {
			await handler.startListening();
			eventService._listenerFn(new Error('EVENT HUB ERROR'), null);
			sinon.assert.notCalled(strategy.eventReceived);
		});

		it('fails when event hub sends an invalid event', async () => {
			const status = 'ERROR_CODE';
			await handler.startListening();
			eventService._listenerFn(null, {
				transactionId,
				status
			});
			await expect(handler.waitForEvents()).to.be.rejectedWith(status);
		});

		it('succeeds when strategy calls success function after event received', async () => {
			strategy.eventReceived = (successFn, failFn) => successFn();

			await handler.startListening();
			eventService._listenerFn(null, {
				transactionId,
				status: 'VALID'
			});
			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after event received', async () => {
			const error = new Error('STRATEGY_FAIL');
			strategy.eventReceived = ((successFn, failFn) => failFn(error));

			await handler.startListening();
			eventService._listenerFn(null, {
				transactionId,
				status: 'VALID'
			});
			await expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds when strategy calls success function after error received', async () => {
			strategy.errorReceived = ((successFn, failFn) => successFn());

			await handler.startListening();
			eventService._listenerFn(new Error('EVENT HUB ERROR'), null);
			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after error received', async () => {
			const error = new Error('STRATEGY_FAIL');
			strategy.errorReceived = ((successFn, failFn) => failFn(error));

			await handler.startListening();
			eventService._listenerFn(new Error('EVENT HUB ERROR'), null);
			await expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds immediately with no event services', async () => {
			strategy.getEventServices.returns([]);
			handler = new TransactionEventHandler(transaction, strategy);
			await handler.startListening();
			await expect(handler.waitForEvents()).to.be.fulfilled;
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
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transaction, strategy, options);

			await handler.startListening();
			const promise = handler.waitForEvents();

			await clock.runAllAsync();
			await expect(promise).to.be.rejectedWith(TimeoutError);
		});

		it('does not timeout if timeout set to zero', async () => {
			strategy.eventReceived = ((successFn, failFn) => successFn());
			const options = {commitTimeout: 0};
			handler = new TransactionEventHandler(transaction, strategy, options);

			await handler.startListening();
			await clock.runAllAsync();
			eventService._listenerFn(null, {
				transactionId,
				status: 'VALID'
			});

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure message includes peers that have not responded', async () => {
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transaction, strategy, options);

			await handler.startListening();
			const promise = handler.waitForEvents();
			await clock.runAllAsync();

			await expect(promise).to.be.rejectedWith(eventService.name);
		});

		it('does not timeout if no peers', async () => {
			strategy.getEventServices.returns([]);
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transaction, strategy, options);

			await handler.startListening();
			await clock.runAllAsync();

			await expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure error has transaction ID property', async () => {
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(transaction, strategy, options);

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
