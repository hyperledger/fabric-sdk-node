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

const ChannelEventHub = require('fabric-client').ChannelEventHub;

const Transaction = require('fabric-network/lib/transaction');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const TimeoutError = require('fabric-network/lib/errors/timeouterror');
const TransactionID = require('fabric-client/lib/TransactionID');

describe('TransactionEventHandler', () => {
	let stubEventHub;
	let stubStrategy;
	let stubTransaction;
	let stubTransactionID;
	const transactionId = 'TRANSACTION_ID';
	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests
		stubTransaction = sinon.createStubInstance(Transaction);
		stubTransactionID = sinon.createStubInstance(TransactionID);
		stubTransactionID.getTransactionID.returns(transactionId);
		stubTransaction.getTransactionID.returns(stubTransactionID);

		stubEventHub = sinon.createStubInstance(ChannelEventHub);

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
			const handler = new TransactionEventHandler(stubTransaction, stubStrategy);
			expect(handler.options.commitTimeout).to.equal(0);
		});

		it('uses timeout from supplied options', () => {
			const options = {commitTimeout: 1};
			const handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			expect(handler.options.commitTimeout).to.equal(options.commitTimeout);
		});

		it('should set transactionID and transaction', () => {
			const handler = new TransactionEventHandler(stubTransaction, stubStrategy);
			expect(handler.transactionId).to.equal(transactionId);
			expect(handler.transaction).to.equal(stubTransaction);
		});
	});

	describe('event handling:', () => {
		let handler;

		beforeEach(() => {
			handler = new TransactionEventHandler(stubTransaction, stubStrategy);
		});

		afterEach(() => {
			handler.cancelListening();
		});

		describe('#startListening', () => {
			it('calls addCommitListener() on transaction with callback', async () => {
				await handler.startListening();
				sinon.assert.calledWith(stubTransaction.addCommitListener, sinon.match.func);
			});

			it('sets auto-unregister option when calling registerTxEvent() on event hub', async () => {
				await handler.startListening();
				sinon.assert.calledWith(
					stubTransaction.addCommitListener,
					sinon.match.func,
					sinon.match.has('unregister', true),
					stubEventHub
				);
			});

			it('should call transaction.addCommitListener', () => {
				handler = new TransactionEventHandler(stubTransaction, stubStrategy);
				handler.startListening();
				sinon.assert.calledWith(
					stubTransaction.addCommitListener,
					sinon.match.func,
					sinon.match.has('unregister', true),
					stubEventHub
				);
			});

			it('should call _onError if err is set', () => {
				handler = new TransactionEventHandler(stubTransaction, stubStrategy);
				sinon.spy(handler, '_onError');
				handler.startListening();
				const err = new Error('an error');
				stubTransaction.addCommitListener.callArgWith(0, err);
				sinon.assert.calledWith(handler._onError, stubEventHub, err);
			});

			it('should call _onEvent if err is set', () => {
				handler = new TransactionEventHandler(stubTransaction, stubStrategy);
				sinon.spy(handler, '_onEvent');
				handler.startListening();
				stubTransaction.addCommitListener.callArgWith(0, null, transactionId, 'VALID');
				sinon.assert.calledWith(handler._onEvent, stubEventHub, transactionId, 'VALID');
			});
		});

		it('calls eventReceived() on strategy when event hub sends valid event', async () => {
			stubTransaction.addCommitListener.yields(null, transactionId, 'VALID');
			await handler.startListening();
			sinon.assert.calledWith(stubStrategy.eventReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call errorReceived() on strategy when event hub sends valid event', async () => {
			stubTransaction.addCommitListener.yields(null, transactionId, 'VALID');
			await handler.startListening();
			sinon.assert.notCalled(stubStrategy.errorReceived);
		});

		it('calls errorReceived() on strategy when event hub sends an error', async () => {
			stubTransaction.addCommitListener.yields(new Error());
			await handler.startListening();
			sinon.assert.calledWith(stubStrategy.errorReceived, sinon.match.func, sinon.match.func);
		});

		it('does not call eventReceived() on strategy when event hub sends an error', async () => {
			stubTransaction.addCommitListener.yields(new Error('EVENT_HUB_ERROR'));
			await handler.startListening();
			sinon.assert.notCalled(stubStrategy.eventReceived);
		});

		it('fails when event hub sends an invalid event', async () => {
			const code = 'ERROR_CODE';
			stubTransaction.addCommitListener.yields(null, transactionId, code);
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.rejectedWith(code);
		});

		it('succeeds when strategy calls success function after event received', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

			stubTransaction.addCommitListener.yields(null, transactionId, 'VALID');
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after event received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.eventReceived = ((successFn, failFn) => failFn(error));

			stubTransaction.addCommitListener.yields(null, transactionId, 'VALID');
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds when strategy calls success function after error received', async () => {
			stubStrategy.errorReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

			stubTransaction.addCommitListener.yields(new Error('EVENT_HUB_ERROR'));
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('fails when strategy calls fail function after error received', async () => {
			const error = new Error('STRATEGY_FAIL');
			stubStrategy.errorReceived = ((successFn, failFn) => failFn(error));

			stubTransaction.addCommitListener.yields(new Error('EVENT_HUB_ERROR'));
			await handler.startListening();
			return expect(handler.waitForEvents()).to.be.rejectedWith(error);
		});

		it('succeeds immediately with no event hubs', async () => {
			stubStrategy.getEventHubs.returns([]);
			handler = new TransactionEventHandler(stubTransaction, stubStrategy);
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
			handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			return expect(promise).to.be.rejectedWith(TimeoutError);
		});

		it('does not timeout if timeout set to zero', async () => {
			stubStrategy.eventReceived = ((successFn, failFn) => successFn()); // eslint-disable-line no-unused-vars

			const options = {commitTimeout: 0};
			handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			stubTransaction.addCommitListener.yields(null, transactionId, 'VALID');
			await handler.startListening();
			clock.runAll();
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure message includes event hubs that have not responded', async () => {
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			const eventHubName = stubEventHub.getName();
			return expect(promise).to.be.rejectedWith(eventHubName);
		});

		it('does not timeout if no event hubs', async () => {
			stubStrategy.getEventHubs.returns([]);
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			await handler.startListening();
			clock.runAll();
			return expect(handler.waitForEvents()).to.be.fulfilled;
		});

		it('timeout failure error has transaction ID property', async () => {
			const options = {commitTimeout: 418};
			handler = new TransactionEventHandler(stubTransaction, stubStrategy, options);
			await handler.startListening();
			const promise = handler.waitForEvents();
			clock.runAll();
			try {
				await promise;
				chai.assert.fail('Expected an error');
			} catch (error) {
				expect(error.transactionId).to.equal(transactionId);
			}
		});
	});
});
