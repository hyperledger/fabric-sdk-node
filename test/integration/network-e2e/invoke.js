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
const {Network, InMemoryWallet, X509WalletMixin} = require('../../../fabric-network/index.js');
const fs = require('fs');

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtils = require('../../unit/util');
const channelName = testUtils.NETWORK_END2END.channel;
const chaincodeId = testUtils.NETWORK_END2END.chaincodeId;

test('\n\n***** Network End-to-end flow: invoke transaction to move money *****\n\n', async (t) => {
	try {
		const fixtures = process.cwd() + '/test/fixtures';
		const credPath = fixtures + '/channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls';
		const cert = fs.readFileSync(credPath + '/cert.pem').toString();
		const key = fs.readFileSync(credPath + '/key.pem').toString();
		const inMemoryWallet = new InMemoryWallet();
		await inMemoryWallet.import('admin', X509WalletMixin.createIdentity('Org1MSP', cert, key));
		const exists = await inMemoryWallet.exists('admin');

		if(exists) {
			t.pass('Successfully imported admin into wallet');
		} else {
			t.fail('Failed to import admin into wallet');
		}

		const network = new Network();

		const ccp = fs.readFileSync(fixtures + '/network.json');
		await network.initialize(JSON.parse(ccp.toString()), {
			wallet: inMemoryWallet,
			identity: 'admin'
		});

		const tlsInfo = await e2eUtils.tlsEnroll('org1');
		network.getClient().setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

		t.pass('Initialized the network');

		const channel = await network.getChannel(channelName);

		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);

		t.pass('Got the contract, about to submit "move" transaction');

		let response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}

		try {
			response = await contract.submitTransaction('throwError', 'a', 'b','100');
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
	}

	t.end();
});
