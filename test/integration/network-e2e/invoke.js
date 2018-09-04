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
const {Gateway, InMemoryWallet, FileSystemWallet, X509WalletMixin, EventStrategies} = require('../../../fabric-network/index.js');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');

const e2eUtils = require('../e2e/e2eUtils.js');
const testUtils = require('../../unit/util');
const channelName = testUtils.NETWORK_END2END.channel;
const chaincodeId = testUtils.NETWORK_END2END.chaincodeId;


const fixtures = process.cwd() + '/test/fixtures';
const credPath = fixtures + '/channel/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com';
const cert = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
const key = fs.readFileSync(credPath + '/keystore/e4af7f90fa89b3e63116da5d278855cfb11e048397261844db89244549918731_sk').toString();
const inMemoryWallet = new InMemoryWallet();
const ccp = fs.readFileSync(fixtures + '/network.json');

async function inMemoryIdentitySetup() {
	await inMemoryWallet.import('User1@org1.example.com', X509WalletMixin.createIdentity('Org1MSP', cert, key));
}

async function tlsSetup() {
	const tlsInfo = await e2eUtils.tlsEnroll('org1');
	await inMemoryWallet.import('tlsId', X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));
}

async function createContract(t, gatewayOptions) {
	const gateway = new Gateway();
	await gateway.initialize(JSON.parse(ccp.toString()), gatewayOptions);
	t.pass('Initialized the gateway');

	const network = await gateway.getNetwork(channelName);
	t.pass('Initialized the network, ' + channelName);

	const contract = await network.getContract(chaincodeId);
	t.pass('Got the contract, about to submit "move" transaction');

	return contract;
}

test('\n\n***** Network End-to-end flow: import identity into wallet *****\n\n', async (t) => {
	await inMemoryIdentitySetup();
	const exists = await inMemoryWallet.exists('User1@org1.example.com');
	if(exists) {
		t.pass('Successfully imported User1@org1.example.com into wallet');
	} else {
		t.fail('Failed to import User1@org1.example.com into wallet');
	}
	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and default event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId'
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ALLFORTX event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventStrategy: EventStrategies.MSPID_SCOPE_ALLFORTX
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ANYFORTX event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventStrategy: EventStrategies.MSPID_SCOPE_ANYFORTX
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ALLFORTX event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventStrategy: EventStrategies.NETWORK_SCOPE_ALLFORTX
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ANYFORTX event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventStrategy: EventStrategies.NETWORK_SCOPE_ANYFORTX
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: handle transaction error *****\n\n', async (t) => {
	await inMemoryIdentitySetup();
	await tlsSetup();

	const contract = await createContract(t, {
		wallet: inMemoryWallet,
		identity: 'User1@org1.example.com',
		clientTlsIdentity: 'tlsId'
	});

	try {
		const response = await contract.submitTransaction('throwError', 'a', 'b','100');
		t.fail('Transaction "throwError" should have thrown an error.  Got response: ' + response.toString());
	} catch(expectedErr) {
		if(expectedErr.message.includes('throwError: an error occurred')) {
			t.pass('Successfully handled invocation errors');
		} else {
			t.fail('Unexpected exception: ' + expectedErr.message);
		}
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in file system wallet *****\n\n', async (t) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test987');

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



		const gateway = new Gateway();

		const ccp = fs.readFileSync(fixtures + '/network.json');
		await gateway.initialize(JSON.parse(ccp.toString()), {
			wallet: fileSystemWallet,
			identity: identityLabel,
			clientTlsIdentity: 'tlsId'
		});

		t.pass('Initialized the gateway');

		const network = await gateway.getNetwork(channelName);

		t.pass('Initialized the channel, ' + channelName);

		const contract = await network.getContract(chaincodeId);

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
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and no event strategy *****\n\n', async (t) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventStrategy: null
		});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	}

	t.end();
});
