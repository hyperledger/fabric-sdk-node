/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Query';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

const Proposal = require('./Proposal.js');

/**
 * @typedef {ProposalResponse} QueryResponse
 * @property {Buffer[]} queryResults - the results as extracted from the
 *  endorsement {@link EndorsementResponse} from an {@link Query} endorsement
 *  that will not be committed.
 */


/**
 * @classdesc
 * This class represents a Query definition.
 * This class allows an application to contain all proposal attributes and
 * artifacts in one place during a query.
 *
 * @class
 */
class Query extends Proposal {

	/**
	 * @constructor
	 * @param {string} chaincodeId
	 * @param {Channel} channel
	 */
	constructor(chaincodeId = checkParameter('chaincodeId'), channel = checkParameter('channel')) {
		super(chaincodeId, channel);

		const method = `constructor[${chaincodeId}]`;
		logger.debug('%s - start', method);
		this.type = TYPE;
		this._queryResults = [];
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {

		return `Query: {chaincodeId: ${this.chaincodeId}, channel: ${this.channel.name}}`;
	}

	/**
	 * Send a signed transaction query proposal
	 * @override
	 * @param {SendProposalRequest} request options
	 * @returns {QueryResponse}
	 */
	async send(request = {}) {
		const return_results = await super.send(request);
		return_results.responses.forEach((response) => {
			if (response.endorsement && response.response && response.response.payload) {
				this._queryResults.push(response.response.payload);
			}
		});
		return_results.queryResults = this._queryResults;
		return return_results;
	}
}

module.exports = Query;
