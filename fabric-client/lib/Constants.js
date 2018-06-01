/*
 Copyright 2016, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

module.exports.LSCC = 'lscc';
module.exports.QSCC = 'qscc';
module.exports.CSCC = 'cscc';
module.exports.SYSTEM_CHANNEL_NAME = 'testchainid';
module.exports.NetworkConfig = {};
module.exports.NetworkConfig.ENDORSING_PEER_ROLE = 'endorsingPeer';
module.exports.NetworkConfig.CHAINCODE_QUERY_ROLE = 'chaincodeQuery';
module.exports.NetworkConfig.LEDGER_QUERY_ROLE = 'ledgerQuery';
module.exports.NetworkConfig.EVENT_SOURCE_ROLE = 'eventSource';
module.exports.NetworkConfig.DISCOVERY_ROLE = 'discover';
module.exports.NetworkConfig.ALL_ROLES = 'all';
module.exports.NetworkConfig.ROLES = [
	module.exports.NetworkConfig.ENDORSING_PEER_ROLE,
	module.exports.NetworkConfig.CHAINCODE_QUERY_ROLE,
	module.exports.NetworkConfig.LEDGER_QUERY_ROLE,
	module.exports.NetworkConfig.EVENT_SOURCE_ROLE,
	module.exports.NetworkConfig.DISCOVERY_ROLE,
	module.exports.NetworkConfig.ALL_ROLES
];
