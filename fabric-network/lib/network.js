/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');
const Channel = require('./channel');
const logger = require('./logger').getLogger('network.js');

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
			commitTimeout: 300 * 1000,
		};
	}

	/**
     * Initialize the network with a connection profile
     *
     * @param {*} ccp
     * @param {*} options
     * @memberof Network
     */
	async initialize(ccp, options) {
		logger.debug('in initialize');

		if (!options || !options.wallet) {
			logger.error('initialize: A wallet must be assigned to a Network instance');
			throw new Error('A wallet must be assigned to a Network instance');
		}

		Network._mergeOptions(this.options, options);

		if (!(ccp instanceof Client)) {
			// still use a ccp for the discovery peer and ca information
			logger.debug('initialize: loading client from ccp');
			this.client = Client.loadFromConfig(ccp);
		} else {
			// initialize from an existing Client object instance
			logger.debug('initialize: using existing client object');
			this.client = ccp;
		}

		// setup an initial identity for the network
		if (options.identity) {
			logger.debug('initialize: setting identity');
			this.currentIdentity = await options.wallet.setUserContext(this.client, options.identity);
		}
	}

	/**
     * Get the current identity
     *
     * @returns
     * @memberof Network
     */
	getCurrentIdentity() {
		logger.debug('in getCurrentIdentity');
		return this.currentIdentity;
	}

	/**
     * Get the underlying Client object instance
     *
     * @returns
     * @memberof Network
     */
	getClient() {
		logger.debug('in getClient');
		return this.client;
	}

	/**
	 * Returns the set of options associated with the network connection
	 * @returns {{commitTimeout: number}|*}
	 * @memberOf Network
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
	 * @memberOf Network
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
}


module.exports = Network;