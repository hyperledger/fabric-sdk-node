/*
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
		if (!user.getName) {
			throw Error('Missing valid user parameter');
		}
		this.name = user.getName();
		this.mspid =  user.getMspid();
		this.transactionId = null;
		this.nonce = null;
	}

	/**
	 * Create a new transaction ID value. The new transaction ID will be set both on this object and on the return
	 * value, which is a copy of this identity context. Calls to this function will not affect the transaction ID value
	 * on copies returned from previous calls.
	 * @returns A copy of this identity context.
	 */
	calculateTransactionId() {
		const method = 'calculateTransactionId';
		logger.debug('%s - start', method);
		this.nonce = getNonce();
		logger.debug('%s - nonce:%s', method, this.nonce.toString('hex'));
		const creator_bytes = this.serializeIdentity();// same as signatureHeader.Creator
		const trans_bytes = Buffer.concat([this.nonce, creator_bytes]);
		const trans_hash = HashPrimitives.SHA2_256(trans_bytes);
		this.transactionId = Buffer.from(trans_hash).toString();
		logger.debug('%s - txid:%s', method, this.transactionId);

		return this.clone({
			nonce: this.nonce,
			transactionId: this.transactionId
		});
	}

	/**
	 * Get the protobuf serialized identity of this user
	 * @returns {Buffer} serialized identity in bytes
	 */
	serializeIdentity() {
		const method = 'serializeIdentity';
		logger.debug('%s - start', method);

		return this.user.getIdentity().serialize();
	}

	/**
	 * Sign the bytes provided
	 * @param {Buffer} payload - The payload bytes that require a signature
	 * @return {Buffer} - The signature in bytes
	 */
	sign(payload = checkParameter('payload')) {
		const method = 'sign';
		logger.debug('%s - start', method);
		const signer = this.user.getSigningIdentity();
		const signature = Buffer.from(signer.sign(payload));

		logger.debug('%s - end', method);
		return signature;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return `IdentityContext: { user: ${this.user.getName()}, transactionId: ${this.transactionId}, nonce:${this.nonce}}`;
	}

	/**
	 * Creates a copy of this object.
	 * @private
	 * @return {IdentityContext} An identity context.
	 */
	clone(state) {
		const result = new IdentityContext(this.user, this.client);
		result.transactionId = state.transactionId;
		result.nonce = state.nonce;
		return result;
	}
};

module.exports = IdentityContext;
module.exports.TYPE = TYPE;
