/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {NetworkImpl: Network} = require('./network');
const NetworkConfig = require('./impl/ccp/networkconfig');
const {Client} = require('fabric-common');
const EventStrategies = require('./impl/event/defaulteventhandlerstrategies');
const QueryStrategies = require('./impl/query/defaultqueryhandlerstrategies');
const {newDefaultProviderRegistry} = require('./impl/wallet/identityproviderregistry');

const logger = require('./logger').getLogger('Gateway');

/**
 * @typedef {Object} Gateway~GatewayOptions
 * @memberof module:fabric-network
 * @property {(string|module:fabric-network.Identity)} identity The identity used for all interactions on this Gateway
 * instance. This can be either:
 * <ul>
 *   <li>a label matching an identity within the supplied wallet.</li>
 *   <li>an identity object.</li>
 * </ul
 * @property {module:fabric-network.Wallet} [wallet] The identity wallet implementation for use with this Gateway
 * instance. Required if a label is specified as the <code>identity</code>, or <code>clientTlsIdentity</code> is specified.
 * @property {module:fabric-network.IdentityProvider} [identityProvider] An identity provider for the supplied identity
 * object. Required if an identity object is not one of the default supported types.
 * @property {string} [clientTlsIdentity] The identity within the wallet to use as the client TLS identity.
 * @property {module:fabric-network.Gateway~TransactionOptions} [transaction]
 * Options for the default event handler capability.
 * @property {module:fabric-network.Gateway~QueryOptions} [query]
 * Options for the default query handler capability.
 * @property {module:fabric-network.Gateway~DiscoveryOptions} [discovery] Discovery options.
 */

/**
 * @typedef {Object} Gateway~TransactionOptions
 * @memberof module:fabric-network
 * @property {number} [commitTimeout = 300] The timeout period in seconds to wait
 * for commit notification to complete.
 * @property {number} [endorseTimeout = 30] The timeout period in seconds to wait
 * for the endorsement to complete.
 * @property {?module:fabric-network.TxEventHandlerFactory} [strategy=MSPID_SCOPE_ALLFORTX]
 * Event handling strategy to identify successful transaction commits. A null value indicates
 * that no event handling is desired. The default is
 * [MSPID_SCOPE_ALLFORTX]{@link module:fabric-network.EventHandlerStrategies}.
 */

/**
 * @typedef {Object} Gateway~QueryOptions
 * @memberof module:fabric-network
 * @property {number} [timeout = 30] The timeout period in seconds to wait for the query to
 * complete.
 * @property {module:fabric-network.QueryHandlerFactory} [strategy=MSPID_SCOPE_SINGLE]
 * Query handling strategy used to evaluate queries. The default is
 * [MSPID_SCOPE_SINGLE]{@link module:fabric-network.QueryHandlerStrategies}.
 */

/**
 * @typedef {Object} Gateway~DiscoveryOptions
 * @memberof module:fabric-network
 * @property {boolean} [enabled=true] True if discovery should be used; otherwise false.
 * @property {boolean} [asLocalhost=false] Convert discovered host addresses to be 'localhost'.
 * Will be needed when running a docker composed fabric network on the local system;
 * otherwise should be disabled.
 */

/**
 * The gateway peer provides the connection point for an application to access the Fabric network.
 * It is instantiated using the default constructor.
 * It can then be connected to a fabric network using the [connect]{@link #connect} method by
 * passing either a common connection profile definition or an existing {@link Client} object.
 * Once connected, it can then access individual Network instances (channels) using the
 * [getNetwork]{@link #getNetwork} method which in turn can access the
 * [smart contracts]{@link Contract} installed on a network and
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
		this.identityContext = null;
		this.networks = new Map();
		this.identity = null;

		// initial options - override with the connect()
		this.options = {
			queryHandlerOptions: {
				timeout: 30, // 30 seconds
				strategy: QueryStrategies.MSPID_SCOPE_SINGLE
			},
			eventHandlerOptions: {
				endorseTimeout: 30, // 30 seconds
				commitTimeout: 300, // 5 minutes
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			},
			discovery: {
				enabled: true,
				asLocalhost: true
			}
		};
	}

	/**
     * Connect to the Gateway with a connection profile or a prebuilt Client instance.
     * @async
     * @param {(object|Client)} config The configuration for this Gateway which can be:
	 * <ul>
	 *   <li>A common connection profile JSON (Object)</li>
	 *   <li>A pre-configured client instance</li>
	 * </ul>
     * @param {module:fabric-network.Gateway~GatewayOptions} options - specific options
	  * for creating this Gateway instance
	 * @example
	 * const gateway = new Gateway();
	 * const wallet = await Wallets.newFileSystemWallet('./WALLETS/wallet');
	 * const ccpFile = await fs.promises.readFile('./network.json');
	 * const ccp = JSON.parse(ccpFile.toString());
	 * await gateway.connect(ccp, {
	 *     identity: 'admin',
	 *     wallet: wallet
	 * });
     */
	async connect(config, options = {}) {
		const method = 'connect';
		logger.debug('%s - start', method);

		Gateway._mergeOptions(this.options, options);
		logger.debug('connection options: %j', options);

		let load_ccp = false;
		if (config && config.type === 'Client') {
			// initialize from an existing Client object instance
			logger.debug('%s - using existing client object', method);
			this.client = config;
		} else {
			this.client = new Client('gateway client');
			load_ccp = true;
		}

		// setup an initial identity for the Gateway
		if (typeof options.identity === 'string') {
			logger.debug('%s - setting identity from wallet', method);
			this.identity = await this._getWalletIdentity(options.identity);
			const provider = options.wallet.getProviderRegistry().getProvider(this.identity.type);
			const user = await provider.getUserContext(this.identity, options.identity);
			this.identityContext = this.client.newIdentityContext(user);
		} else if (typeof options.identity === 'object') {
			logger.debug('%s - setting identity using identity object', method);
			this.identity = options.identity;
			const provider = options.identityProvider || newDefaultProviderRegistry().getProvider(this.identity.type);
			const user = await provider.getUserContext(this.identity, 'gateway identity');
			this.identityContext = this.client.newIdentityContext(user);
		} else {
			logger.error('%s - An identity must be assigned to a Gateway instance', method);
			throw new Error('An identity must be assigned to a Gateway instance');
		}

		if (options.clientTlsIdentity) {
			logger.debug('%s - setting tlsIdentity', method);
			const tlsIdentity = await this._getWalletIdentity(options.clientTlsIdentity);
			const tlsCredentials = tlsIdentity.credentials;
			this.client.setTlsClientCertAndKey(tlsCredentials.certificate, tlsCredentials.privateKey);
		} else if (options.tlsInfo) {
			logger.debug('%s - setting tlsInfo', method);
			this.client.setTlsClientCertAndKey(options.tlsInfo.certificate, options.tlsInfo.key);
		} else {
			logger.debug('%s - using self signed setting for tls', method);
			this.client.setTlsClientCertAndKey();
		}

		// apply any connection options to the client instance for use
		// internally by the client instance when building a complete set
		// of connection options for an endpoint
		// these will be merged with those from the config (default.json)
		if (options['connection-options']) {
			this.client.centralized_options = options['connection-options'];
			logger.debug('%s - assigned connection options');
		}

		// Load connection profile after client configuration has been completed
		if (load_ccp) {
			logger.debug('%s - NetworkConfig loading client from ccp', method);
			await NetworkConfig.loadFromConfig(this.client, config);
		}

		logger.debug('%s - end', method);
	}

	async _getWalletIdentity(label) {
		if (!this.options.wallet) {
			throw new Error('No wallet supplied from which to retrieve identity label');
		}

		const identity = await this.options.wallet.get(label);
		if (!identity) {
			throw new Error(`Identity not found in wallet: ${label}`);
		}

		return identity;
	}

	/**
	 * Get the identity associated with the gateway connection.
	 * @returns {module:fabric-network.Identity} An identity.
	 */
	getIdentity() {
		return this.identity;
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
		const method = 'getNetwork';
		logger.debug('%s - start', method);

		const existingNetwork = this.networks.get(networkName);
		if (existingNetwork) {
			logger.debug('%s - returning existing network:%s', method, networkName);
			return existingNetwork;
		}

		logger.debug('%s - create network object and initialize', method);
		const channel = this.client.getChannel(networkName);
		const newNetwork = new Network(this, channel);
		await newNetwork._initialize(this.options.discovery);
		this.networks.set(networkName, newNetwork);
		return newNetwork;
	}
}

module.exports = Gateway;
