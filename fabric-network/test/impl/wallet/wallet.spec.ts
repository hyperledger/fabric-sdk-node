/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Identity} from '../../../src/impl/wallet/identity';
import {Wallet} from '../../../src/impl/wallet/wallet';
import {Wallets} from '../../../src/impl/wallet/wallets';
import {X509Identity} from '../../../src/impl/wallet/x509identity';

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;



describe('Wallet', () => {
	const identity: X509Identity = {
		credentials: {
			certificate: 'CERTIFICATE',
			privateKey: 'PRIVATE_KEY',
		},
		mspId: 'MSPID',
		type: 'X.509',
	};

	const newWallet = async (): Promise<Wallet> => {
		return await Wallets.newInMemoryWallet();
	};

	it('List returns empty array for an empty wallet', async () => {
		const wallet = await newWallet();
		const result = await wallet.list();
		expect(result).to.be.empty;
	});

	it('List returns added identity', async () => {
		const wallet = await newWallet();
		const label = 'myId';

		await wallet.put(label, identity);
		const result = await wallet.list();

		expect(result).to.have.members([label]);
	});

	it('List does not return removed identities', async () => {
		const wallet = await newWallet();
		const label = 'myId';

		await wallet.put(label, identity);
		await wallet.remove(label);
		const result = await wallet.list();

		expect(result).to.be.empty;
	});

	it('Returns undefined when getting an identity that does not exist', async () => {
		const wallet = await newWallet();
		const result = await wallet.get('NO');
		expect(result).to.be.undefined;
	});

	it('Returns undefined when getting a removed identity', async () => {
		const wallet = await newWallet();
		const label = 'myId';

		await wallet.put(label, identity);
		await wallet.remove(label);
		const result = await wallet.get(label);

		expect(result).to.be.undefined;
	});

	it('Get previously added identity', async () => {
		const wallet = await newWallet();
		const label = 'myId';

		await wallet.put(label, identity);
		const result = await wallet.get(label);

		expect(result).to.deep.equal(identity);
	});

	it('Throws when adding an identity of unknown type', async () => {
		const badIdentity: Identity = {
			mspId: 'MSPID',
			type: 'BAD_TYPE',
		};

		const wallet = await newWallet();
		const promise = wallet.put('label', badIdentity);

		await expect(promise).to.be.rejectedWith(badIdentity.type);
	});
});
