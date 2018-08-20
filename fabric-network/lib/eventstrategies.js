/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');

function MSPID_SCOPE_ALLFORTX(eventHubFactory, channel, mspId) {
	const peers = channel.getPeerMap().get(mspId);
	return new AllForTxStrategy(eventHubFactory, peers);
}

function MSPID_SCOPE_ANYFORTX(eventHubFactory, channel, mspId) {
	const peers = channel.getPeerMap().get(mspId);
	return new AnyForTxStrategy(eventHubFactory, peers);
}

function CHANNEL_SCOPE_ALLFORTX(eventHubFactory, channel, mspId) {
	const peers = channel.getInternalChannel().getPeers();
	return new AllForTxStrategy(eventHubFactory, peers);
}

function CHANNEL_SCOPE_ANYFORTX(eventHubFactory, channel, mspId) {
	const peers = channel.getInternalChannel().getPeers();
	return new AnyForTxStrategy(eventHubFactory, peers);
}

module.exports = {
	MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX,
	CHANNEL_SCOPE_ALLFORTX,
	CHANNEL_SCOPE_ANYFORTX
};
