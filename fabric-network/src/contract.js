/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Transaction = require('fabric-network/lib/transaction');
const ContractEventListener = require('./impl/event/contracteventlistener');

const logger = require('./logger').getLogger('Contract');
const util = require('util');

/**
 * Ensure transaction name is a non-empty string.
 * @private
 * @param {*} name Transaction name.
 * @throws {Error} if the name is invalid.
 */
function verifyTransactionName(name) {
	if (typeof name !== 'string' || name.length === 0) {
		const msg = util.format('Transaction name must be a non-empty string: %j', name);
		logger.error('verifyTransactionName:', msg);
		throw new Error(msg);
	}
}

/**
 * Ensure that, if a namespace is defined, it is a non-empty string
 * @private
 * @param {*} namespace Transaction namespace.
 * @throws {Error} if the namespace is invalid.
 */
function verifyNamespace(namespace) {
	if (namespace && typeof namespace !== 'string') {
		const msg = util.format('Namespace must be a non-empty string: %j', namespace);
		logger.error('verifyNamespace:', msg);
		throw new Error(msg);
	}
}

/**
 * Represents a smart contract (chaincode) instance in a network.
 * Applications should get a Contract instance using the
 * networks's [getContract]{@link module:fabric-network.Network#getContract} method.
 * @memberof module:fabric-network
 * @hideconstructor
 */
class Contract {
	constructor(network, chaincodeId, namespace, collections) {
		const method = `constructor[${namespace}]`;
		logger.debug('%s - start', method);

		verifyNamespace(namespace);

		this.network = network;
		this.chaincodeId = chaincodeId;
		this.collections = collections;
		this.gateway = network.gateway;
		this.namespace = namespace;
		this.discoveryService = null;
	}

	/**
	 * Create an object representing a specific invocation of a transaction
	 * function implemented by this contract, and provides more control over
	 * the transaction invocation. A new transaction object <strong>must</strong>
	 * be created for each transaction invocation.
     * @param {String} name Transaction function name.
	 * @returns {module:fabric-network.Transaction} A transaction object.
     */
	createTransaction(name) {
		verifyTransactionName(name);
		const qualifiedName = this._getQualifiedName(name);
		const transaction = new Transaction(this, qualifiedName);

		return transaction;
	}

	_getQualifiedName(name) {
		return (this.namespace ? `${this.namespace}:${name}` : name);
	}

	/**
	 * Submit a transaction to the ledger. The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers and then submitted to the ordering service
	 * for committing to the ledger.
	 * This function is equivalent to calling <code>createTransaction(name).submit()</code>.
	 * @async
     * @param {string} name Transaction function name.
	 * @param {...string} [args] Transaction function arguments.
	 * @returns {Buffer} Payload response from the transaction function.
	 * @throws {module:fabric-network.TimeoutError} If the transaction was successfully submitted to the orderer but
	 * timed out before a commit event was received from peers.
     */
	async submitTransaction(name, ...args) {
		return this.createTransaction(name).submit(...args);
	}

	/**
	 * Evaluate a transaction function and return its results.
	 * The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers but the responses will not be sent to
	 * the ordering service and hence will not be committed to the ledger.
	 * This is used for querying the world state.
	 * This function is equivalent to calling <code>createTransaction(name).evaluate()</code>.
	 * @async
     * @param {string} name Transaction function name.
     * @param {...string} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
     */
	async evaluateTransaction(name, ...args) {
		return this.createTransaction(name).evaluate(...args);
	}

	/**
	 * Create a commit event listener for this transaction.
	 * @param {Function} callback - This callback will be triggered when
	 * a transaction commit event is emitted. It takes parameters
	 * of Error, Long, ChaincodeEvent[].
	 * NOTE: All contract events contained within the block that match the
	 * eventName will be provided at one time to the callback.
	 * @param {module:fabric-network.Network~EventListenerOptions} [options] - Optional. Options on
	 * registrations allowing start and end block numbers and an application event checkpointer
	 * @param {EventService} [eventService] - Optional. Used to override the event service selection
	 * @returns {module:fabric-network~ContractEventListener}
	 * @async
	 * @private
	 */
	async addContractListener(eventName, callback, options = {}, eventService) {
		const listener = new ContractEventListener(this, eventName, callback, options);
		if (eventService) {
			listener.eventService = eventService;
		}
		this.network.saveListener(listener, listener);
		await listener.register();

		return listener;
	}

	/**
	 * Internal use
	 * Use this method to get the DiscoveryHandler to get the endorsements
	 * needed to commit a transaction.
	 * The first time this method is called, this contract's DiscoveryService
	 * instance will be setup.
	 * The service will make a discovery request to the same
	 * target as that used by the Network. The request will include this contract's
	 * chaincode ID and collection names. This will enable the peer's discovery
	 * service to generate an endorsement plan based on the chaincode's
	 * endorsement policy, the collection configuration, and the current active
	 * peers.
	 * Note: It is assumed that the chaincode ID and collection names will not
	 * change on successive calls. The contract's DiscoveryService will use the
	 * "refreshAge" discovery option after the first call to determine if the
	 * endorsement plan should be refreshed by a new call to the peer's
	 * discovery service.
	 * @private
	 * @param {Endorsement} endorsement instance
	 * @return {DiscoveryHandler} The handler that will work with the discovery
	 * endorsement plan to send a proposal to be endorsed to the peers as described
	 * in the plan.
	 */
	async getDiscoveryHandler(endorsement) {
		const method = `getDiscoveryHandler[${this._name}]`;
		logger.debug('%s - start', method);
		// if the network is using discovery, then this contract will too
		if (this.network.discoveryService) {
			// check if we have initialized this contract's discovery
			if (!this.discoveryService) {
				logger.debug('%s - setting up contract discovery', method);

				this.discoveryService = this.network.channel.newDiscoveryService(this.chaincodeId);

				const targets = this.network.discoveryService.targets;
				const idx = this.network.gateway.identityContext;
				const asLocalhost = this.network.gateway.getOptions().discovery.asLocalhost;
				// this will tell discovery to build a plan based on the chaincode id
				// and collections names of this contract that the endorsement must
				// have been assigned.
				const interest = endorsement.buildProposalInterest();

				this.discoveryService.build(idx, {interest});
				this.discoveryService.sign(idx);

				// go get the endorsement plan from the peer's discovery service
				// to be ready to be used by the transaction's submit
				await this.discoveryService.send({asLocalhost, targets});
				logger.debug('%s - endorsement plan retrieved', method);
			}

			// The handler will have access to the endorsement plan fetched
			// by the parent DiscoveryService instance.
			logger.debug('%s - returning a new discovery service handler', method);
			return this.discoveryService.newHandler();
		} else {

			logger.debug('%s - not using discovery - return null handler', method);
			return null;
		}
	}

}

module.exports = Contract;
