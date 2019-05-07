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
import util = require('util');

import {
	Contract,
	DefaultQueryHandlerStrategies,
	FileSystemWallet,
	Gateway,
	TransientMap,
	Wallet,
	X509WalletMixin,
} from 'fabric-network';

import sampleQueryStrategy = require('./sample-query-handler');

import e2eUtils = require('../../../integration/e2e/e2eUtils.js');
import testUtils = require('../../../unit/util.js');

const test: any = tapePromise.default(tape);
const channelName: string = testUtils.NETWORK_END2END.channel;
const chaincodeId: string = testUtils.NETWORK_END2END.chaincodeId;

const fixtures = process.cwd() + '/test/fixtures';
const identityLabel = 'User1@org1.example.com';
const tlsLabel = 'tlsId';

async function createWallet(t: any, filePath: string): Promise<Wallet> {
	// define the identity to use
	const credPath = fixtures + '/crypto-material/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp';
	const cert = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
	const key = fs.readFileSync(credPath + '/keystore/key.pem').toString();

	const fileSystemWallet = new FileSystemWallet(filePath);

	// prep wallet and test it at the same time
	await fileSystemWallet.import(identityLabel, X509WalletMixin.createIdentity('Org1MSP', cert, key));
	const exists = await fileSystemWallet.exists(identityLabel);
	t.ok(exists, 'Successfully imported User1@org1.example.com into wallet');
	const tlsInfo = await e2eUtils.tlsEnroll('org1');

	await fileSystemWallet.import(tlsLabel, X509WalletMixin.createIdentity('org1', tlsInfo.certificate, tlsInfo.key));

	return fileSystemWallet;
}

async function deleteWallet(filePath: string): Promise<void> {
	const rimRafPromise = new Promise((resolve) => {
		rimraf(filePath, (err: Error) => {
			if (err) {
				console.log(`failed to delete ${filePath}, error was ${err}`); // tslint:disable-line:no-console
				resolve();
			}
			resolve();
		});
	});
	await rimRafPromise;
}

async function testSuccessfulQuery(t: any, contract: Contract): Promise<void> {
	t.comment('Testing successful query');

	const response = await contract.evaluateTransaction('query', 'a');

	if (!isNaN(parseInt(response.toString(), 10))) {
		t.pass('Successfully got back a value');
	} else {
		t.fail('Unexpected response from transaction chaincode: ' + response);
	}
}

async function testQueryErrorResponse(t: any, contract: Contract): Promise<void> {
	t.comment('Testing query error response');

	const errorMessage = 'QUERY_ERROR_RESPONSE_MESSAGE';
	try {
		const response = await contract.evaluateTransaction('returnError', errorMessage);
		t.fail('Transaction "returnError" should have thrown an error. Got response: ' + response.toString());
	} catch (expectedErr) {
		if (expectedErr.isProposalResponse && expectedErr.message.includes(errorMessage)) {
			t.pass('Successfully handled query error response');
		} else {
			t.fail(util.format('Unexpected exception: %O', expectedErr));
		}
	}
}

async function testChaincodeRuntimeError(t: any, contract: Contract): Promise<void> {
	// No-op for now since chaincode runtime errors are not distinguishable from error responses and introduce a
	// significant delay while the chaincode container times out waiting for the chaincide to supply a response

	// t.comment('Testing chaincode runtime error');

	// const errorMessage = 'QUERY_ERROR_THROWN_MESSAGE';
	// try {
	// 	const response = await contract.evaluateTransaction('throwError', errorMessage);
	// 	t.fail('Transaction "throwError" should have thrown an error. Got response: ' + response.toString());
	// } catch (expectedErr) {
	// 	if (expectedErr.isProposalResponse) {
	// 		t.pass('Successfully handled chaincode runtime error');
	// 	} else {
	// 		t.fail(util.format('Unexpected exception: %O', expectedErr));
	// 	}
	// }
}

test('\n\n***** Network End-to-end flow: evaluate transaction with default query handler *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, ' + chaincodeId);

		await testSuccessfulQuery(t, contract);
		await testQueryErrorResponse(t, contract);
		await testChaincodeRuntimeError(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: evaluate transaction with MSPID_SCOPE_ROUND_ROBIN query handler *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			queryHandlerOptions: {
				strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_ROUND_ROBIN,
			},
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, ' + chaincodeId);

		await testSuccessfulQuery(t, contract);
		await testQueryErrorResponse(t, contract);
		await testChaincodeRuntimeError(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: evaluate transaction with MSPID_SCOPE_SINGLE query handler *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			queryHandlerOptions: {
				strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE,
			},
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, ' + chaincodeId);

		await testSuccessfulQuery(t, contract);
		await testQueryErrorResponse(t, contract);
		await testChaincodeRuntimeError(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: evaluate transaction with sample query handler *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			queryHandlerOptions: {
				strategy: sampleQueryStrategy,
			},
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, ' + chaincodeId);

		await testSuccessfulQuery(t, contract);
		await testQueryErrorResponse(t, contract);
		await testChaincodeRuntimeError(t, contract);
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: evaluate transaction with transient data *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, about to evaluate (query) transaction');

		const transaction = contract.createTransaction('getTransient');
		const transientMap: TransientMap = {
			key1: Buffer.from('value1'),
			key2: Buffer.from('value2'),
		};
		const response = await transaction.setTransient(transientMap).evaluate();

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
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});

test('\n\n***** Network End-to-end flow: evaluate transaction with empty string result *****\n\n', async (t: any) => {
	const tmpdir = path.join(os.tmpdir(), 'integration-network-test988');
	const gateway = new Gateway();

	try {
		const wallet = await createWallet(t, tmpdir);
		const ccp: Buffer = fs.readFileSync(fixtures + '/network.json');
		const ccpObject = JSON.parse(ccp.toString());

		await gateway.connect(ccpObject, {
			clientTlsIdentity: tlsLabel,
			discovery: {
				enabled: false,
			},
			identity: identityLabel,
			wallet,
		});
		t.pass('Connected to the gateway');

		const channel = await gateway.getNetwork(channelName);
		t.pass('Initialized the channel, ' + channelName);

		const contract = await channel.getContract(chaincodeId);
		t.pass('Got the contract, about to evaluate (query) transaction');

		const response = await contract.evaluateTransaction('echo', '');

		if (response && response.toString('utf8') === '') {
			t.pass('Got expected transaction response');
		} else {
			t.fail('Unexpected transaction response: ' + response);
		}
	} catch (err) {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
	} finally {
		await deleteWallet(tmpdir);
		gateway.disconnect();
	}

	t.end();
});
