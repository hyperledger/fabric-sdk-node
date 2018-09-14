/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Channel, ChannelPeer } from 'fabric-client';

import Client = require('fabric-client');


//-------------------------------------------
// Main fabric network classes
//-------------------------------------------
export interface InitOptions {
	wallet: Wallet;
	identity: string;
	clientTlsIdentity?: string;
	eventHandlerOptions?: DefaultEventHandlerOptions|Object;
}

export interface DefaultEventHandlerOptions {
	commitTimeout?: number;
	strategy?: DefaultEventHandlerStrategies;
}

export enum DefaultEventHandlerStrategies {
	MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX
}

export class Gateway {
	constructor();
	connect(ccp: string | Client, options?: InitOptions): Promise<void>;
	getCurrentIdentity(): User;
	getClient(): Client;
	getOptions(): InitOptions;
	getNetwork(channelName: string): Promise<Network>;
	disconnect(): void;
}

export class Network {
	getChannel(): Channel;
	getPeerMap(): Map<string, ChannelPeer[]>;
	getContract(chaincodeId: string): Contract;
}

export class Contract {
	executeTransaction(transactionName: string, ...parameters: string[]): Promise<Buffer>;
	submitTransaction(transactionName: string, ...parameters: string[]): Promise<Buffer>;
}

//-------------------------------------------
// Wallet Management
//-------------------------------------------
export interface Identity {
	type: string
}

export interface X509Identity extends Identity {
	mspId: string,
	certificate: string,
	privateKey: string
}

export interface IdentityInformation {
	label: string,
	mspId: string,
	identifier: string
}

interface WalletAPI {
	import(label: string, identity: Identity): Promise<void>;
	export(label: string): Promise<Identity>;
	list(): Promise<IdentityInformation[]>;
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
}

interface Wallet extends WalletAPI {
}

interface WalletMixin {
}

declare abstract class BaseWallet implements Wallet {
	import(label: string, identity: Identity): Promise<void>;
	export(label: string): Promise<Identity>;
	list(): Promise<IdentityInformation[]>;
	abstract delete(label: string): Promise<void>;
	abstract exists(label: string): Promise<boolean>;
}

export class InMemoryWallet extends BaseWallet {
	constructor(mixin?: WalletMixin);
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
}

export class FileSystemWallet extends BaseWallet {
	constructor(path: string, mixin?: WalletMixin);
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
}

export class X509WalletMixin implements WalletMixin {
	constructor();
	static createIdentity(mspId: string, certificate: string, privateKey: string): X509Identity;
}
