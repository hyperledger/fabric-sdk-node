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

const AbstractEventStrategy = require('fabric-network/lib/impl/event/abstracteventstrategy');
const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');

describe('Event Strategy Implementations', () => {
	let stubEventHub1;
	let stubEventHub2;
	let stubEventHub3;
	let stubSuccessFn;
	let stubFailFn;

	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		// Connected event hub
		stubEventHub1 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub1._stubInfo = 'eventHub1';
		stubEventHub1.getName.returns('eventHub1');
		stubEventHub1.isconnected.returns(true);

		// Unconnected event hub
		stubEventHub2 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub2._stubInfo = 'eventHub2';
		stubEventHub2.getName.returns('eventHub2');
		stubEventHub2.isconnected.returns(false);

		// Connected event hub
		stubEventHub3 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub3._stubInfo = 'eventHub3';
		stubEventHub3.getName.returns('eventHub3');
		stubEventHub3.isconnected.returns(true);

		stubSuccessFn = sinon.stub();
		stubFailFn = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	// Common behaviour for all implementations
	[AllForTxStrategy, AnyForTxStrategy].forEach((StrategyClass) => describe(StrategyClass.name + ' common behaviour', () => {
		describe('#constructor', () => {
			it('throws if event hubs argument is not a promise', () => {
				expect(() => new StrategyClass('I am not a promise')).to.throw();
			});
		});

		describe('#getConnectedEventHubs', () => {
			it('returns only the connected event hubs', async () => {
				const strategy = new StrategyClass(Promise.resolve([stubEventHub1, stubEventHub2]));
				const results = await strategy.getConnectedEventHubs();
				expect(results).to.have.members([stubEventHub1]);
			});

			it('throws if no event hubs are connected', async () => {
				const strategy = new StrategyClass(Promise.resolve([stubEventHub2]));
				await expect(strategy.getConnectedEventHubs())
					.to.be.rejectedWith('No available event hubs found for strategy');
			});
		});
	}));

	describe('AbstractEventStrategy', () => {
		it('#checkCompletion (abstract) throws if not overridden', () => {
			const strategy = new AbstractEventStrategy(Promise.resolve([stubEventHub1, stubEventHub2, stubEventHub3]));
			expect(() => strategy.checkCompletion()).to.throw();
		});
	});

	describe('AllForTxStrategy event handling', () => {
		let strategy;

		beforeEach(async () => {
			// Two connected and one disconnected event hubs
			strategy = new AllForTxStrategy(Promise.resolve([stubEventHub1, stubEventHub2, stubEventHub3]));
			await strategy.getConnectedEventHubs();
		});

		it('does not call callbacks on first event of two expected events', () => {
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.notCalled, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('calls success callback on second event of two expected events', () => {
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.calledOnce, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('calls success callback on error then event of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.calledOnce, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('does not call callbacks on first error of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.notCalled, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('calls fail callback on second error of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.notCalled, 'successFn').to.be.true;
			expect(stubFailFn.calledOnce, 'failFn').to.be.true;
			expect(stubFailFn.calledWith(sinon.match.instanceOf(Error)), 'failFn(Error)').to.be.true;
		});

		it('calls success callback on event then error of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.calledOnce, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});
	});

	describe('AnyForTxStrategy event handling', () => {
		let strategy;

		beforeEach(async () => {
			// Two connected and one disconnected event hubs
			strategy = new AnyForTxStrategy(Promise.resolve([stubEventHub1, stubEventHub2, stubEventHub3]));
			await strategy.getConnectedEventHubs();
		});

		it('calls success callback on first event of two expected events', () => {
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.calledOnce, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('calls success callback on error then event of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			strategy.eventReceived(stubSuccessFn, stubFailFn);
			sinon.assert.called(stubSuccessFn);
			sinon.assert.notCalled(stubFailFn);
		});

		it('does not call callbacks on first error of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.notCalled, 'successFn').to.be.true;
			expect(stubFailFn.notCalled, 'failFn').to.be.true;
		});

		it('calls fail callback on second error of two expected events', () => {
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			strategy.errorReceived(stubSuccessFn, stubFailFn);
			expect(stubSuccessFn.notCalled, 'successFn').to.be.true;
			expect(stubFailFn.calledOnce, 'failFn').to.be.true;
			expect(stubFailFn.calledWith(sinon.match.instanceOf(Error)), 'failFn(Error)').to.be.true;
		});
	});
});
