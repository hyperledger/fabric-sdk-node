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
 * by this API. For these tasks or other specific advanced usage, the lower level <em>fabric-common</em> API
 * should be used. Access to related <em>fabric-common</em> objects is provided through the <em>fabric-network</em>
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

/**
 * Factory function to obtain transaction event handler instances. Called on every transaction submit.
 * @typedef {Function} TxEventHandlerFactory
 * @memberof module:fabric-network
 * @param {string} transactionId The ID of the transaction being submitted.
 * @param {module:fabric-network.Network} network The network on which this transaction is being submitted.
 * @returns {module:fabric-network.TxEventHandler} A transaction event handler.
 */

/**
 * Handler used to wait for commit events when a transaction is submitted.
 * @interface TxEventHandler
 * @memberof module:fabric-network
 */
/**
 * Resolves when the handler has started listening for transaction commit events. Called after the transaction proposal
 * has been accepted and prior to submission of the transaction to the orderer.
 * @function module:fabric-network.TxEventHandler#startListening
 * @async
 * @returns {Promise<void>}
 */
/**
 * Resolves (or rejects) when suitable transaction commit events have been received. Called after submission of the
 * transaction to the orderer.
 * @function module:fabric-network.TxEventHandler#waitForEvents
 * @async
 * @returns {Promise<void>}
 */
/**
 * Called if submission of the transaction to the orderer fails.
 * @function module:fabric-network.TxEventHandler#cancelListening
 * @returns {void}
 */

/**
 * Factory function to obtain query handler instances. Called on every network creation.
 * @typedef {Function} QueryHandlerFactory
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network} network The network on which queries are being evaluated.
 * @returns {module:fabric-network.QueryHandler} A query handler.
 */

/**
 * Handler used to obtain query results from peers when a transaction is evaluated.
 * @interface QueryHandler
 * @memberof module:fabric-network
 */
/**
 * Called when a transaction is evaluated to obtain query results from suitable network peers.
 * @function module:fabric-network.QueryHandler#evaluate
 * @async
 * @param {module:fabric-network.Query} query Query object that can be used by the handler to send the query to
 * specific peers.
 * @returns {Promise<Buffer>}
 */

/**
 * Used by query handler implementations to evaluate transactions on peers of their choosing.
 * @interface Query
 * @memberof module:fabric-network
 */
/**
 * Get query results from specified peers.
 * @function module:fabric-network.Query#evaluate
 * @async
 * @param {Endorser[]} peers
 * @returns {Promise<Array<module:fabric-network.Query~QueryResponse | Error>>}
 */

/**
 * @typedef {Object} Query~QueryResponse
 * @memberof module:fabric-network
 * @property {boolean} isEndorsed True if the proposal was endorsed by the peer.
 * @property {number} status The status value from the endorsement. This attriibute will be set by the chaincode.
 * @property {Buffer} payload The payload value from the endorsement. This attribute may be considered the query value
 * if the proposal was endorsed by the peer.
 * @property {string} message The message value from the endorsement. This property contains the error message from
 * the peer if it did not endorse the proposal.
 */

/**
 * A callback function that will be invoked when either a peer communication error occurs or a transaction commit event
 * is received. Only one of the two arguments will have a value for any given invocation.
 * @callback Network~CommitListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network~CommitError} [error] Peer communication error.
 * @param {module:fabric-network.Network~CommitEvent} [event] Transaction commit event from a specific peer.
 */

/**
 * @typedef {Error} Network~CommitError
 * @memberof module:fabric-network
 * @property {Endorser} peer The peer that raised this error.
 */

/**
 * @typedef {EventInfo} Network~CommitEvent
 * @memberof module:fabric-network
 * @property {Endorser} peer The peer that raised this error.
 */

/**
 * A callback function that will be invoked when a block event is received. Block events will be received in order and
 * without duplication.
 * @callback Network~CommitListener
 * @memberof module:fabric-network
 * @async
 * @param {module:fabric-network.Network~BlockEvent} event Block event.
 * @returns {Promise<void>}
 */

/**
 * @typedef {object} Network~ListenerOptions
 * @memberof module:fabric-network
 * @property {number | string | Long} startBlock The block number from which events should be received.
 */

/**
 * @typedef {object} Network~BlockEvent
 * @memberof module:fabric-network
 * @property {Long} blockNumber The number of the block this event represents.
 * @property {('filtered'|'full'|'private')} type Type of block event. The type will dictate the actual implementation
 * sub-type for this event.
 * @see module:fabric-network.Network~FilteredBlockEvent
 */

/**
 * @typedef {module:fabric-network.Network~BlockEvent} Network~FilteredBlockEvent
 * @memberof module:fabric-network
 * @property {"filtered"} type Type of block event.
 * @property {FilteredBlock} blockData The raw filtered block data.
 */

/**
 * A Network represents the set of peers in a Fabric network.
 * Applications should get a Network instance using the
 * gateway's [getNetwork]{@link module:fabric-network.Gateway#getNetwork} method.
 * @interface Network
 * @memberof module:fabric-network
 */

/**
 * Get the owning Gateway connection.
 * @method Network#getGateway
 * @memberof module:fabric-network
 * @returns {module:fabric-network.Gateway} A Gateway.
 */

/**
 * Get an instance of a contract (chaincode) on the current network.
 * @method Network#getContract
 * @memberof module:fabric-network
 * @param {string} chaincodeId - the chaincode identifier.
 * @param {string} [name] - the name of the contract.
 * @param {string[]} [collections] - the names of collections defined for this chaincode.
 * @returns {module:fabric-network.Contract} the contract.
 */

/**
 * Get the underlying channel object representation of this network.
 * @method Network#getChannel
 * @memberof module:fabric-network
 * @returns {Channel} A channel.
 */

/**
 * Add a listener to receive transaction commit and peer disconnect events for a set of peers.
 * @method Network#addCommitListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network~CommitListener} listener A transaction commit listener callback function.
 * @param {Endorser[]} peers The peers from which to receive events.
 * @param {string} transactionId A transaction ID.
 * @returns {module:fabric-network.Network~CommitListener} The added listener.
 * @example
 * const listener: CommitListener = (error, event) => {
 *     if (error) {
 *         // Handle peer communication error
 *     } else {
 *         // Handle transaction commit event
 *     }
 * }
 * const peers = network.channel.getEndorsers();
 * await network.addCommitListener(listener, peers, transactionId);
 */

/**
 * Remove a previously added transaction commit listener.
 * @method Network#removeCommitListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network~CommitListener} listener A transaction commit listener callback function.
 */

/**
 * Add a listener to receive block events for this network. Blocks will be received in order and without duplication.
 * @method Network#addBlockListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network~BlockListener} listener A block listener callback function.
 * @param {module:fabric-network.Network~ListenerOptions} [options] Listener options.
 * @returns {module:fabric-network.Network~BlockListener} The added listener.
 * @example
 * const listener: BlockListener = async (event) => {
 *     // Handle block event
 *
 *     // Listener may remove itself if desired
 *     if (event.blockNumber === endBlock) {
 *         network.removeBlockListener(listener);
 *     }
 * }
 * const options: ListenerOptions = {
 *     startBlock: 1
 * };
 * await network.addBlockListener(listener, options);
 */

/**
 * Remove a previously added block listener.
 * @method Network#removeBlockListener
 * @memberof module:fabric-network
 * @param listener {module:fabric-network.Network~BlockListener} A block listener callback function.
 */

/**
 * A callback function that will be invoked when either a peer communication error occurs or a transaction commit event
 * is received. Only one of the two arguments will have a value for any given invocation.
 * @callback Network~BlockListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network~BlockEvent} event A block event.
 */


module.exports.Gateway = require('./lib/gateway');
module.exports.Wallet = require('./lib/impl/wallet/wallet').Wallet;
module.exports.Wallets = require('./lib/impl/wallet/wallets').Wallets;
module.exports.IdentityProviderRegistry = require('./lib/impl/wallet/identityproviderregistry').IdentityProviderRegistry;
module.exports.HsmX509Provider = require('./lib/impl/wallet/hsmx509identity').HsmX509Provider;
module.exports.DefaultEventHandlerStrategies = require('./lib/impl/event/defaulteventhandlerstrategies');
module.exports.DefaultQueryHandlerStrategies = require('./lib/impl/query/defaultqueryhandlerstrategies');
module.exports.TimeoutError = require('./lib/errors/timeouterror').TimeoutError;
