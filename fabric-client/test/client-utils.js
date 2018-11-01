/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const ClientUtils = rewire('../lib/client-utils');

const chai = require('chai');
const sinon = require('sinon');
const should = chai.should();

describe('client-utils', () => {
	let sandbox;
	let revert;
	let FakeLogger;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		FakeLogger = {
			debug : () => {},
			error: () => {}
		};
		sinon.stub(FakeLogger, 'debug');
		sinon.stub(FakeLogger, 'error');
		revert.push(ClientUtils.__set__('logger', FakeLogger));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#buildProposal', () => {
		let ChaincodeInvocationSpecStub;
		let setChaincodeSpecStub;
		let ChaincodeProposalPayloadStub;
		let setInputStub;
		let setTransientMapStub;
		let ProposalStub;
		let setHeaderStub;
		let setPayloadStub;

		beforeEach(() => {
			setChaincodeSpecStub = sandbox.stub();
			ChaincodeInvocationSpecStub = sandbox.stub().returns({
				setChaincodeSpec: setChaincodeSpecStub,
				toBuffer: () => 'chaincode-invocation-spec'
			});
			revert.push(ClientUtils.__set__('_ccProto.ChaincodeInvocationSpec', ChaincodeInvocationSpecStub));
			setInputStub = sandbox.stub();
			setTransientMapStub = sandbox.stub();
			ChaincodeProposalPayloadStub = sandbox.stub().returns({
				setInput: setInputStub,
				setTransientMap: setTransientMapStub,
				toBuffer: () => 'payload'
			});
			revert.push(ClientUtils.__set__('_proposalProto.ChaincodeProposalPayload', ChaincodeProposalPayloadStub));
			setHeaderStub = sandbox.stub();
			setPayloadStub = sandbox.stub();
			ProposalStub = sandbox.stub().returns({
				setHeader: setHeaderStub,
				setPayload: setPayloadStub
			});
			revert.push(ClientUtils.__set__('_proposalProto.Proposal', ProposalStub));

		});

		it('should return a valid proposal when transientMap is an object', () => {
			const invokeSpec = 'invoke-spec';
			const header = {toBuffer: () => 'header'};
			const transientMap = {};
			const proposal = ClientUtils.buildProposal(invokeSpec, header, transientMap);
			sinon.assert.called(ChaincodeInvocationSpecStub);
			sinon.assert.calledWith(setChaincodeSpecStub, invokeSpec);
			sinon.assert.called(ChaincodeProposalPayloadStub);
			sinon.assert.calledWith(setInputStub, 'chaincode-invocation-spec');
			sinon.assert.calledWith(FakeLogger.debug, sinon.match(/adding in transientMap/));
			sinon.assert.calledWith(setHeaderStub, 'header');
			sinon.assert.calledWith(setPayloadStub, 'payload');
			proposal.should.deep.equal(new ProposalStub());
		});

		it('should return a valid proposal when transientMap is not an object', () => {
			const invokeSpec = 'invoke-spec';
			const header = {toBuffer: () => 'header'};
			const transientMap = undefined;
			const proposal = ClientUtils.buildProposal(invokeSpec, header, transientMap);
			sinon.assert.called(ChaincodeInvocationSpecStub);
			sinon.assert.calledWith(setChaincodeSpecStub, invokeSpec);
			sinon.assert.called(ChaincodeProposalPayloadStub);
			sinon.assert.calledWith(setInputStub, 'chaincode-invocation-spec');
			sinon.assert.calledWith(FakeLogger.debug, sinon.match(/not adding a transientMap/));
			sinon.assert.calledWith(setHeaderStub, 'header');
			sinon.assert.calledWith(setPayloadStub, 'payload');
			proposal.should.deep.equal(new ProposalStub());
		});
	});

	describe('#sendPeersProposal', () => {
		let settleStub;
		let sendProposalStub;
		let mockPeer;
		let mockResult;

		beforeEach(() => {
			settleStub = sandbox.stub();
			revert.push(ClientUtils.__set__('settle', settleStub));

			sendProposalStub = sandbox.stub();
			mockPeer = {sendProposal: sendProposalStub};
			mockResult = {isFulfilled: sandbox.stub(), value: sandbox.stub(), reason: sandbox.stub()};
		});

		it ('should return valid responses for one peer where proposals are fulfilled', async () => {
			sendProposalStub.returns(Promise.resolve('proposal'));
			mockResult.isFulfilled.returns(true);
			mockResult.value.returns('value');
			settleStub.returns([mockResult]);

			const responses = await ClientUtils.sendPeersProposal(mockPeer, 'proposal', 0);
			sinon.assert.calledWith(sendProposalStub, 'proposal', 0);
			sinon.assert.calledWith(settleStub, [sendProposalStub()]);
			sinon.assert.called(mockResult.isFulfilled);
			sinon.assert.calledTwice(mockResult.value);
			responses.should.deep.equal(['value']);
		});


		it ('should return valid responses for one peer where proposals are not fulfilled', async () => {
			sendProposalStub.returns(Promise.resolve('proposal'));
			mockResult.isFulfilled.returns(false);
			mockResult.reason.returns('reason');
			settleStub.returns([mockResult]);

			const responses = await ClientUtils.sendPeersProposal(mockPeer, 'proposal', 0);
			sinon.assert.calledWith(sendProposalStub, 'proposal', 0);
			sinon.assert.calledWith(settleStub, [sendProposalStub()]);
			sinon.assert.called(mockResult.isFulfilled);
			sinon.assert.calledTwice(mockResult.reason);
			responses.should.deep.equal(['reason']);
		});


		it('should return valid responses for two peers where one proposal is fulfilled and one is not', async () => {
			sendProposalStub.returns(Promise.resolve('proposal'));
			mockResult.isFulfilled.onCall(0).returns(false);
			mockResult.isFulfilled.onCall(1).returns(true);
			mockResult.reason.returns('reason');
			mockResult.value.returns('value');
			settleStub.returns([mockResult, mockResult]);

			const responses = await ClientUtils.sendPeersProposal([mockPeer, mockPeer], 'proposal', 0);
			sinon.assert.calledWith(sendProposalStub, 'proposal', 0);
			sinon.assert.called(settleStub);
			sinon.assert.calledTwice(mockResult.isFulfilled);
			sinon.assert.calledTwice(mockResult.reason);
			sinon.assert.calledTwice(mockResult.value);
			responses.should.deep.equal(['reason', 'value']);
		});
	});

	describe('#signProposal', () => {
		let toBufferStub;
		let signStub;

		beforeEach(() => {
			toBufferStub = sandbox.stub();
			signStub = sandbox.stub();

			revert.push(ClientUtils.__set__('Buffer.from', (value) => value));
		});

		it('should return a valid signed proposal', () => {
			toBufferStub.returns('proposal');
			signStub.returns('sign');
			const signingIdentity = {sign: signStub};
			const proposal = {toBuffer: toBufferStub};
			const signedProposal = ClientUtils.signProposal(signingIdentity, proposal);
			signedProposal.should.deep.equal({signature: 'sign', proposal_bytes: 'proposal'});
		});
	});

	describe('#toEnvelope', () => {
		it('should return a valid envelope', () => {
			const data = {signature: 'signature', proposal_bytes: 'proposal'};
			const envelope = ClientUtils.toEnvelope(data);
			envelope.should.deep.equal({signature: 'signature', payload: 'proposal'});
		});
	});

	describe('#buildChannelHeader', () => {
		let channelHeaderStub;
		let channelHeaderFunctionStub;
		let chaincodeIDStub;
		let chaincodeIDFunctionsStub;
		let headerExtStub;
		let headerExtFunctionStub;

		beforeEach(() => {
			channelHeaderStub = sandbox.stub();
			channelHeaderFunctionStub = {
				setType: sandbox.stub(),
				setVersion: sandbox.stub(),
				setChannelId: sandbox.stub(),
				setTxId: sandbox.stub(),
				setEpoch: sandbox.stub(),
				setExtension: sandbox.stub(),
				setTimestamp: sandbox.stub(),
				setTlsCertHash: sandbox.stub()
			};
			channelHeaderStub.returns(channelHeaderFunctionStub);
			revert.push(ClientUtils.__set__('_commonProto.ChannelHeader', channelHeaderStub));
			sandbox.stub(ClientUtils, 'buildCurrentTimestamp').returns(null);
			chaincodeIDFunctionsStub = {setName: sandbox.stub()};
			chaincodeIDStub = sandbox.stub().returns(chaincodeIDFunctionsStub);
			revert.push(ClientUtils.__set__('_ccProto.ChaincodeID', chaincodeIDStub));

			headerExtFunctionStub = {
				setChaincodeId: sandbox.stub(),
				toBuffer: sandbox.stub()
			};
			headerExtStub = sandbox.stub().returns(headerExtFunctionStub);
			revert.push(ClientUtils.__set__('_proposalProto.ChaincodeHeaderExtension', headerExtStub));
		});

		it('should return a channel header without any extra info', () => {
			const channelHeader = ClientUtils.buildChannelHeader('type', 'channel-id', 0);
			sinon.assert.called(channelHeaderStub);
			sinon.assert.calledWith(channelHeaderFunctionStub.setType, 'type');
			sinon.assert.calledWith(channelHeaderFunctionStub.setChannelId, 'channel-id');
			sinon.assert.calledWith(channelHeaderFunctionStub.setTxId, '0');

			channelHeader.should.deep.equal(channelHeaderFunctionStub);
		});

		it('should return a channel header with all extra info', () => {
			const channelHeader = ClientUtils.buildChannelHeader('type', 'channel-id', 0, '0', 'chaincode-id', 'timestamp', 'client-cert-hash');
			sinon.assert.called(channelHeaderStub);
			sinon.assert.calledWith(channelHeaderFunctionStub.setType, 'type');
			sinon.assert.calledWith(channelHeaderFunctionStub.setChannelId, 'channel-id');
			sinon.assert.calledWith(channelHeaderFunctionStub.setTxId, '0');
			sinon.assert.calledWith(channelHeaderFunctionStub.setEpoch, '0');
			sinon.assert.calledWith(chaincodeIDFunctionsStub.setName, 'chaincode-id');
			sinon.assert.calledWith(headerExtFunctionStub.setChaincodeId, chaincodeIDFunctionsStub);
			sinon.assert.called(channelHeaderFunctionStub.setExtension);
			sinon.assert.called(channelHeaderFunctionStub.setTlsCertHash);

			channelHeader.should.deep.equal(channelHeaderFunctionStub);
		});
	});

	describe('#buildHeader', () => {
		let signatureHeaderFunctionStub;
		let signatureHeaderStub;
		let headerFunctionStub;
		let headerStub;
		let mockCreator;
		let mockChannelHeader;

		beforeEach(() => {
			signatureHeaderFunctionStub = {setCreator: sandbox.stub(), setNonce: sandbox.stub(), toBuffer: sandbox.stub()};
			signatureHeaderStub = sandbox.stub().returns(signatureHeaderFunctionStub);
			revert.push(ClientUtils.__set__('_commonProto.SignatureHeader', signatureHeaderStub));

			headerFunctionStub = {setSignatureHeader: () => {}, setChannelHeader: () => {}};
			sandbox.stub(headerFunctionStub);
			headerStub = sandbox.stub().returns(headerFunctionStub);
			revert.push(ClientUtils.__set__('_commonProto.Header', headerStub));


			mockCreator = {serialize: () => {}};
			sandbox.stub(mockCreator);
			mockChannelHeader = {toBuffer: () => {}};
			sandbox.stub(mockChannelHeader);
		});

		it('should return a valid header', () => {
			mockCreator.serialize.returns('serialize');
			const header = ClientUtils.buildHeader(mockCreator, mockChannelHeader, 'nonce');
			sinon.assert.calledWith(signatureHeaderFunctionStub.setCreator, 'serialize');
			sinon.assert.calledWith(signatureHeaderFunctionStub.setNonce, 'nonce');
			sinon.assert.called(headerFunctionStub.setSignatureHeader);
			sinon.assert.called(headerFunctionStub.setChannelHeader);
			sinon.assert.called(signatureHeaderFunctionStub.toBuffer);
			header.should.deep.equal(headerStub());
		});
	});

	describe('#checkProposalRequest', () => {
		it('should return the correct error message if no data given', () => {
			const result = ClientUtils.checkProposalRequest();
			should.equal(result, 'Missing input request object on the proposal request');
		});

		it('should return the correct error message if no request.chaincodeId given', () => {
			const result = ClientUtils.checkProposalRequest({chaincodeId: 0});
			should.equal(result, 'Missing "chaincodeId" parameter in the proposal request');
		});

		it('should return the correct error message if no request.rxId is given', () => {
			const result = ClientUtils.checkProposalRequest({chaincodeId: '0'}, {});
			should.equal(result, 'Missing "txId" parameter in the proposal request');
		});

		it('should return null if no request.rxId or all are given', () => {
			const result = ClientUtils.checkProposalRequest({chaincodeId: '0'});
			should.equal(result, null);
		});
	});

	describe('#checkInstallRequest', () => {
		it('should return the correct error message if no data is given', () => {
			const result = ClientUtils.checkInstallRequest();
			should.equal(result, 'Missing input request object on the proposal request');
		});

		it('should return the correct error message if request.chaincodeVersion is not given', () => {
			const result = ClientUtils.checkInstallRequest({});
			should.equal(result, 'Missing "chaincodeVersion" parameter in the proposal request');
		});

		it('should return the correct error message if request.chaincodeVersion is given', () => {
			const result = ClientUtils.checkInstallRequest({chaincodeVersion: '1'});
			should.equal(result, null);
		});
	});

	describe('#translateCCType', () => {
		const ccTypes = {GOLANG: 'GOLANG', CAR: 'CAR', JAVA: 'JAVA', NODE: 'NODE'};
		beforeEach(() => {
			revert.push(ClientUtils.__set__('_ccProto.ChaincodeSpec.Type', ccTypes));
		});

		it('should return the correct default type', () => {
			const type = ClientUtils.translateCCType();
			type.should.equal('GOLANG');
		});

		it('should return the correct cc type', () => {
			const type = ClientUtils.translateCCType('Car');
			type.should.equal('CAR');
		});
	});

	describe('#ccTypeToString', () => {
		it('should return the correct string', () => {
			ClientUtils.ccTypeToString(ClientUtils.__get__('_ccProto.ChaincodeSpec.Type.GOLANG')).should.equal('golang');
			ClientUtils.ccTypeToString(ClientUtils.__get__('_ccProto.ChaincodeSpec.Type.CAR')).should.equal('car');
			ClientUtils.ccTypeToString(ClientUtils.__get__('_ccProto.ChaincodeSpec.Type.JAVA')).should.equal('java');
			ClientUtils.ccTypeToString(ClientUtils.__get__('_ccProto.ChaincodeSpec.Type.NODE')).should.equal('node');
		});
	});

	describe('#buildCurrentTimestamp', () => {
		let setSecondsStub;
		let setNanosStub;
		let dateStub;
		let timestampStub;
		let getTimeStub;

		beforeEach(() => {
			setSecondsStub = sandbox.stub();
			setNanosStub = sandbox.stub();
			getTimeStub = sandbox.stub();
			dateStub = sandbox.stub().returns({getTime: getTimeStub});
			timestampStub = sandbox.stub().returns({setSeconds: setSecondsStub, setNanos: setNanosStub});
			revert.push(ClientUtils.__set__('_timestampProto.Timestamp', timestampStub));
			revert.push(ClientUtils.__set__('Date', dateStub));
		});

		it('should create a valid timestamp', () => {
			getTimeStub.returns(10000);
			const timestamp = ClientUtils.buildCurrentTimestamp();
			sinon.assert.calledWith(setSecondsStub, 10);
			sinon.assert.calledWith(setNanosStub, 0);
			timestamp.should.deep.equal(timestampStub());
		});
	});
});
