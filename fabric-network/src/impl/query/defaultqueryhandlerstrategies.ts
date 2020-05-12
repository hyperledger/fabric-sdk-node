/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { SingleQueryHandler } from './singlequeryhandler';
import { RoundRobinQueryHandler } from './roundrobinqueryhandler';
import { Network } from '../../network';
import { QueryHandlerFactory } from './queryhandler';

function getOrganizationPeers(network: Network) {
	const mspId = network.getGateway().getIdentity().mspId;
	return network.getChannel().getEndorsers(mspId);
}

/**
 * @typedef DefaultQueryHandlerStrategies
 * @memberof module:fabric-network
 * @property {module:fabric-network.QueryHandlerFactory} MSPID_SCOPE_SINGLE Query any one of the peers for the connected organization. Continue
 * to use the same event service for all queries unless it fails.
 * @property {module:fabric-network.QueryHandlerFactory} MSPID_SCOPE_ROUND_ROBIN Query any one of the peers for the connected organization.
 * Use the next available peer for each successive query.
 */

export const MSPID_SCOPE_SINGLE: QueryHandlerFactory = (network) => {
	const peers = getOrganizationPeers(network);
	return new SingleQueryHandler(peers);
};

export const MSPID_SCOPE_ROUND_ROBIN: QueryHandlerFactory = (network) => {
	const peers = getOrganizationPeers(network);
	return new RoundRobinQueryHandler(peers);
};
