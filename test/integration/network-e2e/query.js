/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const {Gateway, FileSystemWallet, X509WalletMixin} = require('../../../fabric-network/index.js');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtils = require('../../unit/util.js');
const channelName = testUtils.NETWORK_END2END.channel;
const chaincodeId = testUtils.NETWORK_END2END.chaincodeId;

test('\n\n***** Network End-to-end flow: execute transaction to get information *****\n\n', async (t) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		// define the identity to use
		const fixtures = process.cwd() + '/test/fixtures';
		const credPath = fixtures + '/channel/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com';
		const cert = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
		const key = fs.readFileSync(credPath + '/keystore/e4af7f90fa89b3e63116da5d278855cfb11e048397261844db89244549918731_sk').toString();
		const identityLabel = 'User1@org1.example.com';

		const fileSystemWallet = new FileSystemWallet(tmpdir);

		// prep wallet and test it at the same time
		await fileSystemWallet.import(identityLabel, X509WalletMixin.createIdentity('Org1MSP', cert, key));
		const exists = await fileSystemWallet.exists(identityLabel);
		t.ok(exists, 'Successfully imported User1@org1.example.com into wallet');
		const tlsInfo = await e2eUtils.tlsEnroll('org1');

		await fileSystemWallet.import('tlsId', X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));

		const ccp = fs.readFileSync(fixtures + '/network.json');
		let ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			wallet: fileSystemWallet,
			identity: identityLabel,
			clientTlsIdentity: 'tlsId'
		});

		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);

		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);

		t.pass('Got the contract, about to execute (query) transaction');


		// try a standard query
		let responseBuffer = await contract.executeTransaction('query', 'a');
		let response = responseBuffer.toString();

		if(response * 1 === parseInt(response)){
			t.pass('Successfully got back a value');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}

		// check we deal with an error returned.
		try {
			response = await contract.executeTransaction('throwError', 'a', 'b','100');
			t.fail('Transaction "throwError" should have thrown an error.  Got response: ' + response.toString());
		} catch(expectedErr) {
			if(expectedErr.message.includes('throwError: an error occurred')) {
				t.pass('Successfully handled invocation errors');
			} else {
				t.fail('Unexpected exception: ' + expectedErr.message);
			}
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		// delete the file system wallet.
		const rimRafPromise = new Promise((resolve) => {
			rimraf(tmpdir, (err) => {
				if (err) {
					//eslint-disable-next-line no-console
					console.log(`failed to delete ${tmpdir}, error was ${err}`);
					resolve();
				}
				resolve();
			});
		});
		await rimRafPromise;
		gateway.disconnect();
	}

	t.end();
});
