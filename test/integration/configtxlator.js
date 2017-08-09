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

/*
 *   This test case requires that the 'configtxlator' tool be running locally and on port 7059
 *   see:
 *   https://github.com/jyellick/fabric-gerrit/tree/configtxlator/examples/configtxupdate
 *
 *   This test case also requires two node packages to make it easier to make REST calls to
 *   the 'configtxlator'
 *        superagent
 *        superagent-promise
 */
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('configinator');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var superagent = require('superagent');
var agent = require('superagent-promise')(require('superagent'), Promise);
var requester = require('request');

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');

var testUtil = require('../unit/util.js');
var e2eUtils = require('./e2e/e2eUtils.js');

var the_user = null;
var ORGS;

test('\n\n***** configtxlator flow for create and then update  *****\n\n', function(t) {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var channel_name = 'mychannelator';
	var channel = null;

	//
	// Create and configure the test channel
	//
	var client = new Client();

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	let caroots = Buffer.from(data).toString();

	var orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname']
		}
	);

	var config_proto = null;
	var original_config_proto = null;
	var original_config_json = null;
	var updated_config_proto = null;
	var updated_config_json = null;
	var signatures = [];
	var request = null;

	// Acting as a client in org1 when creating the channel
	var org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(org)
	}).then((store) => {
		client.setStateStore(store);

		/*
		 *  C H A N N E L  C R E A T E
		 *
		 *  - Edit the "ConfigUpdate" JSON that may have been produced
		 *    by the "configtxlator". This configuration must be based
		 *    on the current configuration of the system channel. The
		 *    Consortium name must exist and the organizations must
		 *    included in this new channel definition must be defined
		 *    in the consortium on the system channel.
		 *  - Using the "configtxlator", encode the updated "ConfigUpdate"
		 *    JSON and save the returned "ConfigUpate" object for
		 *    later use.
		 *  - Using the NodeSDK, sign the "ConfigUpdate" object by
		 *    all organizations.
		 *  - Using the NodeSDK, create the channel by using the
		 *    the "createChannel" API with all the signatures and
		 *    the "ConfigUpdate" object.
		 */

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
	}).then((admin) =>{
		t.pass('Successfully enrolled user \'admin\' for org1');
		let config_json = fs.readFileSync(path.join(__dirname, '../fixtures/channel/' + channel_name + '.json'));

		// the following is an example of how to make the call without a promise
		var response = superagent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate',
			config_json.toString())
			.buffer()
			.end((err, res) => {
				if(err) {
					logger.error(err);
					return;
				}
				config_proto = res.body;
				//logger.info('config_proto %s',config_proto.toString());
			});
		// and here is an example of how to use it with a promise
		return agent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate', config_json.toString())
			.buffer();
	}).then((config) =>{
		config_proto = config.body;
		t.pass('Successfully built the config create from the json input');

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config create by org1');
		// collect signature
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config create by org2');
		// collect signature
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;

		return testUtil.getOrderAdminSubmitter(client, t);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for orderer');
		the_user = admin;

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config create by orderer');
		// collect signature
		signatures.push(signature);

		// build up the create request
		let tx_id = client.newTransactionID();
		request = {
			config: config_proto,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id
		};

		// this will send the create request to the orderer
		return client.createChannel(request);
	}).then((result) => {
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',result);
		if(result.status && result.status === 'SUCCESS') {
			t.pass('Successfully created the channel.');

			return e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');

			Promise.reject('Failed to create the channel');
		}
	}).then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created.');

		/*
		 *  C H A N N E L  U P D A T E
		 *
		 *  - Get the current configuration of the channel by
		 *    using the NodeSDK API getChannelConfig(). This
		 *    will return a "ConfigEvelope" object.
		 *  - From the "ConfigEvelope" object, save the this original
		 *    "Config" object for later use.
		 *  - Using the "configtxlator", decode the original "Config"
		 *    into JSON. You may do this by using the calls as shown
		 *    below or by using a tool like "curl".
		 *  - Edit the "Config" JSON with the necessary changes to
		 *    the configuration.
		 *  - Using the "configtxlator", encode the updated "Config"
		 *    JSON and save the returned updated "Config" object for
		 *    later use.
		 *  - Using the "configtxlator" to compute a "ConfigUpdate"
		 *    object to be used for the channel update. This requires
		 *    sending both the original and updated "Config" objects.
		 *    Save the returned "ConfigUpdate" object for later use.
		 *  - Using the NodeSDK, sign the "ConfigUpdate" object by
		 *    all organizations.
		 *  - Using the NodeSDK, update the channel by using the
		 *    the "updateChannel" API with all the signatures and
		 *    the "ConfigUpdate" object.
		 */

		var channel = client.newChannel(channel_name);
		channel.addOrderer(orderer);

		return channel.getChannelConfig();
	}).then((config_envelope) => {
		t.pass('Successfully read the current channel configuration');
		// we just need the config from the envelope and configtxlator
		// works with bytes
		original_config_proto = config_envelope.config.toBuffer();

		// lets get the config converted into JSON, so we can edit JSON to
		// make our changes
		return agent.post('http://127.0.0.1:7059/protolator/decode/common.Config',
			original_config_proto)
			.buffer();
	}).then((response) => {
		t.pass('Successfully decoded the current configuration config proto into JSON');
		original_config_json = response.text.toString();
		logger.info(' original_config_json :: %s',original_config_json);
		// make a copy of the original so we can edit it
		updated_config_json = original_config_json;
		var updated_config = JSON.parse(updated_config_json);
		// now edit the config -- remove one of the organizations
		delete updated_config.channel_group.groups.Application.groups.Org1MSP;
		updated_config_json = JSON.stringify(updated_config);
		logger.info(' updated_config_json :: %s',updated_config_json);

		// lets get the updated JSON encoded
		return agent.post('http://127.0.0.1:7059/protolator/encode/common.Config',
			updated_config_json.toString())
			.buffer();
	}).then((response) =>{
		t.pass('Successfully encoded the updated config from the JSON input');
		updated_config_proto = response.body;

		var formData = {
			channel: channel_name,
			original: {
				value: original_config_proto,
				options: {
					filename: 'original.proto',
					contentType: 'application/octet-stream'
				}
			},
			updated: {
				value: updated_config_proto,
				options: {
					filename: 'updated.proto',
					contentType: 'application/octet-stream'
				}
			}
		};

		return new Promise((resolve, reject) =>{
			requester.post({
				url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
				formData: formData
			}, function optionalCallback(err, res, body) {
				if (err) {
					t.fail('Failed to get the updated configuration ::'+err);
					reject(err);
				} else {
					var proto = new Buffer(body, 'binary');
					resolve(proto);
				}
			});
		});
	}).then((response) =>{
		t.pass('Successfully had configtxlator compute the updated config object');
		config_proto = response;

		// will have to now collect the signatures
		signatures = []; //clear out the above
		// make sure we do not reuse the user
		client._userContext = null;

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org1');

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config update by org1');
		// collect signature
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;

		return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config update by org2');
		// collect signature
		signatures.push(signature);

		// make sure we do not reuse the user
		client._userContext = null;
		return testUtil.getOrderAdminSubmitter(client, t);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for orderer');
		the_user = admin;

		// sign the config
		var signature = client.signChannelConfig(config_proto);
		t.pass('Successfully signed config update by orderer');
		// collect signature
		signatures.push(signature);

		// build up the create request
		let tx_id = client.newTransactionID();
		request = {
			config: config_proto,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id
		};

		// this will send the update request to the orderer
		return client.updateChannel(request);
	}).then((result) => {
		if(result.status && result.status === 'SUCCESS') {
			t.pass('Successfully updated the channel.');

			return e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to update the channel. ');

			Promise.reject('Failed to update the channel');
		}
	}).then((nothing) => {
		t.pass('Successfully waited to make sure new channel was updated.');
		t.end();
	}).catch((err) =>{
		t.fail('Unexpected error '+err);
		t.end();
	});
});
