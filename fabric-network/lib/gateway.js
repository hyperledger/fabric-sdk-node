/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');

const Network = require('./network');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');

const logger = require('./logger').getLogger('Gateway');

/**
 * The gateway peer provides the connection point for an application to access the Fabric network.  It is instantiated using
 * the default constructor.
 * It can then be connected to a fabric network using the [connect]{@link Gateway#connect} method by passing either a CCP definition
 * or an existing {@link Client} object.
 * Once connected, it can then access individual Network instances (channels) using the [getNetwork]{@link Gateway#getNetwork} method
 * which in turn can access the [smart contracts]{@link Contract} installed on a network and
 * [submit transactions]{@link Contract#submitTransaction} to the ledger.
 *
 * @class
 */
class Gateway {

	static _mergeOptions(defaultOptions, suppliedOptions) {
		for (const prop in suppliedOptions) {
			if (suppliedOptions[prop] instanceof Object && prop.endsWith('Options')) {
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

	/**
	 * Public constructor for Gateway object
	 */
	constructor() {
		logger.debug('in Gateway constructor');
		this.client = null;
		this.wallet = null;
		this.networks = new Map();

		// default options
		this.options = {
			queryHandler: './impl/query/defaultqueryhandler',
			queryHandlerOptions: {
			},
			eventHandlerOptions: {
				commitTimeout: 300, // 5 minutes
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			}
		};
	}

	/**
 	 * @typedef {Object} GatewayOptions
	 * @property {Wallet} wallet The identity wallet implementation for use with this Gateway instance.
 	 * @property {string} identity The identity in the wallet for all interactions on this Gateway instance.
	 * @property {string} [clientTlsIdentity] the identity in the wallet to use as the client TLS identity.
	 * @property {DefaultEventHandlerOptions} [eventHandlerOptions] This defines options for the inbuilt default
	 * event handler capability.
 	 */

	/**
	 * @typedef {Object} DefaultEventHandlerOptions
 	 * @property {number} [commitTimeout = 300] The timeout period in seconds to wait for commit notification to
	 * complete.
	 * @property {?TxEventHandlerFactory} [strategy = MSPID_SCOPE_ALLFORTX] Event handling strategy to identify
	 * successful transaction commits. A null value indicates that no event handling is desired. The default is
	 * {@link MSPID_SCOPE_ALLFORTX}.
	 */

	/**
	 * @typedef {Function} TxEventHandlerFactory
	 * @param {String} transactionId The transaction ID for which the handler should listen.
	 * @param {Network} network The network on which this transaction is being submitted.
	 * @returns {TxEventHandler} A transaction event handler.
	 */

	/**
	 * @typedef {Object} TxEventHandler
	 * @property {Function} startLstening Async function that resolves when the handler has started listening for
	 * transaction commit events. Called after the transaction proposal has been accepted and prior to submission of
	 * the transaction to the orderer.
	 * @property {Function} waitForEvents Async function that resolves (or rejects) when suitable transaction
	 * commit events have been received. Called after submission of the transaction to the orderer.
	 * @property {Function} cancelListening Cancel listening. Called if submission of the transaction to the orderer
	 * fails.
	 */

	/**
     * Connect to the Gateway with a connection profile or a prebuilt Client instance.
     *
     * @param {string|Client} config The configuration for this Gateway which can come from a common connection
	 * profile or an existing fabric-client Client instance
     * @param {GatewayOptions} options specific options for creating this Gateway instance
     * @memberof Gateway
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

		// if a different queryHandler was provided and it doesn't match the default
		// delete the default queryHandlerOptions.
		if (options.queryHandler && (this.options.queryHandler !== options.queryHandler)) {
			delete this.options.queryHandlerOptions;
		}

		Gateway._mergeOptions(this.options, options);
		logger.debug('connection options: %O', options);

		if (!(config instanceof Client)) {
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

		// load in the query handler plugin
		if (this.options.queryHandler) {
			logger.debug('%s - loading query handler: %s', method, this.options.queryHandler);
			try {
				this.queryHandlerClass = require(this.options.queryHandler);
			} catch(error) {
				logger.error('%s - unable to load provided query handler: %s. Error %O', method, this.options.queryHandler, error);
				throw new Error(`unable to load provided query handler: ${this.options.queryHandler}. Error ${error}`);
			}
		}
	}

	/**
     * Get the current identity
     *
     * @returns {User} A fabric-client {@link User} instance of the current identity used by this Gateway
     * @memberof Gateway
     */
	getCurrentIdentity() {
		logger.debug('in getCurrentIdentity');
		return this.currentIdentity;
	}

	/**
     * Get the underlying Client object instance
     *
     * @returns {Client} The underlying fabric-client {@link Client} instance
     * @memberof Gateway
     */
	getClient() {
		logger.debug('in getClient');
		return this.client;
	}

	/**
	 * Returns the set of options associated with the Gateway connection
	 * @returns {GatewayOptions} The Gateway connection options
	 * @memberof Gateway
	 */
	getOptions() {
		logger.debug('in getOptions');
		return this.options;
	}

	/**
     * Clean up and disconnect this Gateway connection in preparation for it to be discarded and garbage collected
     *
     * @memberof Gateway
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
	 * @returns {Network}
	 * @memberof Gateway
	 */
	async getNetwork(networkName) {
		logger.debug('in getNetwork');

		const existingNetwork = this.networks.get(networkName);
		if (existingNetwork) {
			return existingNetwork;
		}

		logger.debug('getNetwork: create network object and initialize');
		const channel = this.client.getChannel(networkName);
		const newNetwork = new Network(this, channel);
		await newNetwork._initialize();
		this.networks.set(networkName, newNetwork);
		return newNetwork;
	}

	async _createQueryHandler(channel, peerMap) {
		if (this.queryHandlerClass) {
			const currentmspId = this.getCurrentIdentity().getIdentity().getMSPId();
			const queryHandler = new this.queryHandlerClass(
				channel,
				currentmspId,
				peerMap,
				this.options.queryHandlerOptions
			);
			await queryHandler.initialize();
			return queryHandler;
		}
		return null;
	}
}

module.exports = Gateway;
