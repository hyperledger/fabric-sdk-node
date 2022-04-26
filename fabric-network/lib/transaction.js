/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Query = require('fabric-network/lib/impl/query/query');
const FabricConstants = require('fabric-client/lib/Constants');

const logger = require('fabric-network/lib/logger').getLogger('Transaction');
const util = require('util');

const noOpTxEventHandler = {
	startListening: async () => {},
	waitForEvents: async () => {},
	cancelListening: () => {}
};

/**
 * Ensure supplied transaction arguments are not strings.
 * @private
 * @static
 * @param {Array} args transaction arguments.
 * @throws {Error} if any arguments are invalid.
 */
function verifyArguments(args) {
	const isInvalid = args.some((arg) => typeof arg !== 'string');
	if (isInvalid) {
		const argsString = args.map((arg) => util.format('%j', arg)).join(', ');
		const msg = util.format('Transaction arguments must be strings: %s', argsString);
		logger.error('verifyArguments:', msg);
		throw new Error(msg);
	}
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
	 */
	constructor(contract, name) {
		this._contract = contract;
		this._name = name;
		this._transactionId = contract.createTransactionID();
		this._transientMap = null;
		this._createTxEventHandler = (() => noOpTxEventHandler);
		this._isInvoked = false;
		this._queryHandler = contract.getNetwork().getQueryHandler();
		this._endorsingPeers = null;
	}

	/**
	 * Get the fully qualified name of the transaction function.
	 * @returns {String} Transaction name.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the ID that will be used for this transaction invocation.
	 * @returns {module:fabric-client.TransactionID} Transaction ID.
	 */
	getTransactionID() {
		return this._transactionId;
	}

	/**
	 * Set the event handler strategy to be used for this transaction invocation.
	 * @private
	 * @param {Function} factoryFunction Event handler factory function.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setEventHandlerStrategy(factoryFunction) {
		this._createTxEventHandler = factoryFunction;
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
		this._transientMap = transientMap;
		return this;
	}

	/**
	 * Set the peers that should be used for endorsement when this transaction is submitted to the ledger.
	 * @param {ChannelPeer[]} peers Endorsing peers.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setEndorsingPeers(peers) {
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
	 * If discovery is not used then this will target all endorsing peers in each of the
	 * specified organizations. Use setEndorsingPeers instead when not using discovery if you
	 * don't want all peers targetted in an organization.
	 * @param {...string} orgs - Endorsing organizations.
	 * @returns {module:fabric-network.Transaction} This object, to allow function chaining.
	 */
	setEndorsingOrganizations(...orgs) {
		this._endorsingOrgs = orgs;
		this._endorsingPeers = null;
		return this;
	}

	/**
	 * Returns the network from the contract
	 * @returns {module:fabric-network.Network}
	 */
	getNetwork() {
		return this._contract.getNetwork();
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
	 * @throws {Error} if an underlying infrastructure failure occurs.  The `responses` property of the error contains the
	 * array of proposal response objects from the endorsing peers.
     */
	async submit(...args) {
		verifyArguments(args);
		this._setInvokedOrThrow();

		const network = this._contract.getNetwork();
		const channel = network.getChannel();
		const txId = this._transactionId.getTransactionID();
		const options = this._contract.getEventHandlerOptions();

		const eventHandler = this._createTxEventHandler(this, options);

		const request = this._buildRequest(args);
		if (this._endorsingPeers) {
			request.targets = this._endorsingPeers;
		} else if (this._endorsingOrgs) {
			if (network._isDiscoveryEnabled()) {
				request.requiredOrgs = this._endorsingOrgs;
			} else {
				request.targets = this._getEndorsingPeersForOrgs(channel);
			}
		}
		request.endorsement_hint = {chaincodes: this._contract.getDiscoveryInterests()};

		// Same as v2.2, define the endorseTimeout property which is used as the timeout for endorsement of the proposal
		const endorseTimeout = options.endorseTimeout * 1000; // in ms

		// node sdk will target all peers on the channel that are endorsingPeer or do something special for a discovery environment
		const results = await channel.sendTransactionProposal(request, endorseTimeout);
		const proposalResponses = results[0];
		const proposal = results[1];

		try {
			// get only the valid responses to submit to the orderer
			const {validResponses} = this._validatePeerResponses(proposalResponses);

			await eventHandler.startListening();

			// Submit the endorsed transaction to the primary orderers.
			const response = await channel.sendTransaction({
				proposalResponses: validResponses,
				proposal
			});

			if (response.status !== 'SUCCESS') {
				const msg = util.format('Failed to send peer responses for transaction %j to orderer. Response status: %j', txId, response.status);
				logger.error('submit:', msg);
				eventHandler.cancelListening();
				throw new Error(msg);
			}

			await eventHandler.waitForEvents();

			return validResponses[0].response.payload || null;

		} catch(err) {
			err.responses = proposalResponses;
			throw err;
		}
	}

	_setInvokedOrThrow() {
		if (this._isInvoked) {
			throw new Error('Transaction has already been invoked');
		}
		this._isInvoked = true;
	}

	_buildRequest(args) {
		const request = {
			chaincodeId: this._contract.getChaincodeId(),
			txId: this._transactionId,
			fcn: this._name,
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
     * @param {any} responses the responses from the install, instantiate or invoke
     * @return {Object} number of ignored errors and valid responses
     * @throws if there are no valid responses at all.
     */
	_validatePeerResponses(responses) {
		if (!responses.length) {
			logger.error('_validatePeerResponses: No results were returned from the request');
			throw new Error('No results were returned from the request');
		}

		const validResponses = [];
		const errorResponses = [];

		responses.forEach((responseContent) => {
			if (responseContent instanceof Error) {
				// this is either an error from the sdk, peer response or chaincode response.
				// we can distinguish between sdk vs peer/chaincode by the isProposalResponse flag in the future.
				// TODO: would be handy to know which peer the response is from and include it here.
				logger.warn('_validatePeerResponses: Received error response from peer:', responseContent);
				errorResponses.push(responseContent);
			} else {
				// anything else is a successful response ie status will be less then 400.
				// in the future we can do things like verifyProposalResponse and compareProposalResponseResults
				// as part of an extended client side validation strategy but for now don't perform any client
				// side checks as the peers will have to do this anyway and it impacts client performance
				logger.debug('_validatePeerResponses: valid response from peer %j', responseContent.peer);
				validResponses.push(responseContent);
			}
		});

		if (validResponses.length === 0) {
			const errorMessages = errorResponses.map((response) => util.format('peer=%s, status=%s, message=%s',
				response.peer.name, response.status, response.message));
			const messages = Array.of(`No valid responses from any peers. ${errorResponses.length} peer error responses:`,
				...errorMessages);
			const msg = messages.join('\n    ');
			logger.error('_validatePeerResponses: ' + msg);
			throw new Error(msg);
		}

		return {validResponses, invalidResponses: errorResponses};
	}

	/**
	 * Get all endorsring peers for the specific mspids on the specified channel
	 * @param {module:fabric-client.Channel} channel
	 * @returns {module:fabric-client.Channel.ChannelPeer[]} the filtered endorsing peers
	 * @private
	 */
	_getEndorsingPeersForOrgs(channel) {
        const channelPeers = channel.getChannelPeers();
        const filteredPeers = channelPeers.filter((channelPeer) => {
			return channelPeer.isInRole(FabricConstants.NetworkConfig.ENDORSING_PEER_ROLE) &&
				this._endorsingOrgs.some((org) => channelPeer.isInOrg(org));
		});
		return filteredPeers;
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
		verifyArguments(args);
		this._setInvokedOrThrow();

		const channel = this._contract.getNetwork().getChannel();
		const request = this._buildRequest(args);

		// queryHandlerOption.timeout default 30 seconds
		let timeout = this._contract.getQueryHandlerOptions().timeout ? this._contract.getQueryHandlerOptions().timeout : 30;
		request.request_timeout =  timeout * 1000; // in ms

		const query = new Query(channel, request);

		return this._queryHandler.evaluate(query);
	}

	/**
	 * Create a commit event listener for this transaction.
	 * @param {Function} callback - This callback will be triggered when
	 *		a transaction commit event is emitted. It takes parameters
	 * 		of error, transactionId, transaction status and block number
	 * @param {module:fabric-network.Network~ListenerOptions} [options] - Optional. Options on
	 * 		registrations allowing start and end block numbers.
	 * @param {ChannelEventHub} [eventHub] - Optional. Used to override the event hub selection
	 * @returns {module:fabric-network~CommitEventListener}
	 * @async
	 */
	async addCommitListener(callback, options, eventHub) {
		const txid = this.getTransactionID().getTransactionID();
		const network = this._contract.getNetwork();
		return network.addCommitListener(txid, callback, options, eventHub);
	}
}

module.exports = Transaction;
