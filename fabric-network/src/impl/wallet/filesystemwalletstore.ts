/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

import {WalletStore} from './walletstore';

const suffix = '.id';

function isIdentityFile(file: string): boolean {
	return file.endsWith(suffix);
}

function toLabel(file: string): string {
	const endIndex = file.length - suffix.length;
	return file.substring(0, endIndex);
}

export class FileSystemWalletStore implements WalletStore {
	public static async newInstance(directory: string): Promise<FileSystemWalletStore> {
		const mkdirOptions = {
			recursive: true
		};
		await fs.promises.mkdir(directory, mkdirOptions);
		return new FileSystemWalletStore(directory);
	}

	private readonly storePath: string;

	private constructor(directory: string) {
		this.storePath = directory;
	}

	public async remove(label: string): Promise<void> {
		const file = this.toPath(label);
		await fs.promises.unlink(file);
	}

	public async get(label: string): Promise<Buffer|undefined> {
		const file = this.toPath(label);
		try {
			return await fs.promises.readFile(file);
		} catch (error) {
			return undefined;
		}
	}

	public async list(): Promise<string[]> {
		return (await fs.promises.readdir(this.storePath))
			.filter(isIdentityFile)
			.map(toLabel);
	}

	public async put(label: string, data: Buffer): Promise<void> {
		const file = this.toPath(label);
		await fs.promises.writeFile(file, data);
	}

	private toPath(label: string): string {
		return path.join(this.storePath, label + suffix);
	}
}
