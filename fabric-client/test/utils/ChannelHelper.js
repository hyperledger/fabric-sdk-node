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
const ChannelHelper = rewire('../../lib/utils/ChannelHelper');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('ChannelHelper', () => {
	let revert;
	let sandbox;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#buildTransactionProposal', () => {
		let getHeaderStub;
		let buildTransactionProposal;
		let ChaincodeEndorserActionStub;
		let setProposalPayloadStub;
		let setEndorsementsStub;
		let ChaincodeActionPayloadStub;
		let setActionStub;
		let ChaincodeProposalPayloadDecodeStub;
		let ChaincodeProposalPayloadStub;
		let setInputStub;
		let setChaincodeProposalPayloadStub;
		let TransactionActionStub;
		let setHeaderStub;
		let headerDecodeStub;
		let setPayloadStub;
		let getSignatureHeaderStub;
		let toBufferStub;
		let TransactionStub;
		let PayloadStub;
		let setDataStub;

		before(() => {
			buildTransactionProposal = ChannelHelper.__get__('buildTransactionProposal');
		});

		beforeEach(() => {
			getHeaderStub = sandbox.stub();
			getSignatureHeaderStub = sandbox.stub();
			headerDecodeStub = sandbox.stub().returns({getSignatureHeader: getSignatureHeaderStub});
			revert.push(ChannelHelper.__set__('_commonProto.Header.decode', headerDecodeStub));
			setProposalPayloadStub = sandbox.stub();
			setEndorsementsStub = sandbox.stub();
			ChaincodeEndorserActionStub = sandbox.stub()
				.returns({setEndorsements: setEndorsementsStub, setProposalResponsePayload: setProposalPayloadStub});
			revert.push(ChannelHelper.__set__(' _transProto.ChaincodeEndorsedAction', ChaincodeEndorserActionStub));
			setActionStub = sandbox.stub();
			setChaincodeProposalPayloadStub = sandbox.stub();
			toBufferStub = sandbox.stub();
			ChaincodeActionPayloadStub = sandbox.stub()
				.returns({setAction: setActionStub, setChaincodeProposalPayload: setChaincodeProposalPayloadStub, toBuffer: toBufferStub});
			revert.push(ChannelHelper.__set__('_transProto.ChaincodeActionPayload', ChaincodeActionPayloadStub));
			setInputStub = sandbox.stub();
			ChaincodeProposalPayloadStub = sandbox.stub().returns({setInput: setInputStub});
			revert.push(ChannelHelper.__set__('_proposalProto.ChaincodeProposalPayload', ChaincodeProposalPayloadStub));
			ChaincodeProposalPayloadDecodeStub = sandbox.stub();
			revert.push(ChannelHelper.__set__('_proposalProto.ChaincodeProposalPayload.decode', ChaincodeProposalPayloadDecodeStub));
			setHeaderStub = sandbox.stub();
			setPayloadStub = sandbox.stub();
			TransactionActionStub = sandbox.stub().returns({setHeader: setHeaderStub, setPayload: setPayloadStub});
			revert.push(ChannelHelper.__set__('_transProto.TransactionAction', TransactionActionStub));
			TransactionStub = sandbox.stub().returns({toBuffer: toBufferStub, setActions: setActionStub});
			revert.push(ChannelHelper.__set__('_transProto.Transaction', TransactionStub));
			setDataStub = sandbox.stub();
			PayloadStub = sandbox.stub().returns({setHeader: setHeaderStub, setData: setDataStub});
			revert.push(ChannelHelper.__set__('_commonProto.Payload', PayloadStub));
		});

		it('should return the payload', () => {
			const chaincodeProposal = {
				getHeader: getHeaderStub.returns('header'),
				payload: 'chaincode-payload'
			};
			ChaincodeProposalPayloadStub.returns({toBuffer: toBufferStub, setInput: setInputStub});
			const endorsements = [];
			const proposalReponse = {
				payload: 'payload'
			};
			toBufferStub.onCall(0).returns('proposal-payload');
			toBufferStub.onCall(1).returns('chaincode-action-payload');
			toBufferStub.onCall(2).returns('transaction');
			ChaincodeProposalPayloadDecodeStub.returns({input: 'input'});
			getSignatureHeaderStub.returns('signature-header');
			const payload = buildTransactionProposal(chaincodeProposal, endorsements, proposalReponse);
			sinon.assert.calledWith(headerDecodeStub, 'header');
			sinon.assert.calledWith(setProposalPayloadStub, 'payload');
			sinon.assert.calledWith(setEndorsementsStub, endorsements);
			sinon.assert.called(ChaincodeActionPayloadStub);
			sinon.assert.calledWith(setActionStub, new ChaincodeEndorserActionStub());
			sinon.assert.calledWith(ChaincodeProposalPayloadDecodeStub, 'chaincode-payload');
			sinon.assert.called(ChaincodeActionPayloadStub);
			sinon.assert.calledWith(setInputStub, 'input');
			sinon.assert.calledThrice(toBufferStub);
			sinon.assert.calledWith(setChaincodeProposalPayloadStub, 'proposal-payload');
			sinon.assert.calledWith(TransactionActionStub);
			sinon.assert.called(getSignatureHeaderStub);
			sinon.assert.calledWith(setHeaderStub, 'signature-header');
			sinon.assert.calledWith(setPayloadStub, 'chaincode-action-payload');
			sinon.assert.called(TransactionStub);
			sinon.assert.calledWithMatch(setActionStub, Array);
			sinon.assert.called(PayloadStub);
			sinon.assert.calledWith(setHeaderStub, new headerDecodeStub());
			sinon.assert.calledWith(setDataStub, 'transaction');
			payload.should.deep.equal(new PayloadStub());
		});
	});
});
