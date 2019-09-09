/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
const Long = require('long');
const fs = require('fs');
const path = require('path');

const Utils = require('../lib/Utils');
const fabprotos = require('fabric-protos');

module.exports.certificateAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'cert.pem'));
module.exports.keyAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'key.pem'));

module.exports.setCryptoConfigSettings = () => {
	Utils.setConfigSetting('connection-options', {'request-timeout': 3000});
	Utils.setConfigSetting('crypto-hsm', false);
	Utils.setConfigSetting('crypto-suite-software', {'EC': 'fabric-common/lib/impl/CryptoSuite_ECDSA_AES.js'});
	Utils.setConfigSetting('crypto-hash-algo', 'SHA2');
	Utils.setConfigSetting('crypto-keysize', 256);
	Utils.setConfigSetting('key-value-store', 'fabric-common/lib/impl/FileKeyValueStore.js');
};

module.exports.createErrorResponse = (message) => {
	const proposalResponse = module.exports.createProposalResponse(message, 500);

	if (typeof message === 'string') {
		proposalResponse.response.message = Buffer.from(message);
	}

	return proposalResponse;
};

module.exports.createTransactionResponse = (payload) => {
	const proposalResponse = module.exports.createProposalResponse(payload);

	if (payload) {
		proposalResponse.response.payload = payload;
	}

	return proposalResponse;
};

module.exports.createProposalResponse = (results, status = 200) => {
	if (typeof results !== 'string') {
		results = '';
	}
	const extension = new fabprotos.protos.ChaincodeAction();
	extension.response = new fabprotos.protos.Response();
	extension.results = Buffer.from(results);

	const payload = new fabprotos.protos.ProposalResponsePayload();
	payload.extension = extension.toBuffer();

	const identity = new fabprotos.msp.SerializedIdentity();
	identity.setMspid('msp1');

	const endorsement = new fabprotos.protos.Endorsement();
	endorsement.setEndorser(identity.toBuffer());
	endorsement.setSignature(Buffer.from('signature'));

	const response = new fabprotos.protos.Response();
	response.setStatus(status);
	response.setMessage('Dummy message');
	response.setPayload(Buffer.from('response payload'));

	const proposalResponse = new fabprotos.protos.ProposalResponse();
	proposalResponse.setResponse(response);
	proposalResponse.setPayload(payload.toBuffer());
	proposalResponse.setEndorsement(endorsement);

	return proposalResponse;
};

module.exports.createMsp = (name = 'mspid') => {
	const msp = new fabprotos.msp.FabricMSPConfig();
	msp.setName(name);
	msp.setRootCerts(Buffer.from('root_certs'));
	msp.setTlsIntermediateCerts(Buffer.from('tls_intermediate_certs'));

	return msp;
};

module.exports.createEndpoints = (host_base, count) => {
	const endpoints = [];
	for (let index = 1; index < count + 1; index++) {
		const endpoint = new fabprotos.discovery.Endpoint();
		endpoint.setHost(`${host_base}${index}`);
		endpoint.setPort(1000);
		endpoints.push(endpoint);
	}

	return {endpoint: endpoints};
};

module.exports.createSerializedIdentity = (mspid = 'msp1') => {
	const identity = new fabprotos.msp.SerializedIdentity();
	identity.setMspid(mspid);

	return identity.toBuffer();
};

module.exports.createMembership = (endpoint = 'host.com:1000') => {
	const gossip_message = new fabprotos.gossip.GossipMessage();
	const alive_msg = new fabprotos.gossip.AliveMessage();
	const member = new fabprotos.gossip.Member();
	member.setEndpoint(endpoint);
	alive_msg.setMembership(member);
	gossip_message.setAliveMsg(alive_msg);

	return gossip_message.toBuffer();
};

module.exports.createStateInfo = (ledgerHeight = 1000, names = ['chaincode1', 'chaincode2']) => {
	const gossip_message = new fabprotos.gossip.GossipMessage();
	const state_info = new fabprotos.gossip.StateInfo();
	const properties = new fabprotos.gossip.Properties();
	const chaincodes = [];
	for (const name of names) {
		const chaincode = new fabprotos.gossip.Chaincode();
		chaincode.setName(name);
		chaincode.setVersion('v1');
		chaincodes.push(chaincode);
	}
	properties.setChaincodes(chaincodes);
	properties.setLedgerHeight(Long.fromValue(ledgerHeight));
	state_info.setProperties(properties);
	gossip_message.setStateInfo(state_info);

	return gossip_message.toBuffer();
};

module.exports.createChannelHeader = (type = 1, chaincode_name = 'chaincode', channel_name = 'channel', transactionId = 'txid') => {
	const channelHeader = new fabprotos.common.ChannelHeader();
	channelHeader.setType(type); // int32
	channelHeader.setVersion(1); // int32

	channelHeader.setChannelId(channel_name); // string
	channelHeader.setTxId(transactionId.toString()); // string

	const chaincodeID = new fabprotos.protos.ChaincodeID();
	chaincodeID.setName(chaincode_name);

	const headerExt = new fabprotos.protos.ChaincodeHeaderExtension();
	headerExt.setChaincodeId(chaincodeID);

	channelHeader.setExtension(headerExt.toBuffer());
	channelHeader.setTlsCertHash(Buffer.from('cert'));

	return channelHeader;
};

module.exports.createResponsePayload = (results = 'results') => {
	const payload = new fabprotos.protos.ProposalResponsePayload();
	payload.setProposalHash(Buffer.from('proposal'));
	const extension = new fabprotos.protos.ChaincodeAction();
	extension.setResults(Buffer.from(results));
	payload.setExtension(extension.toBuffer());

	return payload.toBuffer();
};
