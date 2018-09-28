/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');

/**
 * Default event handler strategy.<br>
 * Listen to all event hubs for the connected organisation.
 * The [submitTransaction]{@link Contract#submitTransaction} method will wait
 * until <b>all</b> of the events to be received from
 * all of the event hubs that are still connected (minimum 1).
 */
function MSPID_SCOPE_ALLFORTX(eventHubFactory, network, mspId) {
	const peers = network.getPeerMap().get(mspId);
	return new AllForTxStrategy(eventHubFactory, peers);
}

/**
 * Event handler strategy.<br>
 * Listen to all event hubs for the connected organisation.
 * The [submitTransaction]{@link Contract#submitTransaction} method will wait
 * until the first event from <b>any</b> of the event hubs that are still connected.
 */
function MSPID_SCOPE_ANYFORTX(eventHubFactory, network, mspId) {
	const peers = network.getPeerMap().get(mspId);
	return new AnyForTxStrategy(eventHubFactory, peers);
}

/**
 * Event handler strategy.<br>
 * Listen to all event hubs for all peers in the current network.
 * The [submitTransaction]{@link Contract#submitTransaction} method will wait
 * until <b>all</b> of the events to be received from
 * all of the event hubs that are still connected (minimum 1).
 */
//eslint-disable-next-line no-unused-vars
function NETWORK_SCOPE_ALLFORTX(eventHubFactory, network, mspId) {
	const peers = network.getChannel().getPeers();
	return new AllForTxStrategy(eventHubFactory, peers);
}

/**
 * Event handler strategy.<br>
 * Listen to all event hubs for all peers in the current network.
 * The [submitTransaction]{@link Contract#submitTransaction} method will wait
 * until the first event from <b>any</b> of the event hubs that are still connected.
 */
//eslint-disable-next-line no-unused-vars
function NETWORK_SCOPE_ANYFORTX(eventHubFactory, network, mspId) {
	const peers = network.getChannel().getPeers();
	return new AnyForTxStrategy(eventHubFactory, peers);
}

module.exports = {
	MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX
};
