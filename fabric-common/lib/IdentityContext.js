/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'IdentityContext';

const {checkParameter, getLogger, getNonce} = require('./Utils.js');
const HashPrimitives = require('./HashPrimitives.js');
const logger = getLogger(TYPE);

/**
 * @classdesc
 * This class represents a IdentityContext, the user identity.
 * This object will be used to provide the identity on outbound
 * requests to the fabric network.
 * This object will be the source of transaction ids that must
 * be based on an identity. The nonce values will be also
 * be calculated and kept here for convenience.
 * <br><br>
 * see the tutorial {@tutorial proposal}
 * <br><br>
 *
 * @class
 */
const IdentityContext = class {

	/**
	 * Construct a IdentityContext object.
	 *
	 * @param {User} user - The user identity instance
	 * @param {Client} client
	 * @returns {IdentityContext} The IdentityContext instance.
	 */
	constructor(user = checkParameter('user'), client = checkParameter('client')) {
		this.type = TYPE;
		this.client = client;
		this.user = user;
		this.options = {};
		if (!user.getName) {
			throw Error('Missing valid user parameter');
		}
		this.name = user.getName();
		this.mspid =  user.getMspid();
		this.transactionId = null;
		this.nonce = null;
	}

	/**
	 * create a new transaction ID value
	 */
	calculateTransactionId() {
		const method = 'calculateTransactionId';
		logger.debug('%s - start', method);
		this.nonce = getNonce();
		const creator_bytes = this.serializeIdentity();// same as signatureHeader.Creator
		const trans_bytes = Buffer.concat([this.nonce, creator_bytes]);
		const trans_hash = HashPrimitives.SHA2_256(trans_bytes);
		this.transactionId = Buffer.from(trans_hash).toString();
		logger.debug('%s - %s', method, this.transactionId);

		return this;
	}

	/**
	 * Get the protobuf serialized identity of this user
	 * @returns {byte[]} serialized identity in bytes
	 */
	serializeIdentity() {
		const method = 'serializeIdentity';
		logger.debug('%s - start', method);

		return this.user.getIdentity().serialize();
	}

	/**
	 * Sign the bytes provided
	 * @param {byte[]} payload - The payload bytes that require a signature
	 * @return  {byte[]} - The signature in bytes
	 */
	sign(payload = checkParameter('payload')) {
		const method = 'sign';
		logger.debug('%s - start', method);
		const signer = this.user.getSigningIdentity();
		const signature = Buffer.from(signer.sign(payload));

		return signature;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return `IdentityContext: { user: ${this.user.getName()}, transactionId: ${this.transactionId}, nonce:${this.nonce}}`;
	}

};

module.exports = IdentityContext;
module.exports.TYPE = TYPE;
