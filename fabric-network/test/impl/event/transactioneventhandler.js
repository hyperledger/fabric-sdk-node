/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
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
const TransactionEventHandler = rewire('fabric-network/lib/impl/event/transactioneventhandler');

describe('TransactionEventHandler', () => {
	let strategy;
	let transaction;
	let network;
	let contract;
	let eventService;
	let eventServiceManager;
	let baseListener;
	let revert;
	let FakeLogger;
	let sandbox;
	const transactionId = 'TRANSACTION_ID';
	const options = {};

	let handler;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		FakeLogger = {
			debug: () => {
			},
			error: () => {
			},
			warn: () => {
			}
		};
		sandbox.stub(FakeLogger);
		revert.push(TransactionEventHandler.__set__('logger', FakeLogger));
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
		eventService.unregisterEventListener = sinon.stub();
		baseListener = sinon.stub();
		baseListener.eventService = eventService;
		eventService.registerTransactionListener.returns(baseListener);

		strategy = sinon.createStubInstance(EventStrategy);
		strategy.getEventServices.returns([eventService]);

		handler = new TransactionEventHandler(transaction, strategy, options);
	});


	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
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
			const toptions = {commitTimeout: 1};

			const test = new TransactionEventHandler(transaction, strategy, toptions);
			expect(test.options.commitTimeout).to.equal(toptions.commitTimeout);
		});
	});

	describe('#startListening', () => {
		it('calls registerTxEvent() on event service with transaction ID', async () => {
			handler._registerTxEventListeners = sinon.stub().returns();
			handler._setListenTimeout = sinon.stub().returns();
			handler._startEventServices = sinon.stub().resolves();

			await handler.startListening();
			expect(handler.notificationPromise).to.exist;
			sinon.assert.called(handler._registerTxEventListeners);
		});

		it('calls promiose resolve when no event services', async () => {
			handler.eventServices = [];

			await handler.startListening();
			expect(handler.notificationPromise).to.exist;
		});
	});

	describe('#_startEventServices', () => {
		it('calls start on event service', async () => {

			await handler._startEventServices();
			sinon.assert.called(eventServiceManager.startEventService);
		});
		it('see an error', async () => {
			eventServiceManager.startEventService.rejects(new Error('FAILED'));
			handler._onError = sinon.stub();
			await handler._startEventServices();
			sinon.assert.called(eventServiceManager.startEventService);
			sinon.assert.called(handler._onError);
		});
	});

	describe('#_setListenTimeout', () => {
		it('returns', () => {
			handler.options = {commitTimeout: 0};

			handler._setListenTimeout();
			sinon.assert.calledWith(FakeLogger.debug, '%s - no commit timeout');
		});
		it('set and clear', () => {
			handler.options = {commitTimeout: 10};

			handler._setListenTimeout();
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			clearTimeout(handler.timeoutHandler);
		});
		it('set and let fire', async () => {
			handler.options = {commitTimeout: 1};
			handler._timeoutFail = sinon.stub();
			handler._setListenTimeout();
			await sleep(1100);
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			sinon.assert.called(handler._timeoutFail);
		});
	});

	describe('#_registerTxEventListeners', () => {
		it('runs onEvent', () => {
			handler._onError = sinon.stub();
			handler._onEvent = sinon.stub();
			eventService.registerTransactionListener = (txid, callback) => {
				callback(null, {transactionId: txid, status: 'VALID'});
				return 'something';
			};
			expect(handler.activeListeners.size).to.be.equal(0);
			handler._registerTxEventListeners();
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			expect(handler.activeListeners.size).to.be.equal(1);
			sinon.assert.called(handler._onEvent);
			sinon.assert.notCalled(handler._onError);
		});
		it('runs onError', () => {
			handler._onError = sinon.stub();
			handler._onEvent = sinon.stub();
			eventService.registerTransactionListener = (txid, callback) => {
				callback(new Error('onERROR'));
				return 'something';
			};
			expect(handler.activeListeners.size).to.be.equal(0);
			handler._registerTxEventListeners();
			sinon.assert.calledWith(FakeLogger.debug, '%s - end');
			expect(handler.activeListeners.size).to.be.equal(1);
			sinon.assert.notCalled(handler._onEvent);
			sinon.assert.called(handler._onError);
		});
	});

	describe('#_timeoutFail', () => {
		it('runs', () => {
			handler._strategyFail = sinon.stub();
			handler._timeoutFail();
			sinon.assert.called(handler._strategyFail);
		});
	});

	describe('#_onEvent', () => {
		it('runs with valid', () => {
			handler._strategyFail = sinon.stub();
			strategy.eventReceived = sinon.stub();

			handler._onEvent(eventService, 'txid', 'VALID');
			sinon.assert.called(strategy.eventReceived);
			sinon.assert.notCalled(handler._strategyFail);
		});
		it('runs with invalid', () => {
			handler._strategyFail = sinon.stub();
			strategy.eventReceived = sinon.stub();

			handler._onEvent(eventService, 'txid', 'INVALID');
			sinon.assert.notCalled(strategy.eventReceived);
			sinon.assert.called(handler._strategyFail);
		});
	});

	describe('#_onError', () => {
		it('runs', () => {
			strategy.errorReceived = sinon.stub();

			handler._onError(eventService, new Error('FAILED'));
			sinon.assert.called(strategy.errorReceived);
		});
	});

	describe('#_receivedEventServiceResponse', () => {
		it('runs', () => {
			expect(handler.respondedEventServices.size).to.be.equal(0);

			handler._receivedEventServiceResponse(eventService);
			expect(handler.respondedEventServices.size).to.be.equal(1);
		});
	});

	describe('#_strategySuccess', () => {
		it('runs', () => {
			handler.cancelListening = sinon.stub();
			handler._resolveNotificationPromise = sinon.stub();

			handler._strategySuccess();
			sinon.assert.called(handler.cancelListening);
			sinon.assert.called(handler._resolveNotificationPromise);
		});
	});

	describe('#_strategyFail', () => {
		it('runs', () => {
			handler.cancelListening = sinon.stub();
			handler._rejectNotificationPromise = sinon.stub();

			handler._strategyFail();
			sinon.assert.called(handler.cancelListening);
			sinon.assert.called(handler._rejectNotificationPromise);
		});
	});

	describe('#waitForEvents', () => {
		it('runs', async () => {
			setTimeout(() => {
				handler._strategySuccess();
			}, 100);
			await handler.waitForEvents();
			sinon.assert.calledWith(FakeLogger.debug, 'waitForEvents end');
		});
	});

	describe('#cancelListening', () => {
		it('runs', () => {
			handler.activeListeners.add(baseListener);

			handler.cancelListening();
			sinon.assert.called(baseListener.eventService.unregisterEventListener);
		});
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
