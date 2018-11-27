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
	let stubSuccessFn;
	let stubFailFn;

	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		stubEventHub1 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub1._stubInfo = 'eventHub1';
		stubEventHub1.getName.returns('eventHub1');

		stubEventHub2 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub2._stubInfo = 'eventHub2';
		stubEventHub2.getName.returns('eventHub2');

		stubSuccessFn = sinon.stub();
		stubFailFn = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	// Common behaviour for all implementations
	[AllForTxStrategy, AnyForTxStrategy].forEach((StrategyClass) => describe(StrategyClass.name + ' common behaviour', () => {
		describe('#constructor', () => {
			it('throws if no event hubs supplied', () => {
				expect(() => new StrategyClass([])).to.throw('No event hubs');
			});
		});

		describe('#getEventHubs', () => {
			it('returns the event hubs', () => {
				const eventHubs = [stubEventHub1, stubEventHub2];
				const strategy = new StrategyClass(eventHubs);
				const results = strategy.getEventHubs();
				expect(results).to.equal(eventHubs);
			});
		});
	}));

	describe('AbstractEventStrategy', () => {
		it('#checkCompletion (abstract) throws if not overridden', () => {
			const strategy = new AbstractEventStrategy([stubEventHub1, stubEventHub2]);
			expect(() => strategy.checkCompletion()).to.throw();
		});
	});

	describe('AllForTxStrategy event handling', () => {
		let strategy;

		beforeEach(async () => {
			// Two connected and one disconnected event hubs
			strategy = new AllForTxStrategy([stubEventHub1, stubEventHub2]);
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
			strategy = new AnyForTxStrategy([stubEventHub1, stubEventHub2]);
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
