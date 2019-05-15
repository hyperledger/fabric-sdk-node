/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * <h3>Overview</h3>
 *
 * <p>This module provides a higher level API for interacting with smart contracts, and is the recommended API for
 * client applications to interact with smart contracts deployed to a Hyperledger Fabric blockchain network.</p>
 *
 * <p>Note that administrative capabilities, such as installing and starting smart contracts, are not currently provided
 * by this API. For these tasks or other specific advanced usage, the lower level <em>fabric-client</em> API
 * should be used. Access to related <em>fabric-client</em> objects is provided through the <em>fabric-network</em>
 * API objects.</p>
 *
 * [TypeScript]{@link http://www.typescriptlang.org/} definitions are included in this module.
 *
 * <h3>Getting started</h3>
 *
 * <p>The entry point used to interact with a Hyperledger Fabric blockchain network is the
 * [Gateway]{@link module:fabric-network.Gateway} class. This provides a connection to a peer within the blockchain
 * network, and enables access to any of the blockchain [Network]{@link module:fabric-network.Network}s (channels) for
 * which that peer is a member. This in turn provides access to Smart [Contract]{@link module:fabric-network.Contract}s
 * (chaincode) running within that blockchain network, and to which
 * [Transaction]{@link module:fabric-network.Transaction}s can be
 * [submit]{@link module:fabric-network.Transaction#submit}ted or queries can be
 * [evaluate]{@link module:fabric-network.Transaction#evaluate}d.</p>
 *
 * <p>Private data can be submitted to transactions as [transient]{@link module:fabric-network.Transaction#setTransient}
 * data to prevent it from being recorded on the ledger.</p>
 *
 * @example
 * // Obtain the smart contract with which our application wants to interact
 * const wallet = new FileSystemWallet(walletDirectoryPath);
 * const gatewayOptions: GatewayOptions = {
 *     identity: 'user@example.org', // Previously imported identity
 *     wallet,
 * };
 * const gateway = new Gateway();
 * await gateway.connect(commonConnectionProfile, gatewayOptions);
 * const network = await gateway.getNetwork(channelName);
 * const contract = network.getContract(chaincodeId);
 *
 * // Submit transactions or evaluate queries for the smart contract
 * const result = await contract.createTransaction(transactionName)
 *     .setTransient(privateData)
 *     .submit(arg1, arg2);
 *
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
module.exports.DefaultQueryHandlerStrategies = require('fabric-network/lib/impl/query/defaultqueryhandlerstrategies');
module.exports.CheckpointFactories = require('fabric-network/lib/impl/event/checkpointfactories');
module.exports.EventHubSelectionStrategies = require('fabric-network/lib/impl/event/defaulteventhubselectionstrategies');
module.exports.TimeoutError = require('fabric-network/lib/errors/timeouterror');
module.exports.FileSystemCheckpointer = require('fabric-network/lib/impl/event/filesystemcheckpointer');
module.exports.BaseCheckpointer = require('fabric-network/lib/impl/event/basecheckpointer');
