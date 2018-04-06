/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

const sdkUtils = require('./utils.js');
const logger = sdkUtils.getLogger('TransactionID.js');
const User = require('./User.js');
const hashPrimitives = require('./hash.js');


/**
 * The class representing the transaction identifier. Provides for
 * automatically creating the `nonce` value when an instance of this
 * object is created.
 *
 * @class
 */
class TransactionID {

	/**
     * Builds a new transaction Id based on a user's certificate and an automatically
     * generates a nonce value.
     * @param {Identity} signer_or_userContext - An instance of {@link Identity} that provides an unique
     *                 base for this transaction id. This also may be an instance of a {@User}.
     * @param {boolean} admin - Indicates that this instance will be used for administrative  transactions.
     */
	constructor(signer_or_userContext, admin) {
		logger.debug('constructor - start');
		if (!signer_or_userContext) {
			throw new Error('Missing userContext or signing identity parameter');
		}
		let signer = null;
		if ((User.isInstance(signer_or_userContext))) {
			signer = signer_or_userContext.getSigningIdentity();
		} else {
			signer = signer_or_userContext;
		}

		this._nonce = sdkUtils.getNonce(); //nonce is in bytes
		const creator_bytes = signer.serialize();//same as signatureHeader.Creator
		const trans_bytes = Buffer.concat([this._nonce, creator_bytes]);
		const trans_hash = hashPrimitives.SHA2_256(trans_bytes);
		this._transaction_id = Buffer.from(trans_hash).toString();
		logger.debug('const - transaction_id %s', this._transaction_id);

		this._admin = admin;
	}

	/**
     * The transaction ID
     */
	getTransactionID() {
		return this._transaction_id;
	}

	/**
     * The nonce value
     */
	getNonce() {
		return this._nonce;
	}

	/**
     * indicates if this transactionID was generated for an admin
     */
	isAdmin() {
		if (this._admin) {
			return true;
		} else {
			return false;
		}
	}
}

module.exports = TransactionID;
