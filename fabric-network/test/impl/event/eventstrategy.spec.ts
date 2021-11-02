/*
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
import sinon = require('sinon');

import {Endorser} from 'fabric-common';

import {AllForTxStrategy} from '../../../src/impl/event/allfortxstrategy';
import {AnyForTxStrategy} from '../../../src/impl/event/anyfortxstrategy';
import {Mutable} from '../../testutils';

describe('Event Strategy Implementations', () => {
	let peer1: Mutable<Endorser>;
	let peer2: Mutable<Endorser>;
	let stubSuccessFn:sinon.SinonStub;
	let stubFailFn:sinon.SinonStub;

	beforeEach(() => {
		peer1 = sinon.createStubInstance(Endorser);
		peer1.name = 'peer1';

		peer2 = sinon.createStubInstance(Endorser);
		peer2.name = 'peer2';

		stubSuccessFn = sinon.stub();
		stubFailFn = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	// Common behaviour for all implementations
	[AllForTxStrategy, AnyForTxStrategy].forEach((StrategyClass) => describe(StrategyClass.name + ' common behaviour', () => {
		describe('#constructor', () => {
			it('throws if no peers supplied', () => {
				expect(() => new StrategyClass([])).to.throw('No peers for strategy');
			});
		});

		describe('#getPeers', () => {
			it('returns the supplied peers', () => {
				const peers = [peer1, peer2];
				const strategy = new StrategyClass(peers);
				const results = strategy.getPeers();
				expect(results).to.equal(peers);
			});
		});
	}));

	describe('AllForTxStrategy event handling', () => {
		let strategy:AllForTxStrategy;

		beforeEach(() => {
			strategy  = new AllForTxStrategy([peer1, peer2]);
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
		let strategy:AnyForTxStrategy;

		beforeEach(() => {
			strategy = new AnyForTxStrategy([peer1, peer2]);
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
