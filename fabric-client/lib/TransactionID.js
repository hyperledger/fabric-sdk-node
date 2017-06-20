/*
 Copyright 2017 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var sdkUtils = require('./utils.js');
var logger = sdkUtils.getLogger('TransactionID.js');
var User = require('./User.js');
var hashPrimitives = require('./hash.js');


/**
 * The class representing the transaction identifier. Provides for
 * automatically creating the `nonce` value when an instance of this
 * object is created.
 *
 * @class
 */
var TransactionID = class {

	/**
	 * Builds a new tranaction Id based on a user's certificate and an automatically
	 * generated nonce value.
	 * @param {User} userContext - An instance of {@link User} that provides an unique
	 *                 base for this transaction id.
	 */
	constructor(userContext) {
		logger.debug('const - start');
		if (typeof userContext === 'undefined' || userContext === null) {
			throw new Error('Missing userContext parameter');
		}
		if(!(User.isInstance(userContext))) {
			throw new Error('Parameter "userContext" must be an instance of the "User" class');
		}
		this._nonce = sdkUtils.getNonce(); //nonce is in bytes
		let creator_bytes = userContext.getIdentity().serialize();//same as signatureHeader.Creator
		let trans_bytes = Buffer.concat([this._nonce, creator_bytes]);
		let trans_hash = hashPrimitives.sha2_256(trans_bytes);
		this._transaction_id = Buffer.from(trans_hash).toString();
		logger.debug('const - transaction_id %s',this._transaction_id);
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
};

module.exports = TransactionID;

