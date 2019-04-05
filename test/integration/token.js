/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This includes end-to-end tests for the fabtoken feature, both positive and negative.
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const utils = require('fabric-client/lib/utils.js');
const tokenUtils = require('fabric-client/lib/token-utils.js');
const logger = utils.getLogger('E2E token');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const testUtil = require('../unit/util.js');
const e2eUtils = require('./e2e/e2eUtils.js');

// The channel for token e2e tests which should be created and joined in setup tests
const channel_name = process.env.channel ? process.env.channel : 'tokenchannel';
const channel_path = path.join(__dirname, '../fixtures/crypto-material/config-v2', channel_name + '.tx');

// This setup test creates and joins the "tokenchannel"
test('\n\n***** setup: create and join the token channel  *****\n\n', async (t) => {
	// this will use the connection profile to set up the client
	const client_org1 = await testUtil.getClientForOrg(t, 'org1');
	const client_org2 = await testUtil.getClientForOrg(t, 'org2');

	client_org1.setConfigSetting('initialize-with-discovery', true);

	// create channel
	try {
		await createChannel(t, channel_path, channel_name, client_org1, client_org2); // create the channel
		t.pass('***** Token channel has been created *****');
	} catch (error) {
		t.fail('Failed to create the token channel');
	}

	// create the peer and orderer objects for the network (must match docker compose yaml)
	let data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/tlscacerts/tlsca.org1.example.com-cert.pem'));
	let pem = Buffer.from(data).toString();
	const peer_org1 = client_org1.newPeer('grpcs://localhost:7051', {pem: pem, 'ssl-target-name-override': 'peer0.org1.example.com', name: 'peer0.org1.example.com'});

	data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/crypto-material/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp/tlscacerts/tlsca.org2.example.com-cert.pem'));
	pem = Buffer.from(data).toString();
	const peer_org2 = client_org2.newPeer('grpcs://localhost:8051', {pem: pem, 'ssl-target-name-override': 'peer0.org2.example.com', name: 'peer0.org2.example.com'});

	data = fs.readFileSync(path.join(__dirname, 'e2e', '../../fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'));
	pem = Buffer.from(data).toString();
	const orderer_org1 = client_org1.newOrderer('grpcs://localhost:7050', {pem: pem, 'ssl-target-name-override': 'orderer.example.com', name: 'orderer.example.com'});
	const orderer_org2 = client_org2.newOrderer('grpcs://localhost:7050', {pem: pem, 'ssl-target-name-override': 'orderer.example.com', name: 'orderer.example.com'});

	// join peers to the channel
	try {
		await joinChannel(t, channel_name, peer_org1, orderer_org1, client_org1);
		await joinChannel(t, channel_name, peer_org2, orderer_org2, client_org2);
		t.pass('***** Token channel has been joined *****');
	} catch (error) {
		t.fail('Failed to join token channel');
	}
	t.end();
});

// Positive tests that call issue/transfer/redeem APIs to invoke token transactions
// and call list API to verify the results.
test('\n\n***** Token end-to-end flow (green path): issue, transfer, redeem and list *****\n\n', async (t) => {
	try {
		// create TokenClient for user1 (admin user in org1)
		const user1ClientObj = await e2eUtils.createTokenClient('org1', channel_name, 'localhost:7051', t);
		const user1TokenClient = user1ClientObj.tokenClient;
		const user1Identity = user1ClientObj.user.getIdentity();

		// create TokenClient for user2 (admin user in org2)
		const user2ClientObj = await e2eUtils.createTokenClient('org2', channel_name, 'localhost:8051', t);
		const user2TokenClient = user2ClientObj.tokenClient;
		const user2Identity = user2ClientObj.user.getIdentity();

		// clean up tokens from previous tests so that we can rerun token test
		await resetTokens(user1TokenClient, 'user1', t);
		await resetTokens(user2TokenClient, 'user2', t);

		const eventhub = user1TokenClient._channel.getChannelEventHub('localhost:7051');

		// build the request for user2 to issue tokens to user1
		let txId = user2TokenClient.getClient().newTransactionID();
		let param = {
			owner: user1Identity.serialize(),
			type: 'abc123',
			quantity: '200'
		};
		const param2 = {
			owner: user1Identity.serialize(),
			type: 'ibm',
			quantity: '200'
		};
		let request = {
			params: [param, param2],
			txId: txId,
		};

		// user2 issues tokens to user1
		let result = await user2TokenClient.issue(request);
		logger.debug('issue returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent issue token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// call queryTransaction to verify token transaction is decoded correctly
		const issueTx = await user2TokenClient.getChannel().queryTransaction(txId.getTransactionID());
		validateTransactionEnvelope(issueTx, 'issue', null, request.params, t);

		// user1 call list to view his tokens
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param, param2], 'for user1 (owner) after issue', t);

		const transferToken = result[0];
		const redeemToken = result[1];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			owner: user2Identity.serialize(),
			quantity: transferToken.quantity,
		};
		request = {
			tokenIds: [transferToken.id],
			params: [param],
			txId: txId,
		};

		// user1 transfers tokens to user2
		result = await user1TokenClient.transfer(request);
		logger.debug('transfer returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent transfer token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// call queryTransaction to verify token transaction is decoded correctly
		const redeemTx = await user2TokenClient.getChannel().queryTransaction(txId.getTransactionID());
		param.type = transferToken.type;
		validateTransactionEnvelope(redeemTx, 'transfer', request.tokenIds, [param], t);

		// verify user1's (old owner) unspent tokens after transfer, it should not return the transferred token
		result = await user1TokenClient.list();
		logger.debug('(org1)list tokens after transfer token %s', util.inspect(result, false, null));
		t.equals(result.length, 1, 'Checking number of tokens for user1 after transfer');
		t.equals(result[0].type, redeemToken.type, 'Checking token type for user1 after transfer');
		t.equals(result[0].quantity, redeemToken.quantity, 'Checking token quantity for user1 after transfer');

		// verify user2's (new owner) unspent tokens after transfer, it should return the transferred token
		result = await user2TokenClient.list();
		t.equals(result.length, 1, 'Checking number of tokens for user2 after transfer');
		t.equals(result[0].type, transferToken.type, 'Checking token type for user2 after transfer');
		t.equals(result[0].quantity, transferToken.quantity, 'Checking token quantity for user2 after transfer');

		// build requst for user1 to redeem token
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			quantity: '50'
		};
		request = {
			tokenIds: [redeemToken.id],
			params: param,
			txId: txId,
		};

		// user1 redeems his token
		result = await user1TokenClient.redeem(request);
		logger.debug('redeem returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent redeem token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// verify owner's (user1) unspent tokens after redeem - pass optional request
		request = {txId: user1TokenClient.getClient().newTransactionID()};
		result = await user1TokenClient.list(request);
		const remainingQuantity = '150'; // 200 - 50
		logger.debug('(org1)list tokens after transfer token %s', util.inspect(result, false, null));
		t.equals(result.length, 1, 'Checking number of tokens for user1 after redeem');
		t.equals(result[0].type, redeemToken.type, 'Checking token type for user1 after redeem');
		t.equals(result[0].quantity, remainingQuantity, 'Checking token quantity for user1 after redeem');

		t.end();
	} catch (err) {
		logger.error(err);
		t.fail('Failed to test token commands due to error: ' + err.stack ? err.stack : err);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: double spending fails *****\n\n', async (t) => {
	let transferToken;
	try {
		// create TokenClient for user1 (admin user in org1)
		const user1ClientObj = await e2eUtils.createTokenClient('org1', channel_name, 'localhost:7051', t);
		const user1TokenClient = user1ClientObj.tokenClient;
		const user1Identity = user1ClientObj.user.getIdentity();

		// create TokenClient for user2 (admin user in org2)
		const user2ClientObj = await e2eUtils.createTokenClient('org2', channel_name, 'localhost:8051', t);
		const user2TokenClient = user2ClientObj.tokenClient;
		const user2Identity = user2ClientObj.user.getIdentity();

		await resetTokens(user1TokenClient, 'user1', t);
		await resetTokens(user2TokenClient, 'user2', t);

		const eventhub = user1TokenClient._channel.getChannelEventHub('localhost:7051');

		// build request for user2 to issue a token to user1
		let txId = user2TokenClient.getClient().newTransactionID();
		let param = {
			owner: user1Identity.serialize(),
			type: 'abc123',
			quantity: '210'
		};
		let request = {
			params: [param],
			txId: txId,
		};

		// user2 issues token to user1
		let result = await user2TokenClient.issue(request);
		logger.debug('issue returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent issue token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// user1 lists tokens after issue
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user1 (owner) after issue', t);

		transferToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			owner: user2Identity.serialize(),
			quantity: transferToken.quantity
		};
		request = {
			tokenIds: [transferToken.id],
			params: [param],
			txId: txId,
		};

		// user1 transfers token to user2
		result = await user1TokenClient.transfer(request);
		logger.debug('transfer returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent transfer token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// Transfer the same tokenId again - transaction should be invalidated
		txId = user1TokenClient.getClient().newTransactionID();
		request = {
			tokenIds: [transferToken.id],
			params: [param],
			txId: txId,
		};

		// user1 transfers token again using the same tokenIds
		await user1TokenClient.transfer(request);
		t.fail('Transfer should have failed due to double spending');
		t.end();
	} catch (err) {
		const tokenId = '(' + transferToken.id.tx_id + ', ' + transferToken.id.index + ')';
		t.equals(
			err.message,
			'command response has error: input TokenId ' + tokenId + ' does not exist or not owned by the user',
			'Transfer failed as expected because token id has been spent and does not exist any more'
		);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: non owner transfer fails *****\n\n', async (t) => {
	let transferToken;

	try {
		// create TokenClient for user1 (admin user in org1)
		const user1ClientObj = await e2eUtils.createTokenClient('org1', channel_name, 'localhost:7051', t);
		const user1TokenClient = user1ClientObj.tokenClient;
		const user1Identity = user1ClientObj.user.getIdentity();

		// create TokenClient for user2 (admin user in org2), no target peer provided
		const user2ClientObj = await e2eUtils.createTokenClient('org2', channel_name, undefined, t);
		const user2TokenClient = user2ClientObj.tokenClient;
		const user2Identity = user2ClientObj.user.getIdentity();

		await resetTokens(user1TokenClient, 'user1', t);
		await resetTokens(user2TokenClient, 'user2', t);

		// use BasicProverHandler for this test
		const req = {proverHandler : 'fabric-client/lib/impl/BasicProverHandler.js'};
		user1TokenClient.getChannel().initialize(req);
		user2TokenClient.getChannel().initialize(req);

		const eventhub = user1TokenClient._channel.getChannelEventHub('localhost:7051');

		// build request for user2 to issue a token to user1
		let txId = user2TokenClient.getClient().newTransactionID();
		let param = {
			owner: user1Identity.serialize(),
			type: 'abc123',
			quantity: '210'
		};
		let request = {
			params: [param],
			txId: txId,
		};

		// user2 issues token to user1
		let result = await user2TokenClient.issue(request);
		logger.debug('issue returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent issue token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// user1 lists tokens after issue
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user1 (owner) after issue', t);

		transferToken = result[0];

		// token is owned by user1, but user2 attempts to transfer the token, should fail
		txId = user2TokenClient.getClient().newTransactionID();
		param = {
			owner: user2Identity.serialize(),
			quantity: '10'
		};
		request = {
			tokenIds: [transferToken.id],
			params: [param],
			txId: txId,
		};

		// user2 attempts to transfer token, should fail
		result = await user2TokenClient.transfer(request);
		t.fail('');
		t.end();
	} catch (err) {
		const tokenId = '(' + transferToken.id.tx_id + ', ' + transferToken.id.index + ')';
		t.equals(
			err.message,
			'command response has error: input TokenId ' + tokenId + ' does not exist or not owned by the user',
			'Transfer failed as expected because the requestor does not own the token'
		);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: transfer with remaining balance succeeds *****\n\n', async (t) => {
	try {
		// create TokenClient for user1 (admin user in org1)
		const user1ClientObj = await e2eUtils.createTokenClient('org1', channel_name, 'localhost:7051', t);
		const user1TokenClient = user1ClientObj.tokenClient;
		const user1Identity = user1ClientObj.user.getIdentity();

		// create TokenClient for user2 (admin user in org2)
		const user2ClientObj = await e2eUtils.createTokenClient('org2', channel_name, 'localhost:8051', t);
		const user2TokenClient = user2ClientObj.tokenClient;
		const user2Identity = user2ClientObj.user.getIdentity();

		await resetTokens(user1TokenClient, 'user1', t);
		await resetTokens(user2TokenClient, 'user2', t);

		const eventhub = user1TokenClient._channel.getChannelEventHub('localhost:7051');

		// build request for user2 to issue a token to user1
		let txId = user2TokenClient.getClient().newTransactionID();
		let param = {
			owner: user1Identity.serialize(),
			type: 'abc123',
			quantity: '210'
		};
		let request = {
			params: [param],
			txId: txId,
		};

		// user2 issues token to user1
		let result = await user2TokenClient.issue(request);
		logger.debug('issue returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent issue token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// user1 lists tokens after issue
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user1 (owner) after issue', t);

		const transferToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			owner: user2Identity.serialize(),
			quantity: '10'
		};
		request = {
			tokenIds: [transferToken.id],
			params: [param],
			txId: txId,
		};

		// user1 transfers token to user2, balance (210-10=200) should be remained for user1
		result = await user1TokenClient.transfer(request);
		logger.debug('transfer returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent transfer token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// user2 lists tokens after transfer, expect quantity of 10
		param = {type: 'abc123', quantity: '10'};
		result = await user2TokenClient.list();
		logger.debug('\nuser2(org2) listed %d tokens after transfer: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user2 (recipient) after transfer', t);

		// user1 lists tokens after transfer, expect quantity of 210-10=200
		param = {type: 'abc123', quantity: '200'};
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after transfer: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user1 (owner) after transfer', t);

		t.end();
	} catch (err) {
		logger.error(err);
		t.fail('Failed to test token commands due to error: ' + err.stack ? err.stack : err);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: invalid redeem amount fails *****\n\n', async (t) => {
	try {
		// create TokenClient for user1 (admin user in org1)
		const user1ClientObj = await e2eUtils.createTokenClient('org1', channel_name, 'localhost:7051', t);
		const user1TokenClient = user1ClientObj.tokenClient;
		const user1Identity = user1ClientObj.user.getIdentity();

		// create TokenClient for user2 (admin user in org2)
		const user2ClientObj = await e2eUtils.createTokenClient('org2', channel_name, 'localhost:8051', t);
		const user2TokenClient = user2ClientObj.tokenClient;

		await resetTokens(user1TokenClient, 'user1', t);
		await resetTokens(user2TokenClient, 'user2', t);

		const eventhub = user1TokenClient._channel.getChannelEventHub('localhost:7051');

		// build request for user2 to issue a token to user1
		let txId = user2TokenClient.getClient().newTransactionID();
		let param = {
			owner: user1Identity.serialize(),
			type: 'abc123',
			quantity: '100'
		};
		let request = {
			params: [param],
			txId: txId,
		};

		// user2 issues token to user1
		let result = await user2TokenClient.issue(request);
		logger.debug('issue returns: %s', util.inspect(result, {depth: null}));
		t.equals(result.status, 'SUCCESS', 'Successfully sent issue token transaction to orderer. Waiting for transaction to be committed ...');
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'VALID', t);

		// user1 lists tokens after issue
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param], 'for user1 (owner) after issue', t);

		const redeemToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			quantity: '110'
		};
		request = {
			tokenIds: [redeemToken.id],
			params: [param],
			txId: txId,
		};

		// user1 redeem tokens
		result = await user1TokenClient.redeem(request);
		t.fail('Redeem failed because redeem quantity exceeded the token quantity');

		t.end();
	} catch (err) {
		t.equals(
			err.message,
			'command response has error: total quantity [100] from TokenIds is less than quantity [110] to be redeemed',
			'Redeem failed as expected because redeemed quantity exceeded token quantity'
		);
		t.end();
	}
});

// list to tx event and verify that validation code matches expected code
async function waitForTxEvent(eventhub, transactionID, expectedCode, t) {
	logger.debug('waitForTxEvent start, transactionID: %s', transactionID);
	const txPromise = new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			eventhub.disconnect();
			t.fail('REQUEST_TIMEOUT -- eventhub did not respond');
			reject(new Error('REQUEST_TIMEOUT:' + eventhub.getPeerAddr()));
		}, 30000);

		eventhub.registerTxEvent(transactionID, (tx, code) => {
			clearTimeout(handle);

			const action = expectedCode === 'VALID' ? 'committed' : 'invalidated';
			t.equals(code, expectedCode, 'Transaction has been successfully ' + action + ' on peer ' + eventhub.getPeerAddr());
			if (code === expectedCode) {
				// t.pass('transaction has been committed or invalidated on peer ' + eventhub.getPeerAddr());
				resolve();
			} else {
				// t.fail('transaction has wrong validation code, expected ' + expectedCode + ', but got code ' + code);
				reject(new Error('INVALID:' + code));
			}
		}, (error) => {
			clearTimeout(handle);

			t.fail('Event registration for this transaction was invalid ::' + error);
			reject(error);
		},
		{disconnect: true}
		);

		eventhub.connect();
	});
	return txPromise;
}

function validateTokens(actual, expected, message, t) {
	t.equals(actual.length, expected.length, 'Validating number of tokens ' + message);
	for (const actualToken of actual) {
		let found = false;
		for (const expectedToken of expected) {
			if (actualToken.type === expectedToken.type) {
				found = true;
				t.equals(actualToken.type, expectedToken.type, 'Validating token type ' + message);
				t.equals(actualToken.quantity, expectedToken.quantity, 'Validating token quantity ' + message);
				break;
			}
		}
		if (!found) {
			t.fail('failed to validate token type (%s) %s', actualToken.type, message);
		}
	}
}

function validateTransactionEnvelope(txEnvelope, commandName, expectedInputs, expectedOutputs, t) {
	logger.debug('queried transaction is: \n%s', util.inspect(txEnvelope, false, null));
	const token_action = txEnvelope.transactionEnvelope.payload.data.token_action;
	const action_data = token_action[token_action.data];
	t.equals(token_action.data, commandName, 'Validating token transaction matches command name ' + commandName);
	t.equals(action_data.outputs.length, expectedOutputs.length, 'Validationing number of outputs in token transaction');
	for (let i = 0; i < expectedOutputs.length; i++) {
		// fabtoken uses hex string in token transaction, so convert expectedQuantity to hex string
		const expectedQuantityToHex = tokenUtils.toHex(parseInt(expectedOutputs[i].quantity));
		// list tokens returns owner in TokenOwner format {raw: xxx}, so get raw field.
		t.deepEqual(action_data.outputs[i].owner.raw, expectedOutputs[i].owner, 'Validationing owner in token transaction');
		t.deepEqual(action_data.outputs[i].quantity, expectedQuantityToHex, 'Validationing quantity in token transaction');
		t.deepEqual(action_data.outputs[i].type, expectedOutputs[i].type, 'Validationing type in token transaction');
	}
	if (expectedInputs) {
		t.deepEqual(action_data.inputs, expectedInputs, 'Validationing inputs in token transaction');
	}
}

async function resetTokens(tokenClient, userName, t) {
	let request;
	let result;
	const tokens = await tokenClient.list();
	for (const token of tokens) {
		request = {tokenIds: [token.id], params: {quantity: token.quantity}, txId: tokenClient._client.newTransactionID()};
		result = await tokenClient.redeem(request);
		t.equals(result.status, 'SUCCESS', 'Successfully resetting tokens for user %s', userName);
	}
}

async function createChannel(t, file, channelName, client_org1, client_org2) {
	// get the config envelope created by the configtx tool
	const envelope_bytes = fs.readFileSync(file);
	// Have the sdk get the config update object from the envelope.
	// the config update object is what is required to be signed by all
	// participating organizations
	const config = client_org1.extractChannelConfig(envelope_bytes);
	t.pass('Successfully extracted the config update from the configtx envelope');

	const signatures = [];
	// sign the config by the  admins
	const signature1 = client_org1.signChannelConfig(config);
	signatures.push(signature1);
	t.pass('Successfully signed config update for org1');
	const signature2 = client_org2.signChannelConfig(config);
	signatures.push(signature2);
	t.pass('Successfully signed config update for org2');
	// now we have enough signatures...

	// get an admin based transaction
	const tx_id = client_org1.newTransactionID(true);

	const request = {
		config: config,
		signatures : signatures,
		name : channelName,
		orderer : 'orderer.example.com',
		txId  : tx_id
	};

	try {
		const results = await client_org1.createChannel(request);
		if (results.status === 'SUCCESS') {
			t.pass('Successfully created the channel.');
			await testUtil.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ' + results.status + ' :: ' + results.info);
			throw new Error('Failed to create the channel. ');
		}
	} catch (error) {
		logger.error('Token channel create - catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Failed to create channel :' + error);
		throw Error('Failed to create the channel');
	}
}

async function joinChannel(t, channelName, peer, orderer, client) {
	try {
		const channel = client.newChannel(channelName);

		// get an admin based transaction
		let tx_id = client.newTransactionID(true);

		let request = {
			orderer: orderer,
			txId : 	tx_id
		};

		const genesis_block = await channel.getGenesisBlock(request);
		t.pass('Successfully got the genesis block');

		tx_id = client.newTransactionID(true);
		request = {
			targets: [peer],
			block : genesis_block,
			txId : 	tx_id
		};

		const join_results = await channel.joinChannel(request, 30000);
		if (join_results && join_results[0] && join_results[0].response && join_results[0].response.status === 200) {
			t.pass('Successfully joined channel on org');
		} else {
			t.fail('Failed to join channel on org');
			throw new Error('Failed to join channel on org');
		}

		return channel;
	} catch (error) {
		logger.error('Not able to join ' + error);
		t.fail('Failed to join ');
		throw Error('Failed to join');
	}
}

