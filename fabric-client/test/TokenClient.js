/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');
const Client = require('../lib/Client');
const TokenClient = rewire('../lib/TokenClient');
const TransactionID = require('../lib/TransactionID.js');
const fabprotos = require('fabric-protos');

const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('TokenClient', () => {
	let sandbox;
	let revert;
	let checkTokenRequestStub;
	let buildIssueCommandStub;
	let buildTransferCommandStub;
	let buildRedeemCommandStub;
	let buildListCommandStub;
	let sendTokenTransactionStub;
	let sendTokenCommandStub;
	let mockCommand;
	let mockResponse;
	let mockResult;
	let mockTokenTx;
	let mockChannel;
	let client;
	let tokenClient;

	const testowner = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('testowner')};
	const txId = sinon.createStubInstance(TransactionID);

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		checkTokenRequestStub = sandbox.stub();
		buildIssueCommandStub = sandbox.stub();
		buildTransferCommandStub = sandbox.stub();
		buildRedeemCommandStub = sandbox.stub();
		buildListCommandStub = sandbox.stub();
		sendTokenCommandStub = sandbox.stub();
		sendTokenTransactionStub = sandbox.stub();

		mockCommand = new fabprotos.token.Command();
		mockTokenTx = new fabprotos.token.TokenTransaction();
		mockResponse = new fabprotos.token.CommandResponse();
		mockResponse.setTokenTransaction(mockTokenTx);
		mockResult = {status: 'SUCCESS'};

		// prepare stubs
		checkTokenRequestStub.returns();
		buildIssueCommandStub.returns(mockCommand);
		buildTransferCommandStub.returns(mockCommand);
		buildRedeemCommandStub.returns(mockCommand);
		buildListCommandStub.returns(mockCommand);
		sendTokenCommandStub.returns(mockResponse);
		sendTokenTransactionStub.returns(mockResult);

		revert.push(TokenClient.__set__('tokenUtils.checkTokenRequest', checkTokenRequestStub));
		revert.push(TokenClient.__set__('tokenUtils.buildIssueCommand', buildIssueCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildTransferCommand', buildTransferCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildRedeemCommand', buildRedeemCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildListCommand', buildListCommandStub));

		mockChannel = {
			sendTokenCommand: sendTokenCommandStub,
			sendTokenTransaction: sendTokenTransactionStub,
		};
		client = new Client();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should create a new TokenClient instance', () => {
			tokenClient = new TokenClient(client, mockChannel);
			tokenClient.getClient().should.deep.equal(client);
			tokenClient.getChannel().should.deep.equal(mockChannel);
		});

		it('should get error when no client is passed', () => {
			(() => {
				new TokenClient();
			}).should.throw('Missing required "client" parameter on the constructor call');
		});

		it('should get error when no channel is passed', () => {
			(() => {
				new TokenClient(client);
			}).should.throw('Missing required "channel" parameter the constructor call');
		});
	});

	describe('#issue', () => {
		let request;
		let param;

		beforeEach(() => {
			// prepare token request for issue
			param = {recipient: testowner, type: 'abc123', quantity: 210};
			request = {params: [param], txId: txId};
			tokenClient = new TokenClient(client, mockChannel);
		});

		it('should send token command and transaction', async () => {
			// copy the request to verify request is not changed
			const copiedRequest = Object.assign({}, request);

			const result = await tokenClient.issue(request);

			// verify result
			result.should.deep.equal(mockResult);

			// verify that request is not changed
			request.should.deep.equal(copiedRequest);

			// verify stub calls and argments
			sinon.assert.calledOnce(checkTokenRequestStub);
			sinon.assert.calledOnce(buildIssueCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.calledOnce(sendTokenTransactionStub);

			sinon.assert.calledWith(buildIssueCommandStub, request);
			sinon.assert.calledWith(checkTokenRequestStub, request);
			let arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);
			arg = sendTokenTransactionStub.getCall(0).args[0];
			arg.tokenTransaction.should.deep.equal(mockTokenTx);
		});

		it('should get error when checkTokenRequest fails', async () => {
			try {
				const fakeError = new Error('forced check error');
				checkTokenRequestStub.throws(fakeError);

				await tokenClient.issue(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.notCalled(buildIssueCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced check error');
			}
		});

		it('should get error when buildIssueCommand fails', async () => {
			try {
				const fakeError = new Error('forced build error');
				buildIssueCommandStub.throws(fakeError);

				await tokenClient.issue(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildIssueCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced build error');
			}
		});

		it('should get error when sendTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced command error');
				sendTokenCommandStub.throws(fakeError);

				await tokenClient.issue(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildIssueCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced command error');
			}
		});

		it('should get error when sendTokenTransaction fails', async () => {
			try {
				const fakeError = new Error('forced tokentx error');
				sendTokenTransactionStub.throws(fakeError);

				await tokenClient.issue(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildIssueCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.calledOnce(sendTokenTransactionStub);
				err.message.should.equal('forced tokentx error');
			}
		});
	});

	describe('#transfer', () => {
		let request;
		let param;

		beforeEach(() => {
			// prepare token request for transfer
			const tokenId = {tx_id: 'mock_tx_id', index: 0};
			param = {recipient: testowner, quantity: 210};
			request = {params: [param], tokenIds: [tokenId], txId: txId};

			tokenClient = new TokenClient(client, mockChannel);
		});

		it('should send token command and transaction', async () => {
			// copy the request to verify request is not changed
			const copiedRequest = Object.assign({}, request);

			const result = await tokenClient.transfer(request);

			// verify result
			result.should.deep.equal(mockResult);

			// verify that request is not changed
			request.should.deep.equal(copiedRequest);

			// verify stub calls and argments
			sinon.assert.calledOnce(checkTokenRequestStub);
			sinon.assert.calledOnce(buildTransferCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.calledOnce(sendTokenTransactionStub);

			sinon.assert.calledWith(checkTokenRequestStub, request);
			sinon.assert.calledWith(buildTransferCommandStub, request);
			let arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);
			arg = sendTokenTransactionStub.getCall(0).args[0];
			arg.tokenTransaction.should.deep.equal(mockTokenTx);
		});

		it('should get error when checkTokenRequest fails', async () => {
			try {
				const fakeError = new Error('forced check error');
				checkTokenRequestStub.throws(fakeError);

				await tokenClient.transfer(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.notCalled(buildTransferCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced check error');
			}
		});

		it('should get error when buildTransferCommand fails', async () => {
			try {
				const fakeError = new Error('forced build error');
				buildTransferCommandStub.throws(fakeError);

				await tokenClient.transfer(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildTransferCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced build error');
			}
		});

		it('should get error when sendTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced command error');
				sendTokenCommandStub.throws(fakeError);

				await tokenClient.transfer(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildTransferCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced command error');
			}
		});

		it('should get error when sendTokenTransaction fails', async () => {
			try {
				const fakeError = new Error('forced tokentx error');
				sendTokenTransactionStub.throws(fakeError);

				await tokenClient.transfer(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildTransferCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.calledOnce(sendTokenTransactionStub);
				err.message.should.equal('forced tokentx error');
			}
		});
	});

	describe('#redeem', () => {
		let request;
		let param;

		beforeEach(() => {
			// prepare token request for redeem
			const tokenId = {tx_id: 'mock_tx_id', index: 0};
			param = {quantity: 50};
			request = {params: [param], tokenIds: [tokenId], txId: txId};

			tokenClient = new TokenClient(client, mockChannel);
		});

		it('should send token command and transaction', async () => {
			// copy the request to verify request is not changed
			const copiedRequest = Object.assign({}, request);

			const result = await tokenClient.redeem(request);

			// verify result
			result.should.deep.equal(mockResult);

			// verify that request is not changed
			request.should.deep.equal(copiedRequest);

			// verify stub calls and argments
			sinon.assert.calledOnce(checkTokenRequestStub);
			sinon.assert.calledOnce(buildRedeemCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.calledOnce(sendTokenTransactionStub);

			sinon.assert.calledWith(checkTokenRequestStub, request);
			sinon.assert.calledWith(buildRedeemCommandStub, request);
			let arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);
			arg = sendTokenTransactionStub.getCall(0).args[0];
			arg.tokenTransaction.should.deep.equal(mockTokenTx);
		});

		it('should get error when checkTokenRequest fails', async () => {
			try {
				const fakeError = new Error('forced check error');
				checkTokenRequestStub.throws(fakeError);

				await tokenClient.redeem(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.notCalled(buildRedeemCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced check error');
			}
		});

		it('should get error when buildRedeemCommand fails', async () => {
			try {
				const fakeError = new Error('forced build error');
				buildRedeemCommandStub.throws(fakeError);

				await tokenClient.redeem(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildRedeemCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced build error');
			}
		});

		it('should get error when sendTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced command error');
				sendTokenCommandStub.throws(fakeError);

				await tokenClient.redeem(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildRedeemCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced command error');
			}
		});

		it('should get error when sendTokenTransaction fails', async () => {
			try {
				const fakeError = new Error('forced tokentx error');
				sendTokenTransactionStub.throws(fakeError);

				await tokenClient.redeem(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(checkTokenRequestStub);
				sinon.assert.calledOnce(buildRedeemCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.calledOnce(sendTokenTransactionStub);
				err.message.should.equal('forced tokentx error');
			}
		});
	});

	describe('#list', () => {
		let request;
		let mockTokens;
		let newTransactionIDStub;
		let mockClient;

		beforeEach(() => {
			// prepare token request for list
			request = {txId: txId};

			// prepare mockResponse for sendTokenComandStub
			const tokenId1 = {tx_id: 'mock_tx_id1', index: 0};
			const tokenId2 = {tx_id: 'mock_tx_id2', index: 0};
			const token1 = {id: tokenId1, type: 'abc123', quantity: 100};
			const token2 = {id: tokenId2, type: 'xyz', quantity: 200};
			mockTokens = [token1, token2];
			mockResponse = new fabprotos.token.CommandResponse();
			mockResponse.setUnspentTokens({tokens: mockTokens});

			sendTokenCommandStub.returns(mockResponse);

			// create mockClient and tokenClient
			newTransactionIDStub = sandbox.stub();
			newTransactionIDStub.returns(txId);
			mockClient = {newTransactionID: newTransactionIDStub};
			tokenClient = new TokenClient(mockClient, mockChannel);
		});

		it('should send token command and transaction with optional request', async () => {
			const result = await tokenClient.list(request);

			// verify stub calls and argments
			sinon.assert.calledOnce(buildListCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.notCalled(sendTokenTransactionStub);

			sinon.assert.calledWith(buildListCommandStub);
			const arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);

			// verify result
			result.should.deep.equal(mockResponse.unspent_tokens.tokens);
		});

		it('should send token command and transaction with no parameter', async () => {
			const result = await tokenClient.list();

			// verify stub calls and argments
			sinon.assert.calledOnce(buildListCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.notCalled(sendTokenTransactionStub);

			sinon.assert.calledWith(buildListCommandStub);
			const arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);

			// verify result
			result.should.deep.equal(mockResponse.unspent_tokens.tokens);
		});

		it('should get error when buildListCommand fails', async () => {
			try {
				const fakeError = new Error('forced build error');
				buildListCommandStub.throws(fakeError);

				await tokenClient.list();
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(buildListCommandStub);
				sinon.assert.notCalled(sendTokenCommandStub);
				err.message.should.equal('forced build error');
			}
		});

		it('should get error when sendTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced command error');
				sendTokenCommandStub.throws(fakeError);

				await tokenClient.list();
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(buildListCommandStub);
				sinon.assert.calledOnce(sendTokenCommandStub);
				err.message.should.equal('forced command error');
			}
		});
	});

	describe('#_sendAndCommit', () => {
		let request;

		beforeEach(() => {
			// prepare token request for list
			request = {txId: txId, tokenCommand: mockCommand};
			tokenClient = new TokenClient(client, mockChannel);
		});

		it('should send token command and transaction', async () => {
			const result = await tokenClient._sendAndCommit(request);

			// verify stub calls and argments
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.calledOnce(sendTokenTransactionStub);

			let arg = sendTokenCommandStub.getCall(0).args[0];
			arg.tokenCommand.should.deep.equal(mockCommand);
			arg = sendTokenTransactionStub.getCall(0).args[0];
			arg.tokenTransaction.should.deep.equal(mockTokenTx);

			// verify result
			result.should.deep.equal(mockResult);
		});

		it('should get error when sendTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced command error');
				sendTokenCommandStub.throws(fakeError);

				await tokenClient._sendAndCommit(request, ['grpc://127.0.0.1:7051']);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.notCalled(sendTokenTransactionStub);
				err.message.should.equal('forced command error');
			}
		});

		it('should get error when sendTokenTransaction fails', async () => {
			try {
				const fakeError = new Error('forced tokentx error');
				sendTokenTransactionStub.throws(fakeError);

				await tokenClient._sendAndCommit(request);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.calledOnce(sendTokenTransactionStub);
				err.message.should.equal('forced tokentx error');
			}
		});
	});
});
