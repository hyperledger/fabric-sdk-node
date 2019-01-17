/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricConstants = require('fabric-client/lib/Constants');

const SingleQueryHandler = require('fabric-network/lib/impl/query/singlequeryhandler');

function getOrganizationPeers(network) {
	return network.getChannel().getPeersForOrg();
}

function filterQueryablePeers(peers) {
	return peers.filter((peer) => peer.isInRole(FabricConstants.NetworkConfig.CHAINCODE_QUERY_ROLE));
}

// function getNetworkPeers(network) {
// 	return network.getChannel().getPeers();
// }

function MSPID_SCOPE_SINGLE(network, options) {
	const orgPeers = getOrganizationPeers(network);
	const queryPeers = filterQueryablePeers(orgPeers);
	return new SingleQueryHandler(queryPeers);
}

/**
 * @typedef DefaultQueryHandlerStrategies
 * @memberof module:fabric-network
 * @property MSPID_SCOPE_SINGLE Query any one of the event hubs for the connected organisation. Continue
 * to use the same event hub for all queries unless it fails.
 */

module.exports = {
	MSPID_SCOPE_SINGLE
};
