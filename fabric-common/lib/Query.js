/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Query';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

const Proposal = require('./Proposal.js');

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
	 * Construct a Proposal object.
	 *
	 * @param {string} chaincodeName - The chaincode this proposal will execute
	 * @param {Channel} channel - The channel of this proposal
	 * @returns {Proposal} The Proposal instance.
	 */
	constructor(chaincodeName = checkParameter('chaincodeName'), channel = checkParameter('channel')) {
		super(chaincodeName, channel);

		const method = `constructor[${chaincodeName}]`;
		logger.debug('%s - start', method);
		this.type = TYPE;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {

		return `Query: {chaincodeName: ${this.chaincodeName}, channel: ${this.channel.name}}`;
	}
}

module.exports = Query;