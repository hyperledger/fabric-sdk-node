/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const Client = require('fabric-client');
const TransactionID = require('fabric-client/lib/TransactionID.js');

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.should();

const Contract = require('../lib/contract');
const Gateway = require('../lib/gateway');
const Network = require('fabric-network/lib/network');
const Transaction = require('../lib/transaction');
const TransactionEventHandler = require('../lib/impl/event/transactioneventhandler');
const BaseCheckpointer = require('./../lib/impl/event/basecheckpointer');
const ContractEventListener = require('./../lib/impl/event/contracteventlistener');
const EventHubManager = require('./../lib/impl/event/eventhubmanager');

describe('Contract', () => {
	const chaincodeId = 'CHAINCODE_ID';

	let network;

	let mockChannel, mockClient, mockGateway;
	let contract;
	let mockTransactionID;
	let mockCheckpointer;
	let mockEventHubManager;
	let mockEventHub;

	beforeEach(() => {
		mockEventHub = sinon.createStubInstance(ChannelEventHub);
		mockChannel = sinon.createStubInstance(Channel);
		mockClient = sinon.createStubInstance(Client);

		mockGateway = sinon.createStubInstance(Gateway);
		mockCheckpointer = sinon.createStubInstance(BaseCheckpointer);
		mockEventHubManager = sinon.createStubInstance(EventHubManager);
		mockGateway.getClient.returns(mockClient);
		mockGateway.getOptions.returns({
			eventHandlerOptions: {
				strategy: null
			},
			queryHandlerOptions: {
				strategy: () => {
					return {};
				}
			}
		});
		network = new Network(mockGateway, mockChannel);
		mockEventHubManager.getEventHub.returns(mockEventHub);
		mockEventHubManager.getReplayEventHub.returns(mockEventHub);
		network.eventHubManager = mockEventHubManager;
		mockEventHubManager.getPeers.returns(['peer1']);

		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);
		mockChannel.getName.returns('testchainid');

		contract = new Contract(network, chaincodeId, mockGateway, mockCheckpointer);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('throws if namespace is not a string', () => {
			(() => new Contract(network, chaincodeId, mockGateway, mockCheckpointer, 123))
				.should.throw(/namespace/i);
		});
	});

	describe('#getNetwork', () => {
		it('returns a Network', () => {
			const result = contract.getNetwork();
			result.should.be.an.instanceOf(Network);
		});
	});

	describe('#createTransactionID', () => {
		it('returns a TransactionID', () => {
			const result = contract.createTransactionID();
			result.should.be.an.instanceOf(TransactionID);
		});
	});

	describe('#getChaincodeId', () => {
		it('returns the chaincode ID', () => {
			const result = contract.getChaincodeId();
			result.should.equal(chaincodeId);
		});
	});

	describe('#getCheckpointer', () => {
		it('should return the global checkpointer if it is undefined in options', () => {
			const checkpointer = contract.getCheckpointer();
			expect(checkpointer).to.equal(mockCheckpointer);
		});

		it('should return the global checkpointer if it is undefined in options object', () => {
			const checkpointer = contract.getCheckpointer({});
			expect(checkpointer).to.equal(mockCheckpointer);
		});

		it('should return the global checkpointer if it is true in options', () => {
			const checkpointer = contract.getCheckpointer({checkpointer: 'LOL'});
			expect(checkpointer).to.equal(mockCheckpointer);
		});

		it('should return the checkpointer passed as an option', () => {
			const checkpointerFactory = () => {};
			const checkpointer = contract.getCheckpointer({checkpointer: checkpointerFactory});
			expect(checkpointer).to.equal(checkpointerFactory);
			expect(checkpointer).to.not.equal(mockCheckpointer);
		});

		it('should return null if checkpointer is false', () => {
			const checkpointer = contract.getCheckpointer({checkpointer: false});
			expect(checkpointer).to.be.null;
		});
	});

	describe('#getEventHubSelectionStrategy', () => {
		it('should return the eventhub selection strategy', () => {
			network.eventHubSelectionStrategy = 'selection-strategy';
			const strategy = contract.getEventHubSelectionStrategy();
			expect(strategy).to.equal('selection-strategy');
		});
	});

	describe('#getEventHandlerOptions', () => {
		it('returns event handler options from the gateway', () => {
			const result = contract.getEventHandlerOptions();
			const expected = mockGateway.getOptions().eventHandlerOptions;
			result.should.deep.equal(expected);
		});
	});

	describe('#createTransaction', () => {
		it('returns a transaction with only a name', () => {
			const name = 'name';
			const result = contract.createTransaction(name);
			result.getName().should.equal(name);
		});

		it ('returns a transaction with both name and namespace', () => {
			const namespace = 'namespace';
			const name = 'name';
			const expected = `${namespace}:${name}`;

			contract = new Contract(network, chaincodeId, mockGateway, mockCheckpointer, namespace);
			const result = contract.createTransaction(name);

			result.getName().should.equal(expected);
		});

		it ('throws if name is an empty string', () => {
			(() => contract.createTransaction('')).should.throw('name');
		});

		it ('throws is name is not a string', () => {
			(() => contract.createTransaction(123)).should.throw('name');
		});

		it ('sets an event handler strategy on the transaction', () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const strategy = () => stubEventHandler;
			mockGateway.getOptions.returns({
				eventHandlerOptions: {strategy}
			});

			const result = contract.createTransaction('name');

			result._createTxEventHandler.should.equal(strategy);
		});
	});

	describe('#submitTransaction', () => {
		it('submits a transaction with supplied arguments', async () => {
			const args = ['a', 'b', 'c'];
			const expected = Buffer.from('result');
			const stubTransaction = sinon.createStubInstance(Transaction);
			stubTransaction.submit.withArgs(...args).resolves(expected);
			sinon.stub(contract, 'createTransaction').returns(stubTransaction);

			const result = await contract.submitTransaction('name', ...args);

			result.should.equal(expected);
		});
	});

	describe('#evaluateTransaction', () => {
		it('evaluates a transaction with supplied arguments', async () => {
			const args = ['a', 'b', 'c'];
			const expected = Buffer.from('result');
			const stubTransaction = sinon.createStubInstance(Transaction);
			stubTransaction.evaluate.withArgs(...args).resolves(expected);
			sinon.stub(contract, 'createTransaction').returns(stubTransaction);

			const result = await contract.evaluateTransaction('name', ...args);

			result.should.equal(expected);
		});
	});


	describe('#addContractListener', () => {
		let listenerName;
		let testEventName;
		let callback;
		beforeEach(() => {
			listenerName = 'testContractListener';
			testEventName = 'testEvent';
			callback = () => {};
		});
		it('should create options if the options param is undefined', async () => {
			const listener = await contract.addContractListener(listenerName, testEventName, callback);
			expect(listener).to.be.instanceof(ContractEventListener);
			expect(network.listeners.get(listenerName)).to.equal(listener);
		});

		it('should create an instance of ContractEventListener and add it to the list of listeners', async () => {
			const listener = await contract.addContractListener(listenerName, testEventName, callback, {});
			expect(listener).to.be.instanceof(ContractEventListener);
			expect(network.listeners.get(listenerName)).to.equal(listener);
		});

		it('should change options.replay=undefined to options.replay=false', async () => {
			sinon.spy(contract, 'getCheckpointer');
			await contract.addContractListener(listenerName, testEventName, callback, {replay: undefined});
			sinon.assert.calledWith(contract.getCheckpointer, {replay: false, checkpointer: sinon.match.instanceOf(BaseCheckpointer)});
		});

		it('should change options.replay=\'true\' to options.replay=true', async () => {
			sinon.spy(contract, 'getCheckpointer');
			await contract.addContractListener(listenerName, testEventName, callback, {replay: 'true'});
			sinon.assert.calledWith(contract.getCheckpointer, {checkpointer: sinon.match.instanceOf(BaseCheckpointer), replay: true});
		});
	});
});
