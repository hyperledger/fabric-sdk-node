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

const testUtil = require('../../unit/util.js');
const e2eUtils = require('./e2eUtils.js');


const channel_name = process.env.channel ? process.env.channel : 'mychannel';
// can use "channel=<name>" to control the channel name from command line

//
// Attempt to send a request to the orderer with the createChannel method
//
test('\n\n***** SDK Built config update  create flow  *****\n\n', async (t) => {
	testUtil.resetDefaults();
	Client.addConfigFile(path.join(__dirname, './config.json'));
	const ORGS = Client.getConfigSetting('test-network');

	const client = new Client();

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, caRootsPath));
	const caroots = Buffer.from(data).toString();

	const signatures = [];

	// Acting as a client in org1 when creating the channel
	const org = ORGS.org1.name;

	utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

	const tlsInfo = await e2eUtils.tlsEnroll('org1');
	t.pass('Successfully retrieved TLS certificate');
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

	const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
	client.setStateStore(store);
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
	client.setCryptoSuite(cryptoSuite);

	// use the config update created by the configtx tool
	const envelope_bytes = fs.readFileSync(path.join(__dirname, '../../fixtures/channel/mychannel.tx'));
	const config = client.extractChannelConfig(envelope_bytes);
	t.pass('Successfully extracted the config update from the configtx envelope');

	await testUtil.getSubmitter(client, t, true /* get the org admin*/, 'org1');
	t.pass('Successfully enrolled user \'admin\' for org1');

	// sign the config
	let signature = client.signChannelConfig(config);
	// convert signature to a storable string
	// fabric-client SDK will convert back during create
	const string_signature = signature.toBuffer().toString('hex');
	t.pass('Successfully signed config update');

	// collect signature from org1 admin
	signatures.push(string_signature);

	await testUtil.getSubmitter(client, t, true /* get the org admin*/, 'org2');
	t.pass('Successfully enrolled user \'admin\' for org2');

	// sign the config
	signature = client.signChannelConfig(config);
	t.pass('Successfully signed config update');

	// collect signature from org2 admin
	signatures.push(signature);

	await testUtil.getOrderAdminSubmitter(client, t);
	t.pass('Successfully enrolled user \'admin\' for orderer');

	try {
		const orderer_bad = client.newOrderer(
			ORGS.orderer.url,
			{
				name: 'bad orderer',
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname'],
				'grpc.max_send_message_length': 1000 // something too small for the request
			}
		);

		const tx_id = client.newTransactionID();
		const request = {
			config: config,
			signatures: signatures,
			name: channel_name,
			orderer: orderer_bad,
			txId: tx_id
		};

		// send create request to bad orderer
		const result = await client.createChannel(request);
		t.fail('It should fail when creating the channel with a bad max send size');
		logger.debug(' response ::%j', result);
		throw new Error('Failed to get max send error');
	} catch (err) {
		if (err.toString().includes('Sent message larger than max')) {
			t.pass('Successfully failed with max error on the create channel: ' + err.toString());
		} else {
			t.fail('Failed to fail with max error on the create channel: ' + err.stack ? err.stack : err);
			throw new Error('Failed');
		}
	}

	const orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			name: 'new orderer',
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname']
		}
	);
	// let's try to get some info from the orderer
	// Get the system channel config decoded
	const sys_channel = client.newChannel('testchainid');
	sys_channel.addOrderer(orderer);
	await sys_channel.getChannelConfigFromOrderer();
	t.pass('Successfully received the configuration');

	// build up the create request
	const tx_id = client.newTransactionID();
	const request = {
		config: config,
		signatures: signatures,
		name: channel_name,
		orderer: orderer,
		txId: tx_id
	};

	// send create request to orderer
	const result = await client.createChannel(request);

	logger.debug('\n***\n completed the create \n***\n', result);
	t.pass('Successfully created the channel.');
	if (result.status && result.status === 'SUCCESS') {
		await e2eUtils.sleep(5000);
		t.pass('Successfully waited to make sure new channel was created.');
	} else {
		t.fail('Failed to create the channel. ');
		throw new Error('Failed');
	}
	t.end();

});
