/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import { Wallet } from '../lib/impl/wallet/wallet';
import { ChaincodeEvent, Channel, Client, Endorser, EventService, IdentityContext, ProposalResponse, User } from 'fabric-common';

export { Wallet };
export { Wallets } from '../lib/impl/wallet/wallets';
export { WalletStore } from '../lib/impl/wallet/walletstore';
export { Identity } from '../lib/impl/wallet/identity';
export { IdentityData } from '../lib/impl/wallet/identitydata';
export { IdentityProvider } from '../lib/impl/wallet/identityprovider';
export { IdentityProviderRegistry } from '../lib/impl/wallet/identityproviderregistry';
export { HsmOptions, HsmX509Provider, HsmX509Identity } from '../lib/impl/wallet/hsmx509identity';
export { X509Identity } from '../lib/impl/wallet/x509identity';

// Main fabric network classes
// -------------------------------------------
export interface GatewayOptions {
	wallet: Wallet;
	identity: string;
	clientTlsIdentity?: string;
	discovery?: DiscoveryOptions;
	transaction?: TransactionOptions;
	query?: QueryOptions;
}

// export interface EventListenerOptions {
// 	checkpointer?: BaseCheckpointer;
// 	replay?: boolean;
// 	filtered?: boolean;
// 	privateData?: boolean;
// 	unregister?: boolean;
// 	startBlock?: number;
// 	endBlock?: number;
// }

export interface DiscoveryOptions {
	asLocalhost?: boolean;
	enabled?: boolean;
	maxAge?: number;
}

export interface TransactionOptions {
	commitTimeout?: number;
	endorseTimeout?: number;
	strategy?: TxEventHandlerFactory | null;
}

export class DefaultEventHandlerStrategies {
	public static MSPID_SCOPE_ALLFORTX: TxEventHandlerFactory;
	public static MSPID_SCOPE_ANYFORTX: TxEventHandlerFactory;
	public static NETWORK_SCOPE_ALLFORTX: TxEventHandlerFactory;
	public static NETWORK_SCOPE_ANYFORTX: TxEventHandlerFactory;
}

export type TxEventHandlerFactory = (transaction: Transaction, options: object) => TxEventHandler;

export interface TxEventHandler {
	startListening(): Promise<void>;
	waitForEvents(): Promise<void>;
	cancelListening(): void;
}

export interface QueryOptions {
	strategy?: QueryHandlerFactory;
	timeout?: number;
}

export class QueryHandlerStrategies {
	public static MSPID_SCOPE_ROUND_ROBIN: QueryHandlerFactory;
	public static MSPID_SCOPE_SINGLE: QueryHandlerFactory;
}

export type QueryHandlerFactory = (network: Network) => QueryHandler;

export interface QueryHandler {
	evaluate(query: Query): Promise<Buffer>;
}

export interface Query {
	evaluate(targets: Endorser[]): Promise<QueryResults>;
}

export interface QueryResults {
	[peerName: string]: Error | QueryResponse;
}

export interface QueryResponse {
	isEndorsed: boolean;
	payload: Buffer;
	status: number;
	message: string;
}

export class Gateway {
	public client: Client;
	public identityContext: IdentityContext;
	constructor();
	public connect(config: Client | string | object, options: GatewayOptions): Promise<void>;
	public disconnect(): void;
	public getNetwork(channelName: string): Promise<Network>;
	public getOptions(): GatewayOptions;
}

export class Network {
	public channel: Channel;
	public mspid: string;
	getContract(chaincodeId: string, name?: string): Contract;
	// addBlockListener(callback: (error: Error, blockNumber: string, block: any) => Promise<any>, options?: EventListenerOptions): Promise<BlockEventListener>;
	// addCommitListener(callback: (error: Error, blockNumber: string, transactionId: string, status: string) => Promise<any>, options?: EventListenerOptions): Promise<CommitEventListener>;
	unregisterAllEventListeners(): void;
}

export class Contract {
	createTransaction(name: string): Transaction;
	evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
	submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
	// addContractListener(eventName: string, callback: (error: Error, blockNumber: string, chaincodeEvents: Array<ChaincodeEvent>) => Promise<any>, options?: EventListenerOptions): Promise<ContractEventListener>;
}

export interface TransientMap {
	[key: string]: Buffer;
}
export class Transaction {
	transactionId: string;
	evaluate(...args: string[]): Promise<Buffer>;
	getName(): string;
	getNetwork(): Network;
	setEndorsingPeers(peers: Endorser[]): this;
	setTransient(transientMap: TransientMap): this;
	submit(...args: string[]): Promise<Buffer>;
}

export interface FabricError extends Error {
	cause?: Error;
	transactionId?: string;
}

export interface TimeoutError extends FabricError {} // tslint:disable-line:no-empty-interface

// export class BaseCheckpointer {
// 	constructor(options: any);
// 	public check(blockNumber: string): Promise<boolean>;
// 	public getStartBlock(): Promise<string>;
// 	public initialize(): Promise<void>;
// 	public prune(): Promise<void>;
// 	public save(blockNumber: string): Promise<void>;
// }

// export class FileSystemCheckpointer extends BaseCheckpointer {
// 	constructor(options: any);
// 	public check(blockNumber: string): Promise<boolean>;
// 	public getStartBlock(): Promise<string>;
// 	public initialize(): Promise<void>;
// 	public prune(): Promise<void>;
// 	public save(blockNumber: string): Promise<void>;
// }

export class EventServiceManager {
	constructor();
	public getEventService(peer: Endorser): EventService;
	public getEventServices(peers: Endorser[]): EventService[];
	public getReplayEventService(peer: Endorser): EventService;
	public getReplayEventServices(peers: Endorser[]): EventService[];
}

// export class CommitEventListener {
// 	public register(): void;
// 	public unregister(): void;
// }

// export class ContractEventListener {
// 	public register(): void;
// 	public unregister(): void;
// }

// export class BlockEventListener {
// 	public register(): void;
// 	public unregister(): void;
// }
