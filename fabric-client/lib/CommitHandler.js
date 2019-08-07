/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Base class for commit handling
 * @class
 */
class CommitHandler {

	/**
	 * @typedef {Object} CommitHandlerParameters
	 * @property {Object} request - {@link TransactionRequest}
	 * @property {Object} signed_envelope - An object that will be sent to the
	 *           orderer that contains the encoded endorsed proposals and the
	 *           signature of the sender.
	 * @property {Number} timeout - the timeout setting passed on sendTransaction
	 *           method.
	 */

	/**
	 * This method will process the parameters to determine the orderers.
	 * The handler will use the provided orderers or use the orderers assigned to
	 * the channel. The handler is expected to preform failover and use all available
	 * orderers to send the endorsed transaction.
	 *
	 * @param {CommitHandlerParameters} params - A {@link CommitHandlerParameters}
	 * @returns {Promise} A Promise for the {@link BroadcastResponse}, the
	 *        same results as calling the {@link Channel#sendTransaction}
	 *        method directly.
	 */
	commit(params) {
		if (params) {
			throw new Error('The "commit" method must be implemented');
		}
		throw new Error('The "commit" method must be implemented');
	}

	/**
	 * This method will be called by the channel when the channel is initialized.
	 */
	initialize() {
		throw new Error('The "initialize" method must be implemented');
	}

	/**
	 * This static method will be called by the channel to create an instance of
	 * this handler. It will be passed the channel object this handler is working
	 * with.
	 */
	static create(channel) {
		if (channel) {
			throw new Error('The "create" method must be implemented');
		}
		throw new Error('The "create" method must be implemented');
	}
}

module.exports = CommitHandler;
