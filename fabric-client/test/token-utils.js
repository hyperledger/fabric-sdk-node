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
const TokenUtils = rewire('../lib/token-utils');
const TransactionID = require('../lib/TransactionID.js');

const chai = require('chai');
const sinon = require('sinon');
const should = chai.should();
const fabprotos = require('fabric-protos');

describe('token-utils', () => {
	let sandbox;
	let expectedCommand;
	let request;
	let param1;
	let param2;
	let tokenIds;
	let txId;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		txId = sinon.createStubInstance(TransactionID);
		tokenIds = [{tx_id: 'mock_tx_id', index: 0}];
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('#checkTokenRequest', () => {
		let param;

		beforeEach(() => {
			// prepare token request
			const owner = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('test-owner')};
			param = {recipient: owner, type: 'abc123', quantity: 210};
			request = {params: [param], txId: txId, tokenIds: tokenIds};
		});

		describe('#checkTokenRequest common', () => {
			it('should get error when no request is passed', () => {
				(() => {
					TokenUtils.checkTokenRequest(undefined, 'issue');
				}).should.throw('Missing required "request" parameter on issue call');
			});

			it('should get error when no txId is passed', () => {
				(() => {
					request.txId = undefined;
					TokenUtils.checkTokenRequest(request, 'issue', true);
				}).should.throw('Missing required "txId" in request on issue call');
			});

		});

		describe('#checkTokenRequest for issue', () => {
			it('should return without any error', () => {
				TokenUtils.checkTokenRequest(request, 'issue', true);
			});

			it('should get error when no params in request', () => {
				(() => {
					request.params = undefined;
					TokenUtils.checkTokenRequest(request, 'issue');
				}).should.throw('Missing required "params" in request on issue call');
			});

			it('should get error when parameter has no recipient', () => {
				(() => {
					param.recipient = undefined;
					TokenUtils.checkTokenRequest(request, 'issue');
				}).should.throw('Missing required "recipient" in request on issue call');
			});

			it('should get error when parameter has no type', () => {
				(() => {
					param.type = undefined;
					TokenUtils.checkTokenRequest(request, 'issue');
				}).should.throw('Missing required "type" in request on issue call');
			});

			it('should get error when parameter has no quantity', () => {
				(() => {
					param.quantity = undefined;
					TokenUtils.checkTokenRequest(request, 'issue');
				}).should.throw('Missing required "quantity" in request on issue call');
			});

			it('should get error when command name is wrong', () => {
				(() => {
					request.commandName = 'badname';
					TokenUtils.checkTokenRequest(request, 'issue');
				}).should.throw('Invalid "commandName" in request on issue call: badname');
			});
		});

		describe('#checkTokenRequest for transfer', () => {
			it('should return without any error', () => {
				TokenUtils.checkTokenRequest(request, 'transfer', true);
			});

			it('should get error when no tokenIds in request', () => {
				(() => {
					request.tokenIds = undefined;
					TokenUtils.checkTokenRequest(request, 'transfer');
				}).should.throw('Missing required "tokenId" in request on transfer call');
			});

			it('should get error when no params in request', () => {
				(() => {
					request.params = undefined;
					TokenUtils.checkTokenRequest(request, 'transfer');
				}).should.throw('Missing required "params" in request on transfer call');
			});

			it('should get error when parameter has no recipient', () => {
				(() => {
					param.recipient = undefined;
					TokenUtils.checkTokenRequest(request, 'transfer');
				}).should.throw('Missing required "recipient" in request on transfer call');
			});

			it('should get error when parameter has no quantity', () => {
				(() => {
					param.quantity = undefined;
					TokenUtils.checkTokenRequest(request, 'transfer');
				}).should.throw('Missing required "quantity" in request on transfer call');
			});

			it('should get error when command name is wrong', () => {
				(() => {
					request.commandName = 'badname';
					TokenUtils.checkTokenRequest(request, 'transfer');
				}).should.throw('Invalid "commandName" in request on transfer call: badname');
			});
		});

		describe('#checkTokenRequest for redeem', () => {
			it('should return without any error', () => {
				TokenUtils.checkTokenRequest(request, 'redeem', true);
			});

			it('should get error when no tokenIds in request', () => {
				(() => {
					request.tokenIds = undefined;
					TokenUtils.checkTokenRequest(request, 'redeem');
				}).should.throw('Missing required "tokenId" in request on redeem call');
			});

			it('should get error when no params in request', () => {
				(() => {
					request.params = undefined;
					TokenUtils.checkTokenRequest(request, 'redeem');
				}).should.throw('Missing required "params" in request on redeem call');
			});

			it('should get error when parameter has no quantity', () => {
				(() => {
					param.quantity = undefined;
					TokenUtils.checkTokenRequest(request, 'redeem');
				}).should.throw('Missing required "quantity" in request on redeem call');
			});

			it('should get error when command name is wrong', () => {
				(() => {
					request.commandName = 'badname';
					TokenUtils.checkTokenRequest(request, 'redeem');
				}).should.throw('Invalid "commandName" in request on redeem call: badname');
			});
		});

		describe('#checkTokenRequest for generateUnsignedTokenCommand', () => {
			it('should return without any error for issue request', () => {
				request = {commandName: 'issue', params: [param]};
				TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
			});

			it('should return without any error for transfer request', () => {
				request = {commandName: 'transfer', tokenIds: tokenIds, params: [param]};
				TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
			});

			it('should return without any error for redeem request', () => {
				request = {commandName: 'redeem', tokenIds: tokenIds, params: [param]};
				TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
			});

			it('should return without any error for list request', () => {
				request = {commandName: 'list'};
				TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
			});

			it('should get error when wrong commandName in request', () => {
				(() => {
					request = {commandName: 'badName', params: [param]};
					TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
				}).should.throw('Invalid "commandName" in request on generateUnsignedTokenCommand call: badName');
			});

			it('should get error when no commandName in request', () => {
				(() => {
					request = {params: [param]};
					TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
				}).should.throw('Missing "commandName" in request on generateUnsignedTokenCommand call');
			});

			it('should get error when no params in request', () => {
				(() => {
					request = {commandName: 'issue'};
					TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand', false);
				}).should.throw('Missing required "params" in request on generateUnsignedTokenCommand call');
			});

			it('should get error when parameter has no quantity', () => {
				(() => {
					request = {commandName: 'issue', params: [param]};
					param.quantity = undefined;
					TokenUtils.checkTokenRequest(request, 'generateUnsignedTokenCommand');
				}).should.throw('Missing required "quantity" in request on generateUnsignedTokenCommand call');
			});
		});
	});

	describe('#buildIssueCommand', () => {
		beforeEach(() => {
			// prepare token request for issue
			const owner1 = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('owner1')};
			const owner2 = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('owner2')};
			param1 = {recipient: owner1, type: 'abc123', quantity: 210};
			param2 = {recipient: owner2, type: 'horizon', quantity: 300};
			request = {
				params: [param1, param2],
				txId: txId,
			};

			// create expected command based on request
			const importRequest = new fabprotos.token.ImportRequest();
			importRequest.setTokensToIssue([param1, param2]);
			expectedCommand = new fabprotos.token.Command();
			expectedCommand.set('import_request', importRequest);
		});

		it('should return a valid token command', () => {
			const command = TokenUtils.buildIssueCommand(request);
			command.should.deep.equal(expectedCommand);
		});
	});

	describe('#buildTransferCommand', () => {
		beforeEach(() => {
			// prepare token request for transfer
			const tokenId = {tx_id: 'mock_tx_id', index: 0};
			const owner1 = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('owner1')};
			const owner2 = {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: Buffer.from('owner2')};
			param1 = {recipient: owner1, quantity: 100};
			param2 = {recipient: owner2, quantity: 200};

			request = {
				tokenIds: [tokenId],
				params: [param1, param2],
				txId: txId,
			};

			// create expected command based on request
			const transferRequest = new fabprotos.token.TransferRequest();
			transferRequest.setTokenIds([tokenId]);
			transferRequest.setShares([param1, param2]);
			expectedCommand = new fabprotos.token.Command();
			expectedCommand.set('transfer_request', transferRequest);
		});

		it('should return a valid token command', () => {
			const command = TokenUtils.buildTransferCommand(request);
			command.should.deep.equal(expectedCommand);
		});
	});

	describe('#buildRedeemCommand', () => {
		beforeEach(() => {
			// prepare token request for redeem
			const tokenId = {tx_id: 'mock_tx_id', index: 0};
			param1 = {quantity: 100};
			request = {
				tokenIds: [tokenId],
				params: param1,
				txId: txId,
			};

			// create expected command based on request
			const redeemRequest = new fabprotos.token.RedeemRequest();
			redeemRequest.setTokenIds([tokenId]);
			redeemRequest.setQuantityToRedeem(param1.quantity);
			expectedCommand = new fabprotos.token.Command();
			expectedCommand.set('redeem_request', redeemRequest);
		});

		it('should return a valid token command', () => {
			const command = TokenUtils.buildRedeemCommand(request);
			command.should.deep.equal(expectedCommand);
		});
	});

	describe('#buildListCommand', () => {
		beforeEach(() => {
			// prepare token request for list
			request = {txId: txId};

			// create expected command based on request
			const listRequest = new fabprotos.token.ListRequest();
			expectedCommand = new fabprotos.token.Command();
			expectedCommand.set('list_request', listRequest);
		});

		it('should return a valid token command', () => {
			const command = TokenUtils.buildListCommand(request);
			command.should.deep.equal(expectedCommand);
		});
	});

	describe('#sendTokenCommand', () => {
		let sendTokenCommandStub;
		let getUrlStub;
		let mockPeer;
		let mockSignedCmdResponse;

		beforeEach(() => {
			sendTokenCommandStub = sandbox.stub();
			getUrlStub = sandbox.stub();
			mockPeer = {sendTokenCommand: sendTokenCommandStub, getUrl: getUrlStub};
			mockSignedCmdResponse = new fabprotos.token.SignedCommandResponse();
		});

		it ('should return valid responses for one peer when the peer returns a good response', async () => {
			const FakeLogger = {
				info : () => {},
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');
			TokenUtils.__set__('logger', FakeLogger);

			const commandResponse = new fabprotos.token.CommandResponse();
			mockSignedCmdResponse.response = commandResponse.encode();
			sendTokenCommandStub.returns(mockSignedCmdResponse);

			const response = await TokenUtils.sendTokenCommandToPeer(mockPeer, 'token_request', 0);
			sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
			sinon.assert.calledOnce(sendTokenCommandStub);
			response.should.deep.equal(commandResponse);
			sinon.assert.calledWith(debugStub, 'received command response: %s');
		});

		it ('should return error for one peer when the peer returns a response with error', async () => {
			const FakeLogger = {
				info : () => {},
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');
			TokenUtils.__set__('logger', FakeLogger);

			const commandResponse = new fabprotos.token.CommandResponse();
			commandResponse.set('err', {message: 'wild-banana'});
			mockSignedCmdResponse.response = commandResponse.encode();

			sendTokenCommandStub.returns(mockSignedCmdResponse);

			try {
				await TokenUtils.sendTokenCommandToPeer(mockPeer, 'token_request', 0);
				should.fail();
			} catch (err) {
				err.message.should.equal('command response has error: wild-banana');
				sinon.assert.calledWith(errorStub, 'command response has error: %s');
			}
		});

		it ('should return error for one peer when the peer throws error', async () => {
			const FakeLogger = {
				info : () => {},
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');
			TokenUtils.__set__('logger', FakeLogger);

			const fakeError = new Error('forced error');
			sendTokenCommandStub.throws(fakeError);

			try {
				const response = await TokenUtils.sendTokenCommandToPeer(mockPeer, 'token_request', 0);
				response.should.equal(null);
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
				sinon.assert.calledOnce(sendTokenCommandStub);
				sinon.assert.calledWith(errorStub, 'caught error when sending token command to peer (%s): %s');
				err.should.equal(fakeError);
			}
		});

		it ('should return valid response for two peers when first peer returns a good response', async () => {
			const commandResponse = new fabprotos.token.CommandResponse();
			mockSignedCmdResponse.response = commandResponse.encode();
			sendTokenCommandStub.returns(mockSignedCmdResponse);

			const response = await TokenUtils.sendTokenCommandToPeer([mockPeer, mockPeer], 'token_request', 0);
			sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
			sinon.assert.calledOnce(sendTokenCommandStub);
			response.should.deep.equal(commandResponse);
		});

		it ('should return error for two peers when first peer returns response with error', async () => {
			const commandResponse = new fabprotos.token.CommandResponse();
			commandResponse.set('err', {message: 'wild-banana'});
			mockSignedCmdResponse.response = commandResponse.encode();

			sendTokenCommandStub.returns(mockSignedCmdResponse);

			try {
				await TokenUtils.sendTokenCommandToPeer(mockPeer, 'token_request', 0);
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
				sinon.assert.calledOnce(sendTokenCommandStub);
				err.message.should.equal('command response has error: wild-banana');
			}
		});

		it ('should return valid response for two peers when first peer throws error but second peer returns a resposne', async () => {
			// mockPeer2 for the second peer
			const sendTokenCommandStub2 = sandbox.stub();
			const mockPeer2 = {sendTokenCommand: sendTokenCommandStub2, getUrl: getUrlStub};

			// mockPeer returns error
			const fakeError = new Error('forced error');
			sendTokenCommandStub.throws(fakeError);

			// mockPeer2 returns a valid response
			const commandResponse = new fabprotos.token.CommandResponse();
			mockSignedCmdResponse.response = commandResponse.encode();
			sendTokenCommandStub2.returns(mockSignedCmdResponse);

			const response = await TokenUtils.sendTokenCommandToPeer([mockPeer, mockPeer2], 'token_request', 0);
			sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
			sinon.assert.calledWith(sendTokenCommandStub2, 'token_request', 0);
			sinon.assert.calledOnce(sendTokenCommandStub);
			sinon.assert.calledOnce(sendTokenCommandStub2);
			response.should.deep.equal(commandResponse);
		});

		it ('should return error for two peers when both peer throw error', async () => {
			const FakeLogger = {
				info : () => {},
				debug : () => {},
				error: () => {}
			};

			const errorStub = sandbox.stub(FakeLogger, 'error');
			TokenUtils.__set__('logger', FakeLogger);

			const fakeError = new Error('forced error');
			sendTokenCommandStub.throws(fakeError);

			try {
				const response = await TokenUtils.sendTokenCommandToPeer([mockPeer, mockPeer], 'token_request', 0);
				response.should.equal(null);
				should.fail();
			} catch (err) {
				sinon.assert.calledWith(sendTokenCommandStub, 'token_request', 0);
				sinon.assert.calledTwice(sendTokenCommandStub);
				sinon.assert.calledWith(errorStub, 'caught error when sending token command to peer (%s): %s');
				err.should.equal(fakeError);
			}
		});
	});

	describe('#signCommand', () => {
		let mockSigningIdentity;
		let signStub;
		let command;

		beforeEach(() => {
			signStub = sandbox.stub();
			signStub.returns(Buffer.from('command-signature'));
			mockSigningIdentity = {sign: signStub};

			command = new fabprotos.token.Command();
			command.set('import_request', new fabprotos.token.ImportRequest());

		});

		it('should return signed command', () => {
			const expectedSignedCommand = new fabprotos.token.SignedCommand();
			expectedSignedCommand.setCommand(command.toBuffer());
			expectedSignedCommand.setSignature(Buffer.from('command-signature'));

			const result = TokenUtils.signCommand(mockSigningIdentity, command);
			result.should.deep.equal(expectedSignedCommand);
		});

		it('should get error when sign throws error', () => {
			(() => {
				const fakeError = new Error('forced sign command error');
				signStub.throws(fakeError);
				TokenUtils.signCommand(mockSigningIdentity, command);
			}).should.throw('forced sign command error');
		});
	});

	describe('#buildTokenCommandHeader', () => {
		let mockCreator;
		let serializeStub;

		const channelId = 'mychannel';
		const nonce = Buffer.from('test-nonce');
		const tlsCertHash = Buffer.from('test-client-cert-hash');

		beforeEach(() => {
			serializeStub = sandbox.stub();
			serializeStub.returns(Buffer.from('serialized-creator'));
			mockCreator = {serialize: serializeStub};
		});

		it('should return a token command header', () => {
			const expectedHeader = new fabprotos.token.Header();
			expectedHeader.setChannelId(channelId);
			expectedHeader.setCreator(Buffer.from('serialized-creator'));
			expectedHeader.setNonce(nonce);
			expectedHeader.setTlsCertHash(tlsCertHash);

			const header = TokenUtils.buildTokenCommandHeader(mockCreator, channelId, nonce, tlsCertHash);

			// verify header has timestamp
			header.hasOwnProperty('timestamp').should.equal(true);
			expectedHeader.timestamp = header.timestamp;

			// compare toBuffer since they are protobuf messages
			header.toBuffer().should.deep.equal(expectedHeader.toBuffer());
		});

		it('should get error when creator serialize throws error', () => {
			(() => {
				const fakeError = new Error('forced build header error');
				serializeStub.throws(fakeError);
				TokenUtils.buildTokenCommandHeader(mockCreator, channelId, nonce, tlsCertHash);
			}).should.throw('forced build header error');
		});
	});

	describe('#toSignedCommand', () => {
		it('should return a signed command', () => {
			const result = TokenUtils.toSignedCommand('fake-signature', 'fake-command-bytes');
			result.should.deep.equal({signature: 'fake-signature', command: 'fake-command-bytes'});
		});
	});

	describe('#toEnvelope', () => {
		it('should return an envelope', () => {
			const result = TokenUtils.toEnvelope('fake-signature', 'fake-payload-bytes');
			result.should.deep.equal({signature: 'fake-signature', payload: 'fake-payload-bytes'});
		});
	});
});
