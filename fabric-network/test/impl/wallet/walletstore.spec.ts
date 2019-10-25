/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import fs = require('fs-extra');
import os = require('os');
import path = require('path');
import util = require('util');

import rawRimraf = require('rimraf');
// tslint:disable-next-line:typedef
const rimraf = util.promisify(rawRimraf);

import { FileSystemWalletStore } from '../../../src/impl/wallet/filesystemwalletstore';
import { InMemoryWalletStore } from '../../../src/impl/wallet/inmemorywalletstore';
import { WalletStore } from '../../../src/impl/wallet/walletstore';

import chai = require('chai');
const expect: Chai.ExpectStatic = chai.expect;

async function createTempDir(): Promise<string> {
	const prefix: string = path.join(os.tmpdir(), 'fabric-network-test-');
	return await fs.mkdtemp(prefix);
}

// tslint:disable: no-unused-expression

describe('WalletStore', () => {
	let tmpDir: string|undefined;
	const stores: { [k: string]: () => Promise<WalletStore> } = {
		FileSystemWalletStore: async (): Promise<FileSystemWalletStore> => {
			tmpDir = await createTempDir();
			return await FileSystemWalletStore.newInstance(tmpDir);
		},
		InMemoryWalletStore: async (): Promise<WalletStore> => new InMemoryWalletStore(),
	};

	async function deleteTmpDir(): Promise<void> {
		if (tmpDir) {
			await rimraf(tmpDir);
			tmpDir = undefined;
		}
	}

	describe('Common', () => {
		Object.keys(stores).forEach((name: string) => {
			describe(name, () => {
				let store: WalletStore;
				const data: Buffer = Buffer.from('DATA');

				beforeEach(async () => {
					store = await stores[name]();
				});

				afterEach(async () => {
					await deleteTmpDir();
				});

				it('Empty wallet contains no labels', async () => {
					const result: string[] = await store.list();
					expect(result).to.be.empty;
				});

				it('Labels include added identities', async () => {
					const label: string = 'label';

					await store.put(label, data);
					const result: string[] = await store.list();

					expect(result).to.have.members([label]);
				});

				it('Labels do not include deleted identities', async () => {
					const label: string = 'label';

					await store.put(label, data);
					await store.delete(label);
					const result: string[] = await store.list();

					expect(result).to.be.empty;
				});

				it('Get returns undefined for identity that does not exist', async () => {
					const result: Buffer | undefined = await store.get('MISSING');
					expect(result).to.be.undefined;
				});

				it('Get returns undefined for deleted identity', async () => {
					const label: string = 'label';

					await store.put(label, data);
					await store.delete(label);
					const result: Buffer | undefined = await store.get(label);

					expect(result).to.be.undefined;
				});

				it('Get an imported identity', async () => {
					const label: string = 'label';

					await store.put(label, data);
					const result: Buffer | undefined = await store.get(label);

					expect(result).to.exist;
					expect(result ? result.toString() : '').to.equal(data.toString());
				});
			});
		});
	});

	describe('FileSystemWalletStore', () => {
		it('Does not list non-identity files', async () => {
			const store: WalletStore = await stores.FileSystemWalletStore();
			if (!tmpDir) {
				throw new Error('tmpDir not set');
			}
			const file: string = path.join(tmpDir, 'BAD_FILE');
			await fs.writeFile(file, Buffer.from(''));

			const result: string[] = await store.list();

			expect(result).to.be.empty;
		});

		it('Creates store directory if does not exist', async () => {
			const label: string = 'label';
			const data: Buffer = Buffer.from('DATA');
			tmpDir = await createTempDir();
			await rimraf(tmpDir);

			const store: FileSystemWalletStore = await FileSystemWalletStore.newInstance(tmpDir);
			await store.put(label, data);
			const result: Buffer | undefined = await store.get(label);

			expect(result).to.exist;
			expect(result ? result.toString() : '').to.equal(data.toString());
		});
	});
});
