/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricConstants = require('fabric-client/lib/Constants');
const RoundRobinEventHubSelectionStrategy = require('fabric-network/lib/impl/event/roundrobineventhubselectionstrategy');

function getOrganizationPeers(network) {
	return network.getChannel().getPeersForOrg();
}

function filterEventEmittingPeers(peers) {
	return peers.filter((peer) => peer.isInRole(FabricConstants.NetworkConfig.EVENT_SOURCE_ROLE));
}

function MSPID_SCOPE_ROUND_ROBIN(network) {
	const orgPeers = getOrganizationPeers(network);
	const eventEmittingPeers = filterEventEmittingPeers(orgPeers);
	return new RoundRobinEventHubSelectionStrategy(eventEmittingPeers);
}

/**
 * @typedef module:fabric-network~DefaultEventHubSelectionStrategies
 * @memberof module:fabric-network
 * @property {function} MSPID_SCOPE_ROUND_ROBIN Reconnect to any of the event emitting peers in the org after
 * a disconnect occurs. Select the event hub in a 'round robin' fashion
 */
module.exports = {
	MSPID_SCOPE_ROUND_ROBIN
};
