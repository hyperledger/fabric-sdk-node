/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import nano = require('nano');

import {WalletStore} from './walletstore';

const encoding = 'utf8';

interface WalletDocument extends nano.MaybeDocument {
	data: string;
}

export class CouchDBWalletStore implements WalletStore {
	public static async newInstance(config: string | nano.Configuration, dbName: string): Promise<CouchDBWalletStore> {
		const client = nano(config);
		try {
			await client.db.get(dbName); // Throws if database does not exist
		} catch (error) {
			await client.db.create(dbName);
		}
		const db = client.use<WalletDocument>(dbName);
		return new CouchDBWalletStore(db);
	}

	private readonly db: nano.DocumentScope<WalletDocument>;

	private constructor(db: nano.DocumentScope<WalletDocument>) {
		this.db = db;
	}

	public async remove(label: string): Promise<void> {
		const document = await this.getDocument(label);
		if (document) {
			await this.db.destroy(document._id, document._rev);
		}
	}

	public async get(label: string): Promise<Buffer|undefined> {
		const document = await this.getDocument(label);
		return document ? Buffer.from(document.data, encoding) : undefined;
	}

	public async list(): Promise<string[]> {
		const response = await this.db.list();
		return response.rows.map((row) => row.id);
	}

	public async put(label: string, data: Buffer): Promise<void> {
		const newDocument: WalletDocument = {
			_id: label,
			data: data.toString(encoding),
		};

		// Overwrite any existing document revision instead of creating a new revision
		const existingDocument = await this.getDocument(label);
		if (existingDocument) {
			newDocument._rev = existingDocument._rev;
		}

		await this.db.insert(newDocument);
	}

	private async getDocument(label: string): Promise<(nano.DocumentGetResponse & WalletDocument) | undefined> {
		try {
			return await this.db.get(label);
		} catch (error) {
			// TODO: Log error
		}
		return undefined;
	}
}
