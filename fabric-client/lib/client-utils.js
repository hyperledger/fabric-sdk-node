/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const settle = require('promise-settle');
const util = require('util');
const {Utils: utils} = require('fabric-common');
const logger = utils.getLogger('client-utils.js');

const fabprotos = require('fabric-protos');

/*
 * This function will build the proposal
 */
module.exports.buildProposal = (invokeSpec, header, transientMap) => {
	// construct the ChaincodeInvocationSpec
	const cciSpec = new fabprotos.protos.ChaincodeInvocationSpec();
	cciSpec.setChaincodeSpec(invokeSpec);

	const cc_payload = new fabprotos.protos.ChaincodeProposalPayload();
	cc_payload.setInput(cciSpec.toBuffer());

	if (typeof transientMap === 'object') {
		logger.debug('buildProposal - adding in transientMap %s', util.inspect(transientMap));
		cc_payload.setTransientMap(transientMap);
	} else {
		logger.debug('buildProposal - not adding a transientMap');
	}

	// proposal -- will switch to building the proposal once the signProposal is used
	const proposal = new fabprotos.protos.Proposal();
	proposal.setHeader(header.toBuffer());
	proposal.setPayload(cc_payload.toBuffer()); // chaincode proposal payload

	return proposal;
};

/*
 * This function will return one Promise when sending a proposal to many peers
 */
module.exports.sendPeersProposal = async (peers, proposal, timeout) => {
	let targets = peers;
	if (!Array.isArray(peers)) {
		targets = [peers];
	}
	// create array of promises mapping peers array to peer parameter
	// settle all the promises and return array of responses
	const promises = targets.map(async (peer) => {
		return peer.sendProposal(proposal, timeout);
	});
	const responses = [];
	const results = await settle(promises);
	results.forEach((result) => {
		if (result.isFulfilled()) {
			logger.debug(`sendPeersProposal - Promise is fulfilled: ${result.value()}`);
			responses.push(result.value());
		} else {
			logger.debug(`sendPeersProposal - Promise is rejected: ${result.reason()}`);
			responses.push(result.reason());
		}
	});
	return responses;
};

/*
 * This function will sign the proposal
 */
module.exports.signProposal = (signingIdentity, proposal) => {
	const proposal_bytes = proposal.toBuffer();
	// sign the proposal
	const signature = Buffer.from(signingIdentity.sign(proposal_bytes));

	// build manually for now
	return {
		signature,
		proposal_bytes
	};
};
/**
 * convert proposal.proto:SignedProposal to be common.proto:Envelope
 * @param signature
 * @param proposal_bytes
 */
exports.toEnvelope = ({signature, proposal_bytes}) => ({signature, payload: proposal_bytes});

/*
 * This function will build a common channel header
 */
module.exports.buildChannelHeader = (type, channel_id, tx_id, epoch, chaincode_id, time_stamp, client_cert_hash) => {
	logger.debug(
		'buildChannelHeader - type %s channel_id %s tx_id %d epoch %s chaincode_id %s',
		type, channel_id, tx_id, epoch, chaincode_id);
	const channelHeader = new fabprotos.common.ChannelHeader();
	channelHeader.setType(type); // int32
	channelHeader.setVersion(1); // int32
	if (!time_stamp) {
		time_stamp = module.exports.buildCurrentTimestamp();
	}
	channelHeader.setChannelId(channel_id); // string
	channelHeader.setTxId(tx_id.toString()); // string
	if (epoch) {
		channelHeader.setEpoch(epoch); // uint64
	}
	if (chaincode_id) {
		const chaincodeID = new fabprotos.protos.ChaincodeID();
		chaincodeID.setName(chaincode_id);

		const headerExt = new fabprotos.protos.ChaincodeHeaderExtension();
		headerExt.setChaincodeId(chaincodeID);

		channelHeader.setExtension(headerExt.toBuffer());
	}
	if (time_stamp) {
		channelHeader.setTimestamp(time_stamp); // google.protobuf.Timestamp
	}
	if (client_cert_hash) {
		channelHeader.setTlsCertHash(client_cert_hash);
	}
	return channelHeader;
};

/*
 * This function will build the common header
 */
module.exports.buildHeader = (creator, channelHeader, nonce) => {
	const signatureHeader = new fabprotos.common.SignatureHeader();
	signatureHeader.setCreator(creator.serialize());
	signatureHeader.setNonce(nonce);

	const header = new fabprotos.common.Header();
	header.setSignatureHeader(signatureHeader.toBuffer());
	header.setChannelHeader(channelHeader.toBuffer());

	return header;
};

module.exports.checkProposalRequest = (request, all) => {
	let errorMsg = null;

	if (request) {
		if (!request.chaincodeId) {
			errorMsg = 'Missing "chaincodeId" parameter in the proposal request';
		} else if (!request.txId && all) {
			errorMsg = 'Missing "txId" parameter in the proposal request';
		}
	} else {
		errorMsg = 'Missing input request object on the proposal request';
	}
	return errorMsg;
};

module.exports.checkInstallRequest = (request) => {
	let errorMsg = null;

	if (request) {
		if (!request.chaincodeVersion) {
			errorMsg = 'Missing "chaincodeVersion" parameter in the proposal request';
		}
	} else {
		errorMsg = 'Missing input request object on the proposal request';
	}
	return errorMsg;
};

module.exports.translateCCType = (type) => {
	const chaincodeType = type ? type.toLowerCase() : 'golang';

	const map = {
		golang: fabprotos.protos.ChaincodeSpec.Type.GOLANG,
		car: fabprotos.protos.ChaincodeSpec.Type.CAR,
		java: fabprotos.protos.ChaincodeSpec.Type.JAVA,
		node: fabprotos.protos.ChaincodeSpec.Type.NODE
	};
	const value = map[chaincodeType];

	return value;
};

module.exports.ccTypeToString = (ccType) => {
	const map = {};
	map[fabprotos.protos.ChaincodeSpec.Type.GOLANG] = 'golang';
	map[fabprotos.protos.ChaincodeSpec.Type.CAR] = 'car';
	map[fabprotos.protos.ChaincodeSpec.Type.JAVA] = 'java';
	map[fabprotos.protos.ChaincodeSpec.Type.NODE] = 'node';
	const value = map[ccType];

	return value;
};

/* TODO move it to fabric-proto
 * This function will create a timestamp from the current time
 */
module.exports.buildCurrentTimestamp = () => {
	const now = new Date();
	const timestamp = new fabprotos.google.protobuf.Timestamp();
	timestamp.setSeconds(now.getTime() / 1000);
	timestamp.setNanos((now.getTime() % 1000) * 1000000);
	return timestamp;
};
