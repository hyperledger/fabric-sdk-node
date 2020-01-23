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

const utils = require('./utils.js');
const Remote = require('./Remote');
const ProtoLoader = require('./ProtoLoader');
const util = require('util');

const _serviceProto = ProtoLoader.load(__dirname + '/protos/peer/peer.proto').protos;
const _discoveryProto = ProtoLoader.load(__dirname + '/protos/discovery/protocol.proto').discovery;

const logger = utils.getLogger('Peer.js');

/**
 * The Peer class represents a peer in the target blockchain network.
 * The application can send endorsement proposals, and query requests through this
 * class.
 *
 * @class
 * @extends Remote
 */
class Peer extends Remote {

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

		logger.debug('Peer.const - url: %s timeout: %s name:%s', url, this._request_timeout, this.getName());
		this._endorserClient = null;
		this._discoveryClient = null;
		this._createClients();
	}

	_createClients() {
		if (!this._endorserClient) {
			logger.debug('_createClients - create peer endorser connection ' + this._endpoint.addr);
			this._endorserClient = new _serviceProto.Endorser(this._endpoint.addr, this._endpoint.creds, this._options);
		}
		if (!this._discoveryClient) {
			logger.debug('_createClients - create peer discovery connection ' + this._endpoint.addr);
			this._discoveryClient = new _discoveryProto.Discovery(this._endpoint.addr, this._endpoint.creds, this._options);
		}
	}

	/**
	 * Close the service connections.
	 */
	close() {
		if (this._endorserClient) {
			logger.debug('close - closing peer endorser connection ' + this._endpoint.addr);
			this._endorserClient.close();
			this._endorserClient = null;
		}
		if (this._discoveryClient) {
			logger.debug('close - closing peer discovery connection ' + this._endpoint.addr);
			this._discoveryClient.close();
			this._discoveryClient = null;
		}
	}

	/**
	 * Send an endorsement proposal to an endorser. This is used to call an
	 * endorsing peer to execute a chaincode to process a transaction proposal,
	 * or runs queries.
	 *
	 * @param {Proposal} proposal - A protobuf encoded byte array of type
	 *        [Proposal]{@link https://github.com/hyperledger/fabric/blob/release-1.2/protos/peer/proposal.proto}
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link ProposalResponse}
	 */
	async sendProposal(proposal, timeout) {
		const method = 'sendProposal';
		logger.debug('%s - Start ----%s %s', method, this.getName(), this.getUrl());
		const self = this;
		let rto = self._request_timeout;

		if (typeof timeout === 'number') {
			rto = timeout;
		}
		if (!proposal) {
			throw new Error('Missing proposal to send to peer');
		}

		this._createClients();

		// by default users will have to choose to have the connection
		// checked by the wait for ready processing of the gRPC service
		if (this.useWaitForReady) {
			await this.waitForReady(this._endorserClient);
		}

		return new Promise((resolve, reject) => {
			const send_timeout = setTimeout(() => {
				clearTimeout(send_timeout);
				logger.error('%s - timed out after:%s', method, rto);
				return reject(new Error('REQUEST_TIMEOUT'));
			}, rto);

			self._endorserClient.processProposal(proposal, (err, proposalResponse) => {
				clearTimeout(send_timeout);
				if (err) {
					logger.debug('%s - Received proposal response from: %s status: %s', method, self._url, err);
					if (err instanceof Error) {
						reject(err);
					} else {
						reject(new Error(err));
					}
				} else {
					if (proposalResponse) {
						logger.debug('%s - Received proposal response from peer "%s": status - %s', method, self._url, (proposalResponse.response &&  proposalResponse.response.status) ? proposalResponse.response.status : 'undefined');
						// 400 is the error threshold level, anything below that the endorser will endorse it.
						if (proposalResponse.response && proposalResponse.response.status < 400) {
							proposalResponse.peer = self.getCharacteristics();
							resolve(proposalResponse);
						} else if (proposalResponse.response && proposalResponse.response.message) {
							const error = Object.assign(new Error(proposalResponse.response.message), proposalResponse.response);
							error.peer = self.getCharacteristics();
							error.isProposalResponse = true;
							reject(error);
						} else {
							const return_error = new Error(util.format('GRPC client failed to get a proper response from the peer "%s".', self._url));
							return_error.peer = self.getCharacteristics();
							logger.error('%s - rejecting with:%s', method, return_error);
							reject(return_error);
						}
					} else {
						const return_error = new Error(util.format('GRPC client got a null or undefined response from the peer "%s".', self._url));
						return_error.peer = self.getCharacteristics();
						logger.error('%s - rejecting with:%s', method, return_error);
						reject(return_error);
					}
				}
			});
		});
	}

	/**
	 * Send an discovery request to this peer.
	 *
	 * @param {SignedRequest} request - A protobuf encoded byte array of type
	 *        [Proposal]{@link https://github.com/hyperledger/fabric/blob/release-1.2/protos/discovery/protocol.proto}
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *        response before rejecting the promise with a timeout error. This
	 *        overrides the default timeout of the Peer instance and the global
	 *        timeout in the config settings.
	 * @returns {Promise} A Promise for a {@link DiscoveryResponse}
	 */
	async sendDiscovery(request, timeout) {
		const method = 'sendDiscovery';
		logger.debug('%s - Start', method);
		const self = this;
		let rto = self._request_timeout;

		if (typeof timeout === 'number') {
			rto = timeout;
		}
		if (!request) {
			return Promise.reject(new Error('Missing request to send to peer discovery service'));
		}

		this._createClients();

		// by default users will have to choose to have the connection
		// checked by the wait for ready processing of the gRPC service
		if (this.useWaitForReady) {
			await this.waitForReady(this._discoveryClient);
		}

		return new Promise((resolve, reject) => {
			const send_timeout = setTimeout(() => {
				logger.error('%s - timed out after:%s', method, rto);
				return reject(new Error('REQUEST_TIMEOUT'));
			}, rto);

			self._discoveryClient.discover(request, (err, response) => {
				clearTimeout(send_timeout);
				if (err) {
					logger.debug('%s - Received discovery response from: %s status: %s', method, self._url, err);
					if (err instanceof Error) {
						err.peer = self.getCharacteristics();
						reject(err);
					} else {
						const return_error = new Error(err);
						return_error.peer = self.getCharacteristics();
						reject(return_error);
					}
				} else {
					if (response) {
						logger.debug('%s - Received discovery response from peer "%s"', method, self._url);
						response.peer = self.getCharacteristics();
						resolve(response);
					} else {
						const return_error = new Error(util.format('GRPC client failed to get a proper response from the peer "%s".', self._url));
						return_error.peer = self.getCharacteristics();
						logger.error('%s - rejecting with:%s', method, return_error);
						reject(return_error);
					}
				}
			});
		});
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {
		return 'Peer:{' +
			'url:' + this._url +
		'}';
	}

}

module.exports = Peer;
