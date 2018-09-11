/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const Peer = require('fabric-client/lib/Peer');
const Client = require('fabric-client');
const TransactionID = require('fabric-client/lib/TransactionID.js');
const User = require('fabric-client/lib/User.js');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

const Contract = require('../lib/contract');
const Gateway = require('../lib/gateway');
const QueryHandler = require('../lib/api/queryhandler');
const TransactionEventHandler = require('../lib/impl/event/transactioneventhandler');

describe('Contract', () => {

	const sandbox = sinon.createSandbox();
	let clock;

	let mockChannel, mockClient, mockUser, mockGateway;
	let mockPeer1, mockPeer2, mockPeer3;
	let contract;
	let mockTransactionID;
	let mockQueryHandler;

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		mockChannel = sinon.createStubInstance(Channel);
		mockClient = sinon.createStubInstance(Client);
		mockGateway = sinon.createStubInstance(Gateway);
		mockGateway.getClient.returns(mockClient);
		mockUser = sinon.createStubInstance(User);
		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);
		mockChannel.getName.returns('testchainid');

		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
		mockPeer1.getName.returns('Peer1');

		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.index = 2;
		mockPeer2.getName.returns('Peer2');

		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.index = 3;
		mockPeer3.getName.returns('Peer3');
		mockQueryHandler = sinon.createStubInstance(QueryHandler);

		const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
		const stubEventHandlerFactory = {
			createTxEventHandler: () => stubEventHandler
		};

		contract = new Contract(mockChannel, 'someid', mockGateway, mockQueryHandler, stubEventHandlerFactory);
	});

	afterEach(() => {
		sandbox.restore();
		clock.restore();
	});

	describe('#_validatePeerResponses', () => {
		it('should return all responses because all are valid', () => {
			const responses = [
				{
					response: {
						status: 200,
						payload: 'no error'
					}
				},

				{
					response: {
						status: 200,
						payload: 'good here'
					}
				}
			];

			mockChannel.verifyProposalResponse.returns(true);
			mockChannel.compareProposalResponseResults.returns(true);

			(function() {
				const {validResponses} = contract._validatePeerResponses(responses);
				validResponses.should.deep.equal(responses);
			}).should.not.throw();
		});

		it('should throw if no responses', () => {
			(function() {
				contract._validatePeerResponses([]);
			}).should.throw(/No results were returned/);
		});

		it('should throw if no proposal responses', () => {
			(function() {
				contract._validatePeerResponses([]);
			}).should.throw(/No results were returned/);
		});

		it('should return only the valid responses', () => {

			// simulate an Error from node-sdk itself
			const resp1 = new Error('had a problem');

			// simulate a good response
			const resp2 = {
				response: {
					status: 200,
					payload: 'no error'
				}
			};

			// simulate a bad response from peer, chaincode
			const resp3 = new Error('some other error');
			resp3.response = {
				status: 500,
				message: 'some other error'
			};

			const responses = [resp1, resp2, resp3];

			(function() {
				const {validResponses} = contract._validatePeerResponses(responses);
				validResponses.should.deep.equal([resp2]);

			}).should.not.throw();

		});
	});

	describe('#submitTransaction', () => {
		const validResponses = [{
			response: {
				status: 200
			}
		}];


		beforeEach(() => {
			sandbox.stub(contract, '_validatePeerResponses').returns({validResponses: validResponses});
		});

		it('should throw if functionName not specified', () => {
			return contract.submitTransaction(null, 'arg1', 'arg2')
				.should.be.rejectedWith('Transaction name must be a non-empty string: null');
		});


		it('should throw if args contains non-string values', () => {
			return contract.submitTransaction('myfunc', 'arg1', 3.142, 'arg3', null)
				.should.be.rejectedWith('Transaction parameters must be strings: 3.142, null');
		});

		it('should submit an invoke request to the chaincode which does not return data', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.then((result) => {
					should.equal(result, null);
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});

		it('should submit an invoke request to the chaincode which does not return data', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.then((result) => {
					should.equal(result, null);
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});

		it('should submit an invoke request to the chaincode with no event handler', () => {
			const proposalResponses = [{
				response: {
					status: 200,
					payload: 'hello world'
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			contract._validatePeerResponses.returns({validResponses: proposalResponses});
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			contract.eventHandlerFactory = null;
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.then((result) => {
					result.should.equal('hello world');
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});

		it('should submit an invoke request to the chaincode', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.then((result) => {
					should.equal(result, null);
					sinon.assert.calledOnce(mockClient.newTransactionID);
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});


		it('should throw if transaction proposals were not valid', () => {
			const proposalResponses = [];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			const errorResp = new Error('an error');
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			contract._validatePeerResponses.withArgs(proposalResponses).throws(errorResp);
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.should.be.rejectedWith(/an error/);
		});

		it('should throw if no valid proposal responses', () => {
			const proposalResponses = [
				Object.assign(new Error(),
					{
						response: { status: 500, payload: 'got an error' }
					}),
				new Error('had a problem'),
				Object.assign(new Error(),
					{
						response: { status: 500, payload: 'oh oh another error' }
					})
			];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);

			// Remove the stubbing of _validatePeerResponses in beforeEach()
			contract._validatePeerResponses.restore();

			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.should.be.rejectedWith(/No valid responses from any peers/);
		});

		it('should throw an error if the orderer responds with an error', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'FAILURE'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', 'arg1', 'arg2')
				.should.be.rejectedWith(/Failed to send/);
		});

	});

	describe('#executeTransaction', () => {
		it('should query chaincode and handle a good response without return data', async () => {
			mockQueryHandler.queryChaincode.withArgs('someid', mockTransactionID, 'myfunc', ['arg1', 'arg2']).resolves();

			const result = await contract.executeTransaction('myfunc', 'arg1', 'arg2');
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			should.equal(result, null);
		});

		it('should query chaincode and handle a good response with return data', async () => {
			const response = Buffer.from('hello world');
			mockQueryHandler.queryChaincode.withArgs('someid', mockTransactionID, 'myfunc', ['arg1', 'arg2']).resolves(response);

			const result = await contract.executeTransaction('myfunc', 'arg1', 'arg2');
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			result.equals(response).should.be.true;
		});

		it('should query chaincode and handle an error response', () => {
			const response = new Error('such error');
			mockQueryHandler.queryChaincode.withArgs('someid', mockTransactionID, 'myfunc', ['arg1', 'arg2']).rejects(response);
			return contract.executeTransaction('myfunc', 'arg1', 'arg2')
				.should.be.rejectedWith(/such error/);

		});
	});
});
