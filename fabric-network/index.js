/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * <blockquote>
 * <p><strong>Note:</strong> This API is deprecated as of Fabric v2.5, replaced by the <a href="https://hyperledger.github.io/fabric-gateway/">Fabric Gateway client API</a>.</p>
 * </blockquote>
 *
 * <h3>Overview</h3>
 *
 * <p>This module provides a higher level API for interacting with smart contracts, and is the recommended API for
 * client applications to interact with smart contracts deployed to a Hyperledger Fabric blockchain network.</p>
 *
 * <p>Note that administrative capabilities, such as installing and starting smart contracts, are not currently provided
 * by this API. For only specific advanced usage, the lower level <em>fabric-common</em> API can be used. Access to
 * related <em>fabric-common</em> objects is provided through the <em>fabric-network</em> API objects.</p>
 *
 * <p>If migrating a client application from an earlier version of the API, consult the
 * [migration tutorial]{@tutorial migration} for details of potentially breaking changes and recommended actions.</p>
 *
 * <p>[TypeScript]{@link http://www.typescriptlang.org/} definitions are included in this module.</p>
 *
 * <h3>Getting started</h3>
 *
 * <p>The entry point used to interact with a Hyperledger Fabric blockchain network is the
 * [Gateway]{@link module:fabric-network.Gateway} class. Once instantiated, this long-living object provides a
 * reusable connection to a peer within the blockchain network, and enables access to any of the blockchain
 * [Networks]{@link module:fabric-network.Network} (channels) for which that peer is a member. This in turn
 * provides access to Smart [Contracts]{@link module:fabric-network.Contract} (chaincode) running within that
 * blockchain network, and to which [Transactions]{@link module:fabric-network.Transaction} can be
 * [submitted]{@link module:fabric-network.Contract#submitTransaction} or queries can be
 * [evaluated]{@link module:fabric-network.Contract#evaluateTransaction}.</p>
 *
 * <p>Private data can be submitted to transactions as [transient]{@link module:fabric-network.Transaction#setTransient}
 * data to prevent it from being recorded on the ledger.</p>
 *
 * Client applications can initiate actions or business processes in response to chaincode events emitted by smart
 * contract transactions using [smart contract event listeners]{@link module:fabric-network.Contract}. All updates to
 * the ledger can be observed using [block event listeners]{@link module:fabric-network.Network}.
 *
 * @example
 * // Connect to a gateway peer
 * const connectionProfileJson = (await fs.promises.readFile(connectionProfileFileName)).toString();
 * const connectionProfile = JSON.parse(connectionProfileJson);
 * const wallet = await Wallets.newFileSystemWallet(walletDirectoryPath);
 * const gatewayOptions: GatewayOptions = {
 *     identity: 'user@example.org', // Previously imported identity
 *     wallet,
 * };
 * const gateway = new Gateway();
 * await gateway.connect(connectionProfile, gatewayOptions);
 *
 * try {
 *
 *     // Obtain the smart contract with which our application wants to interact
 *     const network = await gateway.getNetwork(channelName);
 *     const contract = network.getContract(chaincodeId);
 *
 *     // Submit transactions for the smart contract
 *     const args = [arg1, arg2];
 *     const submitResult = await contract.submitTransaction('transactionName', ...args);
 *
 *     // Evaluate queries for the smart contract
 *     const evalResult = await contract.evaluateTransaction('transactionName', ...args);
 *
 *     // Create and submit transactions for the smart contract with transient data
 *     const transientResult = await contract.createTransaction(transactionName)
 *         .setTransient(privateData)
 *         .submit(arg1, arg2);
 *
 * } finally {
 *     // Disconnect from the gateway peer when all work for this client identity is complete
 *     gateway.disconnect();
 * }
 *
 * @module fabric-network
 * @deprecated As of Fabric v2.5, replaced by the <a href="https://hyperledger.github.io/fabric-gateway/">Fabric Gateway client API</a>.
 */

/**
 * A base user identity. Actual identity objects will extend this basic structure with credentials applicable to their
 * type. See [X509Identity]{@link module:fabric-network.X509Identity} and
 * [HsmX509Identity]{@link module:fabric-network.HsmX509Identity}.
 * @interface Identity
 * @memberof module:fabric-network
 * @property {string} type The type of the identity.
 * @property {string} mspId The member services provider with which this identity is associated.
 */

/**
 * Identity described by an X.509 certificate.
 * @interface X509Identity
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
 * @interface HsmX509Identity
 * @memberof module:fabric-network
 * @implements module:fabric-network.Identity
 * @property {'HSM-X.509'} type The type of the identity.
 * @property {string} credentials.certificate Certificate in PEM format.
 */

/**
 * Understands the format of identities of a given type. Converts identity objects to/from the persistent format used
 * within wallet stores, and configures the client with a given identity.
 * @interface IdentityProvider
 * @memberof module:fabric-network
 * @property {string} type The type identifier for identities that this provider understands.
 */

/**
 * Options describing how to connect to a hardware security module. Options without default values are mandatory but
 * may be be omitted from this object if they are specified through environment variables or external configuration.
 * @interface HsmOptions
 * @memberof module:fabric-network
 * @property {string} [lib] Path to implementation-specific PKCS#11 library used to interact with the HSM.
 * @property {string} [pin] PIN used to access the HSM.
 * @property {number} [slot] The hardware slot number where data is stored in the HSM.
 * @property {string} [label] The label for the token initialised in the slot overrides slot if provided (use as an alternative to locating a slot)
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
 * @interface ListenerOptions
 * @memberof module:fabric-network
 * @property {(number | string | Long)} [startBlock] The block number from which events should be received. Leaving this
 * value undefined starts listening from the current block.
 * @property {module:fabric-network.EventType} [type] The type of events to be received.
 * @property {module:fabric-network.Checkpointer} [checkpointer] A checkpointer instance. If the checkpointer has a
 * current block number set, this takes precendence over the <code>startBlock</code> option. If no current block number
 * is set, the <code>startBlock</code> option is used if present.
 */

/**
 * The type of an event. The type is based on the type of the raw event data: filtered, full block or including
 * private data. The presence of optional fields and the type of raw protobuf data associated with events is dictated
 * by this value.
 * @typedef {('filtered' | 'full' | 'private')} EventType
 * @memberof module:fabric-network
 */

/**
 * Persists the current block and transactions within that block to enable event listening to be resumed following an
 * application outage. Default implementations can be obtained from
 * [DefaultCheckpointers]{@link module:fabric-network.DefaultCheckpointers}. Application developers are encouraged to
 * build their own implementations that use a persistent store suitable to their environment.
 * @interface Checkpointer
 * @memberof module:fabric-network
 */
/**
 * Add a transaction ID for the current block. Typically called once a transaction has been processed.
 * @method Checkpointer#addTransactionId
 * @memberof module:fabric-network
 * @async
 * @param {string} transactionId A transaction ID.
 * @returns {Promise<void>}
 */
/**
 * Get the current block number, or <code>undefined</code> if there is no previously saved state.
 * @method Checkpointer#getBlockNumber
 * @memberof module:fabric-network
 * @async
 * @returns {Promise<Long | undefined>} A block number.
 */
/**
 * Get the transaction IDs processed within the current block.
 * @method Checkpointer#getTransactionIds
 * @memberof module:fabric-network
 * @async
 * @returns {Promise<Set<string>>} Transaction IDs.
 */
/**
 * Set the current block number. Also clears the stored transaction IDs. Typically set when the previous block has been
 * processed.
 * @method Checkpointer#setBlockNumber
 * @memberof module:fabric-network
 * @async
 * @param {Long} blockNumber A block number.
 * @returns {Promise<void>}
 */

/**
 * Event representing a block on the ledger.
 * @interface BlockEvent
 * @memberof module:fabric-network
 * @property {Long} blockNumber The number of the block this event represents.
 * @property {(FilteredBlock | Block)} blockData The raw block event protobuf.
 */
/**
 * Get the transactions included in this block.
 * @method BlockEvent#getTransactionEvents
 * @memberof module:fabric-network
 * @returns {module:fabric-network.TransactionEvent[]} Transaction events.
 */

/**
 * Event representing a transaction processed within a block.
 * @interface TransactionEvent
 * @memberof module:fabric-network
 * @property {string} transactionId The ID of the transaction this event represents.
 * @property {string} status The status of this transaction.
 * @property {Date} [timestamp] The transaction timestamp. Note that
 * timestamp does not exist for <strong>filtered</strong> event.
 * @property {boolean} isValid Whether this transaction was successfully committed to the ledger. <code>true</code> if
 * the transaction was commited; otherwise <code>false</code>. The status will provide a more specific reason why an
 * invalid transaction was not committed.
 * @property {(FilteredTransaction | any)} transactionData The raw transaction event protobuf.
 * @property {any} [privateData] Private data read/write sets associated with this transaction. Only present if
 * listening to <strong>private</strong> events and there is private data associated with the transaction.
 */
/**
 * Get the parent block event for this event.
 * @method TransactionEvent#getBlockEvent
 * @memberof module:fabric-network
 * @returns {module:fabric-network.BlockEvent} A block event.
 */
/**
 * Get the contract events emitted by this transaction.
 * @method TransactionEvent#getContractEvents
 * @memberof module:fabric-network
 * @returns {module:fabric-network.ContractEvent[]} Contract events.
 */

/**
 * Event representing a contract event emitted by a smart contract.
 * @interface ContractEvent
 * @memberof module:fabric-network
 * @property {string} chaincodeId The chaincode ID of the smart contract that emitted this event.
 * @property {string} eventName The name of the emitted event.
 * @property {Buffer} [payload] The data associated with this event by the smart contract. Note that
 * <strong>filtered</strong> events do not include any payload data.
 */
/**
 * Get the parent transaction event of this event.
 * @method ContractEvent#getTransactionEvent
 * @memberof module:fabric-network
 * @returns {module:fabric-network.TransactionEvent} A transaction event.
 */

module.exports.Gateway = require('./lib/gateway').Gateway;
module.exports.Wallet = require('./lib/impl/wallet/wallet').Wallet;
module.exports.Wallets = require('./lib/impl/wallet/wallets').Wallets;
module.exports.IdentityProviderRegistry = require('./lib/impl/wallet/identityproviderregistry').IdentityProviderRegistry;
module.exports.HsmX509Provider = require('./lib/impl/wallet/hsmx509identity').HsmX509Provider;
module.exports.DefaultCheckpointers = require('./lib/defaultcheckpointers').DefaultCheckpointers;
module.exports.DefaultEventHandlerStrategies = require('./lib/impl/event/defaulteventhandlerstrategies');
module.exports.DefaultQueryHandlerStrategies = require('./lib/impl/query/defaultqueryhandlerstrategies');
module.exports.TimeoutError = require('./lib/errors/timeouterror').TimeoutError;
