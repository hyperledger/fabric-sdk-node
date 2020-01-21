/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const {Channel, EventService} = require('fabric-common');
const EventServiceManager = require('fabric-network/lib/impl/event/eventservicemanager');

const Network = require('fabric-network/lib/network');
const Contract = require('fabric-network/lib/contract');
const Transaction = require('fabric-network/lib/transaction');

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');

describe('DefaultEventHandlerStrategies', () => {
	const expectedStrategyTypes = {
		'MSPID_SCOPE_ALLFORTX': AllForTxStrategy,
		'MSPID_SCOPE_ANYFORTX': AnyForTxStrategy,
		'NETWORK_SCOPE_ALLFORTX': AllForTxStrategy,
		'NETWORK_SCOPE_ANYFORTX': AnyForTxStrategy
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	let options;
	let network;
	let transaction;

	beforeEach(() => {
		options = {
			commitTimeout: 418,
			banana: 'man'
		};

		const stubPeer = {
			_stubInfo: 'peer',
			name: 'peer'
		};

		const eventService = sinon.createStubInstance(EventService);
		eventService.isStarted.returns(true);

		const eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.getEventServices.returns([eventService]);

		const channel = sinon.createStubInstance(Channel);
		channel.getEndorsers.returns([stubPeer]);

		network = sinon.createStubInstance(Network);
		network.channel = channel;
		network.eventServiceManager = eventServiceManager;

		const contract = sinon.createStubInstance(Contract);
		contract.network = network;

		transaction = sinon.createStubInstance(Transaction);
		transaction.getNetwork.returns(network);
		transaction.name = 'trans1';
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createTxEventHandler = EventStrategies[strategyName];

		let eventHandler;

		beforeEach(() => {
			eventHandler = createTxEventHandler(transaction, options);
		});

		it('Returns a TransactionEventHandler', () => {
			expect(eventHandler).to.be.an.instanceOf(TransactionEventHandler);
		});

		it('Sets transaction on event handler', () => {
			expect(eventHandler.transaction).to.equal(transaction);
		});

		it('Sets transaction ID on event handler', () => {
			expect(eventHandler.transaction.name).to.equal('trans1');
		});

		it('Sets options on event handler', () => {
			expect(eventHandler.options).to.include(options);
		});

		it('Sets correct strategy on event handler', () => {
			const expectedType = expectedStrategyTypes[strategyName];
			expect(eventHandler.strategy).to.be.an.instanceOf(expectedType);
		});
	}));
});
