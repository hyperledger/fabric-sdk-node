/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import { Wallet } from '../lib/impl/wallet/wallet';
import { ContractListener, ListenerOptions } from '../lib/events';
import { Identity } from '../lib/impl/wallet/identity';
import { QueryHandlerFactory } from '../lib/impl/query/queryhandler';
import { Network } from '../lib/network';
import { Client, Endorser, IdentityContext } from 'fabric-common';

export { Wallet };
export { Wallets } from '../lib/impl/wallet/wallets';
export { WalletStore } from '../lib/impl/wallet/walletstore';
export { Identity };
export { IdentityData } from '../lib/impl/wallet/identitydata';
export { IdentityProvider } from '../lib/impl/wallet/identityprovider';
export { IdentityProviderRegistry } from '../lib/impl/wallet/identityproviderregistry';
export { HsmOptions, HsmX509Provider, HsmX509Identity } from '../lib/impl/wallet/hsmx509identity';
export { X509Identity } from '../lib/impl/wallet/x509identity';
export * from '../lib/events';
export { FabricError } from '../lib/errors/fabricerror';
export { TimeoutError } from '../lib/errors/timeouterror';
export { QueryHandlerFactory };
export { QueryHandler } from '../lib/impl/query/queryhandler';
export { Query, QueryResults, QueryResponse } from '../lib/impl/query/query';
export { Network };
export { Checkpointer } from '../lib/checkpointer';
export { DefaultCheckpointers } from '../lib/defaultcheckpointers';

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
	eventHandlerOptions?: DefaultEventHandlerOptions;
	queryHandlerOptions?: DefaultQueryHandlerOptions;
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
	endorseTimeout?: number;
	strategy?: TxEventHandlerFactory | null;
}

export interface DefaultQueryHandlerOptions {
	strategy?: QueryHandlerFactory;
	timeout?: number;
}

export class Gateway {
	constructor();
	public connect(config: Client | string | object, options: GatewayOptions): Promise<void>;
	public disconnect(): void;
	public getIdentity(): Identity;
	public getNetwork(channelName: string): Promise<Network>;
	public getOptions(): GatewayOptions;
}

export class Contract {
	readonly chaincodeId: string;
	readonly namespace: string;
	createTransaction(name: string): Transaction;
	evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
	submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
	addContractListener(listener: ContractListener, options?: ListenerOptions): Promise<ContractListener>;
	removeContractListener(listener: ContractListener): void;
	addDiscoveryInterest(interest: DiscoveryInterest): Contract;
	resetDiscoveryInterests(): Contract;
}

export interface TransientMap {
	[key: string]: Buffer;
}
export class Transaction {
	getName(): string;
	getTransactionId(): string | null;
	setEndorsingPeers(peers: Endorser[]): this;
	setEndorsingOrganizations(...orgs: string[]): this;
	setTransient(transientMap: TransientMap): this;
	submit(...args: string[]): Promise<Buffer>;
	evaluate(...args: string[]): Promise<Buffer>;
}
