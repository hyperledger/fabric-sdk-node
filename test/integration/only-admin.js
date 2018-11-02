/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('ONLY-ADMIN');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const fs = require('fs');
const path = require('path');

const testUtil = require('../unit/util.js');

// Testing will demostrate how the connetion profile configuration may hold a
// admin user identity and it will be used for all fabric interactions.
// However since the network is using mutual TLS, the TLS connection will get
// valid certificates from the CertificateAuthority as a testing convenience.
// The CertificateAuthority will not be used to get the required signing certificates
// for the fabric requests.
//
// Testing will also demostrate how to read and set the admin identity manually
// Only one call will be made with this, however if the identity has access, all
// the calls made by connection profile demonstration may also be made.
test('\n\n***** use only admin identity  *****\n\n', async (t) => {
	const channel_name = 'adminconfig';

	const client_org1 = await testUtil.getClientForOrg(t, 'org1');
	const client_org2 = await testUtil.getClientForOrg(t, 'org2');

	client_org2.setConfigSetting('initialize-with-discovery', false);
	const channel = await testUtil.setupChannel(t, client_org1, client_org2, channel_name);
	channel._endorsement_handler = null;
	const tx_id_string = await testUtil.invokeAsAdmin(t, client_org1, channel);
	await testUtil.queryChannelAsAdmin(t, client_org1, channel, tx_id_string, 'peer0.org1.example.com', 'example');
	await testUtil.queryClientAsAdmin(t, client_org1, channel, 'peer0.org1.example.com');
	await manually(t, client_org1);

	t.end();
});

async function manually(t, client) {
	try {
		let data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/keystore/ef8e88d28a86f23466ad378003d819561adbedc77fe90cc250424ce4de179a3c_sk'));
		const key = data;
		const keyPem = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/signcerts/Admin@example.com-cert.pem'));
		const cert = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
		const pem = Buffer.from(data).toString();
		t.pass('Successfully read all crypto material');

		client.setAdminSigningIdentity(key, cert, 'OrdererMSP');
		t.pass('Successfully set the client with admin signing identity');

		const sys_channel = client.newChannel('testchainid');

		const options = {
			pem: pem,
			'ssl-target-name-override': 'orderer.example.com'
		};

		// this is to allow mutual TLS on the orderer by adding client TLS
		// information into the options object used to create the orderer
		client.addTlsClientCertAndKey(options);

		const orderer = client.newOrderer(
			'grpcs://localhost:7050',
			options
		);

		sys_channel.addOrderer(orderer);
		t.pass('Successfully added orderer to channel');

		await sys_channel.getChannelConfigFromOrderer();
		t.pass('Successfully got the config envelope by using the admin identity');

		client._adminSigningIdentity = null; // remove the admin assigned above
		client._userContext = null;

		// this will create the user and also assign it to client instance
		// as a userContext
		const user = await client.createUser({
			username: 'ordererAdmin',
			mspid: 'OrdererMSP',
			cryptoContent: {privateKeyPEM: keyPem, signedCertPEM: cert}
		});
		t.equals(user.getName(), 'ordererAdmin', 'Checking that the user was created');
		t.equals(client._userContext.getName(), 'ordererAdmin', 'Checking that the user was set');

		await sys_channel.getChannelConfigFromOrderer();
		t.pass('Successfully got the config envelope by user the user context');

	} catch (error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with ' + error);
	}

	return true;
}
