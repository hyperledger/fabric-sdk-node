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
const Channel = require('../lib/Channel');
const Client = require('../lib/Client');
const {Identity} = require('fabric-common');
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

	const testowner = Buffer.from('testowner');
	const txId = sinon.createStubInstance(TransactionID);
	const channelId = 'mychannel';

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

		// use following common stubs for all tests
		revert.push(TokenClient.__set__('tokenUtils.checkTokenRequest', checkTokenRequestStub));
		revert.push(TokenClient.__set__('tokenUtils.buildIssueCommand', buildIssueCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildTransferCommand', buildTransferCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildRedeemCommand', buildRedeemCommandStub));
		revert.push(TokenClient.__set__('tokenUtils.buildListCommand', buildListCommandStub));

		mockChannel = {
			_name: channelId,
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
			param = {owner: testowner, type: 'abc123', quantity: 210};
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
			sinon.assert.calledWith(checkTokenRequestStub, request, 'issue', true);
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
			param = {owner: testowner, quantity: 210};
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

			sinon.assert.calledWith(checkTokenRequestStub, request, 'transfer', true);
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

			sinon.assert.calledWith(checkTokenRequestStub, request, 'redeem', true);
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
			const token1 = {id: tokenId1, type: 'abc123', quantity: '100'};
			const token2 = {id: tokenId2, type: 'xyz', quantity: '200'};
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

	describe('#generateUnsignedTokenCommand', () => {
		let request;
		let param;
		let tokenIds;
		let newIdentityStub;
		let identityStub;
		let newTransactionIDStub;
		let transactionIDStub;
		let clientStub;
		let buildTokenCommandHeaderStub;

		const admin = true;
		const mspId = 'fake-mspid';
		const certificate = 'fake-certificate';
		const commandHeader = new fabprotos.token.Header();
		const tlsCertHash = Buffer.from('test-client-cert-hash');

		beforeEach(() => {
			sandbox = sinon.createSandbox();

			// update mockCommand with mocked header
			mockCommand.setHeader(commandHeader);

			// prepare request parameters
			tokenIds = [{tx_id: 'mock_tx_id', index: 0}];
			param = {owner: testowner, type: 'abc123', quantity: 210};

			// create stubs
			buildTokenCommandHeaderStub = sinon.stub();
			buildTokenCommandHeaderStub.returns(commandHeader);

			identityStub = sinon.createStubInstance(Identity);
			identityStub.serialize.returns('fake-serialized-identity');
			newIdentityStub = sinon.stub();
			newIdentityStub.returns(identityStub);

			transactionIDStub = sinon.createStubInstance(TransactionID);
			transactionIDStub.getNonce.returns('fake-nonce');
			newTransactionIDStub = sinon.stub();
			newTransactionIDStub.returns(transactionIDStub);

			revert.push(TokenClient.__set__('Identity', newIdentityStub));
			revert.push(TokenClient.__set__('TransactionID', newTransactionIDStub));
			revert.push(TokenClient.__set__('tokenUtils.buildTokenCommandHeader', buildTokenCommandHeaderStub));

			clientStub = sinon.createStubInstance(Client);
			clientStub.getClientCertHash.returns(tlsCertHash);
			tokenClient = new TokenClient(clientStub, mockChannel);
		});

		it('should return a unsigned token command for issue', () => {
			request = {commandName: 'issue', params: [param]};
			const command = tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			command.should.deep.equal(mockCommand);

			sinon.assert.calledWith(buildIssueCommandStub, request);
			sinon.assert.calledWith(newIdentityStub, certificate, null, mspId);
			sinon.assert.calledWith(newTransactionIDStub, identityStub, admin);
			sinon.assert.calledWith(buildTokenCommandHeaderStub, identityStub, channelId, 'fake-nonce', tlsCertHash);
		});

		it('should return a unsigned token command for transfer', () => {
			request = {commandName: 'transfer', tokenIds: tokenIds, params: [param]};
			const command = tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			command.should.deep.equal(mockCommand);

			sinon.assert.calledWith(buildTransferCommandStub, request);
			sinon.assert.calledWith(newIdentityStub, certificate, null, mspId);
			sinon.assert.calledWith(newTransactionIDStub, identityStub, admin);
			sinon.assert.calledWith(buildTokenCommandHeaderStub, identityStub, channelId, 'fake-nonce', tlsCertHash);
		});

		it('should return a unsigned token command for redeem', () => {
			request = {commandName: 'redeem', tokenIds: tokenIds, params: [param]};
			const command = tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			command.should.deep.equal(mockCommand);

			sinon.assert.calledWith(buildRedeemCommandStub, request);
			sinon.assert.calledWith(newIdentityStub, certificate, null, mspId);
			sinon.assert.calledWith(newTransactionIDStub, identityStub, admin);
			sinon.assert.calledWith(buildTokenCommandHeaderStub, identityStub, channelId, 'fake-nonce', tlsCertHash);
		});

		it('should return a unsigned token command for list', () => {
			request = {commandName: 'list'};
			const command = tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			command.should.deep.equal(mockCommand);

			sinon.assert.calledWith(checkTokenRequestStub, request, 'generateUnsignedTokenCommand', false);
			sinon.assert.calledWith(buildListCommandStub, request);
			sinon.assert.calledWith(newIdentityStub, certificate, null, mspId);
			sinon.assert.calledWith(newTransactionIDStub, identityStub, admin);
			sinon.assert.calledWith(buildTokenCommandHeaderStub, identityStub, channelId, 'fake-nonce', tlsCertHash);
		});

		it('should get error when new Identity throws error', () => {
			(() => {
				const fakeError = new Error('forced new identity error');
				newIdentityStub.throws(fakeError);

				request = {commandName: 'issue', params: [param], txId: txId};
				tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			}).should.throw('forced new identity error');
		});

		it('should get error when new TransactionID throws error', () => {
			(() => {
				const fakeError = new Error('forced new identity error');
				newTransactionIDStub.throws(fakeError);

				request = {commandName: 'issue', params: [param], txId: txId};
				tokenClient.generateUnsignedTokenCommand(request, mspId, certificate, admin);
			}).should.throw('forced new identity error');
		});
	});

	describe('#generateUnsignedTokenTransaction', () => {
		let request;
		let tokenTx;
		let command;
		let commandHeader;
		let sha2_256Stub;
		let buildChannelHeaderStub;
		let buildCurrentTimestampStub;
		let clientStub;

		const trans_hash = 'fake-sha2_256-tran-hash';
		const tlsCertHash = Buffer.from('test-client-cert-hash');
		const channelHeader = new fabprotos.common.ChannelHeader();
		const mockTimestamp = sinon.createStubInstance(fabprotos.google.protobuf.Timestamp);

		beforeEach(() => {
			sandbox = sinon.createSandbox();

			// prepare command header, command and token transaction for input request
			commandHeader = new fabprotos.token.Header();
			commandHeader.setChannelId(channelId);
			commandHeader.setCreator(Buffer.from('fake-creator'));
			commandHeader.setNonce(Buffer.from('fake-nonce'));
			commandHeader.setTlsCertHash(tlsCertHash);

			command = new fabprotos.token.Command();
			command.setHeader(commandHeader);

			tokenTx = new fabprotos.token.TokenTransaction();
			tokenTx.set('token_action', new fabprotos.token.TokenAction());

			// create stubs
			sha2_256Stub = sinon.stub();
			sha2_256Stub.returns(trans_hash);

			buildChannelHeaderStub = sinon.stub();
			buildChannelHeaderStub.returns(channelHeader);

			buildCurrentTimestampStub = sinon.stub();
			buildCurrentTimestampStub.returns(mockTimestamp);

			revert.push(TokenClient.__set__('clientUtils.buildChannelHeader', buildChannelHeaderStub));
			revert.push(TokenClient.__set__('clientUtils.buildCurrentTimestamp', buildCurrentTimestampStub));
			revert.push(TokenClient.__set__('HashPrimitives.SHA2_256', sha2_256Stub));

			// create an intance of TokenClient
			clientStub = sinon.createStubInstance(Client);
			clientStub.getClientCertHash.returns(tlsCertHash);
			tokenClient = new TokenClient(clientStub, mockChannel);
		});

		it('should return a unsigned transaction payload', () => {
			request = {tokenTransaction: tokenTx, tokenCommand: command};
			const payload = tokenClient.generateUnsignedTokenTransaction(request);

			payload.data.toBuffer().should.deep.equal(tokenTx.toBuffer());

			const signatureHeader = new fabprotos.common.SignatureHeader();
			signatureHeader.setCreator(commandHeader.creator);
			signatureHeader.setNonce(commandHeader.nonce);
			payload.header.signature_header.toBuffer().should.deep.equal(signatureHeader.toBuffer());

			payload.header.channel_header.toBuffer().should.deep.equal(channelHeader.toBuffer());

			sinon.assert.calledWith(buildChannelHeaderStub,
				fabprotos.common.HeaderType.TOKEN_TRANSACTION, channelId, trans_hash, null, '', mockTimestamp, tlsCertHash);
			sinon.assert.calledOnce(buildCurrentTimestampStub);
		});

		it('should get error when request has no tokenTransaction', () => {
			(() => {
				request = {tokenCommand: command};
				tokenClient.generateUnsignedTokenTransaction(request);
			}).should.throw('Missing required "tokenTransaction" in request on the generateUnsignedTokenTransaction call');
		});

		it('should get error when request has no tokenCommand', () => {
			(() => {
				request = {tokenTransaction: tokenTx};
				tokenClient.generateUnsignedTokenTransaction(request);
			}).should.throw('Missing required "tokenCommand" in request on the generateUnsignedTokenTransaction call');
		});

		it('should get error when request has no tokenCommand header', () => {
			(() => {
				command.header = undefined;
				request = {tokenTransaction: tokenTx, tokenCommand: command};
				tokenClient.generateUnsignedTokenTransaction(request);
			}).should.throw('Missing required "header" in tokenCommand on the generateUnsignedTokenTransaction call');
		});

		it('should get error when buildChannelHeader throws error', () => {
			(() => {
				const fakeError = new Error('forced build header error');
				buildChannelHeaderStub.throws(fakeError);

				request = {tokenTransaction: tokenTx, tokenCommand: command};
				tokenClient.generateUnsignedTokenTransaction(request);
			}).should.throw('forced build header error');
		});
	});

	describe('#sendSignedTokenCommand', () => {
		let request;
		let channelStub;

		const commandResponse = new fabprotos.token.CommandResponse();

		beforeEach(() => {
			channelStub = sinon.createStubInstance(Channel);
			channelStub.sendSignedTokenCommand.returns(commandResponse);

			tokenClient = new TokenClient(client, channelStub);
			request = {command_bytes: 'fake-payload-bytes', signature: 'fake-signature-bytes'};
		});

		it('should return command response', async () => {
			sinon.spy(channelStub.sendSignedTokenCommand);
			const response = await tokenClient.sendSignedTokenCommand(request);
			response.should.deep.equal(commandResponse);
			request.targets = undefined;
			sinon.assert.calledWith(channelStub.sendSignedTokenCommand, request);
		});

		it('should get error when channel.sendSignedTokenCommand throws error', async () => {
			try {
				const fakeError = new Error('forced send command error');
				channelStub.sendSignedTokenCommand.throws(fakeError);
				await tokenClient.sendSignedTokenCommand(request);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced send command error');
			}
		});
	});

	describe('#sendSignedTokenTransaction', () => {
		let request;
		let channelStub;

		const bcResponse = {status: 'SUCCESS'};

		beforeEach(() => {
			channelStub = sinon.createStubInstance(Channel);
			channelStub.sendSignedTokenTransaction.returns(bcResponse);

			tokenClient = new TokenClient(client, channelStub);

			request = {payload_bytes: 'fake-payload-bytes', signature: 'fake-signature-bytes', txId: txId};
		});

		it('should return broadcast response with success status', async () => {
			const result = await tokenClient.sendSignedTokenTransaction(request);
			result.status.should.equal('SUCCESS');
			result.should.deep.equal(bcResponse);
		});

		it('should get error when channel.sendSignedTokenTransaction throws error', async () => {
			try {
				const fakeError = new Error('forced send transaction error');
				channelStub.sendSignedTokenTransaction.throws(fakeError);
				await tokenClient.sendSignedTokenTransaction(request);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced send transaction error');
			}
		});
	});
});
