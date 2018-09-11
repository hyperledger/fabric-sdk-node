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
	 * @property {Wallet} wallet The identity wallet implementation for use with this Gateway instance
 	 * @property {string} identity The identity in the wallet for all interactions on this Gateway instance
	 * @property {string} [clientTlsIdentity] the identity in the wallet to use as the client TLS identity
	 * @property {DefaultEventHandlerOptions|Object} [eventHandlerOptions] This defines options for the inbuilt default
	 * event handler capability
 	 */

	/**
	 * @typedef {Object} DefaultEventHanderOptions
 	 * @property {number} [commitTimeout = 300] The timeout period in seconds to wait for commit notification to complete
	 * @property {*} [strategy] Event handling strategy to identify successful transaction commits. A null value
	 * indicates that no event handling is desired.
	 */

	/**
     * Connect to the Gateway with a connection profile or a prebuilt Client instance.
     *
     * @param {Client | string} config The configuration for this Gateway which can come from a common connection
	 * profile or an existing fabric-client Client instance
	 * @see see {Client}
     * @param {GatewayOptions} options specific options for creating this Gateway instance
     * @memberof Gateway
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
     * @returns {User} a fabric-client User instance of the current identity used by this Gateway
     * @memberof Gateway
     */
	getCurrentIdentity() {
		logger.debug('in getCurrentIdentity');
		return this.currentIdentity;
	}

	/**
     * Get the underlying Client object instance
     *
     * @returns {Client} the underlying fabric-client Client instance
     * @memberof Gateway
     */
	getClient() {
		logger.debug('in getClient');
		return this.client;
	}

	/**
	 * Returns the set of options associated with the Gateway connection
	 * @returns {GatewayOptions} the Gateway options
	 * @memberof Gateway
	 */
	getOptions() {
		logger.debug('in getOptions');
		return this.options;
	}

	/**
     * clean up and disconnect this Gateway in prep for it to be discarded and garbage collected
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
	 * Returns an object representing the network
	 * @param networkName
	 * @returns {Promise<Network>}
	 * @memberof Gateway
	 */
	async getNetwork(networkName) {
		logger.debug('in getNetwork');
		const existingNetwork = this.networks.get(networkName);
		if (!existingNetwork) {
			logger.debug('getNetwork: create network object and initialize');
			const channel = this.client.getChannel(networkName);
			const newNetwork = new Network(this, channel);
			await newNetwork._initialize();
			this.networks.set(networkName, newNetwork);
			return newNetwork;
		}
		return existingNetwork;
	}

	async _createQueryHandler(channel, peerMap) {
		if (this.queryHandlerClass) {
			const currentmspId = this.getCurrentIdentity()._mspId;
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
