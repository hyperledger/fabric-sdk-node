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

const EventService = require('fabric-common/lib/EventService');

const BaseEventStrategy = require('fabric-network/lib/impl/event/baseeventstrategy');
const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');

describe('Event Strategy Implementations', () => {
	let stubEventService1;
	let stubEventService2;
	let stubSuccessFn;
	let stubFailFn;

	beforeEach(() => {
		stubEventService1 = sinon.createStubInstance(EventService);
		stubEventService1.name = 'eventService1';

		stubEventService2 = sinon.createStubInstance(EventService);
		stubEventService2.name = 'eventService2';

		stubSuccessFn = sinon.stub();
		stubFailFn = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	// Common behaviour for all implementations
	[AllForTxStrategy, AnyForTxStrategy].forEach((StrategyClass) => describe(StrategyClass.name + ' common behaviour', () => {
		describe('#constructor', () => {
			it('throws if no event Services supplied', () => {
				expect(() => new StrategyClass()).to.throw('No event services for strategy');
			});
			it('throws if no event Services supplied', () => {
				expect(() => new StrategyClass('string')).to.throw('No event services for strategy');
			});
			it('throws if no event Services supplied', () => {
				expect(() => new StrategyClass([])).to.throw('No event services for strategy');
			});
		});

		describe('#getEventServices', () => {
			it('returns the event Services', () => {
				const eventServices = [stubEventService1, stubEventService2];
				const strategy = new StrategyClass(eventServices);
				const results = strategy.getEventServices();
				expect(results).to.equal(eventServices);
			});
		});
	}));

	describe('BaseEventStrategy', () => {
		it('#checkCompletion (Base) throws if not overridden', () => {
			const strategy = new BaseEventStrategy([stubEventService1, stubEventService2]);
			expect(() => strategy.checkCompletion()).to.throw();
		});
	});

	describe('AllForTxStrategy event handling', () => {
		let strategy;

		beforeEach(async () => {
			// Two connected and one disconnected event Services
			strategy = new AllForTxStrategy([stubEventService1, stubEventService2]);
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
			// Two connected and one disconnected event Services
			strategy = new AnyForTxStrategy([stubEventService1, stubEventService2]);
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
