/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from './transaction';
import { ContractListenerSession } from './impl/event/contractlistenersession';
import { ListenerSession, addListener, removeListener } from './impl/event/listenersession';
import * as Logger from './logger';
const logger = Logger.getLogger('Contract');
import util = require('util');
import { NetworkImpl } from './network';
import { ContractListener, ListenerOptions } from './events';
import { DiscoveryService, DiscoveryHandler } from 'fabric-common';
import { Gateway } from './gateway';

/**
 * Ensure transaction name is a non-empty string.
 * @private
 * @param {string} name Transaction name.
 * @throws {Error} if the name is invalid.
 */
function verifyTransactionName(name: string): void {
	if (typeof name !== 'string' || name.length === 0) {
		const msg = util.format('Transaction name must be a non-empty string: %j', name);
		logger.error('verifyTransactionName:', msg);
		throw new Error(msg);
	}
}

/**
 * Ensure that, if a namespace is defined, it is a non-empty string
 * @private
 * @param {string|undefined} namespace Transaction namespace.
 * @throws {Error} if the namespace is invalid.
 */
function verifyNamespace(namespace?: string): void {
	if (namespace && typeof namespace !== 'string') {
		const msg = util.format('Namespace must be a non-empty string: %j', namespace);
		logger.error('verifyNamespace:', msg);
		throw new Error(msg);
	}
}

export interface DiscoveryInterest {
	name: string;
	collectionNames?: string[];
	noPrivateReads?: boolean;
}

export interface Contract {
	readonly chaincodeId: string;
	readonly namespace: string;
	createTransaction(name: string): Transaction;
	evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
	submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
	addContractListener(listener: ContractListener, options?: ListenerOptions): Promise<ContractListener>;
	removeContractListener(listener: ContractListener): void;
	addDiscoveryInterest(interest: DiscoveryInterest): Contract;
	resetDiscoveryInterests(): Contract;
}

/**
 * <p>Represents a smart contract (chaincode) instance in a network.
 * Applications should get a Contract instance using the
 * networks's [getContract]{@link module:fabric-network.Network#getContract} method.</p>
 *
 * <p>The Contract allows applications to:</p>
 * <ul>
 *   <li>Submit transactions that store state to the ledger using
 *       [submitTransaction]{@link module:fabric-network.Contract#submitTransaction}.</li>
 *   <li>Evaluate transactions that query state from the ledger using
 *       [evaluateTransaction]{@link module:fabric-network.Contract#evaluateTransaction}.</li>
 *   <li>Listen for new chaincode events and replay previous chaincode events emitted by the smart contract using
 *       [addContractListener]{@link module:fabric-network.Contract#addContractListener}.</li>
 * </ul>
 *
 * <p>If more control over transaction invocation is required, such as including transient data,
 * [createTransaction]{@link module:fabric-network.Contract#createTransaction} can be used to build a transaction
 * request that is submitted to or evaluated by the smart contract.</p>
 * @interface Contract
 * @memberof module:fabric-network
 */
/**
 * Create an object representing a specific invocation of a transaction
 * function implemented by this contract, and provides more control over
 * the transaction invocation. A new transaction object <strong>must</strong>
 * be created for each transaction invocation.
 * @method Contract#createTransaction
 * @memberof module:fabric-network
 * @param {string} name Transaction function name.
 * @returns {module:fabric-network.Transaction} A transaction object.
 */
/**
 * Submit a transaction to the ledger. The transaction function <code>name</code>
 * will be evaluated on the endorsing peers and then submitted to the ordering service
 * for committing to the ledger.
 * This function is equivalent to calling <code>createTransaction(name).submit()</code>.
 * @method Contract#submitTransaction
 * @memberof module:fabric-network
 * @param {string} name Transaction function name.
 * @param {...string} [args] Transaction function arguments.
 * @returns {Buffer} Payload response from the transaction function.
 * @throws {module:fabric-network.TimeoutError} If the transaction was successfully submitted to the orderer but
 * timed out before a commit event was received from peers.
 */
/**
 * Evaluate a transaction function and return its results.
 * The transaction function <code>name</code>
 * will be evaluated on the endorsing peers but the responses will not be sent to
 * the ordering service and hence will not be committed to the ledger.
 * This is used for querying the world state.
 * This function is equivalent to calling <code>createTransaction(name).evaluate()</code>.
 * @method Contract#evaluateTransaction
 * @memberof module:fabric-network
 * @param {string} name Transaction function name.
 * @param {...string} [args] Transaction function arguments.
 * @returns {Buffer} Payload response from the transaction function.
 */
/**
 * Add a listener to receive all chaincode events emitted by the smart contract as part of successfully committed
 * transactions. The default is to listen for full contract events from the current block position.
 * @method Contract#addContractListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.ContractListener} listener A contract listener callback function.
 * @param {module:fabric-network.ListenerOptions} [options] Listener options.
 * @returns {Promise<module:fabric-network.ContractListener>} The added listener.
 * @example
 * const listener: ContractListener = async (event) => {
 *     if (event.eventName === 'newOrder') {
 *         const details = event.payload.toString('utf8');
 *         // Run business process to handle orders
 *     }
 * };
 * contract.addContractListener(listener);
 */
/**
 * Remove a previously added contract listener.
 * @method Contract#removeContractListener
 * @memberof module:fabric-network
 * @param {module:fabric-network.ContractListener} listener A contract listener callback function.
 */
/**
 * Provide a Discovery Interest settings to help the peer's discovery service
 * build an endorsement plan. This chaincode Id will be include by default in
 * the list of discovery interests. If this contract's chaincode is in one or
 * more collections then use this method with this chaincode Id to change the
 * default discovery interest to include those collection names.
 * @method Contract#addDiscoveryInterest
 * @memberof module:fabric-network
 * @param {DiscoveryInterest} interest - These will be added to the existing discovery interests and used when
 * {@link module:fabric-network.Transaction#submit} is called.
 * @return {Contract} This Contract instance
 */
/**
 * reset Discovery interest to default of this contracts chaincode name
 * and no collection names and no other chaincode names.
 * @method Contract#resetDiscoveryInterests
 * @memberof module:fabric-network
 * @return {Contract} This Contract instance
 */
/**
 * Retrieve the Discovery Interest settings that will help the peer's
 * discovery service build an endorsement plan.
 * @method Contract#getDiscoveryInterests
 * @memberof module:fabric-network
 * @return {DiscoveryInterest[]} - An array of DiscoveryInterest
 */

/**
 * A callback function that will be invoked when a block event is received.
 * @callback ContractListener
 * @memberof module:fabric-network
 * @async
 * @param {module:fabric-network.ContractEvent} event Contract event.
 * @returns {Promise<void>}
 */

export class ContractImpl {
	readonly chaincodeId: string;
	readonly namespace: string;
	readonly network: NetworkImpl;
	readonly gateway: Gateway;
	private discoveryService?: DiscoveryService;
	private readonly contractListeners: Map<ContractListener, ListenerSession> = new Map();
	private discoveryInterests: DiscoveryInterest[];
	private discoveryResultsListners: any[] = new Array();

	constructor(network: NetworkImpl, chaincodeId: string, namespace: string) {
		const method = `constructor[${namespace}]`;
		logger.debug('%s - start', method);

		verifyNamespace(namespace);

		this.network = network;
		this.chaincodeId = chaincodeId;
		this.gateway = network.getGateway();
		this.namespace = namespace;
		this.contractListeners = new Map();
		this.discoveryInterests = [{name: chaincodeId}];
	}

	createTransaction(name: string): Transaction {
		verifyTransactionName(name);
		const qualifiedName = this._getQualifiedName(name);
		const transaction = new Transaction(this, qualifiedName);

		return transaction;
	}

	async submitTransaction(name: string, ...args: string[]): Promise<Buffer> {
		return this.createTransaction(name).submit(...args);
	}

	async evaluateTransaction(name: string, ...args: string[]): Promise<Buffer> {
		return this.createTransaction(name).evaluate(...args);
	}

	async addContractListener(listener: ContractListener, options?: ListenerOptions): Promise<ContractListener> {
		const sessionSupplier = async () => new ContractListenerSession(listener, this.chaincodeId, this.network, options);
		const contractListener = await addListener(listener, this.contractListeners, sessionSupplier);
		return contractListener;
	}

	removeContractListener(listener: ContractListener): void {
		removeListener(listener, this.contractListeners);
	}

	/**
	 * Internal use
	 * Use this method to get the DiscoveryHandler to get the endorsements
	 * needed to commit a transaction.
	 * The first time this method is called, this contract's DiscoveryService
	 * instance will be setup.
	 * The service will make a discovery request to the same
	 * target as that used by the Network. The request will include this contract's
	 * discovery interests. This will enable the peer's discovery
	 * service to generate an endorsement plan based on the chaincode's
	 * endorsement policy, the collection configuration, and the current active
	 * peers.
	 * Note: It is assumed that the discovery interests will not
	 * change on successive calls. The handler's DiscoveryService will use the
	 * "refreshAge" discovery option after the first call to determine if the
	 * endorsement plan should be refreshed by a new call to the peer's
	 * discovery service.
	 * @private
	 * @return {DiscoveryHandler} The handler that will work with the discovery
	 * endorsement plan to send a proposal to be endorsed to the peers as described
	 * in the plan.
	 */
	async getDiscoveryHandler(): Promise<DiscoveryHandler | undefined> {
		const method = `getDiscoveryHandler[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		// Contract is only using discovery if the network is too
		if (!this.network.discoveryService) {
			logger.debug('%s - not using discovery - return null handler', method);
			return undefined;
		}

		// check if we have initialized this contract's discovery
		if (!this.discoveryService) {
			logger.debug('%s - setting up contract discovery', method);

			this.discoveryService = this.network.getChannel().newDiscoveryService(this.chaincodeId);

			const targets = this.network.discoveryService.targets;
			const idx = this.gateway.identityContext!;
			const asLocalhost = this.gateway.getOptions().discovery.asLocalhost;

			logger.debug('%s - using discovery interest %j', method, this.discoveryInterests);
			this.discoveryService.build(idx, {interest: this.discoveryInterests});
			this.discoveryService.sign(idx);

			// go get the endorsement plan from the peer's discovery service
			// to be ready to be used by the transaction's submit
			await this.discoveryService.send({asLocalhost, targets});
			logger.debug('%s - endorsement plan retrieved', method);

			const hasDiscoveryResults = this.discoveryService.hasDiscoveryResults();
			this.notifyDiscoveryResultsListeners(hasDiscoveryResults);
			logger.debug('%s - completed discovery results as first one', method);
		} else {
			if (!this.discoveryService.hasDiscoveryResults()) {
				// maybe the discovery service was created by another submit of
				// this same contract, make sure it has completed getting the
				// discovery results, we do not want this submission to also
				// get the discovery results, just wait for first one to complete.
				await this.waitDiscoveryResults();
			}
		}

		// The handler will have access to the endorsement plan fetched
		// by the parent DiscoveryService instance.
		logger.debug('%s - returning a new discovery service handler', method);
		return this.discoveryService.newHandler();
	}

	/*
	 * Internal method to setup a Promise that will wait to be notified when
	 * the discovery service has retreived the discovery results.
	 */
	waitDiscoveryResults() {
		const method = `checkDiscoveryResults[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		return new Promise((resolve: any, reject: any): any => {
			const handle: NodeJS.Timeout = setTimeout(() => {
				reject(new Error('Timed out waiting for discovery results'));
			}, 30000);

			this.registerDiscoveryResultsListener(
				(hasDiscoveryResults: boolean): any => {
					clearTimeout(handle);
					if (hasDiscoveryResults) {
						logger.debug('%s - discovery results have been retieved', method);
						resolve();
					} else {
						const error = new Error('Failed to retrieve discovery results');
						logger.error('%s - %s', method, error);
						reject(error);
					}
				}
			);
		});
	}

	/*
	 * Internal method to register to be notified when
	 * discovery results are ready to be used.
	 */
	registerDiscoveryResultsListener(callback: any) {
		const method = `registerDiscoveryResultsListener[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		this.discoveryResultsListners.push(callback);
	}

	/*
	 * Interal method to notify all other submits that the discovery
	 * results are now ready to be used. This will have the Promise
	 * resolve and all the other submits to continue to process.
	 */
	notifyDiscoveryResultsListeners(hasDiscoveryResults: boolean) {
		const method = `notifyDiscoveryResultsListeners[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		while (this.discoveryResultsListners.length) {
			const listener = this.discoveryResultsListners.pop();
			listener(hasDiscoveryResults);
		}
	}

	addDiscoveryInterest(interest: DiscoveryInterest): Contract {
		const method = `addDiscoveryInterest[${this.chaincodeId}]`;

		if (typeof interest !== 'object') {
			throw Error('"interest" parameter must be a DiscoveryInterest object');
		}

		logger.debug('%s - adding %s', method, interest);

		const existingIndex = this.discoveryInterests.findIndex((entry) => entry.name === interest.name);
		if (existingIndex >= 0) {
			this.discoveryInterests[existingIndex] = interest;
		} else {
			this.discoveryInterests.push(interest);
		}

		return this;
	}

	resetDiscoveryInterests(): Contract {
		const method = `resetDiscoveryInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		this.discoveryInterests = [{name: this.chaincodeId}];
		this.discoveryService = undefined;

		return this;
	}

	getDiscoveryInterests(): DiscoveryInterest[] {
		return this.discoveryInterests;
	}

	private _getQualifiedName(name: string): string {
		return (this.namespace ? `${this.namespace}:${name}` : name);
	}
}
