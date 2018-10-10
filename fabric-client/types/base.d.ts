/**
 * Copyright 2018 Zhao Chaoyi, All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { CryptoSetting, ICryptoSuite, ICryptoKeyStore, IKeyValueStore } from 'fabric-client';

export abstract class BaseClient {
    constructor();
    static newCryptoSuite(setting?: CryptoSetting): ICryptoSuite;
    static newCryptoKeyStore(obj?: { path: string }): ICryptoKeyStore;
    static newDefaultKeyValueStore(obj?: { path: string }): Promise<IKeyValueStore>;

    static setLogger(logger: any): void;

    static getConfigSetting(name: string, default_value?: any): any;
    getConfigSetting(name: string, default_value?: any): any;
    static addConfigFile(path: string): void;
    static setConfigSetting(name: string, value: any): void;
    setConfigSetting(name: string, value: any): void;

    static getLogger(name: string): any;

    setCryptoSuite(suite: ICryptoSuite): void;
    getCryptoSuite(): ICryptoSuite;

    static normalizeX509(raw: string): string;
}