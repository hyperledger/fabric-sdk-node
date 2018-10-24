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


const ProtoLoader = require('../ProtoLoader');
const path = require('path');

const _commonProto = ProtoLoader.load(path.resolve(__dirname, '../protos/common/common.proto')).common;
const _transProto = ProtoLoader.load(path.resolve(__dirname, '../protos/peer/transaction.proto')).protos;
const _proposalProto = ProtoLoader.load(path.resolve(__dirname, '../protos/peer/proposal.proto')).protos;


/*
 * Internal static method to allow transaction envelope to be built without
 * creating a new channel
 */
function buildTransactionProposal(chaincodeProposal, endorsements, proposalResponse) {

	const header = _commonProto.Header.decode(chaincodeProposal.getHeader());

	const chaincodeEndorsedAction = new _transProto.ChaincodeEndorsedAction();
	chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
	chaincodeEndorsedAction.setEndorsements(endorsements);

	const chaincodeActionPayload = new _transProto.ChaincodeActionPayload();
	chaincodeActionPayload.setAction(chaincodeEndorsedAction);

	// the TransientMap field inside the original proposal payload is only meant for the
	// endorsers to use from inside the chaincode. This must be taken out before sending
	// to the orderer, otherwise the transaction will be rejected by the validators when
	// it compares the proposal hash calculated by the endorsers and returned in the
	// proposal response, which was calculated without the TransientMap
	const originalChaincodeProposalPayload = _proposalProto.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
	const chaincodeProposalPayloadNoTrans = new _proposalProto.ChaincodeProposalPayload();
	chaincodeProposalPayloadNoTrans.setInput(originalChaincodeProposalPayload.input); // only set the input field, skipping the TransientMap
	chaincodeActionPayload.setChaincodeProposalPayload(chaincodeProposalPayloadNoTrans.toBuffer());

	const transactionAction = new _transProto.TransactionAction();
	transactionAction.setHeader(header.getSignatureHeader());
	transactionAction.setPayload(chaincodeActionPayload.toBuffer());

	const actions = [];
	actions.push(transactionAction);

	const transaction = new _transProto.Transaction();
	transaction.setActions(actions);


	const payload = new _commonProto.Payload();
	payload.setHeader(header);
	payload.setData(transaction.toBuffer());

	return payload;
}



module.exports = {
	buildTransactionProposal
};
