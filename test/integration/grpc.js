/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('query');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var util = require('util');
var fs = require('fs');
var crypto = require('crypto');

var e2eUtils = require('./e2e/e2eUtils.js');
var testUtil = require('../unit/util.js');
var Client = require('fabric-client');

const GRPC_SEND = 'grpc.max_send_message_length';
const GRPC_RECEIVE = 'grpc.max_receive_message_length';
const SDK_SEND = 'grpc-max-send-message-length'; //legacy v1.0 way of setting the max
const SDK_RECEIVE = 'grpc-max-receive-message-length'; //legacy v1.0 way of setting the max

/*
 * The test depends on an existing channel 'mychannel'
 */
test('\n\n*** GRPC message size tests ***\n\n', async (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();

	try {
		// setup client , including user and tls mutual certs
		const client = new Client();
		const channel_name = testUtil.END2END.channel;
		const channel = client.newChannel(channel_name);
		const ORGS = Client.getConfigSetting('test-network');
		const userOrg = 'org1';
		const orgName = ORGS[userOrg].name;
		const url = ORGS[userOrg].peer1.requests;
		const data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[userOrg].peer1['tls_cacerts']));
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
		client.setCryptoSuite(cryptoSuite);
		const tlsInfo = await e2eUtils.tlsEnroll(userOrg);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		client.setStateStore(store);
		await testUtil.getSubmitter(client, t, userOrg, true);

		// make sure chaincode is installed that has the echo function
		const go_cc = testUtil.END2END.chaincodeId;
		const node_cc = testUtil.NODE_END2END.chaincodeId;
		const version = 'v'+ (new Date()).getTime();
		await e2eUtils.installChaincode(userOrg, testUtil.CHAINCODE_UPGRADE_PATH, testUtil.METADATA_PATH, version, 'golang', t, true);
		await e2eUtils.installChaincode('org2', testUtil.CHAINCODE_UPGRADE_PATH, testUtil.METADATA_PATH, version, 'golang', t, true);
		await e2eUtils.instantiateChaincode(userOrg, testUtil.CHAINCODE_UPGRADE_PATH, version, 'golang', true, false, t);
		await e2eUtils.installChaincode(userOrg, testUtil.NODE_CHAINCODE_UPGRADE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
		await e2eUtils.installChaincode('org2', testUtil.NODE_CHAINCODE_UPGRADE_PATH, testUtil.METADATA_PATH, version, 'node', t, true);
		await e2eUtils.instantiateChaincode(userOrg, testUtil.NODE_CHAINCODE_UPGRADE_PATH, version, 'node', true, false, t);

		const connection_profile = {
			version: '1.0',
			organizations: {
				Org1: {
					mspid: 'Org1MSP',
					peers: [
						'peer_cp'
					]
				}
			},
			peers: {
				peer_cp: {
					url: url,
					grpcOptions: {
						'ssl-target-name-override': ORGS[userOrg].peer1['server-hostname'],
						'grpc.max_receive_message_length': 1024,
					},
					'tlsCACerts': {
						path: path.join(__dirname, 'e2e', ORGS[userOrg].peer1['tls_cacerts'])
					}
				}
			}
		};

		// setup reusable artificates
		const opts = {
			pem: Buffer.from(data).toString(),
			clientCert: tlsInfo.certificate,
			clientKey: tlsInfo.key,
			'ssl-target-name-override': ORGS[userOrg].peer1['server-hostname']
		};
		let response;

		t.pass('Successfully setup to testing environment');

		// use the connection profile defined peer which includes a GRPC max setting
		response = await sendToConnectionProfile(client, channel, connection_profile, go_cc, 1);
		checkResponse(t, response, 'Test golang cc able to use connection profile set with grpc max receive', 'Received|max|1024');
		response = await sendToConnectionProfile(client, channel, connection_profile, node_cc, 1);
		checkResponse(t, response, 'Test node cc able to use connection profile set with grpc max receive', 'Received|max|1024');

		// use the NodeSDK configuration to set the sizes
		response = await send(client, channel, url, go_cc, opts, 1, -1, 1024, null, null);
		checkResponse(t, response, 'Test golang cc able to set config for grpc max receive', 'Received|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, 1024, null, null);
		checkResponse(t, response, 'Test node cc able to set config for grpc max receive', 'Received|max|1024');

		response = await send(client, channel, url, go_cc, opts, 1, 1024, -1, null, null);
		checkResponse(t, response, 'Test golang cc able to set config for grpc max send', 'Sent|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, 1024, -1, null, null);
		checkResponse(t, response, 'Test node cc able to set config for grpc max send', 'Sent|max|1024');

		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, null, 1024);
		checkResponse(t, response, 'Test golang cc able to set config for legacy sdk max receive', 'Received|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, null, 1024);
		checkResponse(t, response, 'Test node cc able to set config for legacy sdk max receive', 'Received|max|1024');

		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, 1024, null);
		checkResponse(t, response, 'Test golang cc able to set config for legacy sdk max send', 'Sent|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, 1024, null);
		checkResponse(t, response, 'Test node cc able to set config for legacy sdk max send', 'Sent|max|1024');

		// pass the size setting on the create of the peer instance as an option
		opts[GRPC_RECEIVE] = 1024;
		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test golang cc able to set peer for grpc max receive', 'Received|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test node cc able to set peer for grpc max receive', 'Received|max|1024');
		delete opts[GRPC_RECEIVE];

		opts[GRPC_SEND] = 1024;
		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test golang cc able to set peer for grpc max send', 'Sent|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test node cc able to set peer for grpc max send', 'Sent|max|1024');
		delete opts[GRPC_SEND];

		opts[SDK_RECEIVE] = 1024;
		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test golang cc able to set peer for legacy sdk max receive', 'Received|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test node cc able to set peer for legacy sdk max receive', 'Received|max|1024');
		delete opts[SDK_RECEIVE];

		opts[SDK_SEND] = 1024;
		response = await send(client, channel, url, go_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test golang cc able to set peer for legacy sdk max send', 'Sent|max|1024');
		response = await send(client, channel, url, node_cc, opts, 1, -1, -1, -1, -1);
		checkResponse(t, response, 'Test node cc able to set peer for legacy sdk max send', 'Sent|max|1024');

	} catch(error) {
		t.fail('Failed -- '+ error);
	}

	t.end();
});

async function send(client, channel, url, cc, opts, megs, grpc_send_max, grpc_receive_max, sdk_send_max, sdk_receive_max) {
	if(grpc_send_max !== null) utils.setConfigSetting('grpc.max_send_message_length', grpc_send_max);
	if(grpc_receive_max !== null) utils.setConfigSetting('grpc.max_receive_message_length', grpc_receive_max);
	if(sdk_send_max !== null) utils.setConfigSetting('grpc-max-send-message-length', sdk_send_max);
	if(sdk_receive_max !== null) utils.setConfigSetting('grpc-max-receive-message-length', sdk_receive_max);

	let peer = client.newPeer(
		url,
		opts
	);

	let request = {
		targets: [peer],
		chaincodeId : cc,
		fcn: 'echo',
		args: [crypto.randomBytes(megs * 1024 * 1024)],
		txId: client.newTransactionID()
	};

	return channel.sendTransactionProposal(request);
}

async function sendToConnectionProfile(client, channel, config, cc, megs) {
	client.loadFromConfig(config);
	let peer = client.getPeersForOrg('Org1')[0]; // will only be one

	let request = {
		targets: [peer],
		chaincodeId : cc,
		fcn: 'echo',
		args: [crypto.randomBytes(megs * 1024 * 1024)],
		txId: client.newTransactionID()
	};

	return channel.sendTransactionProposal(request);
}

function checkResponse(t, response, message, error_message) {
	var err = (response[0] && response[0][0] && response[0][0] instanceof Error) ? response[0][0] : {};
	let pattern = new RegExp('\\b(' + error_message + ')', 'g');
	let error_words_length = error_message.split('|').length;

	if(err.message) {
		if(pattern.test(err.message) && err.message.match(pattern).length == error_words_length) {
			t.pass('Successfully ' + message);
		} else {
			t.fail('Failed message not match ' + error_message + ' for ' + message );
			t.comment('Failed with error of '+ err.message);
		}
	} else {
		t.fail('Failed to get an error message for '+ message);
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
