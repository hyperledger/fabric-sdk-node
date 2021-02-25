/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import { Channel, ChannelPeer, TransactionId, User } from 'fabric-client';

import Client = require('fabric-client');

//-------------------------------------------
// Main fabric network classes
//-------------------------------------------
export interface GatewayOptions {
	wallet: Wallet;
	identity: string;
	clientTlsIdentity?: string;
	discovery?: DiscoveryOptions;
	eventHandlerOptions?: DefaultEventHandlerOptions;
	queryHandlerOptions?: DefaultQueryHandlerOptions;
	checkpointer?: CheckpointerOptions;
}

export interface CheckpointerOptions {
	factory: CheckpointerFactory;
	options: object;
}

export interface EventListenerOptions {
	checkpointer?: CheckpointerOptions;
	replay?: boolean;
	filtered?: boolean;
	unregister?: boolean;
	startBlock?: number;
	endBlock?: number;
	asArray?: boolean;
	eventHubConnectWait?: number;
	eventHubConnectTimeout?: number;
}

export interface DiscoveryOptions {
	asLocalhost?: boolean;
	enabled?: boolean;
}

export interface DiscoveryInterest {
	name: string;
	collectionNames?: string[];
}

export interface DefaultEventHandlerOptions {
	commitTimeout?: number;
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

export interface DefaultQueryHandlerOptions {
	timeout?: number;
	strategy?: QueryHandlerFactory;
}

export class DefaultQueryHandlerStrategies {
	public static MSPID_SCOPE_ROUND_ROBIN: QueryHandlerFactory;
	public static MSPID_SCOPE_SINGLE: QueryHandlerFactory;
}

export type QueryHandlerFactory = (network: Network, options: object) => QueryHandler;

export interface QueryHandler {
	evaluate(query: Query): Promise<Buffer>;
}

export interface Query {
	evaluate(peers: ChannelPeer[]): Promise<QueryResults>;
}

export interface QueryResults {
	[peerName: string]: Buffer | Client.ProposalErrorResponse;
}

export class Gateway {
	constructor();
	public connect(config: Client | string | object, options: GatewayOptions): Promise<void>;
	public disconnect(): void;
	public getClient(): Client;
	public getCurrentIdentity(): User;
	public getNetwork(channelName: string): Promise<Network>;
	public getOptions(): GatewayOptions;
}

export interface Network {
	getChannel(): Channel;
	getContract(chaincodeId: string, name?: string): Contract;
	addBlockListener(listenerName: string, callback: (error: Error, block?: Client.Block | Client.FilteredBlock) => Promise<void> | void, options?: EventListenerOptions): Promise<BlockEventListener>;
	addCommitListener(transactionId: string, callback: (error: Error, transactionId?: string, status?: string, blockNumber?: string) => Promise<void> | void, options?: EventListenerOptions): Promise<CommitEventListener>;
	unregisterAllEventListeners(): void;
}

export interface Contract {
	createTransaction(name: string): Transaction;
	evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
	submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
	addContractListener(listenerName: string, eventName: string, callback: (error: Error, event?: Client.ChaincodeEvent | Client.ChaincodeEvent[], blockNumber ?: string, transactionId ?: string, status ?: string) => Promise <void> | void , options ?: EventListenerOptions): Promise<ContractEventListener>;
	addDiscoveryInterest(interest: DiscoveryInterest): Contract;
}

export interface TransientMap {
	[key: string]: Buffer;
}
export interface Transaction {
	evaluate(...args: string[]): Promise<Buffer>;
	getName(): string;
	getTransactionID(): TransactionId;
	getNetwork(): Network;
	setEndorsingPeers(peers: ChannelPeer[]): this;
	setEndorsingOrganizations(...orgs: string[]): this;
	setTransient(transientMap: TransientMap): this;
	submit(...args: string[]): Promise<Buffer>;
	addCommitListener(callback: (error: Error, transactionId?: string, status?: string, blockNumber?: string) => Promise<void> | void, options?: object, eventHub?: Client.ChannelEventHub): Promise<CommitEventListener>;
}

export interface FabricError extends Error {
	cause?: Error;
	transactionId?: string;
}

export interface TimeoutError extends FabricError {} // tslint:disable-line:no-empty-interface
export interface TransactionError extends FabricError {
	transationCode: string;
}

//-------------------------------------------
// Wallet Management
//-------------------------------------------
export interface Identity {
	type: string;
}

export interface IdentityInfo {
	label: string;
	identifier?: string;
	mspId?: string;
}

export interface Wallet {
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
	export(label: string): Promise<Identity>;
	import(label: string, identity: Identity): Promise<void>;
	list(): Promise<IdentityInfo[]>;
}

export class InMemoryWallet implements Wallet {
	constructor(mixin?: WalletMixin);
	public delete(label: string): Promise<void>;
	public exists(label: string): Promise<boolean>;
	public export(label: string): Promise<Identity>;
	public import(label: string, identity: Identity): Promise<void>;
	public list(): Promise<IdentityInfo[]>;
}

export class FileSystemWallet implements Wallet {
	constructor(path: string, mixin?: WalletMixin);
	public delete(label: string): Promise<void>;
	public exists(label: string): Promise<boolean>;
	public export(label: string): Promise<Identity>;
	public import(label: string, identity: Identity): Promise<void>;
	public list(): Promise<IdentityInfo[]>;
}

export class CouchDBWallet implements Wallet {
	constructor(options: CouchDBWalletOptions, mixin?: WalletMixin)
	public delete(label: string): Promise<void>;
	public exists(label: string): Promise<boolean>;
	public export(label: string): Promise<Identity>;
	public import(label: string, identity: Identity): Promise<void>;
	public list(): Promise<IdentityInfo[]>;
}

export interface CouchDBWalletOptions {
	url: string;
}

export interface WalletMixin {} // tslint:disable-line:no-empty-interface

export class X509WalletMixin implements WalletMixin {
	public static createIdentity(mspId: string, certificate: string, privateKey: string): Identity;
	constructor(library?: string, slot?: string, pin?: string, userType?: string);
}

export class HSMWalletMixin implements WalletMixin {
	public static createIdentity(mspId: string, certificate: string): Identity;
	constructor(library?: string, slot?: string, pin?: string, userType?: string);
}

export interface Checkpoint {
	blockNumber: number;
	transactionIds: string[];
}

export class BaseCheckpointer {
	public setChaincodeId(chaincodeId: string): void;
	public loadLatestCheckpoint(): Promise<Checkpoint>;
}

export class FileSystemCheckpointer extends BaseCheckpointer {
	constructor(channelName: string, listenerName: string, options: any);
	public initialize(): Promise<void>;
	public save(transactionId: string, blockNumber: string): Promise<void>;
	public load(): Promise<Checkpoint | {[blockNumber: string]: Checkpoint}>;
}

export type CheckpointerFactory = (channelName: string, listenerName: string, options: object) => BaseCheckpointer;

export class EventHubManager {
	constructor();
	public getEventHub(peer: Client.Peer): Client.ChannelEventHub;
	public getEventHubs(peers: Client.Peer[]): Client.ChannelEventHub[];
	public getReplayEventHub(peer: Client.Peer): Client.ChannelEventHub;
	public getReplayEventHubs(peers: Client.Peer[]): Client.ChannelEventHub[];
}

export class CommitEventListener {
	public register(): void;
	public setEventHub(eventHub: Client.ChannelEventHub, isFixed?: boolean): void;
	public unregister(): void;
}

export class ContractEventListener {
	public register(): void;
	public unregister(): void;
}

export class BlockEventListener {
	public register(): void;
	public unregister(): void;
}

// Alias for AbstractEventHubSelectionStrategy
export interface BaseEventHubSelectionStrategy {
	getNextPeer(): Client.Peer;
	updateEventHubAvailability(deadPeer: Client.Peer): void;
}
export interface AbstractEventHubSelectionStrategy {
	getNextPeer(): Client.Peer;
	updateEventHubAvailability(deadPeer: Client.Peer): void;
}

export class DefaultEventHubSelectionStrategies {
	public static MSPID_SCOPE_ROUND_ROBIN: AbstractEventHubSelectionStrategy;
}
