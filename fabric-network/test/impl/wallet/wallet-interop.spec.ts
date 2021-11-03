/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Identity} from '../../../src/impl/wallet/identity';
import {Wallets} from '../../../src/impl/wallet/wallets';
import {Wallet} from '../../../src/impl/wallet/wallet';
import * as path from 'path';
import {expect} from 'chai';

const testWalletPath = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test-wallet');

describe('Wallet interop', () => {
	let wallet: Wallet;
	let labels: string[];

	before(async () => {
		wallet = await Wallets.newFileSystemWallet(testWalletPath);
		labels = await wallet.list();
	});

	it('Wallet is not empty', () => {
		expect(labels).to.not.be.empty;
	});

	it('Read identities', async () => {
		for (const label of labels) {
			const identity = await wallet.get(label) as Identity;
			expect(identity).to.exist;
			expect(identity.mspId).to.not.be.empty;
			expect(identity.type).to.not.be.empty;
		}
	});
});
