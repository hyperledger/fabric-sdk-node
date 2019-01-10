/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const FabricConstants = require('fabric-client/lib/Constants');
const Contract = require('./contract');
const EventHubFactory = require('fabric-network/lib/impl/event/eventhubfactory');

const logger = require('./logger').getLogger('Network');
const util = require('util');

/**
 * A Network represents the set of peers in a Fabric network.
 * Applications should get a Network instance using the
 * gateway's [getNetwork]{@link module:fabric-network.Gateway#getNetwork} method.
 * @memberof module:fabric-network
 * @hideconstructor
 */
class Network {
	/*
	 * Network constructor for internal use only.
	 * @param {Gateway} gateway The owning gateway instance
	 * @param {Channel} channel The fabric-client channel instance
	 */
	constructor(gateway, channel) {
		logger.debug('in Network constructor');

		this.gateway = gateway;
		this.channel = channel;
		this.contracts = new Map();
		this.eventHubFactory = new EventHubFactory(channel);
		this.initialized = false;
	}

	/**
     * initialize the channel if it hasn't been done
     * @private
     */
	async _initializeInternalChannel(discovery) {
		logger.debug('in _initializeInternalChannel');

		// TODO: Should this work across all peers or just orgs peers ?
		// TODO: should sort peer list to the identity org initializing the channel.
		// TODO: Candidate to push to low level node-sdk.

		let ledgerPeers;
		if (discovery.enabled) {
			ledgerPeers = this.gateway.getClient().getPeersForOrg();
		} else {
			ledgerPeers = this.channel.getPeers().filter((cPeer) => {
				return cPeer.isInRole(FabricConstants.NetworkConfig.LEDGER_QUERY_ROLE);
			});
		}

		if (ledgerPeers.length === 0) {
			const msg = 'no suitable peers available to initialize from';
			logger.error('_initializeInternalChannel: ' + msg);
			throw new Error(msg);
		}

		let ledgerPeerIndex = 0;
		let success = false;

		while (!success) {
			try {
				const initOptions = {
					target: ledgerPeers[ledgerPeerIndex],
					discover: discovery.enabled
				};
				if (typeof discovery.asLocalhost !== 'undefined') {
					initOptions.asLocalhost = discovery.asLocalhost;
				}

				await this.channel.initialize(initOptions);

				success = true;
			} catch (error) {
				if (ledgerPeerIndex >= ledgerPeers.length - 1) {
					const msg = util.format('Unable to initialize channel. Attempted to contact %j Peers. Last error was %s', ledgerPeers.length, error);
					logger.error('_initializeInternalChannel: ' + msg);
					throw new Error(msg);
				}
				ledgerPeerIndex++;
			}
		}
	}

	/**
	 * Initialize this network instance
	 * @private
	 */
	async _initialize(discover) {
		logger.debug('in initialize');

		if (this.initialized) {
			return;
		}

		await this._initializeInternalChannel(discover);

		this.initialized = true;

		// Must be created after channel initialization to ensure discovery has located peers
		const queryHandlerOptions = this.gateway.getOptions().queryHandlerOptions;
		this.queryHandler = queryHandlerOptions.strategy(this, queryHandlerOptions);
	}

	/**
	 * Get the underlying channel object representation of this network.
	 * @returns {Channel} A channel.
	 */
	getChannel() {
		return this.channel;
	}

	/**
	 * Get an instance of a contract (chaincode) on the current network.
	 * @param {string} chaincodeId the chaincode identifier.
	 * @param {string} [name] name of the contract.
	 * @returns {module:fabric-network.Contract} the contract.
	 */
	getContract(chaincodeId, name = '') {
		logger.debug('in getContract');
		if (!this.initialized) {
			throw new Error('Unable to get contract as network has failed to initialize');
		}
		const key = `${chaincodeId}:${name}`;
		let contract = this.contracts.get(key);
		if (!contract) {
			contract = 	new Contract(
				this,
				chaincodeId,
				this.gateway,
				name
			);
			this.contracts.set(key, contract);
		}
		return contract;
	}

	_dispose() {
		logger.debug('in _dispose');

		// Danger as this cached in gateway, and also async so how would
		// network._dispose() followed by network.initialize() be safe ?
		// make this private is the safest option.
		this.contracts.clear();

		this.eventHubFactory.dispose();
		this.channel.close();

		this.initialized = false;
	}

	/**
	 * Get the event hub factory for this network.
	 * @private
	 * @returns {EventHubFactory} An event hub factory.
	 */
	getEventHubFactory() {
		return this.eventHubFactory;
	}

	/**
	 * Get the query handler for this network.
	 * @private
	 * @returns {object} A query handler.
	 */
	getQueryHandler() {
		return this.queryHandler;
	}
}

module.exports = Network;
