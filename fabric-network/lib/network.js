/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');

const Channel = require('./channel');
const EventStrategies = require('./eventstrategies');

const logger = require('./logger').getLogger('Network');

class Network {

	static _mergeOptions(defaultOptions, suppliedOptions) {
		for (const prop in suppliedOptions) {
			if (suppliedOptions[prop] instanceof Object && prop.endsWith('Options')) {
				if (defaultOptions[prop] === undefined) {
					defaultOptions[prop] = suppliedOptions[prop];
				} else {
					Network._mergeOptions(defaultOptions[prop], suppliedOptions[prop]);
				}
			} else {
				defaultOptions[prop] = suppliedOptions[prop];
			}
		}
	}

	/**
	 * Public constructor for Network object
	 */
	constructor() {
		logger.debug('in Network constructor');
		this.client = null;
		this.wallet = null;
		this.channels = new Map();

		// default options
		this.options = {
			commitTimeout: 300, // 5 minutes
			eventStrategy: EventStrategies.MSPID_SCOPE_ALLFORTX,
			queryHandler: './impl/query/defaultqueryhandler',
			queryHandlerOptions: {
			}
		};
	}

	/**
 	 * @typedef {Object} NetworkOptions
	 * @property {Wallet} wallet The identity wallet implementation for use with this network instance
 	 * @property {string} identity The identity in the wallet for all interactions on this network instance
	 * @property {string} [clientTlsIdentity] the identity in the wallet to use as the client TLS identity
 	 * @property {number} [commitTimeout = 300] The timout period in seconds to wait for commit notification to complete
	 * @property {*} [eventStrategy] Event handling strategy to identify successful transaction commits. A null value
	 * indicates that no event handling is desired.
 	 */

	/**
     * Initialize the network with a connection profile
     *
     * @param {Client | string} config The configuration for this network which can come from a common connection
	 * profile or an existing fabric-client Client instance
	 * @see see {Client}
     * @param {NetworkOptions} options specific options for creating this network instance
     * @memberof Network
     */
	async initialize(config, options) {
		const method = 'initialize';
		logger.debug('in %s', method);

		if (!options || !options.wallet) {
			logger.error('%s - A wallet must be assigned to a Network instance', method);
			throw new Error('A wallet must be assigned to a Network instance');
		}

		// if a different queryHandler was provided and it doesn't match the default
		// delete the default queryHandlerOptions.
		if (options.queryHandler && (this.options.queryHandler !== options.queryHandler)) {
			delete this.options.queryHandlerOptions;
		}

		Network._mergeOptions(this.options, options);

		if (!(config instanceof Client)) {
			// still use a ccp for the discovery peer and ca information
			logger.debug('%s - loading client from ccp', method);
			this.client = Client.loadFromConfig(config);
		} else {
			// initialize from an existing Client object instance
			logger.debug('%s - using existing client object', method);
			this.client = config;
		}

		// setup an initial identity for the network
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
     * @returns {User} a fabric-client User instance of the current identity used by this network
     * @memberof Network
     */
	getCurrentIdentity() {
		logger.debug('in getCurrentIdentity');
		return this.currentIdentity;
	}

	/**
     * Get the underlying Client object instance
     *
     * @returns {Client} the underlying fabric-client Client instance
     * @memberof Network
     */
	getClient() {
		logger.debug('in getClient');
		return this.client;
	}

	/**
	 * Returns the set of options associated with the network connection
	 * @returns {NetworkOptions} the network options
	 * @memberof Network
	 */
	getOptions() {
		logger.debug('in getOptions');
		return this.options;
	}

	/**
     * clean up this network in prep for it to be discarded and garbage collected
     *
     * @memberof Network
     */
	dispose() {
		logger.debug('in cleanup');
		for (const channel of this.channels.values()) {
			channel._dispose();
		}
		this.channels.clear();
	}

	/**
	 * Returns an object representing the channel
	 * @param channelName
	 * @returns {Promise<Channel>}
	 * @memberof Network
	 */
	async getChannel(channelName) {
		logger.debug('in getChannel');
		const existingChannel = this.channels.get(channelName);
		if (!existingChannel) {
			logger.debug('getChannel: create channel object and initialize');
			const channel = this.client.getChannel(channelName);
			const newChannel = new Channel(this, channel);
			await newChannel._initialize();
			this.channels.set(channelName, newChannel);
			return newChannel;
		}
		return existingChannel;
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

module.exports = Network;
