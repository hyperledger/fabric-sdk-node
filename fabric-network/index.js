/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Higher level API for interacting with smart contracts.
 * @module fabric-network
 */

module.exports.Gateway = require('./lib/gateway');
module.exports.Wallet = require('./lib/api/wallet');
module.exports.InMemoryWallet = require('./lib/impl/wallet/inmemorywallet');
module.exports.X509WalletMixin = require('./lib/impl/wallet/x509walletmixin');
module.exports.HSMWalletMixin = require('./lib/impl/wallet/hsmwalletmixin');
module.exports.FileSystemWallet = require('./lib/impl/wallet/filesystemwallet');
module.exports.CouchDBWallet = require('./lib/impl/wallet/couchdbwallet');
module.exports.DefaultEventHandlerStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
