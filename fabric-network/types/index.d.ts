/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* tslint:disable:max-classes-per-file */

import { Wallet } from '../lib/impl/wallet/wallet';
import { Identity } from '../lib/impl/wallet/identity';
import { IdentityProvider } from '../lib/impl/wallet/identityprovider';
import { QueryHandlerFactory } from '../lib/impl/query/queryhandler';
import { Network } from '../lib/network';
import { Endorser } from 'fabric-common';

export { Wallet };
export { Wallets } from '../lib/impl/wallet/wallets';
export { WalletStore } from '../lib/impl/wallet/walletstore';
export { Identity };
export { IdentityData } from '../lib/impl/wallet/identitydata';
export { IdentityProvider };
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
export { GatewayOptions, DiscoveryOptions, Gateway, DefaultEventHandlerOptions, DefaultQueryHandlerOptions } from '../lib/gateway';
export { DiscoveryInterest, Contract } from '../lib/contract';

// Main fabric network classes
// -------------------------------------------

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
