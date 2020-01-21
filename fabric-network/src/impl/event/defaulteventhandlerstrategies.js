/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

function getOrganizationEventServices(network) {
	const peers = network.channel.getEndorsers(network.mspid);
	return network.eventServiceManager.getEventServices(peers);
}

function getNetworkEventServices(network) {
	const peers = network.channel.getEndorsers();
	return network.eventServiceManager.getEventServices(peers);
}

function MSPID_SCOPE_ALLFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AllForTxStrategy(getOrganizationEventServices(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function MSPID_SCOPE_ANYFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AnyForTxStrategy(getOrganizationEventServices(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function NETWORK_SCOPE_ALLFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AllForTxStrategy(getNetworkEventServices(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function NETWORK_SCOPE_ANYFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AnyForTxStrategy(getNetworkEventServices(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

/**
 * @typedef DefaultEventHandlerStrategies
 * @memberof module:fabric-network
 * @property MSPID_SCOPE_ALLFORTX Listen for transaction commit events from all peers in the client identity's
 * organization.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until successful
 * events are received from <em>all</em> currently connected peers (minimum 1).
 * @property MSPID_SCOPE_ANYFORTX Listen for transaction commit events from all peers in the client identity's
 * organization.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until a
 * successful event is received from <em>any</em> peer.
 * @property NETWORK_SCOPE_ALLFORTX Listen for transaction commit events from all peers in the network.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until successful
 * events are received from <em>all</em> currently connected peers (minimum 1).
 * @property NETWORK_SCOPE_ANYFORTX Listen for transaction commit events from all peers in the network.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} function will wait until a
 * successful event is received from <em>any</em> peer.
 */

module.exports = {
	MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX
};
