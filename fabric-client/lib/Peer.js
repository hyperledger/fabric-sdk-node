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
 * The Peer class represents a peer in the target blockchain network to which
 * HFC sends endorsement proposals, transaction ordering or query requests.
 *
 * The Peer class represents the remote Peer node and its network membership materials,
 * aka the ECert used to verify signatures. Peer membership represents organizations,
 * unlike User membership which represents individuals.
 *
 * When constructed, a Peer instance can be designated as an event source, in which case
 * a “eventSourceUrl” attribute should be configured. This allows the SDK to automatically
 * attach transaction event listeners to the event stream.
 *
 * It should be noted that Peer event streams function at the Peer level and not at the
 * channel and chaincode levels.
 *
 * @class
 * @extends Remote
 */
var Peer = class extends Remote {

	/**
	 * Constructs a Peer given its endpoint configuration settings.
	 *
	 * @param {string} url The URL with format of "grpcs://host:port".
	 * @param {Object} opts The options for the connection to the peer.
	 * <br>- request-timeout {string} A integer value in milliseconds to
	 *       be used as node.js based timeout. This will break the request
	 *       operation if the grpc request has not responded within this
	 *       timeout period.
	 *   note: other options will be passed to the grpc connection
	 */
	constructor(url, opts) {
		super(url, opts);

		logger.debug('Peer.const - url: %s timeout: %s', url, this._request_timeout);
		this._endorserClient = new _serviceProto.Endorser(this._endpoint.addr, this._endpoint.creds, this._options);
		this._name = null;
	}

	/**
	 * Get the Peer name. Required property for the instance objects.
	 * @returns {string} The name of the Peer
	 */
	getName() {
		return this._name;
	}

	/**
	 * Set the Peer name / id.
	 * @param {string} name
	 */
	setName(name) {
		this._name = name;
	}

    /**
	 * Set the Peer’s enrollment certificate.
	 * @param {object} enrollment Certificate in PEM format signed by the trusted CA
	 */
	setEnrollmentCertificate(enrollment) {
		if (typeof enrollment.privateKey === 'undefined' || enrollment.privateKey === null || enrollment.privateKey === '') {
			throw new Error('Invalid enrollment object. Must have a valid private key.');
		}

		if (typeof enrollment.certificate === 'undefined' || enrollment.certificate === null || enrollment.certificate === '') {
			throw new Error('Invalid enrollment object. Must have a valid certificate.');
		}

		this._enrollment = enrollment;
	}

	/**
	 * Send an endorsement proposal to an endorser.
	 *
	 * @param {Proposal} proposal A proposal of type Proposal
	 * @see /protos/peer/fabric_proposal.proto
	 * @returns Promise for a ProposalResponse
	 */
	sendProposal(proposal) {
		logger.debug('Peer.sendProposal - Start');
		var self = this;

		if(!proposal) {
			return Promise.reject(new Error('Missing proposal to send to peer'));
		}

		// Send the transaction to the peer node via grpc
		// The rpc specification on the peer side is:
		//     rpc ProcessProposal(Proposal) returns (ProposalResponse) {}
		return new Promise(function(resolve, reject) {
			var send_timeout = setTimeout(function(){
				logger.error('sendProposal - timed out after:%s', self._request_timeout);
				return reject(new Error('REQUEST_TIMEOUT'));
			}, self._request_timeout);

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
