/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This includes end-to-end tests for the fabric token feature, both positive and negative.
'use strict';

const util = require('util');
const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E token');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const e2eUtils = require('./e2eUtils.js');
const fabprotos = require('fabric-protos');

const channel_name = process.env.channel ? process.env.channel : 'tokenchannel';

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
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'abc123',
			quantity: 210
		};
		const param2 = {
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'horizon',
			quantity: 300,
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

		// user1 call list to view his tokens
		result = await user1TokenClient.list();
		logger.debug('\nuser1(org1) listed %d tokens after issue: \n%s', result.length, util.inspect(result, false, null));
		validateTokens(result, [param, param2], 'for user1 (recipient) after issue', t);

		const transferToken = result[0];
		const redeemToken = result[1];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user2Identity.serialize()},
			quantity: transferToken.quantity
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

		// verify user1's unspent tokens after transfer, it should return 1 token
		result = await user1TokenClient.list();
		logger.debug('(org1)list tokens after transfer token %s', util.inspect(result, false, null));
		t.equals(result.length, 1, 'Checking number of tokens for user1 after transfer');
		t.equals(result[0].type, redeemToken.type, 'Checking token type for user1 after transfer');
		t.equals(result[0].quantity.low, redeemToken.quantity.low, 'Checking token quantity for user1 after transfer');

		// verify recipient's (user2) unspent tokens after transfer, it should return 1 token
		result = await user2TokenClient.list();
		t.equals(result.length, 1, 'Checking number of tokens for user2 after transfer');
		t.equals(result[0].type, transferToken.type, 'Checking token type for user2 after transfer');
		t.equals(result[0].quantity.low, transferToken.quantity.low, 'Checking token quantity for user2 after transfer');

		// build requst for user1 to redeem token
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			quantity: 50,
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
		const remainingQuantity = redeemToken.quantity - param.quantity;
		logger.debug('(org1)list tokens after transfer token %s', util.inspect(result, false, null));
		t.equals(result.length, 1, 'Checking number of tokens for user1 after redeem');
		t.equals(result[0].type, redeemToken.type, 'Checking token type for user1 after redeem');
		t.equals(result[0].quantity.low, remainingQuantity, 'Checking token quantity for user1 after redeem');

		t.end();
	} catch (err) {
		logger.error(err);
		t.fail('Failed to test token commands due to error: ' + err.stack ? err.stack : err);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: double spending fails *****\n\n', async (t) => {
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
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'abc123',
			quantity: 210
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
		validateTokens(result, [param], 'for user1 (recipient) after issue', t);

		const transferToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user2Identity.serialize()},
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
		result = await user1TokenClient.transfer(request);
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'INVALID_OTHER_REASON', t);

		t.end();
	} catch (err) {
		logger.error(err);
		t.fail('Failed to test token commands due to error: ' + err.stack ? err.stack : err);
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: non owner transfer fails *****\n\n', async (t) => {
	try {
		// create TokenClient for user1 (admin user in org1)
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
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'abc123',
			quantity: 210
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
		validateTokens(result, [param], 'for user1 (recipient) after issue', t);

		const transferToken = result[0];

		// token is owned by user1, but user2 attempts to transfer the token, should fail
		txId = user2TokenClient.getClient().newTransactionID();
		param = {
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user2Identity.serialize()},
			quantity: 10
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
		t.equals(
			err.message,
			'command response has error: the requestor does not own inputs',
			'Transfer failed as expected because the requestor does not own the token');
		t.end();
	}
});

test('\n\n***** Token end-to-end flow: invalid transfer amount fails *****\n\n', async (t) => {
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
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'abc123',
			quantity: 210
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
		validateTokens(result, [param], 'for user1 (recipient) after issue', t);

		const transferToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user2Identity.serialize()},
			quantity: 10
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
		await waitForTxEvent(eventhub, txId.getTransactionID(), 'INVALID_OTHER_REASON', t);

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
			recipient: {type: fabprotos.token.TokenOwner_MSP_IDENTIFIER, raw: user1Identity.serialize()},
			type: 'abc123',
			quantity: 100
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
		validateTokens(result, [param], 'for user1 (recipient) after issue', t);

		const redeemToken = result[0];

		// build request for user1 to transfer transfer token to user2
		txId = user1TokenClient.getClient().newTransactionID();
		param = {
			quantity: 110
		};
		request = {
			tokenIds: [redeemToken.id],
			params: [param],
			txId: txId,
		};

		// user1 transfers token to user2
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
				// compare quantity based on if it is a Long or simple integer
				if (expectedToken.quantity.low) {
					t.equals(actualToken.quantity.low, expectedToken.quantity.low, 'Validating token quantity ' + message);
				} else {
					t.equals(actualToken.quantity.low, expectedToken.quantity, 'Validating token quantity ' + message);
				}
				break;
			}
		}
		if (!found) {
			t.fail('failed to validate token type (%s) %s', actualToken.type, message);
		}
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
