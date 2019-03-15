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
 * Base class for prover handling
 * @class
 */
class ProverHandler {

	/**
	 * @typedef {Object} ProverHandlerParameters
	 * @property {Object} request - {@link ChaincodeInvokeRequest}
	 * @property {Object} signed_proposal - the encoded protobuf "SignedProposal"
	 *           created by the sendTransactionProposal method before calling the
	 *           handler. Will be the object to be proved by the target peers.
	 * @property {Number} timeout - the timeout setting passed on sendTransactionProposal
	 *           method.
	 */

	/**
	 * This method will process the request object to calculate the target peers.
	 * Once the targets have been determined, use the channel to send the token
	 * transaction to the targets one at a time. After a target peer returns a response,
	 * this method will skip the rest of targets and return the response to the caller.
	 *
	 * @param {ProverHandlerParameters} params - A {@link ProverHandlerParameters}
	 *        that contains enough information to determine the targets and contains
	 *        a {@link ChaincodeInvokeRequest} to be sent using the included channel
	 *        with the {@link Channel} 'sendTransactionProposal' method.
	 * @returns {Promise} A Promise for the {@link ProposalResponseObject}, the
	 *        same results as calling the {@link Channel#sendTransactionProposal}
	 *        method directly.
	 */
	processCommand(params) {
		if (params) {
			throw new Error('The "processCommand" method must be implemented');
		}
		throw new Error('The "processCommand" method must be implemented');
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

module.exports = ProverHandler;
