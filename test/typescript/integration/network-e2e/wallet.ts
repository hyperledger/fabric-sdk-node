/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import fs = require('fs-extra');
import tape = require('tape');
import tapePromise = require('tape-promise');
const test = tapePromise.default(tape);

import {
	Wallets,
	X509Identity,
} from 'fabric-network';

const fixtures = process.cwd() + '/test/fixtures';
const credPath = fixtures + '/crypto-material/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp';
const certificatePem = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
const privateKeyPem = fs.readFileSync(credPath + '/keystore/key.pem').toString();

const couchDbUrl = 'http://localhost:5984';

test('\n\n***** Network End-to-end: CouchDB wallet *****\n\n', async (t: tape.Test) => {
	const wallet = await Wallets.newCouchDBWallet({url: couchDbUrl});

	const identityName = 'identity';
	const identity: X509Identity = {
		credentials: {
			certificate: certificatePem,
			privateKey: privateKeyPem,
		},
		mspId: 'Org1MSP',
		type: 'X.509',
	};

	await wallet.put(identityName, identity);
	t.pass(`Successfully imported ${identityName} into wallet`);

	const value = await wallet.get(identityName);
	t.deepEqual(value, identity, 'Retrieved a stored identity');

	const missingValue = await wallet.get('MISSING');
	t.equal(missingValue, undefined, 'Undefined returned for missing labels');

	const updateDeleteName = 'UPDATE_DELETE';
	await wallet.put(updateDeleteName, identity);
	await wallet.put(updateDeleteName, identity);
	await wallet.delete(updateDeleteName);
	const deletedValue = await wallet.get(updateDeleteName);
	t.equal(deletedValue, undefined, 'Successfully deleted entry');

	const labels = await wallet.list();
	const expectedLabels = [identityName];
	t.deepEqual(labels, expectedLabels, 'List contained expected values');

	t.end();
});
