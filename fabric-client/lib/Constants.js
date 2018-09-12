/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
