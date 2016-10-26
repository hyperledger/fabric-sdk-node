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
var grpc = require('grpc');

var _fabricProto = grpc.load(__dirname + '/protos/fabric_next.proto').protos;

var logger = utils.getLogger('Peer.js');

/**
 * The Peer class represents a peer in the target blockchain network to which
 * HFC sends endorsement proposals, transaction ordering or query requests.
 *
 * @class
 */
var Peer = class {

	/**
	 * Constructs a Peer given its endpoint configuration settings
	 * and returns the new Peer.
	 *
	 * @param {string} url The URL with format of "grpcs://host:port".
	 * @param {Chain} chain The chain of which this peer is a member.
	 * @param {string} pem The certificate file, in PEM format,
	 * to use with the gRPC protocol (that is, with TransportCredentials).
	 * Required when using the grpcs protocol.
	 */
	constructor(url) {
		this._url = url;
		this._ep = new utils.Endpoint(url, null);
		this._endorserClient = new _fabricProto.Endorser(this._ep.addr, this._ep.creds);
	}

	/**
	 * Get the URL of the peer.
	 * @returns {string} Get the URL associated with the peer.
	 */
	getUrl() {
		return this._url;
	}

	/**
	 * Send an endorsement proposal to an endorser.
	 *
	 * @param {Object} proposal A proposal of type Proposal
	 * @returns Promise for a ProposalResponse
	 */
	sendProposal(proposal) {
		var self = this;

		// Send the transaction to the peer node via grpc
		// The rpc specification on the peer side is:
		//     rpc ProcessProposal(Proposal) returns (ProposalResponse) {}
		return new Promise(function(resolve, reject) {
			self._endorserClient.processProposal(proposal, function(err, response) {
				if (err) {
					reject(new Error(err));
				} else {
					if (response) {
						logger.info('Received proposal response: code - %s', JSON.stringify(response.response.status));
						resolve(response.response.status);
					} else {
						logger.error('GRPC client failed to get a proper response from the peer.');
						reject(new Error('GRPC client failed to get a proper response from the peer.'));
					}
				}
			});
		});
	}
};

module.exports = Peer;
