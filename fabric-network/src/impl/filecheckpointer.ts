/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Checkpointer} from '../checkpointer';
import * as Long from 'long';
import * as fs from 'fs';

const encoding = 'utf8';

interface PersistentState {
	blockNumber?: string;
	transactionIds?: string[];
}

export class FileCheckpointer implements Checkpointer {
	private readonly path: string;
	private blockNumber?: Long;
	private transactionIds: Set<string> = new Set();

	constructor(path: string) {
		this.path = path;
	}

	async init(): Promise<void> {
		await this.load();
		await this.save();
	}

	async addTransactionId(transactionId: string): Promise<void> {
		this.transactionIds.add(transactionId);
		await this.save();
	}

	getBlockNumber(): Promise<Long | undefined> {
		return Promise.resolve(this.blockNumber);
	}

	getTransactionIds(): Promise<Set<string>> {
		return Promise.resolve(this.transactionIds);
	}

	async setBlockNumber(blockNumber: Long): Promise<void> {
		this.blockNumber = blockNumber;
		this.transactionIds.clear();
		await this.save();
	}

	private async load(): Promise<void> {
		const data = await this.readFile();
		if (data) {
			const json = data.toString(encoding);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const state = JSON.parse(json) as PersistentState;
			this.setState(state);
		}
	}

	private async readFile(): Promise<Buffer | undefined> {
		try {
			return await fs.promises.readFile(this.path);
		} catch (err) {
			// Ignore error on non-existent file
		}
	}

	private setState(state: PersistentState): void {
		this.blockNumber = state.blockNumber ? Long.fromString(state.blockNumber) : undefined;
		this.transactionIds = new Set(state.transactionIds);
	}

	private async save(): Promise<void> {
		const state = this.getState();
		const json = JSON.stringify(state);
		const data = Buffer.from(json, encoding);
		await fs.promises.writeFile(this.path, data);
	}

	private getState(): PersistentState {
		return {
			blockNumber: this.blockNumber?.toString(),
			transactionIds: Array.from(this.transactionIds)
		};
	}
}
