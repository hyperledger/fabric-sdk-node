/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

/*
 *   This test case requires that the 'configtxlator' tool be running locally and on port 7059
 *   see:
 *   https://github.com/hyperledger/fabric/tree/master/examples/configtxupdate
 *
 *   This test case also requires two node packages to make it easier to make REST calls to
 *   the 'configtxlator'
 *        superagent
 *        superagent-promise
 */
const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('configinator');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const superagent = require('superagent');
const agent = require('superagent-promise')(require('superagent'), Promise);
const requester = require('request');

const Client = require('fabric-client');
const fs = require('fs');
const path = require('path');

const testUtil = require('../unit/util.js');
const e2eUtils = require('./e2e/e2eUtils.js');


test('\n\n***** configtxlator flow for create and then update  *****\n\n', async (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	const ORGS = Client.getConfigSetting('test-network');

	const channel_name = 'mychannelator';

	//
	// Create and configure the test channel
	//
	const client = new Client();

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	const caroots = Buffer.from(data).toString();

	let config_proto = null;
	let original_config_proto = null;
	let original_config_json = null;
	let updated_config_proto = null;
	let updated_config_json = null;
	let signatures = [];
	let request = null;

	// Acting as a client in org1 when creating the channel
	const org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');
	try {

		const tlsInfo = await e2eUtils.tlsEnroll(org);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		t.pass('Successfully retrieved TLS certificate');
		let store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
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

		await testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
		t.pass('Successfully enrolled user \'admin\' for org1');
		const config_json = fs.readFileSync(path.join(__dirname, '../fixtures/channel/' + channel_name + '.json'));

		const orderer = client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		);

		// the following is an example of how to make the call without a promise
		superagent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate',
			config_json.toString())
			.buffer()
			.end((err, res) => {
				if (err) {
					logger.error(err);
					return;
				}
				config_proto = res.body;
				//logger.info('config_proto %s',config_proto.toString());
			});
		// and here is an example of how to use it with a promise
		const config = await agent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate', config_json.toString())
			.buffer();
		config_proto = config.body;
		t.pass('Successfully built the config create from the json input');

		// sign and collect signature
		signatures.push(client.signChannelConfig(config_proto));
		t.pass('Successfully signed config create by org1');

		// make sure we do not reuse the user
		client._userContext = null;

		await testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign and collect signature
		signatures.push(client.signChannelConfig(config_proto));
		t.pass('Successfully signed config create by org2');

		// make sure we do not reuse the user
		client._userContext = null;

		await testUtil.getOrderAdminSubmitter(client, t);
		t.pass('Successfully enrolled user \'admin\' for orderer (configtxlator 1)');

		// sign the config
		t.pass('Successfully signed config create by orderer');
		// collect signature
		signatures.push(client.signChannelConfig(config_proto));

		// build up the create request
		request = {
			config: config_proto,
			signatures: signatures,
			name: channel_name,
			orderer: orderer,
			txId: client.newTransactionID()
		};

		// this will send the create request to the orderer
		let result = await client.createChannel(request);
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j', result);
		if (result.status && result.status === 'SUCCESS') {
			t.pass('Successfully created the channel.');

			await e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');

			throw 'Failed to create the channel';
		}
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

		const channel = client.newChannel(channel_name);
		channel.addOrderer(orderer);

		const config_envelope = await channel.getChannelConfig();
		t.pass('Successfully read the current channel configuration');
		// we just need the config from the envelope and configtxlator
		// works with bytes
		original_config_proto = config_envelope.config.toBuffer();

		// lets get the config converted into JSON, so we can edit JSON to
		// make our changes
		let response = await agent.post('http://127.0.0.1:7059/protolator/decode/common.Config',
			original_config_proto)
			.buffer();
		t.pass('Successfully decoded the current configuration config proto into JSON');
		original_config_json = response.text.toString();
		logger.info(' original_config_json :: %s', original_config_json);
		// make a copy of the original so we can edit it
		updated_config_json = original_config_json;
		const updated_config = JSON.parse(updated_config_json);
		// now edit the config -- remove one of the organizations
		delete updated_config.channel_group.groups.Application.groups.Org1MSP;
		updated_config_json = JSON.stringify(updated_config);
		logger.info(' updated_config_json :: %s', updated_config_json);

		// lets get the updated JSON encoded
		response = await agent.post('http://127.0.0.1:7059/protolator/encode/common.Config',
			updated_config_json.toString())
			.buffer();
		t.pass('Successfully encoded the updated config from the JSON input');
		updated_config_proto = response.body;

		const formData = {
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

		response = await new Promise((resolve, reject) => {
			requester.post({
				url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
				formData: formData
			}, (err, res, body) => {
				if (err) {
					t.fail('Failed to get the updated configuration ::' + err);
					reject(err);
				} else {
					const proto = Buffer.from(body, 'binary');
					resolve(proto);
				}
			});
		});
		t.pass('Successfully had configtxlator compute the updated config object');
		config_proto = response;

		// will have to now collect the signatures
		signatures = []; //clear out the above
		// make sure we do not reuse the user
		client._userContext = null;

		await testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org1');
		t.pass('Successfully enrolled user \'admin\' for org1');

		// sign and collect signature
		signatures.push(client.signChannelConfig(config_proto));
		t.pass('Successfully signed config update by org1');
		// make sure we do not reuse the user
		client._userContext = null;

		await testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
		t.pass('Successfully enrolled user \'admin\' for org2');

		// sign and collect signature
		signatures.push(client.signChannelConfig(config_proto));
		t.pass('Successfully signed config update by org2');

		// make sure we do not reuse the user
		client._userContext = null;
		await testUtil.getOrderAdminSubmitter(client, t);
		t.pass('Successfully enrolled user \'admin\' for orderer (configtxlator 2)');

		// sign and collect signature
		signatures.push(client.signChannelConfig(config_proto));
		t.pass('Successfully signed config update by orderer');

		// build up the create request
		request = {
			config: config_proto,
			signatures: signatures,
			name: channel_name,
			orderer: orderer,
			txId: client.newTransactionID()
		};

		// this will send the update request to the orderer
		result = await client.updateChannel(request);
		if (result.status && result.status === 'SUCCESS') {
			t.pass('Successfully updated the channel.');

			await e2eUtils.sleep(5000);
		} else {
			t.fail('Failed to update the channel. ');

			throw 'Failed to update the channel';
		}
		t.pass('Successfully waited to make sure new channel was updated.');
		t.end();

	} catch (err) {
		t.fail('Unexpected error ' + err);
		t.end();
	}

});
