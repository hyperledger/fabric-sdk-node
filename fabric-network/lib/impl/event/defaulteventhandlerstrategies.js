/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricConstants = require('fabric-client/lib/Constants');

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');

function getOrganizationEventHubs(network) {
	const peers = network.getChannel().getPeersForOrg().filter(hasEventSourceRole);
	return network.getEventHubManager().getEventHubs(peers);
}

function getNetworkEventHubs(network) {
	const peers = network.getChannel().getPeers().filter(hasEventSourceRole);
	return network.getEventHubManager().getEventHubs(peers);
}

function hasEventSourceRole(peer) {
	return peer.isInRole(FabricConstants.NetworkConfig.EVENT_SOURCE_ROLE);
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
