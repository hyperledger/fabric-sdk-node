/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';

import rawRimraf = require('rimraf');
const rimraf = util.promisify(rawRimraf);

import {FileSystemWalletStore} from '../../../src/impl/wallet/filesystemwalletstore';
import {InMemoryWalletStore} from '../../../src/impl/wallet/inmemorywalletstore';
import {WalletStore} from '../../../src/impl/wallet/walletstore';

import chai = require('chai');
const expect = chai.expect;

async function createTempDir(): Promise<string> {
	const prefix = path.join(os.tmpdir(), 'fabric-network-test-');
	return await fs.promises.mkdtemp(prefix);
}



describe('WalletStore', () => {
	let tmpDir: string|undefined;
	const stores: { [k: string]: () => Promise<WalletStore> } = {
		FileSystemWalletStore: async () => {
			tmpDir = await createTempDir();
			return await FileSystemWalletStore.newInstance(tmpDir);
		},
		InMemoryWalletStore:  () => Promise.resolve(new InMemoryWalletStore()),
	};

	async function deleteTmpDir(): Promise<void> {
		if (tmpDir) {
			await rimraf(tmpDir);
			tmpDir = undefined;
		}
	}

	describe('Common', () => {
		Object.keys(stores).forEach((name) => {
			describe(name, () => {
				let store: WalletStore;
				const data = Buffer.from('DATA');

				beforeEach(async () => {
					store = await stores[name]();
				});

				afterEach(async () => {
					await deleteTmpDir();
				});

				it('Empty wallet contains no labels', async () => {
					const result = await store.list();
					expect(result).to.be.empty;
				});

				it('Labels include added identities', async () => {
					const label = 'label';

					await store.put(label, data);
					const result = await store.list();

					expect(result).to.have.members([label]);
				});

				it('Labels do not include removed identities', async () => {
					const label = 'label';

					await store.put(label, data);
					await store.remove(label);
					const result = await store.list();

					expect(result).to.be.empty;
				});

				it('Get returns undefined for identity that does not exist', async () => {
					const result = await store.get('MISSING');
					expect(result).to.be.undefined;
				});

				it('Get returns undefined for removed identity', async () => {
					const label = 'label';

					await store.put(label, data);
					await store.remove(label);
					const result = await store.get(label);

					expect(result).to.be.undefined;
				});

				it('Get an imported identity', async () => {
					const label = 'label';

					await store.put(label, data);
					const result = await store.get(label);

					expect(result).to.exist;
					expect(result ? result.toString() : '').to.equal(data.toString());
				});
			});
		});
	});

	describe('FileSystemWalletStore', () => {
		it('Does not list non-identity files', async () => {
			const store = await stores.FileSystemWalletStore();
			if (!tmpDir) {
				throw new Error('tmpDir not set');
			}
			const file = path.join(tmpDir, 'BAD_FILE');
			await fs.promises.writeFile(file, Buffer.from(''));

			const result = await store.list();

			expect(result).to.be.empty;
		});

		it('Recursively creates store directory if does not exist', async () => {
			const label = 'label';
			const data = Buffer.from('DATA');
			tmpDir = await createTempDir();
			const walletDir = path.join(tmpDir, 'wallet');
			await rimraf(tmpDir);

			const store = await FileSystemWalletStore.newInstance(walletDir);
			await store.put(label, data);
			const result = await store.get(label);

			expect(result).to.exist;
			expect(result ? result.toString() : '').to.equal(data.toString());
		});
	});
});
