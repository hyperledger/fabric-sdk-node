/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const util = require('util');
const logger = require('fabric-network/lib/logger').getLogger('Transaction');

const noOpEventHandler = {
	startListening: async () => {},
	waitForEvents: async () => {},
	cancelListening: () => {}
};

function noOpEventHandlerStrategyFactory() {
	return noOpEventHandler;
}

function getResponsePayload(proposalResponse) {
	const validEndorsementResponse = getValidEndorsementResponse(proposalResponse.responses);

	if (!validEndorsementResponse) {
		const error = newEndorsementError(proposalResponse);
		logger.error(error);
		throw error;
	}

	return validEndorsementResponse.response.payload;
}

function getValidEndorsementResponse(endorsementResponses) {
	return endorsementResponses.find((endorsementResponse) => endorsementResponse.endorsement);
}

function newEndorsementError(proposalResponse) {
	const errorInfos = [];

	for (const error of proposalResponse.errors) {
		error.peer = error.connection.name;
		error.status = 'grpc';
		errorInfos.push(error);
	}

	for (const endorsement of proposalResponse.responses) {
		const errorInfo = {
			peer: endorsement.connection.name,
			status: endorsement.response.status,
			message: endorsement.response.message
		};
		errorInfos.push(errorInfo);
	}

	const messages = ['No valid responses from any peers. Errors:'];
	for (const errorInfo of errorInfos) {
		messages.push(util.format('peer=%s, status=%s, message=%s',
			errorInfo.peer,
			errorInfo.status,
			errorInfo.message));
	}

	return new Error(messages.join('\n    '));
}

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
		this._name = name;
		this._transientMap = null;
		this._options = contract.gateway.getOptions();
		this._eventHandlerStrategyFactory = this._options.transaction.strategy || noOpEventHandlerStrategyFactory;
		this._isInvoked = false;
		this.queryHandler = contract.network.queryHandler;
		this._endorsingPeers = null; // for user assigned endorsements
		this._commitingOrderers = null; // for user assigned orderers
		this.transactionId = null; // will have a value after a submit

		// the signer of the outbound requests to the fabric network
		this.identityContext = this.contract.gateway.identityContext;
	}

	/**
	 * Get the fully qualified name of the transaction function.
	 * @returns {string} Transaction name.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Override the Gateway option for event handler strategy
	 * @private
	 * @param {*} eventHandlerStrategyFactory
	 */
	setEventHandlerStrategy(eventHandlerStrategyFactory) {
		const method = `setEventHandlerStrategy[${this._name}]`;
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
		const method = `setTranssient[${this._name}]`;
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
		const method = `setEndorsingPeers[${this._name}]`;
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
		const method = `setEndorsingOrganizations[${this._name}]`;
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
     * @param {...string} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
	 * @throws {module:fabric-network.TimeoutError} If the transaction was successfully submitted to the orderer but
	 * timed out before a commit event was received from peers.
     */
	async submit(...args) {
		const method = `submit[${this._name}]`;
		logger.debug('%s - start', method);

		const channel = this.contract.network.channel;
		const endorsementOptions = this._buildEndorsementOptions(args);
		if (Number.isInteger(this._options.transaction.endorseTimeout)) {
			endorsementOptions.requestTimeout = this._options.transaction.endorseTimeout * 1000; // in ms;
		}

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
			endorsementOptions.targets = this._endorsingPeers;
		} else if (this.contract.network.discoveryService) {
			logger.debug('%s - discovery handler will be used for endorsing', method);
			endorsementOptions.handler = await this.contract.getDiscoveryHandler(endorsement);
			if (this._endorsingOrgs) {
				endorsementOptions.requiredOrgs = this._endorsingOrgs;
			}
		} else if (this._endorsingOrgs) {
			logger.debug('%s - user has assigned an endorsing orgs %s', method, this._endorsingOrgs);
			const flatten = (accumulator, value) => {
				accumulator.push(...value);
				return accumulator;
			};
			endorsementOptions.targets = this._endorsingOrgs.map(channel.getEndorsers).reduce(flatten, []);
		} else {
			logger.debug('%s - targets will be all that are assigned to this channel', method);
			endorsementOptions.targets = channel.getEndorsers();
		}

		// by now we should have targets or a discovery handler to be used
		// by the send() of the proposal instance

		logger.debug('%s - build and send the endorsement', method);

		// build the outbound request along with getting a new transactionId
		// from the identity context
		endorsement.build(this.identityContext, endorsementOptions);
		endorsement.sign(this.identityContext);

		// ------- S E N D   P R O P O S A L
		// This is where the request gets sent to the peers
		const proposalResponse = await endorsement.send(endorsementOptions);
		try {
			const result = getResponsePayload(proposalResponse);

			// The endorsement is the source for the transaction id.
			// The endorsement created the transaction id on demand
			// when it built the proposal.
			this.transactionId = endorsement.getTransactionId();

			// ------- E V E N T   M O N I T O R
			const eventHandler = this._eventHandlerStrategyFactory(this, this._options.transaction);
			await eventHandler.startListening(this.identityContext);

			const commitOptions = {};
			if (Number.isInteger(this._options.transaction.commitTimeout)) {
				commitOptions.requestTimeout = this._options.transaction.commitTimeout * 1000; // in ms;
			}
			if (endorsementOptions.handler) {
				logger.debug('%s - use discovery to commit', method);
				commitOptions.handler = endorsementOptions.handler;
			} else {
				logger.debug('%s - use the orderers assigned to the channel', method);
				commitOptions.targets = channel.getCommitters();
			}

			// by now we should have a discovery handler or use the target orderers
			// that have been assigned from the channel to perform the commit

			const commit = endorsement.newCommit();
			commit.build(this.identityContext, commitOptions);
			commit.sign(this.identityContext);

			// -----  C O M M I T   E N D O R S E M E N T
			// this is where the endorsement results are sent to the orderer
			const commitResponse = await commit.send(commitOptions);

			logger.debug('%s - commit response %j', method, commitResponse);

			if (commitResponse.status !== 'SUCCESS') {
				const msg = `Failed to commit transaction %${endorsement.transactionId}, orderer response status: ${commitResponse.status}`;
				logger.error('%s - %s', method, msg);
				eventHandler.cancelListening();
				throw new Error(msg);
			} else {
				logger.debug('%s - successful commit', method);
			}

			logger.debug('%s - wait for the transaction to be committed on the peer', method);
			await eventHandler.waitForEvents();

			return result;
		} catch (err) {
			err.responses = proposalResponse.responses;
			err.errors = proposalResponse.errors;
			throw err;
		}
	}

	_buildEndorsementOptions(args) {
		const request = {
			fcn: this._name,
			args: args
		};
		if (this._transientMap) {
			request.transientMap = this._transientMap;
		}
		return request;
	}

	/**
	 * Evaluate a transaction function and return its results.
	 * The transaction function will be evaluated on the endorsing peers but
	 * the responses will not be sent to the ordering service and hence will
	 * not be committed to the ledger.
	 * This is used for querying the world state.
	 * @async
     * @param {...string} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
     */
	async evaluate(...args) {
		const method = `evaluate[${this._name}]`;
		logger.debug('%s - start', method);

		const request = this._buildEndorsementOptions(args);
		if (Number.isInteger(this._options.query.timeout)) {
			request.requestTimeout = this._options.query.timeout * 1000; // in ms;
		}

		const query = this.contract.network.channel.newQuery(this.contract.chaincodeId);

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
