/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');

const Network = require('./network');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const QueryStrategies = require('fabric-network/lib/impl/query/defaultqueryhandlerstrategies');
const EventHubSelectionStrategies = require('fabric-network/lib/impl/event/defaulteventhubselectionstrategies');
const CheckpointFactories = require('fabric-network/lib/impl/event/checkpointfactories');

const logger = require('./logger').getLogger('Gateway');

/**
 * @typedef {Object} Gateway~GatewayOptions
 * @memberof module:fabric-network
 * @property {module:fabric-network.Wallet} wallet The identity wallet implementation for use with this Gateway instance.
 * @property {string} identity The identity in the wallet for all interactions on this Gateway instance.
 * @property {string} [clientTlsIdentity] The identity in the wallet to use as the client TLS identity.
 * @property {module:fabric-network.Gateway~DefaultEventHandlerOptions} [eventHandlerOptions] Options for the inbuilt default
 * event handler capability.
 * @property {module:fabric-network.Gateway~DefaultQueryHandlerOptions} [queryHandlerOptions] Options for the inbuilt
 * default query handler capability.
 * @property {module:fabric-network.Gateway~DiscoveryOptions} [discovery] Discovery options.
 * @property {module:fabric-network.Gateway~DefaultEventHubSelectionOptions} [eventHubSelectionOptions] Event hub selection options.
 * @property {module:fabric-network.Network~CheckpointerFactory} [checkpointer] Event hub selection options.
 */

/**
 * @typedef {Object} Gateway~DefaultEventHandlerOptions
 * @memberof module:fabric-network
 * @property {number} [commitTimeout = 300] The timeout period in seconds to wait for commit notification to
 * complete.
 * @property {?module:fabric-network.Gateway~TxEventHandlerFactory} [strategy=MSPID_SCOPE_ALLFORTX] Event handling strategy to identify
 * successful transaction commits. A null value indicates that no event handling is desired. The default is
 * [MSPID_SCOPE_ALLFORTX]{@link module:fabric-network.DefaultEventHandlerStrategies}.
 */

/**
 * @typedef {Function} Gateway~TxEventHandlerFactory
 * @memberof module:fabric-network
 * @param {String} transactionId The transaction ID for which the handler should listen.
 * @param {module:fabric-network.Network} network The network on which this transaction is being submitted.
 * @returns {module:fabric-network.Gateway~TxEventHandler} A transaction event handler.
 */

/**
 * @typedef {Object} Gateway~TxEventHandler
 * @memberof module:fabric-network
 * @property {Function} startListening Async function that resolves when the handler has started listening for
 * transaction commit events. Called after the transaction proposal has been accepted and prior to submission of
 * the transaction to the orderer.
 * @property {Function} waitForEvents Async function that resolves (or rejects) when suitable transaction
 * commit events have been received. Called after submission of the transaction to the orderer.
 * @property {Function} cancelListening Cancel listening. Called if submission of the transaction to the orderer
 * fails.
 */

/**
 * @typedef {Object} Gateway~DefaultEventHubSelectionOptions
 * @memberof module:fabric-network
 * @property {?module:fabric-network.Gateway~DefaultEventHubSelectionFactory} [strategy=MSPID_SCOPE_ROUND_ROBIN] Selects the next
 * event hub in the event of a new listener being created or an event hub disconnect
 */

/**
 * @typedef {Object} Gateway~DefaultEventHubSelectionFactory
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network} network The network the event hub is being selected for
 * @returns {module:fabric-network.Gateway~AbstractEventHubSelectionStrategy}
 */

/**
  * @typedef {Object} Gateway~AbstractEventHubSelectionStrategy
  * @memberof module:fabric-network
  * @property {Function} getNextPeer Function that returns the next peer in the list of available peers
  * @property {Function} updateEventHubAvailability Function that updates the availability of an event hub
  */


/**
 * @typedef {Object} Gateway~DefaultQueryHandlerOptions
 * @memberof module:fabric-network
 * @property {module:fabric-network.Gateway~QueryHandlerFactory} [strategy=MSPID_SCOPE_SINGLE] Query handling strategy
 * used to evaluate queries. The default is [MSPID_SCOPE_SINGLE]{@link module:fabric-network.DefaultQueryHandlerStrategies}.
 */

/**
 * @typedef {Function} Gateway~QueryHandlerFactory
 * @memberof module:fabric-network
 * @param {module:fabric-network.Network} network The network on which queries are being evaluated.
 * @returns {module:fabric-network.Gateway~QueryHandler} A query handler.
 */

/**
 * @typedef {Object} Gateway~QueryHandler
 * @memberof module:fabric-network
 * @property {Function} evaluate Async function that takes a [Query]{@link module:fabric-network.Query} and resolves
 * with the result of the query evaluation.
 */

/**
 * @typedef {Object} Gateway~DiscoveryOptions
 * @memberof module:fabric-network
 * @property {boolean} [enabled=true] True if discovery should be used; otherwise false.
 * @property {boolean} [asLocalhost=true] Convert discovered host addresses to be 'localhost'. Will be needed when
 * running a docker composed fabric network on the local system; otherwise should be disabled.
 */

/**
 * The gateway peer provides the connection point for an application to access the Fabric network.  It is instantiated using
 * the default constructor.
 * It can then be connected to a fabric network using the [connect]{@link #connect} method by passing either a CCP definition
 * or an existing {@link Client} object.
 * Once connected, it can then access individual Network instances (channels) using the [getNetwork]{@link #getNetwork} method
 * which in turn can access the [smart contracts]{@link Contract} installed on a network and
 * [submit transactions]{@link Contract#submitTransaction} to the ledger.
 * @memberof module:fabric-network
 */
class Gateway {

	static _mergeOptions(defaultOptions, suppliedOptions) {
		for (const prop in suppliedOptions) {
			if (typeof suppliedOptions[prop] === 'object' && suppliedOptions[prop] !== null) {
				if (defaultOptions[prop] === undefined) {
					defaultOptions[prop] = suppliedOptions[prop];
				} else {
					Gateway._mergeOptions(defaultOptions[prop], suppliedOptions[prop]);
				}
			} else {
				defaultOptions[prop] = suppliedOptions[prop];
			}
		}
	}

	constructor() {
		logger.debug('in Gateway constructor');
		this.client = null;
		this.wallet = null;
		this.networks = new Map();

		// default options
		this.options = {
			queryHandlerOptions: {
				strategy: QueryStrategies.MSPID_SCOPE_SINGLE
			},
			eventHandlerOptions: {
				commitTimeout: 300, // 5 minutes
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			},
			discovery: {
				enabled: Client.getConfigSetting('initialize-with-discovery', true)
			},
			checkpointer: {
				factory: CheckpointFactories.FILE_SYSTEM_CHECKPOINTER,
				options: {}
			},
			eventHubSelectionOptions: {
				strategy: EventHubSelectionStrategies.MSPID_SCOPE_ROUND_ROBIN,
			}
		};
	}

	/**
     * Connect to the Gateway with a connection profile or a prebuilt Client instance.
     * @async
     * @param {(string|object|Client)} config The configuration for this Gateway which can be:
	 * <ul>
	 *   <li>A fully qualified common connection profile file path (String)</li>
	 *   <li>A common connection profile JSON (Object)</li>
	 *   <li>A pre-configured client instance</li>
	 * </ul>
     * @param {module:fabric-network.Gateway~GatewayOptions} options specific options for creating this Gateway instance
	 * @example
	 * const gateway = new Gateway();
	 * const wallet = new FileSystemWallet('./WALLETS/wallet');
	 * const ccpFile = fs.readFileSync('./network.json');
	 * const ccp = JSON.parse(ccpFile.toString());
	 * await gateway.connect(ccp, {
	 *   identity: 'admin',
	 *   wallet: wallet
	 * });
     */
	async connect(config, options) {
		const method = 'connect';
		logger.debug('in %s', method);

		if (!options || !options.wallet) {
			logger.error('%s - A wallet must be assigned to a Gateway instance', method);
			throw new Error('A wallet must be assigned to a Gateway instance');
		}

		Gateway._mergeOptions(this.options, options);
		logger.debug('connection options: %j', options);

		if (!(config && config.constructor && config.constructor.name === 'Client')) {
			// still use a ccp for the discovery peer and ca information
			logger.debug('%s - loading client from ccp', method);
			this.client = Client.loadFromConfig(config);
		} else {
			// initialize from an existing Client object instance
			logger.debug('%s - using existing client object', method);
			this.client = config;
		}

		// setup an initial identity for the Gateway
		if (options.identity) {
			logger.debug('%s - setting identity', method);
			this.currentIdentity = await options.wallet.setUserContext(this.client, options.identity);
		}

		if (options.clientTlsIdentity) {
			const tlsIdentity = await options.wallet.export(options.clientTlsIdentity);
			this.client.setTlsClientCertAndKey(tlsIdentity.certificate, tlsIdentity.privateKey);
		}

		if (options.tlsInfo && !options.clientTlsIdentity) {
			this.client.setTlsClientCertAndKey(options.tlsInfo.certificate, options.tlsInfo.key);
		}
	}

	/**
     * Get the current identity
     *
     * @returns {User} The current identity used by this Gateway.
     */
	getCurrentIdentity() {
		logger.debug('in getCurrentIdentity');
		return this.currentIdentity;
	}

	/**
     * Get the underlying Client object instance
     *
     * @returns {Client} The underlying client instance
     */
	getClient() {
		logger.debug('in getClient');
		return this.client;
	}

	/**
	 * Returns the set of options associated with the Gateway connection
	 * @returns {module:fabric-network.Gateway~GatewayOptions} The Gateway connection options
	 */
	getOptions() {
		logger.debug('in getOptions');
		return this.options;
	}

	/**
     * Clean up and disconnect this Gateway connection in preparation for it to be discarded and garbage collected
     */
	disconnect() {
		logger.debug('in disconnect');
		for (const network of this.networks.values()) {
			network._dispose();
		}
		this.networks.clear();
	}

	/**
	 * Returns an object representing a network
	 * @param {string} networkName The name of the network (channel name)
	 * @returns {module:fabric-network.Network}
	 */
	async getNetwork(networkName) {
		logger.debug('in getNetwork');

		const existingNetwork = this.networks.get(networkName);
		if (existingNetwork) {
			return existingNetwork;
		}

		logger.debug('getNetwork: create network object and initialize');
		let channel = this.client.getChannel(networkName, false);
		if (channel === null) {
			// not found in the in-memory cache or the CCP
			channel = this.client.newChannel(networkName);
		}
		const newNetwork = new Network(this, channel);
		await newNetwork._initialize(this.options.discovery);
		this.networks.set(networkName, newNetwork);
		return newNetwork;
	}
}

module.exports = Gateway;
