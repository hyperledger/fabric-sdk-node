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

const DefaultEventHandlerManager = require('../../../lib/impl/event/defaulteventhandlermanager');
const EventHandlerStrategies = require('../../../lib/impl/event/defaulteventhandlerstrategies');
const EventHubFactory = require('fabric-network/lib/impl/event/eventhubfactory');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const Network = require('fabric-network/lib/network');
const Channel = require('fabric-client/lib/Channel');

describe('DefaultEventHandlerManager', () => {
	const mspId = 'MSP_ID';

	let stubNetwork;
	let fakeStrategyFactory;
	let stubStrategy;

	beforeEach(() => {
		const stubChannel = sinon.createStubInstance(Channel);

		stubNetwork = sinon.createStubInstance(Network);
		stubNetwork.getChannel.returns(stubChannel);

		stubStrategy = {
			getConnectedEventHubs: sinon.stub()
		};
		stubStrategy.getConnectedEventHubs.resolves([]);

		fakeStrategyFactory = sinon.stub();
		fakeStrategyFactory.withArgs(sinon.match.instanceOf(EventHubFactory), sinon.match(stubNetwork), sinon.match(mspId)).returns(stubStrategy);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('has a default strategy if no options supplied', () => {
			const manager = new DefaultEventHandlerManager(stubNetwork, mspId, {});
			expect(manager.options.strategy).to.equal(EventHandlerStrategies.MSPID_SCOPE_ALLFORTX);
		});

		it('allows a strategy to be specified', () => {
			const options = {
				strategy: EventHandlerStrategies.MSPID_SCOPE_ANYFORTX
			};
			const manager = new DefaultEventHandlerManager(stubNetwork, mspId, options);
			expect(manager.options.strategy).to.equal(EventHandlerStrategies.MSPID_SCOPE_ANYFORTX);
		});
	});

	describe('#initialize', () => {
		let manager;

		beforeEach(() => {
			const options = { strategy: fakeStrategyFactory };
			manager = new DefaultEventHandlerManager(stubNetwork, mspId, options);
		});

		it('gets event hubs from strategy', () => {
			manager.initialize();
			sinon.assert.calledOnce(stubStrategy.getConnectedEventHubs);
		});

		it('does not reject if getting event hubs from strategy errors', () => {
			stubStrategy.getConnectedEventHubs.rejects();
			return expect(manager.initialize()).to.be.fulfilled;
		});
	});

	describe('#createTxEventHandler', () => {
		it('returns a transaction event handler', () => {
			const options = { strategy: fakeStrategyFactory };
			const manager = new DefaultEventHandlerManager(stubNetwork, mspId, options);

			const result = manager.createTxEventHandler('txId');

			expect(result).to.be.an.instanceof(TransactionEventHandler);
		});

		it('creates a new strategy instance on each call', () => {
			const options = { strategy: fakeStrategyFactory };
			const manager = new DefaultEventHandlerManager(stubNetwork, mspId, options);

			manager.createTxEventHandler('txId');
			manager.createTxEventHandler('txId');

			sinon.assert.calledTwice(fakeStrategyFactory);
		});
	});
});
