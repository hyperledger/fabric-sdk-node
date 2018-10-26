/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const Client = require('fabric-client');
const TransactionID = require('fabric-client/lib/TransactionID.js');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

const Contract = require('../lib/contract');
const Gateway = require('../lib/gateway');
const Network = require('fabric-network/lib/network');
const QueryHandler = require('../lib/api/queryhandler');
const Transaction = require('../lib/transaction');
const TransactionEventHandler = require('../lib/impl/event/transactioneventhandler');

describe('Contract', () => {
	const chaincodeId = 'CHAINCODE_ID';

	let network;

	let mockChannel, mockClient, mockGateway;
	let contract;
	let mockTransactionID;
	let mockQueryHandler;

	beforeEach(() => {
		mockChannel = sinon.createStubInstance(Channel);
		mockClient = sinon.createStubInstance(Client);

		mockGateway = sinon.createStubInstance(Gateway);
		mockGateway.getClient.returns(mockClient);
		mockGateway.getOptions.returns({
			eventHandlerOptions: {
				strategy: null
			}
		});

		network = new Network(mockGateway, mockChannel);

		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);
		mockChannel.getName.returns('testchainid');

		mockQueryHandler = sinon.createStubInstance(QueryHandler);

		contract = new Contract(network, chaincodeId, mockGateway, mockQueryHandler);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('throws if namespace is not a string', () => {
			(() => new Contract(network, chaincodeId, mockGateway, mockQueryHandler, 123))
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

		it('returns a transaction with both name and namespace', () => {
			const namespace = 'namespace';
			const name = 'name';
			const expected = `${namespace}:${name}`;

			const contract = new Contract(network, chaincodeId, mockGateway, mockQueryHandler, namespace);
			const result = contract.createTransaction(name);

			result.getName().should.equal(expected);
		});

		it('throws if name is an empty string', () => {
			(() => contract.createTransaction('')).should.throw('name');
		});

		it('throws is name is not a string', () => {
			(() => contract.createTransaction(123)).should.throw('name');
		});

		it('sets an event handler strategy on the transaction', () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const strategy = () => stubEventHandler;
			mockGateway.getOptions.returns({
				eventHandlerOptions: { strategy }
			});

			const result = contract.createTransaction('name');

			result._createTxEventHandler.should.equal(strategy);
		});
	});

	describe('#submitTransaction', () => {
		it('submits a transaction with supplied arguments', async () => {
			const args = [ 'a', 'b', 'c' ];
			const expected = Buffer.from('result');
			const stubTransaction = sinon.createStubInstance(Transaction);
			stubTransaction.submit.withArgs(...args).resolves(expected);
			sinon.stub(contract, 'createTransaction').returns(stubTransaction);

			const result = await contract.submitTransaction('name', ...args);

			result.should.equal(expected);
		});
	});

	describe('#evaluateTransaction', () => {
		it('should query chaincode and handle a good response without return data', async () => {
			mockQueryHandler.queryChaincode.withArgs(chaincodeId, mockTransactionID, 'myfunc', ['arg1', 'arg2']).resolves();

			const result = await contract.evaluateTransaction('myfunc', 'arg1', 'arg2');
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			should.equal(result, null);
		});

		it('should query chaincode and handle a good response with return data', async () => {
			const response = Buffer.from('hello world');
			mockQueryHandler.queryChaincode.withArgs(chaincodeId, mockTransactionID, 'myfunc', ['arg1', 'arg2']).resolves(response);

			const result = await contract.evaluateTransaction('myfunc', 'arg1', 'arg2');
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			result.equals(response).should.be.true;
		});

		it('should query chaincode and handle an error response', () => {
			const response = new Error('such error');
			mockQueryHandler.queryChaincode.withArgs(chaincodeId, mockTransactionID, 'myfunc', ['arg1', 'arg2']).rejects(response);
			return contract.evaluateTransaction('myfunc', 'arg1', 'arg2')
				.should.be.rejectedWith(/such error/);

		});

		it('should query chaincode with namespace added to the function', async () => {
			const nscontract = new Contract(network, chaincodeId, mockGateway, mockQueryHandler, 'my.name.space');

			mockQueryHandler.queryChaincode.withArgs(chaincodeId, mockTransactionID, 'myfunc', ['arg1', 'arg2']).resolves();

			await nscontract.evaluateTransaction('myfunc', 'arg1', 'arg2');
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			sinon.assert.calledWith(mockQueryHandler.queryChaincode,
				sinon.match.any,
				sinon.match.any,
				'my.name.space:myfunc',
				sinon.match.any);
		});

		it('throws if name is an empty string', () => {
			const promise = contract.evaluateTransaction('');
			return promise.should.be.rejectedWith('name');
		});

		it('throws is name is not a string', () => {
			const promise = contract.evaluateTransaction(123);
			return promise.should.be.rejectedWith('name');
		});

	});
});
