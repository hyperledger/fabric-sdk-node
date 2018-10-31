/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('Transaction');
const util = require('util');

function getResponsePayload(peerResponse) {
	const payload = peerResponse.response.payload;
	return (payload && payload.length > 0) ? payload : null;
}

class Transaction {
	/**
	 * Constructor.
	 * @param {Contract} contract Contract to which this transaction belongs.
	 * @param {String} name Transaction name.
	 */
	constructor(contract, name) {
		this._contract = contract;
		this._name = name;
		this._transactionId = contract.createTransactionID();
		this._transientMap = null;
		this._createTxEventHandler = () => {
			return {
				startListening: async () => {},
				waitForEvents: async () => {},
				cancelListening: () => {}
			};
		};
	}

	/**
	 * Ensure supplied transaction arguments are not strings.
	 * @private
	 * @static
	 * @param {Array} args transaction argument.
	 * @throws {Error} if any arguments are invalid.
	 */
	static verifyArguments(args) {
		const isInvalid = args.some((arg) => typeof arg !== 'string');
		if (isInvalid) {
			const argsString = args.map((arg) => util.format('%j', arg)).join(', ');
			const msg = util.format('Transaction arguments must be strings: %s', argsString);
			logger.error('_verifyTransactionArguments:', msg);
			throw new Error(msg);
		}
	}

	getName() {
		return this._name;
	}

	getTransactionID() {
		return this._transactionId;
	}

	setEventHandlerStrategy(factoryFunction) {
		this._createTxEventHandler = factoryFunction;
	}

	setTransient(transientMap) {
		this._transientMap = transientMap;
	}

	/**
	 * Submit a transaction to the ledger. The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers and then submitted to the ordering service
	 * for committing to the ledger.
	 * @async
     * @param {...string} args Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
     */
	async submit(...args) {
		Transaction.verifyArguments(args);

		const network = this._contract.getNetwork();
		const channel = network.getChannel();
		const txId = this._transactionId.getTransactionID();
		const eventHandler = this._createTxEventHandler(txId, network, this._contract.getEventHandlerOptions());

		const request = {
			chaincodeId: this._contract.getChaincodeId(),
			txId: this._transactionId,
			fcn: this._name,
			args: args
		};
		if (this._transientMap) {
			request.transientMap = this._transientMap;
		}

		// node sdk will target all peers on the channel that are endorsingPeer or do something special for a discovery environment
		const results = await channel.sendTransactionProposal(request);
		const proposalResponses = results[0];
		const proposal = results[1];

		// get only the valid responses to submit to the orderer
		const { validResponses } = this._validatePeerResponses(proposalResponses);

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

		return getResponsePayload(validResponses[0]);
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
		const invalidResponses = [];
		const invalidResponseMsgs = [];

		responses.forEach((responseContent) => {
			if (responseContent instanceof Error) {
				// this is either an error from the sdk, peer response or chaincode response.
				// we can distinguish between sdk vs peer/chaincode by the isProposalResponse flag in the future.
				// TODO: would be handy to know which peer the response is from and include it here.
				const warning = util.format('Response from attempted peer comms was an error: %j', responseContent);
				logger.warn('_validatePeerResponses: ' + warning);
				invalidResponseMsgs.push(warning);
				invalidResponses.push(responseContent);
			} else {
				// anything else is a successful response ie status will be less the 400.
				// in the future we can do things like verifyProposalResponse and compareProposalResponseResults
				// as part of an extended client side validation strategy but for now don't perform any client
				// side checks as the peers will have to do this anyway and it impacts client performance
				validResponses.push(responseContent);
			}
		});

		if (validResponses.length === 0) {
			const errorMessages = [ 'No valid responses from any peers.' ];
			invalidResponseMsgs.forEach(invalidResponse => errorMessages.push(invalidResponse));
			const msg = errorMessages.join('\n');
			logger.error('_validatePeerResponses: ' + msg);
			throw new Error(msg);
		}

		return { validResponses, invalidResponses };
	}
}

module.exports = Transaction;
