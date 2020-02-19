/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import { Wallet } from '../lib/impl/wallet/wallet';
import { CommitListener } from '../lib/impl/event/commitlistener';
import { Identity } from '../lib/impl/wallet/identity';
import { QueryHandlerFactory } from '../lib/impl/query/queryhandler';
import { Network } from '../lib/network';
import { ChaincodeEvent, Channel, Client, Endorser, EventService, IdentityContext, ProposalResponse, User } from 'fabric-common';

export { Wallet };
export { Wallets } from '../lib/impl/wallet/wallets';
export { WalletStore } from '../lib/impl/wallet/walletstore';
export { Identity };
export { IdentityData } from '../lib/impl/wallet/identitydata';
export { IdentityProvider } from '../lib/impl/wallet/identityprovider';
export { IdentityProviderRegistry } from '../lib/impl/wallet/identityproviderregistry';
export { HsmOptions, HsmX509Provider, HsmX509Identity } from '../lib/impl/wallet/hsmx509identity';
export { X509Identity } from '../lib/impl/wallet/x509identity';
export { CommitEvent, CommitError, CommitListener } from '../lib/impl/event/commitlistener';
export { BlockEvent, BlockListener } from '../lib/impl/event/blocklistener';
export { FabricError } from '../lib/errors/fabricerror';
export { TimeoutError } from '../lib/errors/timeouterror';
export { QueryHandlerFactory };
export { QueryHandler } from '../lib/impl/query/queryhandler';
export { Query, QueryResults, QueryResponse } from '../lib/impl/query/query';
export { Network };

import * as DefaultEventHandlerStrategies from '../lib/impl/event/defaulteventhandlerstrategies';
export { DefaultEventHandlerStrategies };

import { TxEventHandler, TxEventHandlerFactory } from '../lib/impl/event/transactioneventhandler';
export { TxEventHandler, TxEventHandlerFactory };

import * as DefaultQueryHandlerStrategies from '../lib/impl/query/defaultqueryhandlerstrategies';
export { DefaultQueryHandlerStrategies };

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

export interface QueryOptions {
	strategy?: QueryHandlerFactory;
	timeout?: number;
}

export class Gateway {
	public client: Client;
	public identityContext: IdentityContext;
	constructor();
	public connect(config: Client | string | object, options: GatewayOptions): Promise<void>;
	public disconnect(): void;
	public getIdentity(): Identity;
	public getNetwork(channelName: string): Promise<Network>;
	public getOptions(): GatewayOptions;
}

export class Contract {
	createTransaction(name: string): Transaction;
	evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
	submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
}

export interface TransientMap {
	[key: string]: Buffer;
}
export class Transaction {
	evaluate(...args: string[]): Promise<Buffer>;
	getName(): string;
	setEndorsingPeers(peers: Endorser[]): this;
	setTransient(transientMap: TransientMap): this;
	submit(...args: string[]): Promise<Buffer>;
}

export class EventServiceManager {
	constructor();
	public getEventService(peer: Endorser): EventService;
	public getEventServices(peers: Endorser[]): EventService[];
	public getReplayEventService(peer: Endorser): EventService;
	public getReplayEventServices(peers: Endorser[]): EventService[];
}
