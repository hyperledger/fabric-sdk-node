/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const FabricConstants = require('fabric-client/lib/Constants');
const Contract = require('./contract');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const BlockEventListener = require('fabric-network/lib/impl/event/blockeventlistener');
const CommitEventListener = require('fabric-network/lib/impl/event/commiteventlistener');

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
		this.initialized = false;
		this.listeners = new Map();
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

		this.checkpointer = this.gateway.getOptions().checkpointer;

		const eventHubSelectionOptions = this.gateway.getOptions().eventHubSelectionOptions;
		this.eventHubSelectionStrategy = eventHubSelectionOptions.strategy(this);
		this.eventHubManager = new EventHubManager(this);
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
				this.getCheckpointer(),
				name
			);
			this.contracts.set(key, contract);
		}
		return contract;
	}

	_dispose() {
		logger.debug('in _dispose');

		this.listeners.forEach(listener => listener.unregister());
		// Danger as this cached in gateway, and also async so how would
		// network._dispose() followed by network.initialize() be safe ?
		// make this private is the safest option.
		this.contracts.clear();

		this.eventHubManager.dispose();
		this.channel.close();

		this.initialized = false;
	}

	/**
	 * Get the query handler for this network.
	 * @private
	 * @returns {object} A query handler.
	 */
	getQueryHandler() {
		return this.queryHandler;
	}

	/**
	 * Get the checkpoint factory
	 * @private
	 * @returns {Function} The checkpointer factory
	 */
	getCheckpointer() {
		return this.checkpointer;
	}

	/**
	 * Get the event hub manager
	 * @private
	 * @returns {EventHubManager} An event hub manager
	 */
	getEventHubManager() {
		return this.eventHubManager;
	}

	/**
	 * Get the event hub selection strategy
	 * @private
	 * @returns {BaseEventHubSelectionStrategy}
	 */
	getEventHubSelectionStrategy() {
		return this.eventHubSelectionStrategy;
	}

	/**
	 * Save the listener to a map in Network
	 * @param {String} listenerName the name of the listener being saved
	 * @param {AbstractEventListener} listener the listener to be saved
	 * @private
	 */
	saveListener(listenerName, listener) {
		if (this.listeners.has(listenerName)) {
			listener.unregister();
			throw new Error(`Listener already exists with the name ${listenerName}`);
		}
		this.listeners.set(listenerName, listener);
	}

	/**
	 * Create a block event listener
	 * @param {String} listenerName the name of the listener
	 * @param {Function} callback the callback called when an event is triggered with signature (error, block)
	 * @param {Object} [options] Optional. Tjhe event listener options
	 */
	async addBlockListener(listenerName, callback, options) {
		if (!options) {
			options = {};
		}
		options.replay = options.replay ? true : false;
		options.checkpointer = this.getCheckpointer(options);
		const listener = new BlockEventListener(this, listenerName, callback, options);
		this.saveListener(listenerName, listener);
		await listener.register();
		return listener;
	}

	/**
	 * Create a commit event listener for this transaction.
	 * @param {string} transactionId The transactionId being watched
	 * @param {Function} callback - This callback will be triggered when
	 *		a transaction commit event is emitted. It takes parameters
	 * 		of error, transactionId, transaction status and block number
	 * @param {RegistrationOptions} [options] - Optional. Options on
	 * 		registrations allowing start and end block numbers.
	 * @param {ChannelEventHub} [eventHub] - Optional. Used to override the event hub selection
	 * @returns {CommitEventListener}
	 * @async
	 */
	async addCommitListener(transactionId, callback, options, eventHub) {
		if (!options) {
			options = {};
		}
		options.replay = false;
		options.checkpointer = null;
		const listener = new CommitEventListener(this, transactionId, callback, options);
		if (eventHub) {
			listener.setEventHub(eventHub, options.fixedEventHub);
		}
		this.saveListener(listener.listenerName, listener);
		await listener.register();
		return listener;
	}
}

module.exports = Network;
