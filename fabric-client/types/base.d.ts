/**
 * Copyright 2018 Zhao Chaoyi, All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { CryptoSetting, ICryptoKeyStore, ICryptoSuite, IKeyValueStore } from 'fabric-client';

export abstract class BaseClient {
	public static newCryptoSuite(setting?: CryptoSetting): ICryptoSuite;
	public static newCryptoKeyStore(obj?: { path: string }): ICryptoKeyStore;
	public static newDefaultKeyValueStore(obj?: { path: string }): Promise<IKeyValueStore>;

	public static setLogger(logger: any): void;

	public static getConfigSetting(name: string, defaultValue?: any): any;
	public static addConfigFile(path: string): void;
	public static setConfigSetting(name: string, value: any): void;

	public static getLogger(name: string): any;

	public static normalizeX509(raw: string): string;

	constructor();
	public getConfigSetting(name: string, defaultValue?: any): any;
	public setConfigSetting(name: string, value: any): void;

	public setCryptoSuite(suite: ICryptoSuite): void;
	public getCryptoSuite(): ICryptoSuite;
}
