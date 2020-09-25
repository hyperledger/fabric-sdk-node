/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { SingleQueryHandler } from './singlequeryhandler';
import { RoundRobinQueryHandler } from './roundrobinqueryhandler';
import { Network } from '../../network';
import { QueryHandlerFactory } from './queryhandler';
import { Endorser } from 'fabric-common';

function getOrganizationPeers(network: Network) {
	const mspId = network.getGateway().getIdentity().mspId;
	return network.getChannel().getEndorsers(mspId);
}

function getNetworkPeers(network: Network): Endorser[] {
	return network.getChannel().getEndorsers();
}

/**
 * @typedef DefaultQueryHandlerStrategies
 * @memberof module:fabric-network
 * @property {module:fabric-network.QueryHandlerFactory} MSPID_SCOPE_SINGLE Query any one of the peers for the connected organization. Continue
 * to use the same event service for all queries unless it fails. If the client identity's organization has no peers, this strategy will fail.
 * @property {module:fabric-network.QueryHandlerFactory} MSPID_SCOPE_ROUND_ROBIN Query any one of the peers for the connected organization.
 * Use the next available peer for each successive query. If the client identity's organization has no peers, this strategy will fail.
 * @property {module:fabric-network.QueryHandlerFactory} PREFER_MSPID_SCOPE_SINGLE Query any one of the peers for the connected organization. If the
 * connected organization has no peers, query any one of the peers in the network. Continue to use the same event service for all queries unless it
 * fails.
 * @property {module:fabric-network.QueryHandlerFactory} PREFER_MSPID_SCOPE_ROUND_ROBIN Query any one of the peers for the connected organization. If
 * the connected organization has no peers, query any one of the peers in the network. Use the next available peer for each successive query.
 */

export const MSPID_SCOPE_SINGLE: QueryHandlerFactory = (network) => {
	const peers = getOrganizationPeers(network);
	return new SingleQueryHandler(peers);
};

export const MSPID_SCOPE_ROUND_ROBIN: QueryHandlerFactory = (network) => {
	const peers = getOrganizationPeers(network);
	return new RoundRobinQueryHandler(peers);
};

export const PREFER_MSPID_SCOPE_SINGLE: QueryHandlerFactory = (network) => {
	let peers = getOrganizationPeers(network);
	if (peers.length === 0) {
		peers = getNetworkPeers(network);
	}
	return new SingleQueryHandler(peers);
};

export const PREFER_MSPID_SCOPE_ROUND_ROBIN: QueryHandlerFactory = (network) => {
	let peers = getOrganizationPeers(network);
	if (peers.length === 0) {
		peers = getNetworkPeers(network);
	}
	return new RoundRobinQueryHandler(peers);
};
