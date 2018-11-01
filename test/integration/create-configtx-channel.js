/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E create-channel');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Client = require('fabric-client');
const fs = require('fs');
const path = require('path');

const testUtil = require('../unit/util.js');
const e2eUtils = require('./e2e/e2eUtils.js');

let ORGS;

//
// Attempt to send a request to the orderer with the createChannel method
//
test('\n\n***** Configtx Built config  create flow  *****\n\n', (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	const channel_name = 'mychanneltx';
	Client.setConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', channel_name);

	//
	// Create and configure the test channel
	//
	const client = new Client();

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	const caroots = Buffer.from(data).toString();

	let config = null;
	const signatures = [];
	let request = null;
	let orderer = null;
	let tlsInfo = null;

	// Acting as a client in org1 when creating the channel
	const org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	return e2eUtils.tlsEnroll('org1')
		.then((enrollment) => {
			t.pass('Successfully retrieved TLS certificate');
			tlsInfo = enrollment;
			client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
			return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
		}).then((store) => {
			client.setStateStore(store);

			return testUtil.getSubmitter(client, t, true /* get the org admin*/, 'org1');
		}).then(() => {
			t.pass('Successfully enrolled user \'admin\' for orderer (create-configtx-channel 1)');

			orderer = client.newOrderer(
				ORGS.orderer.url,
				{
					'pem': caroots,
					'ssl-target-name-override': ORGS.orderer['server-hostname']
				}
			);

			logger.info('\n\n***** Get the configtx config update configuration  *****\n\n');
			// use the config update created by the configtx tool
			const envelope_bytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/' + channel_name + '.tx'));
			config = client.extractChannelConfig(envelope_bytes);
			t.pass('Successfull extracted the config update from the configtx envelope');

			// sign the config
			const signature = client.signChannelConfig(config);
			t.pass('Successfully signed config update');
			// collect signature from org1 admin
			signatures.push(signature);

			// make sure we do not reuse the user
			client._userContext = null;
			return testUtil.getSubmitter(client, t, true /* get the org admin*/, 'org2');
		}).then(() => {
			t.pass('Successfully enrolled user \'admin\' for org2');

			// sign the config
			const signature = client.signChannelConfig(config);
			t.pass('Successfully signed config update');

			// collect signature from org2 admin
			signatures.push(signature);

			// make sure we do not reuse the user
			client._userContext = null;
			return testUtil.getOrderAdminSubmitter(client, t);
		}).then(() => {
			t.pass('Successfully enrolled user \'admin\' for orderer (create-configtx-channel 2)');

			// sign the config
			const signature = client.signChannelConfig(config);
			t.pass('Successfully signed config update');

			// collect signature from orderer org admin
			signatures.push(signature);

			logger.debug('\n***\n done signing \n***\n');

			// build up the create request
			const tx_id = client.newTransactionID();
			request = {
				config: config,
				signatures : signatures,
				name : channel_name,
				orderer : orderer,
				txId  : tx_id
			};

			// send to create request to orderer
			return client.createChannel(request);
		})
		.then((result) => {
			logger.debug('\n***\n completed the create \n***\n');

			logger.debug(' response ::%j', result);
			t.pass('Successfully created the channel.');
			if (result.status && result.status === 'SUCCESS') {
				return e2eUtils.sleep(5000);
			} else {
				t.fail('Failed to create the channel. ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to create the channel: ' + err.stack ? err.stack : err);
			t.end();
		})
		.then(() => {
			t.pass('Successfully waited to make sure new channel was created.');

			logger.info('\n\n >>>>>>  Should fail to create the existing channel again with name :: %s <<<<<<< \n\n', channel_name);
			return client.createChannel(request);
		}, (err) => {
			t.fail('Failed to sleep due to error: ' + err.stack ? err.stack : err);
			t.end();
		})
		.then((result) => {
			logger.debug(' response ::%j', result);
			if (result && result.status && result.status.toString().indexOf('BAD_REQUEST') >= 0) {
				t.pass('Successfully received the error message due to the conflict of channel: ' + result.info);
			} else {
				t.fail('Failed to get error. response: ' + result.status);
			}
			t.end();
		}, (err) => {
			t.fail('Got unexpected error: ' + err.stack ? err.stack : err);
			t.end();
		});
});
