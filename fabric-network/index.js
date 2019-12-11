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
 * [Gateway]{@link module:fabric-network.Gateway} class. Once instantiated, this long-living object provides a
 * reusable connection to a peer within the blockchain network, and enables access to any of the blockchain
 * [Networks]{@link module:fabric-network.Network} (channels) for which that peer is a member. This in turn
 * provides access to Smart [Contracts]{@link module:fabric-network.Contract} (chaincode) running within that
 * blockchain network, and to which [Transactions]{@link module:fabric-network.Transaction} can be
 * [submitted]{@link module:fabric-network.Transaction#submit} or queries can be
 * [evaluated]{@link module:fabric-network.Transaction#evaluate}.</p>
 *
 * <p>Private data can be submitted to transactions as [transient]{@link module:fabric-network.Transaction#setTransient}
 * data to prevent it from being recorded on the ledger.</p>
 *
 * @example
 * // Obtain the smart contract with which our application wants to interact
 * const wallet = await Wallets.newFileSystemWallet(walletDirectoryPath);
 * const gatewayOptions: GatewayOptions = {
 *     identity: 'user@example.org', // Previously imported identity
 *     wallet,
 * };
 * const gateway = new Gateway();
 * await gateway.connect(commonConnectionProfile, gatewayOptions);
 * const network = await gateway.getNetwork(channelName);
 * const contract = network.getContract(chaincodeId);
 *
 * // Submit transactions for the smart contract
 * const args = [arg1, arg2];
 * const submitResult = await contract.submitTransaction("transactionName", ...args);
 *
 * // Evaluate queries for the smart contract
 * const evalResult = await contract.evaluateTransaction("transactionName", ...args);
 *
 * // Create and submit transactions for the smart contract with transient data
 * const transientResult = await contract.createTransaction(transactionName)
 *     .setTransient(privateData)
 *     .submit(arg1, arg2);
 *
 * @module fabric-network
 */

/**
 * A base user identity. Actual identity objects will extend this basic structure with credentials applicable to their
 * type. See [X509Identity]{@link module:fabric-network.X509Identity} and
 * [HsmX509Identity]{@link module:fabric-network.HsmX509Identity}.
 * @typedef {object} Identity
 * @memberof module:fabric-network
 * @property {string} type The type of the identity.
 * @property {string} mspId The member services provider with which this identity is associated.
 */

/**
 * Identity described by an X.509 certificate.
 * @typedef {object} X509Identity
 * @memberof module:fabric-network
 * @implements module:fabric-network.Identity
 * @property {'X.509'} type The type of the identity.
 * @property {string} credentials.certificate Certificate in PEM format.
 * @property {string} credentials.privateKey Private key in PEM format.
 */

/**
 * Identity described by an X.509 certificate where the private key is stored in a hardware security module.
 * To use identities of this type, a suitable [HsmX509Provider]{@link module:fabric-network.HsmX509Provider} must be
 * created and added to the identity provider registry of the wallet containing the identity.
 * @typedef {object} HsmX509Identity
 * @memberof module:fabric-network
 * @implements module:fabric-network.Identity
 * @property {'HSM-X.509'} type The type of the identity.
 * @property {string} credentials.certificate Certificate in PEM format.
 */

/**
 * Understands the format of identities of a given type. Converts identity objects to/from the persistent format used
 * within wallet stores, and configures the client with a given identity.
 * @typedef IdentityProvider
 * @memberof module:fabric-network
 * @property {string} type The type identifier for identities that this provider understands.
 */

/**
 * Options describing how to connect to a hardware security module. Options without default values are mandatory but
 * may be be omitted from this object if they are specified through environment variables or external configuration.
 * @typedef {object} HsmOptions
 * @memberof module:fabric-network
 * @property {string} [lib] Path to implementation-specific PKCS#11 library used to interact with the HSM.
 * @property {string} [pin] PIN used to access the HSM.
 * @property {number} [slot] The hardware slot number where data is stored in the HSM.
 * @property {number} [usertype=1] Specify the user type for accessing the HSM.
 * @property {boolean} [readwrite=true] True if the session should be read/write; false if read-only.
 */

/**
 * Interface for store implementations that provide backing storage for identities in a [Wallet]{@link module:fabric-network.Wallet}.
 * @interface WalletStore
 * @memberof module:fabric-network
 */
/**
 * Remove data associated with a given label.
 * @function module:fabric-network.WalletStore#remove
 * @async
 * @param {string} label A label identifying stored data.
 * @returns {Promise<void>}
 */
/**
 * Get data associated with a given label.
 * @function module:fabric-network.WalletStore#get
 * @async
 * @param {string} label A label identifying stored data.
 * @returns {Promise<Buffer | undefined>} Stored data as a Buffer if it exists; otherwise undefined.
 */
/**
 * List the labels for all stored data.
 * @function module:fabric-network.WalletStore#list
 * @async
 * @returns {Promise<string[]>} A list of labels.
 */
/**
 * Put data associated with a given label.
 * @function module:fabric-network.WalletStore#put
 * @async
 * @param {string} label A label identifying stored data.
 * @param {Buffer} data Data to store.
 * @returns {Promise<void>}
 */

module.exports.Gateway = require('./lib/gateway');
module.exports.Wallet = require('./lib/impl/wallet/wallet').Wallet;
module.exports.Wallets = require('./lib/impl/wallet/wallets').Wallets;
module.exports.IdentityProviderRegistry = require('./lib/impl/wallet/identityproviderregistry').IdentityProviderRegistry;
module.exports.HsmX509Provider = require('./lib/impl/wallet/hsmx509identity').HsmX509Provider;
module.exports.DefaultEventHandlerStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
module.exports.DefaultQueryHandlerStrategies = require('fabric-network/lib/impl/query/defaultqueryhandlerstrategies');
module.exports.CheckpointFactories = require('fabric-network/lib/impl/event/checkpointfactories');
module.exports.EventHubSelectionStrategies = require('fabric-network/lib/impl/event/defaulteventhubselectionstrategies');
module.exports.TimeoutError = require('fabric-network/lib/errors/timeouterror');
module.exports.FileSystemCheckpointer = require('fabric-network/lib/impl/event/filesystemcheckpointer');
module.exports.BaseCheckpointer = require('fabric-network/lib/impl/event/basecheckpointer');
