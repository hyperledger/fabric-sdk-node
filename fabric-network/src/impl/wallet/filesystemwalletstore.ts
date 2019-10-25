/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import fs = require('fs-extra');
import path = require('path');

import { WalletStore } from './walletstore';

const suffix: string = '.id';

function isIdentityFile(file: string): boolean {
	return file.endsWith(suffix);
}

function toLabel(file: string): string {
	const endIndex: number = file.length - suffix.length;
	return file.substring(0, endIndex);
}

export class FileSystemWalletStore implements WalletStore {
	public static async newInstance(directory: string): Promise<FileSystemWalletStore> {
		await fs.mkdirp(directory);
		return new FileSystemWalletStore(directory);
	}

	private readonly storePath: string;

	private constructor(directory: string) {
		this.storePath = directory;
	}

	public async delete(label: string): Promise<void> {
		const file: string = this.toPath(label);
		await fs.unlink(file);
	}

	public async get(label: string): Promise<Buffer|undefined> {
		const file: string = this.toPath(label);
		try {
			return await fs.readFile(file);
		} catch (error) {
			return undefined;
		}
	}

	public async list(): Promise<string[]> {
		return (await fs.readdir(this.storePath))
			.filter(isIdentityFile)
			.map(toLabel);
	}

	public async put(label: string, data: Buffer): Promise<void> {
		const file: string = this.toPath(label);
		await fs.writeFile(file, data);
	}

	private toPath(label: string): string {
		return path.join(this.storePath, label + suffix);
	}
}
