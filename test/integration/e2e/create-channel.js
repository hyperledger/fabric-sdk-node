/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E create-channel');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');

var _commonProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/common/common.proto')).common;
var _configtxProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/common/configtx.proto')).common;

var testUtil = require('../../unit/util.js');
var e2eUtils = require('./e2eUtils.js');

var the_user = null;

Client.addConfigFile(path.join(__dirname, './config.json'));
var ORGS = Client.getConfigSetting('test-network');

var channel_name = 'mychannel';
// can use "channel=<name>" to control the channel name from command line
if (process.argv.length > 2) {
	if (process.argv[2].indexOf('channel=') === 0) {
		channel_name = process.argv[2].split('=')[1];
	}
}

logger.info('\n\n >>>>>>  Will create new channel with name :: %s <<<<<<< \n\n',channel_name);
//
//Attempt to send a request to the orderer with the sendCreateChain method
//
test('\n\n***** SDK Built config update  create flow  *****\n\n', function(t) {
	//
	// Create and configure the test chain
	//
	var client = new Client();

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();

	var orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname']
		}
	);

	var config = null;
	var signatures = [];

	client.addMSP( e2eUtils.loadMSPConfig('OrdererMSP', '../../fixtures/channel/crypto-config/ordererOrganizations/example.com/msp/'));

	client.addMSP( e2eUtils.loadMSPConfig('Org1MSP', '../../fixtures/channel/crypto-config/peerOrganizations/org1.example.com/msp/'));

	client.addMSP( e2eUtils.loadMSPConfig('Org2MSP', '../../fixtures/channel/crypto-config/peerOrganizations/org2.example.com/msp/'));

	// Acting as a client in org1 when creating the channel
	var org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(org)
	}).then((store) => {
		client.setStateStore(store);

		// use this when the config comes from the configtx tool
		data = fs.readFileSync(path.join(__dirname, '../../fixtures/channel/mychannel.tx'));
		var envelope = _commonProto.Envelope.decode(data);
		var payload = _commonProto.Payload.decode(envelope.getPayload().toBuffer());
		var configtx = _configtxProto.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
		config = configtx.getConfigUpdate().toBuffer();

		logger.debug('\n***\n dump the configtx config \n***\n');

		 return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org1');

		// sign the config
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update');
		// collect signature from org1 admin
		// TODO: signature counting against policies on the orderer
		// at the moment is being investigated, but it requires this
		// weird double-signature from each org admin
		signatures.push(signature);
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;
		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign the config
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update');

		// collect signature from org2 admin
		// TODO: signature counting against policies on the orderer
		// at the moment is being investigated, but it requires this
		// weird double-signature from each org admin
		signatures.push(signature);
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;
		return testUtil.getOrderAdminSubmitter(client, t);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for orderer');
		the_user = admin;

		// sign the config
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update');

		// collect signature from orderer org admin
		// TODO: signature counting against policies on the orderer
		// at the moment is being investigated, but it requires this
		// weird double-signature from each org admin
		signatures.push(signature);
		signatures.push(signature);

		logger.debug('\n***\n done signing \n***\n');

		// build up the create request
		let nonce = utils.getNonce();
		let tx_id = Client.buildTransactionID(nonce, the_user);
		var request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id,
			nonce : nonce
		};

		// send to create request to orderer
		return client.createChannel(request);
	})
	.then((result) => {
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',result);
		t.pass('Successfully created the channel.');
		if(result.status && result.status === 'SUCCESS') {
			return e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to create the channel: ' + err.stack ? err.stack : err);
		t.end();
	})
	.then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created.');
		t.end();
	}, (err) => {
		t.fail('Failed to sleep due to error: ' + err.stack ? err.stack : err);
		t.end();
	});
});