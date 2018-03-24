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

var testUtil = require('../../unit/util.js');
var e2eUtils = require('./e2eUtils.js');

var ORGS;

var channel_name = 'mychannel';
// can use "channel=<name>" to control the channel name from command line
if (process.argv.length > 2) {
	if (process.argv[2].indexOf('channel=') === 0) {
		channel_name = process.argv[2].split('=')[1];
	}
}

//
//Attempt to send a request to the orderer with the createChannel method
//
test('\n\n***** SDK Built config update  create flow  *****\n\n', function(t) {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, './config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var client = new Client();

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();

	var config = null;
	var signatures = [];
	var orderer = null;
	var tlsInfo = null;

	// Acting as a client in org1 when creating the channel
	var org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	return e2eUtils.tlsEnroll('org1')
	.then((enrollment) => {
		t.pass('Successfully retrieved TLS certificate');
		tlsInfo = enrollment;
		return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
	}).then((store) => {
		client.setStateStore(store);
		var cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
		client.setCryptoSuite(cryptoSuite);

		// use the config update created by the configtx tool
		let envelope_bytes = fs.readFileSync(path.join(__dirname, '../../fixtures/channel/mychannel.tx'));
		config = client.extractChannelConfig(envelope_bytes);
		t.pass('Successfull extracted the config update from the configtx envelope');

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org1');

		// sign the config
		var signature = client.signChannelConfig(config);
		// convert signature to a storable string
		// fabric-client SDK will convert back during create
		var string_signature = signature.toBuffer().toString('hex');
		t.pass('Successfully signed config update');

		// collect signature from org1 admin
		signatures.push(string_signature);

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign the config
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update');

		// collect signature from org2 admin
		signatures.push(signature);

		return testUtil.getOrderAdminSubmitter(client, t);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for orderer');

		let orderer_bad = client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'clientCert': tlsInfo.certificate,
				'clientKey': tlsInfo.key,
				'ssl-target-name-override': ORGS.orderer['server-hostname'],
				'grpc.max_send_message_length': 1000 //something too small for the request
			}
		);

		let tx_id = client.newTransactionID();
		var request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : orderer_bad,
			txId  : tx_id
		};

		// send create request to bad orderer
		return client.createChannel(request);
	}).then((result) => {
		logger.debug('\n***\n completed the create successfully with an orderer with a bad max send size  \n***\n');

		logger.debug(' response ::%j',result);
		t.fail('Failed when successfully created the channel with a bad max send size');
		throw new Error('Failed to get max send error');
	}, (err) => {
		if(err.toString().indexOf('Sent message larger than max') > -1) {
			t.pass('Successfully failed with max error on the create channel: ' + err.toString());
		} else {
			t.fail('Failed to fail with max error on the create channel: ' + err.stack ? err.stack : err);
			throw new Error('Failed');
		}

		return true;
	}).then((nothing) => {

		orderer = client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'clientCert': tlsInfo.certificate,
				'clientKey': tlsInfo.key,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		);

		// let's try to get some info from the orderer
		// Get the system channel config decoded
		let sys_channel = client.newChannel('testchainid');
		sys_channel.addOrderer(orderer);
		return sys_channel.getChannelConfigFromOrderer();
	}).then((config_envelope) => {
		t.pass('Successfully received the configuration');

		// build up the create request
		let tx_id = client.newTransactionID();
		var request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id
		};

		// send create request to orderer
		return client.createChannel(request);
	}).then((result) => {
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',result);
		t.pass('Successfully created the channel.');
		if(result.status && result.status === 'SUCCESS') {
			return e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');
			throw new Error('Failed');
		}
	}).then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created.');
		t.end();
	}).catch((err)=> {
		t.fail('Failed error: ' + err.stack ? err.stack : err);
		t.end();
	});
});
