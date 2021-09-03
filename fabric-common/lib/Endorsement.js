/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Endorsement';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);

const Proposal = require('./Proposal.js');
const Commit = require('./Commit.js');

/**
 * @classdesc
 * This class represents an Endorsement definition.
 * This class allows an application to contain all proposal attributes and
 * artifacts in one place during an endorsement.
 *
 * @class
 */
class Endorsement extends Proposal {

	/**
	 * Construct a Proposal object.
	 *
	 * @param {string} chaincodeId - The chaincode this proposal will execute
	 * @param {Channel} channel - The channel of this proposal
	 * @returns {Proposal} The Proposal instance.
	 */
	constructor(chaincodeId = checkParameter('chaincodeId'), channel = checkParameter('channel')) {
		super(chaincodeId, channel);
		const method = `constructor[${chaincodeId}]`;
		logger.debug('%s - start', method);
		this.type = TYPE;
	}

	/**
	 * Gets a Commit instance for this endorsement.
	 */
	newCommit() {
		const method = `newCommit[${this.name}]`;
		logger.debug(`${method} - start`);

		return new Commit(this.chaincodeId, this.channel, this);
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {

		return `Endorsement: {chaincodeId: ${this.chaincodeId}, channel: ${this.channel.name}}`;
	}
}

module.exports = Endorsement;