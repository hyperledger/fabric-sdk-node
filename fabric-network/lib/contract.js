/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('./logger').getLogger('Contract');
const util = require('util');

class Contract {

	constructor(channel, chaincodeId, gateway, queryHandler, eventHandlerFactory) {
		logger.debug('in Contract constructor');

		this.channel = channel;
		this.chaincodeId = chaincodeId;
		this.gateway = gateway;
		this.queryHandler = queryHandler;
		this.eventHandlerFactory = eventHandlerFactory;
	}

	/**
     * Check for proposal response errors.
     * @private
     * @param {any} responses the responses from the install, instantiate or invoke
     * @return {Object} number of ignored errors and valid responses
     * @throws if there are no valid responses at all.
     */
	_validatePeerResponses(responses) {
		logger.debug('in _validatePeerResponses');

		if (!responses.length) {
			logger.error('_validatePeerResponses: No results were returned from the request');
			throw new Error('No results were returned from the request');
		}

		const validResponses = [];
		const invalidResponses = [];
		const invalidResponseMsgs = [];

		responses.forEach((responseContent) => {
			if (responseContent instanceof Error) {
				const warning = util.format('Response from attempted peer comms was an error: %j', responseContent);
				logger.warn('_validatePeerResponses: ' + warning);
				invalidResponseMsgs.push(warning);
				invalidResponses.push(responseContent);
			} else {

				// not an error, if it is from a proposal, verify the response
				if (!this.channel.verifyProposalResponse(responseContent)) {
					// the node-sdk doesn't provide any external utilities from parsing the responseContent.
					// there are internal ones which may do what is needed or we would have to decode the
					// protobufs ourselves but it should really be the node sdk doing this.
					const warning = util.format('Proposal response from peer failed verification: %j', responseContent.response);
					logger.warn('_validatePeerResponses: ' + warning);
					invalidResponseMsgs.push(warning);
					invalidResponses.push(responseContent);
				} else if (responseContent.response.status !== 200) {
					const warning = util.format('Unexpected response of %j. Payload was: %j', responseContent.response.status, responseContent.response.payload);
					logger.warn('_validatePeerResponses: ' + warning);
					invalidResponseMsgs.push(warning);
				} else {
					validResponses.push(responseContent);
				}
			}
		});

		if (validResponses.length === 0) {
			const errorMessages = [ 'No valid responses from any peers.' ];
			invalidResponseMsgs.forEach(invalidResponse => errorMessages.push(invalidResponse));
			const msg = errorMessages.join('\n');
			logger.error('_validatePeerResponses: ' + msg);
			throw new Error(msg);
		}

		return {validResponses, invalidResponses, invalidResponseMsgs};
	}

	/**
	 * Submit a transaction to the contract.
     * @param {string} transactionName Transaction function name
     * @param {...string} parameters Transaction function parameters
     * @returns {Buffer} Payload response
     */
	async submitTransaction(transactionName, ...parameters) {
		logger.debug('in submitTransaction: ' + transactionName);

		this._verifyTransactionDetails('submitTransaction', transactionName, parameters);

		const txId = this.gateway.getClient().newTransactionID();
		// createTxEventHandler() will return null if no event handler is requested
		const eventHandler = this.eventHandlerFactory.createTxEventHandler(txId.getTransactionID());

		// Submit the transaction to the endorsers.
		const request = {
			chaincodeId: this.chaincodeId,
			txId,
			fcn: transactionName,
			args: parameters
		};

		// node sdk will target all peers on the channel that are endorsingPeer or do something special for a discovery environment
		const results = await this.channel.sendTransactionProposal(request);
		const proposalResponses = results[0];
		const proposal = results[1];

		//TODO: what to do about invalidResponses
		const {validResponses} = this._validatePeerResponses(proposalResponses);

		//TODO: more to do regarding checking the response (see hlfconnection.invokeChaincode)

		eventHandler && await eventHandler.startListening();

		// Submit the endorsed transaction to the primary orderers.
		const response = await this.channel.sendTransaction({
			proposalResponses: validResponses,
			proposal
		});

		if (response.status !== 'SUCCESS') {
			const msg = util.format('Failed to send peer responses for transaction \'%j\' to orderer. Response status: %j', txId.getTransactionID(), response.status);
			logger.error('submitTransaction:', msg);
			eventHandler && eventHandler.cancelListening();
			throw new Error(msg);
		}

		eventHandler && await eventHandler.waitForEvents();

		// return the payload from the invoked chaincode
		let result = null;
		if (validResponses[0].response.payload && validResponses[0].response.payload.length > 0) {
			result = validResponses[0].response.payload;
		}
		return result;
	}

	/**
	 * Verify the supplied transaction details.
	 * @private
	 * @param {String} methodName Requesting method name, used for logging.
	 * @param {String} transactionName Name of a transaction.
	 * @param {String[]} parameters transaction parameters.
	 * @throws {Error} if the details are not acceptable.
	 */
	_verifyTransactionDetails(methodName, transactionName, parameters) {
		this._verifyTransactionName(methodName, transactionName);
		this._verifyTransactionParameters(methodName, parameters);
	}

	/**
	 * Ensure a supplied transaction name is valid.
	 * @private
	 * @param {String} methodName Requesting method name, used for logging.
	 * @param {String} transactionName Name of a transaction.
	 * @throws {Error} if the name is not valid.
	 */
	_verifyTransactionName(methodName, transactionName) {
		if(typeof transactionName !== 'string' || transactionName.length === 0) {
			const msg = util.format('Transaction name must be a non-empty string: %j', transactionName);
			logger.error(methodName + ':', msg);
			throw new Error(msg);
		}
	}

	/**
	 * Ensure supplied transaction parameters are valid.
	 * @private
	 * @param {String} methodName Requesting method name, used for logging.
	 * @param {String[]} parameters transaction parameters.
	 * @throws {Error} if any parameters are invalid.
	 */
	_verifyTransactionParameters(methodName, parameters) {
		const invalidParameters = parameters.filter((parameter) => typeof parameter !== 'string');
		if (invalidParameters.length > 0) {
			const invalidParamString = invalidParameters
				.map((parameter) => util.format('%j', parameter))
				.join(', ');
			const msg = 'Transaction parameters must be strings: ' + invalidParamString;
			logger.error(methodName + ':', msg);
			throw new Error(msg);
		}
	}

	/**
     * @param {string} transactionName transaction name
     * @param {string[]} parameters transaction parameters
     * @returns {byte[]} payload response
     */
	async executeTransaction(transactionName, ...parameters) {
		this._verifyTransactionDetails('executeTransaction', transactionName, parameters);
		const txId = this.gateway.getClient().newTransactionID();
		const result = await this.queryHandler.queryChaincode(this.chaincodeId, txId, transactionName, parameters);
		return result ? result : null;
	}
}

module.exports = Contract;
