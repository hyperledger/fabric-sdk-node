/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

const Channel = require('fabric-client/lib/Channel');
const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const Query = require('fabric-network/lib/impl/query/query');
const Transaction = require('fabric-network/lib/transaction');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const TransactionID = require('fabric-client/lib/TransactionID');

describe('Transaction', () => {
	const transactionName = 'TRANSACTION_NAME';
	const chaincodeId = 'chaincode-id';
	const expectedResult = Buffer.from('42');

	const fakeProposal = {proposal: 'I do'};
	const fakeHeader = {header: 'gooooal'};
	const validProposalResponse = {
		response: {
			status: 200,
			payload: expectedResult,
			peer: {url: 'grpc://fakehost:9999'}
		}
	};
	const noPayloadProposalResponse = {
		response: {
			status: 200
		}
	};
	const errorResponseMessage = 'I_AM_AN_ERROR_RESPONSE';
	const errorProposalResponse = Object.assign(new Error(errorResponseMessage), {response: {status: 500, payload: 'error', peer: {url: 'grpc://fakehost:9999'}}});
	const emptyStringProposalResponse = {
		response: {
			status: 200,
			payload: Buffer.from('')
		}
	};

	const validProposalResponses = [[validProposalResponse], fakeProposal, fakeHeader];
	const noPayloadProposalResponses = [[noPayloadProposalResponse], fakeProposal, fakeHeader];
	const noProposalResponses = [[], fakeProposal, fakeHeader];
	const errorProposalResponses = [[errorProposalResponse], fakeProposal, fakeHeader];
	const mixedProposalResponses = [[validProposalResponse, errorProposalResponse], fakeProposal, fakeHeader];
	const emptyStringProposalResponses = [[emptyStringProposalResponse], fakeProposal, fakeHeader];

	let stubContract;
	let transaction;
	let channel;
	let network;
	let stubQueryHandler;

	beforeEach(() => {
		stubContract = sinon.createStubInstance(Contract);

		const transactionId = sinon.createStubInstance(TransactionID);
		transactionId.getTransactionID.returns('TRANSACTION_ID');
		stubContract.createTransactionID.returns(transactionId);

		stubQueryHandler = {
			evaluate: sinon.fake.resolves(expectedResult)
		};

		network = sinon.createStubInstance(Network);
		network.getQueryHandler.returns(stubQueryHandler);
		stubContract.getNetwork.returns(network);

		channel = sinon.createStubInstance(Channel);
		channel.sendTransactionProposal.resolves(validProposalResponses);
		channel.sendTransaction.resolves({status: 'SUCCESS'});
		network.getChannel.returns(channel);

		stubContract.getChaincodeId.returns(chaincodeId);
		stubContract.getEventHandlerOptions.returns({commitTimeout: 418});

		transaction = new Transaction(stubContract, transactionName);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#getName', () => {
		it('return the name', () => {
			const result = transaction.getName();
			expect(result).to.equal(transactionName);
		});
	});

	describe('#getTransactionID', () => {
		it('has a default transaction ID', () => {
			const result = transaction.getTransactionID();
			expect(result).to.be.an.instanceOf(TransactionID);
		});
	});

	describe('#setEventHandlerStrategy', () => {
		it('returns this', () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const stubEventHandlerFactoryFn = () => stubEventHandler;

			const result = transaction.setEventHandlerStrategy(stubEventHandlerFactoryFn);

			expect(result).to.equal(transaction);
		});
	});

	describe('#setTransient', () => {
		it('returns this', () => {
			const result = transaction.setTransient(new Map());
			expect(result).to.equal(transaction);
		});
	});

	describe('#submit', () => {
		let expectedProposal;

		beforeEach(() => {
			expectedProposal = {
				fcn: transactionName,
				txId: transaction.getTransactionID(),
				chaincodeId: stubContract.getChaincodeId(),
				args: []
			};
		});

		it('rejects for non-string arguments', () => {
			const promise = transaction.submit('arg1', 3.142, null);
			return expect(promise).to.be.rejectedWith('"arg1", 3.142, null');
		});

		it('sends proposal with no arguments', async () => {
			await transaction.submit();
			sinon.assert.calledWith(channel.sendTransactionProposal, sinon.match(expectedProposal));
		});

		it('sends proposal with arguments', async () => {
			const args = ['one', 'two', 'three'];
			expectedProposal.args = args;
			await transaction.submit(...args);
			sinon.assert.calledWith(channel.sendTransactionProposal, sinon.match(expectedProposal));
		});

		it('returns null for no proposal response payload', async () => {
			channel.sendTransactionProposal.resolves(noPayloadProposalResponses);
			const result = await transaction.submit();
			expect(result).to.be.null;
		});

		it('returns proposal response payload', async () => {
			const result = await transaction.submit();
			expect(result).to.equal(expectedResult);
		});

		it('throws if no peer responses are returned', () => {
			channel.sendTransactionProposal.resolves(noProposalResponses);
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith('No results were returned from the request');
		});

		it('throws if proposal responses are all errors', () => {
			channel.sendTransactionProposal.resolves(errorProposalResponses);
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith('No valid responses from any peers');
		});

		it('throws with message including underlying error message', () => {
			channel.sendTransactionProposal.resolves(errorProposalResponses);
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith(errorResponseMessage);
		});

		it('succeeds if some proposal responses are valid', () => {
			channel.sendTransactionProposal.resolves(mixedProposalResponses);
			const promise = transaction.submit();
			return expect(promise).to.be.fulfilled;
		});

		it('throws if the orderer returns an unsuccessful response', () => {
			const status = 'FAILURE';
			channel.sendTransaction.resolves({status});
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith(status);
		});

		it('sends only valid proposal responses to orderer', async () => {
			channel.sendTransactionProposal.resolves(mixedProposalResponses);
			await transaction.submit();
			const expected = {
				proposalResponses: [validProposalResponse],
				proposal: fakeProposal
			};
			sinon.assert.calledWith(channel.sendTransaction, sinon.match(expected));
		});

		it('uses a supplied event handler strategy', async () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const options = stubContract.getEventHandlerOptions();
			const stubEventHandlerFactoryFn = sinon.stub();
			stubEventHandlerFactoryFn.withArgs(transaction, stubContract.getNetwork(), options).returns(stubEventHandler);

			await transaction.setEventHandlerStrategy(stubEventHandlerFactoryFn).submit();

			sinon.assert.called(stubEventHandler.startListening);
			sinon.assert.called(stubEventHandler.waitForEvents);
		});

		it('sends a proposal with transient data', async () => {
			const transientMap = {key1: 'value1', key2: 'value2'};
			expectedProposal.transientMap = transientMap;

			await transaction.setTransient(transientMap).submit();

			sinon.assert.calledWith(channel.sendTransactionProposal, sinon.match(expectedProposal));
		});

		it('returns empty string proposal response payload', async () => {
			channel.sendTransactionProposal.resolves(emptyStringProposalResponses);
			const result = await transaction.submit();
			expect(result.toString()).to.equal('');
		});

		it('throws if called a second time', async () => {
			await transaction.submit();
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith('Transaction has already been invoked');
		});

		it('throws if called after evaluate', async () => {
			await transaction.evaluate();
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith('Transaction has already been invoked');
		});
	});

	describe('#evaluate', () => {
		it('returns the result from the query handler', async () => {
			const result = await transaction.evaluate();
			expect(result).to.equal(expectedResult);
		});

		it('passes a query to the query handler', async () => {
			await transaction.evaluate();
			sinon.assert.calledWith(stubQueryHandler.evaluate, sinon.match.instanceOf(Query));
		});

		it('builds correct request for no-args invocation', async () => {
			await transaction.evaluate();

			const query = stubQueryHandler.evaluate.lastArg;
			expect(query._request).to.deep.include({
				chaincodeId,
				fcn: transactionName,
				txId: transaction.getTransactionID(),
				args: []
			});
		});

		it('builds correct request for with-args invocation', async () => {
			const args = ['a', 'b', 'c'];

			await transaction.evaluate(...args);

			const query = stubQueryHandler.evaluate.lastArg;
			expect(query._request).to.deep.include({
				chaincodeId,
				fcn: transactionName,
				txId: transaction.getTransactionID(),
				args
			});
		});

		it('builds request with transient data', async () => {
			const transientMap = {key1: 'value1', key2: 'value2'};
			transaction.setTransient(transientMap);

			await transaction.evaluate();

			const query = stubQueryHandler.evaluate.lastArg;
			expect(query._request).to.deep.include({
				transientMap
			});
		});

		it('rejects for non-string arguments', () => {
			const promise = transaction.evaluate('arg1', 3.142, null);
			return expect(promise).to.be.rejectedWith('"arg1", 3.142, null');
		});

		it('returns empty string response', async () => {
			stubQueryHandler.evaluate = sinon.fake.resolves(Buffer.from(''));
			const result = await transaction.evaluate();
			expect(result.toString()).to.equal('');
		});

		it('throws if called a second time', async () => {
			await transaction.evaluate();
			const promise = transaction.evaluate();
			return expect(promise).to.be.rejectedWith('Transaction has already been invoked');
		});

		it('throws if called after submit', async () => {
			await transaction.submit();
			const promise = transaction.evaluate();
			return expect(promise).to.be.rejectedWith('Transaction has already been invoked');
		});
	});

	describe('#addCommitListener', () => {
		it('should call Network.addCommitlistner', async () => {
			network.addCommitListener.resolves('listener');
			const callback = (err, transationId, status, blockNumber) => {};
			const listener = await transaction.addCommitListener(callback, {}, 'eventHub');
			expect(listener).to.equal('listener');
			sinon.assert.calledWith(network.addCommitListener, 'TRANSACTION_ID', callback, {}, 'eventHub');
		});
	});

	describe('#getNetwork', () => {
		it('should call Contract.getNetwork', () => {
			stubContract.getNetwork.returns(network);
			expect(transaction.getNetwork()).to.equal(network);
			sinon.assert.called(stubContract.getNetwork);
		});
	});
});
