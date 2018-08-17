/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('./logger').getLogger('contract.js');
const util = require('util');

class Contract {

	constructor(channel, chaincodeId, network) {
		logger.debug('in Contract constructor');

		this.channel = channel;
		this.chaincodeId = chaincodeId;
		this.network = network;

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
     * @param {string} transactionName Transaction function name
     * @param {...string} parameters Transaction function parameters
     * @returns {Buffer} Payload response
     */
	async submitTransaction(transactionName, ...parameters) {
		logger.debug('in submitTransaction: ' + transactionName);

		// check parameters
		if(typeof transactionName !== 'string' || transactionName.length === 0) {
			const msg = util.format('transactionName must be a non-empty string: %j', transactionName);
			logger.error('submitTransaction: ' + msg);
			throw new Error(msg);
		}
		parameters.forEach((parameter) => {
			if(typeof parameter !== 'string') {
				const msg = util.format('transaction parameters must be strings: %j', parameter);
				logger.error('submitTransaction: ' + msg);
				throw new Error(msg);
			}
		});

		const txId = this.network.getClient().newTransactionID();

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

		//TODO: what to do about invalidResponses
		const {validResponses} = this._validatePeerResponses(proposalResponses);
		if (validResponses.length === 0) {
			//TODO: include the invalidResponsesMsgs ?
			const msg = 'No valid responses from any peers';
			logger.error('submitTransaction: ' + msg);
			throw new Error(msg);
		}

		// Submit the endorsed transaction to the primary orderers.
		const proposal = results[1];

		//TODO: more to do regarding checking the response (see hlfconnection.invokeChaincode)

		const response = await this.channel.sendTransaction({
			proposalResponses: validResponses,
			proposal
		});

		if (response.status !== 'SUCCESS') {
			const msg = util.format('Failed to send peer responses for transaction \'%j\' to orderer. Response status: %j', txId.getTransactionID(), response.status);
			logger.error('submitTransaction: ' + msg);
			throw new Error(msg);
		}

		// return the payload from the invoked chaincode
		let result = null;
		if (validResponses[0].response.payload && validResponses[0].response.payload.length > 0) {
			result = validResponses[0].response.payload;
		}
		return result;

	}
}

module.exports = Contract;