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
const {Gateway, InMemoryWallet, FileSystemWallet, X509WalletMixin, DefaultEventHandlerStrategies} = require('../../../fabric-network/index.js');
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

async function createContract(t, gateway, gatewayOptions) {
	await gateway.connect(JSON.parse(ccp.toString()), gatewayOptions);
	t.pass('Connected to the gateway');

	const network = await gateway.getNetwork(channelName);
	t.pass('Initialized the network, ' + channelName);

	const contract = network.getContract(chaincodeId);
	t.pass('Got the contract, about to submit "move" transaction');

	return contract;
}

const getEventHubForOrg = async (gateway, orgMSP) => {
	// bit horrible until we provide a proper api to get the underlying event hubs
	const network = await gateway.getNetwork(channelName);
	const orgpeer = network.getPeerMap().get(orgMSP)[0];
	return network.getChannel().getChannelEventHub(orgpeer.getName());
};

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
	const gateway = new Gateway();
	let org1EventHub;

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();


		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId'
		});

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let eventFired = 0;

		// have to register for all transaction events (a new feature in 1.3) as
		// there is no way to know what the initial transaction id is
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				eventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		t.true(org1EventHub.isconnected(), 'org1 event hub correctly connected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}


	t.end();
});

test('\n\n***** Network End-to-end flow: invoke multiple transactions to move money using in memory wallet and default event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();


		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId'
		});

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let eventFired = 0;

		// have to register for all transaction events (a new feature in 1.3) as
		// there is no way to know what the initial transaction id is
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				eventFired++;
			}
		}, () => {});

		let response = await contract.submitTransaction('move', 'a', 'b','100');

		t.true(org1EventHub.isconnected(), 'org1 event hub correctly connected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked first transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response first from transaction chaincode: ' + response);
		}

		// second transaction for same connection
		response = await contract.submitTransaction('move', 'a', 'b','50');

		t.equal(eventFired, 2, 'single event for org1 correctly unblocked submitTransaction');

		if(response.toString() === expectedResult){
			t.pass('Successfully invoked second transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from second transaction chaincode: ' + response);
		}

		// third transaction for same connection
		response = await contract.submitTransaction('move', 'a', 'b','25');

		t.equal(eventFired, 3, 'single event for org1 correctly unblocked submitTransaction');

		if(response.toString() === expectedResult){
			t.pass('Successfully invoked third transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from third transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}


	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ALLFORTX event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX
			}
		});

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let eventFired = 0;

		// have to register for all transaction events (a new feature in 1.3) as
		// there is no way to know what the initial transaction id is
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				eventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');
		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ANYFORTX event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX
			}
		});

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');


		// initialize eventFired to 0
		let eventFired = 0;
		// have to register for all transaction events (a new feature in 1.3) as
		// there is no way to know what the initial transaction id is
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				eventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');
		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ALLFORTX event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;
	let org2EventHub;

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX
			}
		});

		// Obtain the event hubs that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let org1EventFired = 0;
		let org2EventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				org1EventFired++;
			}
		}, () => {});

		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				org2EventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const unblockCorrectly = (org1EventFired === 1) && (org2EventFired === 1);
		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'got single events at both org event hubs before submitTransaction was unblocked');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ANYFORTX event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();
	let org1EventHub;
	let org2EventHub;

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX
			}
		});

		// Obtain the event hubs that that will be used by the underlying implementation
		org1EventHub = await getEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');

		// initialize eventFired to 0
		let org1EventFired = 0;
		let org2EventFired = 0;

		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				org1EventFired++;
			}
		}, () => {});

		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID') {
				org2EventFired++;
			}
		}, () => {});

		const response = await contract.submitTransaction('move', 'a', 'b','100');

		const unblockCorrectly = (org1EventFired === 1 && org2EventFired === 0)
								|| (org1EventFired === 0 && org2EventFired === 1)
								// || (org1EventFired === 1 && org2EventFired === 1) hopefully this doesn't have to be included due to timing
								;

		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'single event received by one of the event hubs caused submitTransaction to unblock, before other event received');

		const expectedResult = 'move succeed';
		if(response.toString() === expectedResult){
			t.pass('Successfully invoked transaction chaincode on channel');
		}
		else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch(err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		// remove the disconnects once gateway disconnect cleans up event hubs
		gateway.disconnect();
		t.false(org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: handle transaction error *****\n\n', async (t) => {
	const gateway = new Gateway();

	await inMemoryIdentitySetup();
	await tlsSetup();

	const contract = await createContract(t, gateway, {
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
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in file system wallet *****\n\n', async (t) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test987');
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
		await gateway.connect(JSON.parse(ccp.toString()), {
			wallet: fileSystemWallet,
			identity: identityLabel,
			clientTlsIdentity: 'tlsId'
		});

		t.pass('Connected to the gateway');

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
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and no event strategy *****\n\n', async (t) => {
	const gateway = new Gateway();

	try {
		await inMemoryIdentitySetup();
		await tlsSetup();

		const contract = await createContract(t, gateway, {
			wallet: inMemoryWallet,
			identity: 'User1@org1.example.com',
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: null
			}
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
	} finally {
		gateway.disconnect();
	}

	t.end();
});
