/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { AllForTxStrategy } from './allfortxstrategy';
import { AnyForTxStrategy } from './anyfortxstrategy';
import { TxEventHandlerFactory, TransactionEventHandler } from './transactioneventhandler';
// @ts-ignore no implicit any
import Network = require('../../network');
import { Endorser } from 'fabric-common';

function getOrganizationPeers(network: Network): Endorser[] {
	return network.channel.getEndorsers(network.mspid);
}

function getNetworkPeers(network: Network): Endorser[] {
	return network.channel.getEndorsers();
}

/**
 * @typedef DefaultEventHandlerStrategies
 * @memberof module:fabric-network
 */

/**
 * @property {module:fabric-network.Gateway~TxEventHandlerFactory} MSPID_SCOPE_ALLFORTX Listen for transaction commit
 * events from all peers in the client identity's organization.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until successful
 * events are received from <em>all</em> currently connected peers (minimum 1).
 * @memberof module:fabric-network.DefaultEventHandlerStrategies
 */
export const MSPID_SCOPE_ALLFORTX: TxEventHandlerFactory = (transactionId, network) => {
	const eventStrategy = new AllForTxStrategy(getOrganizationPeers(network));
	return new TransactionEventHandler(transactionId, network, eventStrategy);
};

/**
 * @property {module:fabric-network.Gateway~TxEventHandlerFactory} MSPID_SCOPE_ANYFORTX Listen for transaction commit
 * events from all peers in the client identity's organization.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until a
 * successful event is received from <em>any</em> peer.
 * @memberof module:fabric-network.DefaultEventHandlerStrategies
 */
export const MSPID_SCOPE_ANYFORTX: TxEventHandlerFactory = (transactionId, network) => {
	const eventStrategy = new AnyForTxStrategy(getOrganizationPeers(network));
	return new TransactionEventHandler(transactionId, network, eventStrategy);
};

/**
 * @property {module:fabric-network.Gateway~TxEventHandlerFactory} MSPID_SCOPE_ALLFORTX Listen for transaction commit
 * events from all peers in the client identity's organization.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until successful
 * events are received from <em>all</em> currently connected peers (minimum 1).
 * @memberof module:fabric-network.DefaultEventHandlerStrategies
 */
export const NETWORK_SCOPE_ALLFORTX: TxEventHandlerFactory = (transactionId, network) => {
	const eventStrategy = new AllForTxStrategy(getNetworkPeers(network));
	return new TransactionEventHandler(transactionId, network, eventStrategy);
};

/**
 * @property {module:fabric-network.Gateway~TxEventHandlerFactory} NETWORK_SCOPE_ANYFORTX Listen for transaction commit
 * events from all peers in the network.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until a
 * successful event is received from <em>any</em> peer.
 * @memberof module:fabric-network.DefaultEventHandlerStrategies
 */
export const NETWORK_SCOPE_ANYFORTX: TxEventHandlerFactory = (transactionId, network) => {
	const eventStrategy = new AnyForTxStrategy(getNetworkPeers(network));
	return new TransactionEventHandler(transactionId, network, eventStrategy);
};
