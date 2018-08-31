/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

This helper is used for Channel util functions, most channel
util function should be removed here so that we can reduce the
file size of Channel.js
*/

const grpc = require('grpc');
const path = require('path');

const _commonProto = grpc.load(path.resolve(__dirname, '../protos/common/common.proto')).common;
const _transProto = grpc.load(path.resolve(__dirname, '../protos/peer/transaction.proto')).protos;
const _proposalProto = grpc.load(path.resolve(__dirname, '../protos/peer/proposal.proto')).protos;


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
