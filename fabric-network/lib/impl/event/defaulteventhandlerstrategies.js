/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

function getOrganizationEventHubs(network) {
	const peers = network.getChannel().getPeersForOrg();
	return network.getEventHubManager().getEventHubs(peers);
}

function getNetworkEventHubs(network) {
	const peers = network.getChannel().getPeers();
	return network.getEventHubManager().getEventHubs(peers);
}

function MSPID_SCOPE_ALLFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AllForTxStrategy(getOrganizationEventHubs(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function MSPID_SCOPE_ANYFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AnyForTxStrategy(getOrganizationEventHubs(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function NETWORK_SCOPE_ALLFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AllForTxStrategy(getNetworkEventHubs(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

function NETWORK_SCOPE_ANYFORTX(transaction, options) {
	const network = transaction.getNetwork();
	const eventStrategy = new AnyForTxStrategy(getNetworkEventHubs(network));
	return new TransactionEventHandler(transaction, eventStrategy, options);
}

/**
 * @typedef DefaultEventHandlerStrategies
 * @memberof module:fabric-network
 * @property NETWORK_SCOPE_ANYFORTX Listen to all event hubs for the connected organisation.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} method will wait
 * until <b>all</b> of the events to be received from
 * all of the event hubs that are still connected (minimum 1).
 * @property MSPID_SCOPE_ALLFORTX Listen to all event hubs for the connected organisation.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} method will wait
 * until the first event from <b>any</b> of the event hubs that are still connected.
 * @property MSPID_SCOPE_ANYFORTX Listen to all event hubs for all peers in the current network.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} method will wait
 * until <b>all</b> of the events to be received from
 * all of the event hubs that are still connected (minimum 1).
 * @property NETWORK_SCOPE_ALLFORTX Listen to all event hubs for all peers in the current network.
 * The [submitTransaction]{@link module:fabric-network.Contract#submitTransaction} method will wait
 * until the first event from <b>any</b> of the event hubs that are still connected.
*/

module.exports = {
	MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX
};
