/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const tsPath = '../../typescript/integration/network-e2e';

require('./install-chaincode.js');
require('./instantiate-chaincode.js');
// require(tsPath + '/updateAnchorPeers');
require(tsPath + '/invoke.js');
require(tsPath + '/query.js');
