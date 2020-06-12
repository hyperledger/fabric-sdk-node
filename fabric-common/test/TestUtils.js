/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
const Long = require('long');
const fs = require('fs');
const path = require('path');

const Utils = require('../lib/Utils');
const fabproto6 = require('fabric-protos');
const pem =
'-----BEGIN CERTIFICATE-----\n' +
'MIICSTCCAe+gAwIBAgIQPHXmPqjzn2bon7JrBRPS2DAKBggqhkjOPQQDAjB2MQsw\n' +
'CQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\n' +
'YW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEfMB0GA1UEAxMWdGxz\n' +
'Y2Eub3JnMS5leGFtcGxlLmNvbTAeFw0xOTAyMjExNDI4MDBaFw0yOTAyMTgxNDI4\n' +
'MDBaMHYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQH\n' +
'Ew1TYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMR8wHQYD\n' +
'VQQDExZ0bHNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0D\n' +
'AQcDQgAELAsSPvzK3EdhGPZAMKYh67s02WqfYUe09xMzy7BzNODUKcbyIW5i7GVQ\n' +
'3YurSkR/auRsk6FG45Q1zTZaEvwVH6NfMF0wDgYDVR0PAQH/BAQDAgGmMA8GA1Ud\n' +
'JQQIMAYGBFUdJQAwDwYDVR0TAQH/BAUwAwEB/zApBgNVHQ4EIgQg8HHn3ScArMdH\n' +
'lkp+jpcDXtIAzWnVf4F9rBHvUNjcC1owCgYIKoZIzj0EAwIDSAAwRQIhAMi+R+ZI\n' +
'XgZV40IztD8aQDr/sntDTu/8Nw7Y0DGEhwaQAiBEnBCdRXaBcENWnAnastAg+RA5\n' +
'XALSidlQqZKrK4L3Yg==\n' +
'-----END CERTIFICATE-----\n';

module.exports.certificateAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'cert.pem'));
module.exports.keyAsPEM = fs.readFileSync(path.join(__dirname, 'data', 'key.pem'));

module.exports.setCryptoConfigSettings = () => {
	Utils.setConfigSetting('connection-options', {'requestTimeout': 3000});
	Utils.setConfigSetting('crypto-hsm', false);
	Utils.setConfigSetting('crypto-suite-software', {'EC': 'fabric-common/lib/impl/CryptoSuite_ECDSA_AES.js'});
	Utils.setConfigSetting('crypto-hash-algo', 'SHA2');
	Utils.setConfigSetting('crypto-keysize', 256);
};

module.exports.setHFCLogging = (value) => {
	Utils.setConfigSetting('hfc-logging', value);
	global.hfc.logger = undefined;
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
	const extension = fabproto6.protos.ChaincodeAction.create({
		response: fabproto6.protos.Response.create(),
		results: Buffer.from(results)
	});
	const extensionBuff  = fabproto6.protos.ChaincodeAction.encode(extension).finish();
	const payload = fabproto6.protos.ProposalResponsePayload.create({
		extension: extensionBuff
	});
	const payloadBuff  = fabproto6.protos.ProposalResponsePayload.encode(payload).finish();

	const identity = fabproto6.msp.SerializedIdentity.create({
		mspid: 'msp1'
	});
	const identityBuff  = fabproto6.msp.SerializedIdentity.encode(identity).finish();

	const endorsement = fabproto6.protos.Endorsement.create({
		endorser: identityBuff,
		signature: Buffer.from('signature')
	});

	const response = fabproto6.protos.Response.create({
		status: status,
		message: 'Dummy message',
		payload: Buffer.from('response payload')
	});

	const proposalResponse = fabproto6.protos.ProposalResponse.create({
		response: response,
		payload: payloadBuff,
		endorsement: endorsement
	});

	return proposalResponse;
};

module.exports.createMsp = (name = 'mspid') => {
	const msp = fabproto6.msp.FabricMSPConfig.create({
		name: name,
		root_certs: Buffer.from(pem),
		tls_intermediate_certs: Buffer.from(pem)
	});

	return msp;
};

module.exports.createEndpoints = (host_base, count) => {
	const endpoints = [];
	for (let index = 1; index < count + 1; index++) {
		const endpoint = fabproto6.discovery.Endpoint.create({
			host: `${host_base}${index}`,
			port: 1000,
		});
		endpoints.push(endpoint);
	}

	return {endpoint: endpoints};
};

module.exports.createSerializedIdentity = (mspid = 'msp1') => {
	const identity = fabproto6.msp.SerializedIdentity.create({
		mspid: mspid
	});
	const identityBuff  = fabproto6.msp.SerializedIdentity.encode(identity).finish();

	return identityBuff;
};

module.exports.createMembership = (endpoint = 'host.com:1000') => {
	const member = fabproto6.gossip.Member.create({
		endpoint: endpoint
	});
	const aliveMsg = fabproto6.gossip.AliveMessage.create({
		membership: member
	});
	const gossipMessage = fabproto6.gossip.GossipMessage.create({
		alive_msg: aliveMsg
	});
	const gossipMessageBuff  = fabproto6.gossip.GossipMessage.encode(gossipMessage).finish();

	return gossipMessageBuff;
};

module.exports.createStateInfo = (ledgerHeight = 1000, names = ['chaincode1', 'chaincode2']) => {
	const chaincodes = [];
	for (const name of names) {
		const chaincode = fabproto6.gossip.Chaincode.create({
			name: name,
			version: 'v1',
		});
		chaincodes.push(chaincode);
	}
	const properties = fabproto6.gossip.Properties.create({
		chaincodes: chaincodes,
		ledger_height: Long.fromValue(ledgerHeight),
	});
	const stateInfo = fabproto6.gossip.StateInfo.create({
		properties: properties
	});

	const gossipMessage = fabproto6.gossip.GossipMessage.create({
		state_info: stateInfo
	});
	const gossipMessageBuff  = fabproto6.gossip.GossipMessage.encode(gossipMessage).finish();

	return gossipMessageBuff;
};

module.exports.createChannelHeader = (type = 1, chaincodeName = 'chaincode', channelName = 'channel', transactionId = 'txid') => {
	const chaincodeId = fabproto6.protos.ChaincodeID.create({
		name: chaincodeName
	});

	const headerExt = fabproto6.protos.ChaincodeHeaderExtension.create({
		chaincode_id: chaincodeId
	});
	const headerExtBuff  = fabproto6.protos.ChaincodeHeaderExtension.encode(headerExt).finish();

	const channelHeader = fabproto6.common.ChannelHeader.create({
		type: type,
		version: 1,
		chaincode_id: channelName,
		tx_id: transactionId.toString(),
		extension: headerExtBuff,
		tls_cert_hash: Buffer.from('cert')
	});

	return channelHeader;
};

module.exports.createResponsePayload = (results = 'results') => {

	const extension = fabproto6.protos.ChaincodeAction.create({
		results: Buffer.from(results)
	});
	const extensionBuff  = fabproto6.protos.ChaincodeAction.encode(extension).finish();

	const payload = fabproto6.protos.ProposalResponsePayload.create({
		proposal_hash: Buffer.from('proposal'),
		extension: extensionBuff
	});
	const payloadBuff  = fabproto6.protos.ProposalResponsePayload.encode(payload).finish();

	return payloadBuff;
};

module.exports.TEST_KEY_PRIVATE_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw' +
'fzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
'biBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAK' +
'BgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTAzMDEyNDAw' +
'WhcNMTgwMTAzMDEyNDAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEG' +
'CCqGSM49AwEHA0IABLoGEWBb+rQ/OuTBPlGVZO3jVWBcuC4+/pAq8axbtKorpORw' +
'J/GxahKPLr+vVLPNMyeLcnyJBGgneug+ajE8srijfzB9MA4GA1UdDwEB/wQEAwIF' +
'oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd' +
'BgNVHQ4EFgQU9BUt7QfgDXx9g6zpzCyJGxXsNM0wHwYDVR0jBBgwFoAUF2dCPaqe' +
'gj/ExR2fW8OZ0bWcSBAwCgYIKoZIzj0EAwIDSAAwRQIgcWQbMzluyZsmvQCvGzPg' +
'f5B7ECxK0kdmXPXIEBiizYACIQD2x39Q4oVwO5uL6m3AVNI98C2LZWa0g2iea8wk' +
'BAHpeA==' +
'-----END CERTIFICATE-----';

module.exports.TEST_PUBLIC_KEY_SKI = 'f7b61538c52260e83cf4f2693d1' +
'1019f73e7495056c5b54f1e05bae80e9402a7';

module.exports.TEST_PRIVATE_KEY_SKI = 'bced195e7aacb5705bbad45598' +
'535d2f41564953680c5cf696becbb2dfebf39c';

module.exports.TEST_MSG = 'this is a test message';
module.exports.TEST_LONG_MSG = 'The Hyperledger project is an open source collaborative effort created to advance cross-industry blockchain technologies. ' +
	'It is a global collaboration including leaders in finance, banking, Internet of Things, supply chains, manufacturing and Technology. The Linux ' +
	'Foundation hosts Hyperledger as a Collaborative Project under the foundation. Why Create the Project? Not since the Web itself has a technology ' +
	'promised broader and more fundamental revolution than blockchain technology. A blockchain is a peer-to-peer distributed ledger forged by consensus, ' +
	'combined with a system for “smart contracts” and other assistive technologies. Together these can be used to build a new generation of transactional ' +
	'applications that establishes trust, accountability and transparency at their core, while streamlining business processes and legal constraints. ' +
	'Think of it as an operating system for marketplaces, data-sharing networks, micro-currencies, and decentralized digital communities. It has the potential ' +
	'to vastly reduce the cost and complexity of getting things done in the real world. Only an Open Source, collaborative software development approach can ' +
	'ensure the transparency, longevity, interoperability and support required to bring blockchain technologies forward to mainstream commercial adoption. That ' +
	'is what Hyperledger is about – communities of software developers building blockchain frameworks and platforms.';

module.exports.HASH_MSG_SHA2_256 = '4e4aa09b6d80efbd684e80f54a70c1d8605625c3380f4cb012b32644a002b5be';
module.exports.HASH_LONG_MSG_SHA2_256 = '0d98987f5e4e3ea611f0e3d768c594ff9aac25404265d73554d12c86d7f6fbbc';
module.exports.HASH_MSG_SHA2_384 = '6247065855a812ecd182476576c02d46a675845ef4b0056e973ca42dcf8191d3adabc8c6c4b909f20f96136032ab723a';
module.exports.HASH_MSG_SHA3_256 = '7daeff454f7e91e3cd2d1c1bd5fcd1b6c9d4d5fffc6c327710d8fae7b06ee4a3';
module.exports.HASH_LONG_MSG_SHA3_256 = '577174210438a85ae4311a62e5fccf2441b960013f5691993cdf38ed6ba0c84f';
module.exports.HASH_MSG_SHA3_384 = '9e9c2e5edf6cbc0b512807a8efa2917daff71b83e04dee28fcc00b1a1dd935fb5afc5eafa06bf55bd64792a597e2a8f3';
module.exports.HASH_LONG_MSG_SHA3_384 = '47a90d6721523682e09b81da0a60e6ee1faf839f0503252316638daf038cf682c0a842edaf310eb0f480a2e181a07af0';
