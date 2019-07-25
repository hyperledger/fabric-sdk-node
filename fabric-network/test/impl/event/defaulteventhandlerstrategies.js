/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const ChannelEventHub = require('fabric-client').ChannelEventHub;
const Network = require('fabric-network/lib/network');
const Transaction = require('fabric-network/lib/transaction');
const TransactionID = require('fabric-client/lib/TransactionID');
const Channel = require('fabric-client').Channel;
const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');

describe('DefaultEventHandlerStrategies', () => {
	const transactionId = 'TRANSACTION_ID';
	const expectedStrategyTypes = {
		'MSPID_SCOPE_ALLFORTX': AllForTxStrategy,
		'MSPID_SCOPE_ANYFORTX': AnyForTxStrategy,
		'NETWORK_SCOPE_ALLFORTX': AllForTxStrategy,
		'NETWORK_SCOPE_ANYFORTX': AnyForTxStrategy
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	let options;
	let stubNetwork;
	let stubTransaction;

	beforeEach(() => {
		options = {
			commitTimeout: 418,
			banana: 'man'
		};

		const stubPeer = {
			_stubInfo: 'peer',
			getName: () => 'peer',
			isInRole: () => true
		};
		const stubNonEventingPeer = {
			_stubInfo: 'nonEventingPeer',
			getName: () => 'peer',
			isInRole: () => false
		};

		const stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub.isconnected.returns(true);

		const stubEventHubManager = sinon.createStubInstance(EventHubManager);
		stubEventHubManager.getEventHubs.withArgs([stubPeer]).resolves([stubEventHub]);

		const channel = sinon.createStubInstance(Channel);
		channel.getPeers.returns([stubPeer, stubNonEventingPeer]);
		channel.getPeersForOrg.returns([stubPeer, stubNonEventingPeer]);

		stubNetwork = sinon.createStubInstance(Network);
		stubNetwork.getChannel.returns(channel);
		stubNetwork.getEventHubManager.returns(stubEventHubManager);

		stubTransaction = sinon.createStubInstance(Transaction);
		const stubTransactionId = sinon.createStubInstance(TransactionID);
		stubTransactionId.getTransactionID.returns(transactionId);
		stubTransaction.getTransactionID.returns(stubTransactionId);
		stubTransaction.getNetwork.returns(stubNetwork);
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createTxEventHandler = EventStrategies[strategyName];

		let eventHandler;

		beforeEach(() => {
			eventHandler = createTxEventHandler(stubTransaction, options);
		});

		it('Returns a TransactionEventHandler', () => {
			expect(eventHandler).to.be.an.instanceOf(TransactionEventHandler);
		});

		it('Sets transaction on event handler', () => {
			expect(eventHandler.transaction).to.equal(stubTransaction);
		});

		it('Sets transaction ID on event handler', () => {
			expect(eventHandler.transactionId).to.equal(transactionId);
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
