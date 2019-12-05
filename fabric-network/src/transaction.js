/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('Transaction');
const util = require('util');

/*
 * Ensure supplied transaction arguments are not strings.
 * @private
 * @static
 * @param {Array} args transaction arguments.
 * @throws {Error} if any arguments are invalid.
 */
// function verifyArguments(args) {
// 	const isInvalid = args.some((arg) => typeof arg !== 'string');
// 	if (isInvalid) {
// 		const argsString = args.map((arg) => util.format('%j', arg)).join(', ');
// 		const msg = util.format('Transaction arguments must be strings: %s', argsString);
// 		logger.error('verifyArguments:', msg);
// 		throw new Error(msg);
// 	}
// }

/**
 * Represents a specific invocation of a transaction function, and provides
 * felxibility over how that transaction is invoked. Applications should
 * obtain instances of this class by calling
 * [Contract#createTransaction()]{@link module:fabric-network.Contract#createTransaction}.
 * <br><br>
 * Instances of this class are stateful. A new instance <strong>must</strong>
 * be created for each transaction invocation.
 * @memberof module:fabric-network
 * @hideconstructor
 */
class Transaction {
	/*
	 * @param {Contract} contract Contract to which this transaction belongs.
	 * @param {String} name Fully qualified transaction name.
	 * @param {function} eventStrategyFactory - A factory function that will return
	 * an EventStrategy.
	 */
	constructor(contract, name) {
		const method = `constructor[${name}]`;
		logger.debug('%s - start', method);

		this.contract = contract;
		this.name = name;
		this._transientMap = null;
		this._transactionOptions = contract.gateway.getOptions().transaction;
		this._eventHandlerStrategyFactory = null;
		this._isInvoked = false;
		this.queryHandler = contract.network.queryHandler;
		this._endorsingPeers = null; // for user assigned endorsements
		this._commitingOrderers = null; // for user assigned orderers
		this.transactionId = null; // will have a value after a submit

		// the signer of the outbound requests to the fabric network
		this.identityContext = this.contract.gateway.identityContext;
	}

	/**
	 * Override the Gateway option for event handler strategy
	 * @param {*} eventHandlerStrategyFactory
	 */
	setEventHandlerStrategy(eventHandlerStrategyFactory) {
		const method = `setEventHandlerStrategy[${this.name}]`;
		logger.debug('%s - start', method);

		this._eventHandlerStrategyFactory = eventHandlerStrategyFactory;

		return this;
	}
	/**
	 * Set transient data that will be passed to the transaction function
	 * but will not be stored on the ledger. This can be used to pass
	 * private data to a transaction function.
	 * @param {Object} transientMap Object with String property names and
	 * Buffer property values.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setTransient(transientMap) {
		const method = `setTranssient[${this.name}]`;
		logger.debug('%s - start', method);

		this._transientMap = transientMap;

		return this;
	}

	/**
	 * Set the peers that should be used for endorsement when this transaction
	 * is submitted to the ledger.
	 * Setting the peers will override the use of discovery and the submit will
	 * send the proposal to these peers.
	 * This will override the setEndorsingOrganizations if previously called.
	 * @param {Endorser[]} peers - Endorsing peers.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setEndorsingPeers(peers) {
		const method = `setEndorsingPeers[${this.name}]`;
		logger.debug('%s - start', method);

		this._endorsingPeers = peers;
		this._endorsingOrgs = null;

		return this;
	}

	/**
	 * Set the organizations that should be used for endorsement when this
	 * transaction is submitted to the ledger.
	 * Peers that are in the organizations will be used for the endorsement.
	 * This will override the setEndorsingPeers if previously called. Setting
	 * the endorsing organizations will not override discovery, however it will
	 * filter the peers provided by discovery to be those in these organizatons.
	 * @param {string[]} orgs - Endorsing organizations.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setEndorsingOrganizations(...orgs) {
		const method = `setEndorsingOrganizations[${this.name}]`;
		logger.debug('%s - start', method);

		this._endorsingOrgs = orgs;
		this._endorsingPeers = null;

		return this;
	}

	/**
	 * Returns the network from the contract
	 * @returns {module:fabric-network.Network}
	 */
	getNetwork() {
		return this.contract.network;
	}

	/**
	 * Submit a transaction to the ledger. The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers and then submitted to the ordering service
	 * for committing to the ledger.
	 * @async
     * @param {...String} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
	 * @throws {module:fabric-network.TimeoutError} If the transaction was successfully submitted to the orderer but
	 * timed out before a commit event was received from peers.
     */
	async submit(...args) {
		const method = `submit[${this.name}]`;
		logger.debug('%s - start', method);

		const channel = this.contract.network.channel;

		const request = this._buildRequest(args);

		// This is the object that will centralize this endorsement activities
		// with the fabric network
		const endorsement = channel.newEndorsement(this.contract.chaincodeId);
		if (this.contract.collections) {
			for (const collection of this.contract.collections) {
				endorsement.addCollectionInterest(collection);
			}
		}

		if (this._endorsingPeers) {
			logger.debug('%s - user has assigned targets', method);
			request.targets = this._endorsingPeers;
		} else if (this.contract.network.discoveryService) {
			logger.debug('%s - discovery handler will be used for endorsing', method);
			request.handler = await this.contract.getDiscoveryHandler(endorsement);
			if (this._endorsingOrgs) {
				request.requiredOrgs = this._endorsingOrgs;
			}
		} else if (this._endorsingOrgs) {
			logger.debug('%s - user has assigned an endorsing orgs %s', method, this._endorsingOrgs);
			let org_peers = [];
			this._endorsingOrgs.forEach((org) => {
				const peers = channel.getEndorsers(org);
				org_peers = org_peers.concat(peers);
			});
			request.targets = org_peers;
		} else {
			logger.debug('%s - targets will be all that are assigned to this channel', method);
			request.targets = channel.getEndorsers();
		}

		// by now we should have targets or a discovery handler to be used
		// by the send() of the proposal instance

		// use the commitTimeout as the requestTimeout or let default
		if (Number.isInteger(this._transactionOptions.endorseTimeout)) {
			request.requestTimeout = this._transactionOptions.endorseTimeout * 1000; // in ms;
		}

		logger.debug('%s - build and send the endorsement', method);

		// build the outbound request along with getting a new transactionId
		// from the identity context
		endorsement.build(this.identityContext, request);
		endorsement.sign(this.identityContext);

		// ------- S E N D   P R O P O S A L
		// This is where the request gets sent to the peers
		const results = await endorsement.send(request);

		// the validate throws an error if no valid endorsements
		logger.debug('%s - check the results of the endorsement', method);
		const {validResponses} = this._validatePeerResponses(results);

		// The endorsement is the source for the transaction id.
		// The endorsement created the transaction id on demand
		// when it built the proposal.
		this.transactionId = endorsement.getTransactionId();

		// using the event handler strategy factory function from the gateway,
		// or assigned by the user this instance,
		// the eventService list will be built by the strategy to monitor for this
		// transaction's completion by the eventHandler
		let eventHandler;
		if (this._eventHandlerStrategyFactory) {
			eventHandler = this._eventHandlerStrategyFactory(this, this._transactionOptions);
		} else {
			eventHandler = this._transactionOptions.strategy(this, this._transactionOptions);
		}

		// ------- E V E N T   M O N I T O R
		await eventHandler.startListening(this.identityContext);

		if (request.handler) {
			logger.debug('%s - use discovery to commit', method);
		} else {
			logger.debug('%s - use the orderers assigned to the channel', method);
			request.targets = channel.getCommitters();
		}

		// by now we should have a discovery handler or the target orderers
		// to perform the commit have been assigned from the channel

		const commit = endorsement.newCommit();
		commit.build(this.identityContext, request);
		commit.sign(this.identityContext);

		// -----  C O M M I T   E N D O R S E M E N T
		// this is where the endorsement results are sent to the orderer
		const response = await commit.send(request);

		logger.debug('%s - commit response %j', method, response);

		if (response.status !== 'SUCCESS') {
			const msg = `Failed to commit transaction %${endorsement.transactionId}, orderer response status: ${response.status}`;
			logger.error('%s - %s', method, msg);
			eventHandler.cancelListening();
			throw new Error(msg);
		} else {
			logger.debug('%s - successful commit', method);
		}

		logger.debug('%s - wait for the transaction to be committed on the peer', method);
		await eventHandler.waitForEvents();

		return validResponses[0].response.payload;
	}

	_buildRequest(args) {
		const request = {
			fcn: this.name,
			args: args
		};
		if (this._transientMap) {
			request.transientMap = this._transientMap;
		}
		return request;
	}

	/**
     * Check for proposal response errors.
     * @private
     * @param {any} results - the results from the invoke
     * @return {Object} The valid and invalid responses
     * @throws if there are no valid responses at all.
     */
	_validatePeerResponses(results) {
		const method = `_validatePeerResponses[${this.name}]`;
		logger.debug('%s - start', method);

		if (!results) {
			logger.error('%s: No results were returned from the request', method);
			throw new Error('No results were returned from the request');
		}

		const validResponses = [];
		const errorResponses = [];

		if (results.errors) {
			results.errors.forEach((errorContent) => {
				logger.warn('%s: Received error response from grpc:', method, errorContent);
				errorContent.peer = errorContent.connection.name;
				errorResponses.push(errorContent);
			});
		}

		if (results.responses) {
			results.responses.forEach((responseContent) => {
				// valid response ie status will be less then 400.
				// in the future we can do things like verifyProposalResponse and compareProposalResponseResults
				// as part of an extended client side validation strategy but for now don't perform any client
				// side checks as the peers will have to do this anyway and it impacts client performance
				if (responseContent.response.status < 400) {
					logger.debug('%s: valid response from peer %j', method, responseContent.connection);
					validResponses.push(responseContent);
				} else {
					logger.warn('%s: invalid response from peer %j', method, responseContent.peer);
					logger.warn('%s: Received invalid response from peer:', method, responseContent.response.message);
					const responseError = new Error(responseContent.response.message);
					responseError.status = responseContent.response.status;
					responseError.connection = responseContent.connection;
					responseError.peer = responseContent.connection.name;
					errorResponses.push(responseError);
				}
			});
		}

		if (validResponses.length === 0) {
			const errorMessages = errorResponses.map((response) => util.format('peer=%j, status=%s, message=%s',
				response.connection, response.status, response.message));
			const messages = Array.of(`No valid responses from any peers. ${errorResponses.length} peer error responses:`,
				...errorMessages);
			const msg = messages.join('\n    ');
			logger.error('%s: %s', method, msg);
			throw new Error(msg);
		}

		return {validResponses, invalidResponses: errorResponses};
	}

	/**
	 * Evaluate a transaction function and return its results.
	 * The transaction function will be evaluated on the endorsing peers but
	 * the responses will not be sent to the ordering service and hence will
	 * not be committed to the ledger.
	 * This is used for querying the world state.
	 * @async
     * @param {...String} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
     */
	async evaluate(...args) {
		const method = `evaluate[${this.name}]`;
		logger.debug('%s - start', method);

		const channel = this.contract.network.channel;
		const request = this._buildRequest(args);
		const query = channel.newQuery(this.contract.chaincodeId);

		logger.debug('%s - build and sign the query', method);
		query.build(this.identityContext, request);
		query.sign(this.identityContext);

		logger.debug('%s - handler will send', method);
		const results = await this.queryHandler.evaluate(query);
		logger.debug('%s - queryHandler completed %j', method, results);

		return results;
	}
}

module.exports = Transaction;
