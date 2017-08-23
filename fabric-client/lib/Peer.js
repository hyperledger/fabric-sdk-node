/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

var api = require('./api.js');
var utils = require('./utils.js');
var Remote = require('./Remote');
var grpc = require('grpc');
var util = require('util');

var _serviceProto = grpc.load(__dirname + '/protos/peer/peer.proto').protos;

var logger = utils.getLogger('Peer.js');

/**
 * The Peer class represents an endorsing peer in the target blockchain network.
 * The application can send endorsement proposals, and query requests through this
 * class.
 *
 * @class
 * @extends Remote
 */
var Peer = class extends Remote {

	/**
	 * Construct a Peer object with the given url and opts. A peer object
	 * encapsulates the properties of an endorsing peer and the interactions with it
	 * via the grpc service API. Peer objects are used by the {@link Client} objects to
	 * send channel-agnostic requests such as installing chaincode, querying peers for
	 * installed chaincodes, etc. They are also used by the {@link Channel} objects to
	 * send channel-aware requests such as instantiating chaincodes, and invoking
	 * transactions.
	 *
	 * @param {string} url - The URL with format of "grpc(s)://host:port".
	 * @param {ConnectionOpts} opts - The options for the connection to the peer.
	 * @returns {Peer} The Peer instance.
	 */
	constructor(url, opts) {
		super(url, opts);

		logger.debug('Peer.const - url: %s timeout: %s', url, this._request_timeout);
		this._endorserClient = new _serviceProto.Endorser(this._endpoint.addr, this._endpoint.creds, this._options);
		this._name = null;
	}

	/**
	 * Get the Peer name. This is a client-side only identifier for this
	 * Peer object.
	 * @returns {string} The name of the Peer object
	 */
	getName() {
		return this._name;
	}

	/**
	 * Set the Peer name as a client-side only identifier of this Peer object.
	 * @param {string} name
	 */
	setName(name) {
		this._name = name;
	}

	/**
	 * Send an endorsement proposal to an endorser. This is used to call an
	 * endorsing peer to execute a chaincode to process a transaction proposal,
	 * or runs queries.
	 *
	 * @param {Proposal} proposal - A protobuf encoded byte array of type
	 *                              [Proposal]{@link https://github.com/hyperledger/fabric/blob/v1.0.0/protos/peer/proposal.proto#L134}
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *                              response before rejecting the promise with a
	 *                              timeout error. This overrides the default timeout
	 *                              of the Peer instance and the global timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link ProposalResponse}
	 */
	sendProposal(proposal, timeout) {
		logger.debug('Peer.sendProposal - Start');
		let self = this;
		let rto = self._request_timeout;
		if (typeof timeout === 'number')
			rto = timeout;

		if(!proposal) {
			return Promise.reject(new Error('Missing proposal to send to peer'));
		}

		// Send the transaction to the peer node via grpc
		// The rpc specification on the peer side is:
		//     rpc ProcessProposal(Proposal) returns (ProposalResponse) {}
		return new Promise(function(resolve, reject) {
			var send_timeout = setTimeout(function(){
				logger.error('sendProposal - timed out after:%s', rto);
				return reject(new Error('REQUEST_TIMEOUT'));
			}, rto);

			self._endorserClient.processProposal(proposal, function(err, proposalResponse) {
				clearTimeout(send_timeout);
				if (err) {
					logger.debug('Received proposal response from: %s status: %s',self._url, err);
					if(err instanceof Error) {
						reject(err);
					}
					else {
						reject(new Error(err));
					}
				} else {
					if (proposalResponse) {
						logger.debug('Received proposal response from peer "%s": status - %s', self._url, proposalResponse.response.status);
						resolve(proposalResponse);
					} else {
						logger.error('GRPC client failed to get a proper response from the peer "%s".', self._url);
						reject(new Error(util.format('GRPC client failed to get a proper response from the peer "%s".', self._url)));
					}
				}
			});
		});
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return ' Peer : {' +
			'url:' + this._url +
		'}';
	}

};

module.exports = Peer;
