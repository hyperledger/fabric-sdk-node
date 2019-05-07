/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

import fs = require('fs-extra');
import os = require('os');
import path = require('path');
import rimraf = require('rimraf');
import tape = require('tape');
import tapePromise = require('tape-promise');

import {
	Contract,
	CouchDBWallet,
	DefaultEventHandlerStrategies,
	FileSystemWallet,
	Gateway,
	GatewayOptions,
	InMemoryWallet,
	Transaction,
	TransientMap,
	Wallet,
	X509WalletMixin,
} from 'fabric-network';

import {
	ChannelEventHub,
	RegistrationOpts,
} from 'fabric-client';

import e2eUtils = require('../../../integration/e2e/e2eUtils.js');
import sampleEventStrategy = require('../../../integration/network-e2e/sample-transaction-event-handler');
import testUtils = require('../../../unit/util');

const test: any = tapePromise.default(tape);
const channelName: string = testUtils.NETWORK_END2END.channel;
const chaincodeId: string = testUtils.NETWORK_END2END.chaincodeId;

const fixtures = process.cwd() + '/test/fixtures';
const credPath = fixtures + '/crypto-material/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp';
const certificatePem: string = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
const privateKeyPem: string = fs.readFileSync(credPath + '/keystore/key.pem').toString();
const inMemoryWallet: Wallet = new InMemoryWallet();
const ccp: Buffer = fs.readFileSync(fixtures + '/profiles/network.json');
const ccpDiscovery: Buffer = fs.readFileSync(fixtures + '/profiles/network-discovery.json');

const expectedMoveResult = 'move succeed';

async function inMemoryIdentitySetup(): Promise<void> {
	await inMemoryWallet.import('User1@org1.example.com', X509WalletMixin.createIdentity('Org1MSP', certificatePem, privateKeyPem));
}

async function tlsSetup(): Promise<void> {
	const tlsInfo = await e2eUtils.tlsEnroll('org1');
	await inMemoryWallet.import('tlsId', X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));
}

async function createContract(t: any, gateway: Gateway, gatewayOptions: GatewayOptions): Promise<Contract> {
	const useDiscovery = !(gatewayOptions.discovery && gatewayOptions.discovery.enabled === false);
	const profile = useDiscovery ? ccpDiscovery : ccp;
	await gateway.connect(JSON.parse(profile.toString()), gatewayOptions);
	t.pass('Connected to the gateway');

	const network = await gateway.getNetwork(channelName);
	t.pass('Initialized the network, ' + channelName);

	const contract = network.getContract(chaincodeId);
	t.pass('Got the contract');

	return contract;
}

async function getInternalEventHubForOrg(gateway: Gateway, orgMSP: string): Promise<ChannelEventHub> {
	const network = await gateway.getNetwork(channelName);
	const channel = network.getChannel();
	const orgPeer = channel.getPeersForOrg(orgMSP)[0]; // Only one peer per org in the test configuration

	// Using private functions to get hold of an internal event hub. Don't try this at home, kids!
	const eventHubManager = (network as any).getEventHubManager();
	return eventHubManager.getEventHub(orgPeer);
}

async function testErrorResponse(t: any, contract: Contract): Promise<void> {
	const errorMessage = 'TRANSACTION_ERROR_RESPONSE_MESSAGE';

	try {
		const response = await contract.submitTransaction('returnError', errorMessage);
		t.fail('Transaction "returnError" should have thrown an error.  Got response: ' + response.toString());
	} catch (expectedErr) {
		if (expectedErr.message.includes(errorMessage)) {
			t.pass('Successfully handled invocation errors');
		} else {
			t.fail('Unexpected exception: ' + expectedErr);
		}
	}
}

test('\n\n***** Network End-to-end flow: import identity into wallet and configure tls *****\n\n', async (t: any) => {
	try {
		await inMemoryIdentitySetup();
		await tlsSetup();
		const exists = await inMemoryWallet.exists('User1@org1.example.com');
		if (exists) {
			t.pass('Successfully imported User1@org1.example.com into wallet');
		} else {
			t.fail('Failed to import User1@org1.example.com into wallet');
		}
	} catch (err) {
		t.fail('Failed to import identity into wallet and configure tls. ' + err.stack ? err.stack : err);
	}
	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and default event strategy with discovery *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let eventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				eventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		t.true(org1EventHub.isconnected(), 'org1 event hub correctly connected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke multiple transactions to move money using in memory wallet and default event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				asLocalhost: true, // Redundant since discovery is disabled but ensures TS definitions are correct
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transactions: Transaction[] = [];
		const transactionIds: string[] = [];
		for (let i = 0; i < 3; i++) {
			const transaction = contract.createTransaction('move');
			transactions.push(transaction);
			transactionIds.push(transaction.getTransactionID().getTransactionID());
		}

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let eventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && transactionIds.includes(txId)) {
				eventFired++;
			}
		}, () => {
			// Ignore errors
		});

		let response = await transactions[0].submit('a', 'b', '100');

		t.true(org1EventHub.isconnected(), 'org1 event hub correctly connected');
		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked first transaction chaincode on channel');
		} else {
			t.fail('Unexpected response first from transaction chaincode: ' + response);
		}

		// second transaction for same connection
		response = await transactions[1].submit('a', 'b', '50');

		t.equal(eventFired, 2, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked second transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from second transaction chaincode: ' + response);
		}

		// third transaction for same connection
		response = await transactions[2].submit('a', 'b', '25');

		t.equal(eventFired, 3, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked third transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from third transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ALLFORTX event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let eventFired = 0;

		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				eventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and MSPID_SCOPE_ANYFORTX event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		const org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let eventFired = 0;

		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				eventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		t.false(org2EventHub.isconnected(), 'org2 event hub correctly not connected');
		t.equal(eventFired, 1, 'single event for org1 correctly unblocked submitTransaction');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ALLFORTX event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;
	let org2EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let org1EventFired = 0;
		let org2EventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org1EventFired++;
			}
		}, () => {
			// Ignore errors
		});
		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org2EventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		const unblockCorrectly = (org1EventFired === 1) && (org2EventFired === 1);
		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'got single events at both org event hubs before submitTransaction was unblocked');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub && org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ALLFORTX event strategy with discovery *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;
	let org2EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let org1EventFired = 0;
		let org2EventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org1EventFired++;
			}
		}, () => {
			// Ignore errors
		});
		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org2EventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		const unblockCorrectly = (org1EventFired === 1) && (org2EventFired === 1);
		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'got single events at both org event hubs before submitTransaction was unblocked');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub && org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ANYFORTX event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;
	let org2EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let org1EventFired = 0;
		let org2EventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org1EventFired++;
			}
		}, () => {
			// Ignore errors
		});

		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org2EventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		const unblockCorrectly = (org1EventFired === 1 && org2EventFired === 0) ||
			(org1EventFired === 0 && org2EventFired === 1);

		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'single event received by one of the event hubs caused submitTransaction to unblock, before other event received');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub && org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and NETWORK_SCOPE_ANYFORTX event strategy with discovery *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	let org1EventHub: ChannelEventHub | undefined;
	let org2EventHub: ChannelEventHub | undefined;

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			eventHandlerOptions: {
				strategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('move');
		const transactionId = transaction.getTransactionID().getTransactionID();

		// Obtain an event hub that that will be used by the underlying implementation
		org1EventHub = await getInternalEventHubForOrg(gateway, 'Org1MSP');
		org2EventHub = await getInternalEventHubForOrg(gateway, 'Org2MSP');

		let org1EventFired = 0;
		let org2EventFired = 0;
		org1EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org1EventFired++;
			}
		}, () => {
			// Ignore errors
		});
		org2EventHub.registerTxEvent('all', (txId, code) => {
			if (code === 'VALID' && txId === transactionId) {
				org2EventFired++;
			}
		}, () => {
			// Ignore errors
		});

		const response = await transaction.submit('a', 'b', '100');

		const unblockCorrectly = (org1EventFired === 1 && org2EventFired === 0) ||
			(org1EventFired === 0 && org2EventFired === 1);

		t.pass(`org1 events: ${org1EventFired}, org2 events: ${org2EventFired}`);
		t.true(unblockCorrectly, 'single event received by one of the event hubs caused submitTransaction to unblock, before other event received');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
		t.false(org1EventHub && org1EventHub.isconnected(), 'org1 event hub correctly been disconnected');
		t.false(org2EventHub && org2EventHub.isconnected(), 'org2 event hub correctly been disconnected');
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and plug-in event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: sampleEventStrategy,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction with transient data *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const transaction = contract.createTransaction('getTransient');
		const transientMap: TransientMap = {
			key1: Buffer.from('value1'),
			key2: Buffer.from('value2'),
		};
		const response = await transaction.setTransient(transientMap).submit();
		t.pass('Got response: ' + response.toString('utf8'));
		const result = JSON.parse(response.toString('utf8'));

		let success = true;

		if (Object.keys(transientMap).length !== Object.keys(result).length) {
			success = false;
		}

		Object.entries(transientMap).forEach((entry) => {
			const key = entry[0];
			const value = entry[1].toString();
			if (value !== result[key]) {
				t.fail(`Expected ${key} to be ${value} but was ${result[key]}`);
				success = false;
			}
		});

		if (success) {
			t.pass('Got expected transaction response');
		} else {
			t.fail('Unexpected transaction response: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction with empty string response *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const response = await contract.submitTransaction('echo', '');

		if (response && response.toString('utf8') === '') {
			t.pass('Got expected transaction response');
		} else {
			t.fail('Unexpected transaction response: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction while channel\'s event hub is replaying blocks *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const network = await gateway.getNetwork(channelName);
		const channel = network.getChannel();
		const peer = channel.getPeersForOrg('Org1MSP')[0];
		const eventHub = channel.getChannelEventHub(peer.getName());

		let eventsReceived = 0;
		let errorsReceived = 0;

		function onEvent(txId: string, code: string, blockNumber: number) {
			eventsReceived++;
		}
		function onError(error: Error) {
			errorsReceived++;
		}
		// Trigger replay of previous blocks, which will prevent any other listeners registering with this event hub
		const registrationOptions: RegistrationOpts = {
			disconnect: false,
			startBlock: 0,
			unregister: false,
		};
		eventHub.registerTxEvent('all', onEvent, onError, registrationOptions);
		eventHub.connect();

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		t.true(eventsReceived > 0, `Received replay events (eventsReceived = ${eventsReceived})`);
		t.false(errorsReceived > 0, `No replay errors (errorsReceived = ${errorsReceived})`);

		if (response.toString() === expectedMoveResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: handle transaction error *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		await testErrorResponse(t, contract);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in file system wallet *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test987');
	const gateway = new Gateway();

	try {
		// define the identity to use
		const identityLabel = 'User1@org1.example.com';

		const fileSystemWallet: Wallet = new FileSystemWallet(tmpdir);

		// prep wallet and test it at the same time
		await fileSystemWallet.import(identityLabel, X509WalletMixin.createIdentity('Org1MSP', certificatePem, privateKeyPem));
		const exists = await fileSystemWallet.exists(identityLabel);
		t.ok(exists, 'Successfully imported User1@org1.example.com into wallet');
		const tlsInfo = await e2eUtils.tlsEnroll('org1');

		await fileSystemWallet.import('tlsId', X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));

		await gateway.connect(JSON.parse(ccp.toString()), {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			wallet: fileSystemWallet,
		});
		t.pass('Connected to the gateway');

		const network = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await network.getContract(chaincodeId);
		t.pass('Got the contract, about to submit "move" transaction');

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		const expectedResult = 'move succeed';
		if (response.toString() === expectedResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}

		await testErrorResponse(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		// delete the file system wallet.
		const rimRafPromise: Promise<void> = new Promise((resolve) => {
			rimraf(tmpdir, (err: Error) => {
				if (err) {
					console.log(`failed to delete ${tmpdir}, error was ${err}`); // tslint:disable-line:no-console
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

test('\n\n***** Network End-to-end flow: invoke transaction to move money using CouchDB wallet *****\n\n', async (t: any) => {
	const gateway = new Gateway();
	try {
		const identityLabel = 'user1-org1_example_com';
		const couchDBWallet = new CouchDBWallet({url: 'http://localhost:5984'});
		await couchDBWallet.import(identityLabel, X509WalletMixin.createIdentity('Org1MSP', certificatePem, privateKeyPem));
		const exists = await couchDBWallet.exists(identityLabel);
		t.ok(exists, 'Successfully imported User1@org1.example.com into wallet');

		const tlsInfo = await e2eUtils.tlsEnroll('org1');
		await couchDBWallet.import('tls_id', X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));

		await gateway.connect(JSON.parse(ccp.toString()), {
			clientTlsIdentity: 'tls_id',
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			wallet: couchDBWallet,
		});
		t.pass('Connected to the gateway');

		const network = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await network.getContract(chaincodeId);
		t.pass('Got the contract, about to submit "move" transaction');

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		const expectedResult = 'move succeed';
		if (response.toString() === expectedResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}

		await testErrorResponse(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}
});

test('\n\n***** Network End-to-end flow: invoke multiple transactions concurrently *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const expected = 'RESULT';
		const promises: Array<Promise<Buffer>> = [];
		for (let i = 0; i < 10; i++) {
			promises.push(contract.submitTransaction('echo', expected));
		}
		const results = await Promise.all(promises);
		const resultStrings = results.map((buffer) => buffer.toString('utf8'));

		const badResults = resultStrings.filter((value) => value !== expected);
		if (badResults.length > 0) {
			t.fail('Got bad results: ' + badResults.join(', '));
		} else {
			t.pass('Got expected results from all transactions');
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: invoke transaction to move money using in memory wallet and no event strategy *****\n\n', async (t: any) => {
	const gateway = new Gateway();

	try {
		const contract = await createContract(t, gateway, {
			clientTlsIdentity: 'tlsId',
			discovery: {
				enabled: false,
			},
			eventHandlerOptions: {
				strategy: null,
			},
			identity: 'User1@org1.example.com',
			wallet: inMemoryWallet,
		});

		const response = await contract.submitTransaction('move', 'a', 'b', '100');

		const expectedResult = 'move succeed';
		if (response.toString() === expectedResult) {
			t.pass('Successfully invoked transaction chaincode on channel');
		} else {
			t.fail('Unexpected response from transaction chaincode: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		gateway.disconnect();
	}

	t.end();
});
