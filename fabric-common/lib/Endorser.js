/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Endorser';

const {checkParameter, getLogger} = require('./Utils.js');
const ServiceEndpoint = require('./ServiceEndpoint');
const fabproto6 = require('fabric-protos').services;

const logger = getLogger(TYPE);

/**
 * The Endorser class represents a peer in the target blockchain network.
 * The application can send endorsement proposals, and query requests through this
 * class.
 *
 * @class
 * @extends ServiceEndpoint
 */
class Endorser extends ServiceEndpoint {

	/**
	 * Construct a Endorser object with the name. A Endorser object encapsulates the
	 * properties of an endorsing peer and the interactions with it
	 * via the grpc service API. Endorser objects are used by the {@link Client} objects to
	 * send channel-agnostic requests such as querying peers for
	 * installed chaincodes, etc. They are also used by the {@link Channel} objects to
	 * send channel-aware requests such as instantiating chaincodes, and invoking
	 * transactions.
	 * Use the connect method with options to establish a
	 * connection with the fabric network endpoint.
	 *
	 * @param {string} name - The name of this Endorser
	 * @param {Client} client - The client instance
	 * @param {string} [mspid] - The mspid (organization) of this Endorser
	 * @returns {Endorser} The Endorser instance.
	 */
	constructor(name = checkParameter('name'), client = checkParameter('client'), mspid) {
		logger.debug(`${TYPE}.constructor[${name}] - start `);
		super(name, client, mspid);

		this.type = TYPE;
		this.serviceClass = fabproto6.protos.Endorser;
	}

	/**
	 * Send an endorsement proposal to an endorser. This is used to call an
	 * endorsing peer to execute a chaincode to process a transaction proposal,
	 * or runs queries.
	 *
	 * @param {Envelope} signedProposal - A signed proposal envelope that
	 *  has been signed
	 * @param {Number} timeout - A number indicating milliseconds to wait on the
	 *  response before rejecting the promise with a timeout error. This
	 *  overrides the requestTimeout config connection setting of this instance.
	 * @returns {Promise} A Promise for a Object that is the Protobuf
	 *  'protos.ProposalResponse' see fabric-protos/protos/peer/proposal_response.proto
	 */
	sendProposal(signedProposal, timeout) {
		const method = `sendProposal[${this.name}]`;
		logger.debug(`${method} - Start ----${this.name} ${this.endpoint.url} timeout:${timeout}`);

		return new Promise((resolve, reject) => {
			if (!signedProposal) {
				checkParameter('signedProposal');
			}
			if (this.connected === false) {
				throw Error(`Broadcast Client ${this.name} ${this.endpoint.url} is not connected`);
			}

			logger.debug('%s - %j', method, signedProposal);




			let rto = this.options.requestTimeout;
			if (typeof timeout === 'number') {
				rto = timeout;
			}
			const send_timeout = setTimeout(() => {
				clearTimeout(send_timeout);
				logger.error(`${method} - ${this.name} timed out after:${rto}`);
				const return_error = new Error('REQUEST TIMEOUT');
				this.getCharacteristics(return_error);
				return reject(return_error);
			}, rto);

			this.service.processProposal(signedProposal, (err, proposalResponse) => {
				clearTimeout(send_timeout);
				if (err) {
					logger.error(`${method} - Received error response from: ${this.endpoint.url} error: ${err}`);
					if (err instanceof Error) {
						this.getCharacteristics(err);
						reject(err);
					} else {
						const out_error = new Error(err);
						this.getCharacteristics(out_error);
						reject(out_error);
					}
				} else {
					if (proposalResponse) {
						logger.debug(`${method} - Received proposal response from peer "${this.endpoint.url}": status - ${proposalResponse.response && proposalResponse.response.status}`);
						if (proposalResponse.response && proposalResponse.response.status) {
							this.getCharacteristics(proposalResponse);
							resolve(proposalResponse);
						} else {
							const return_error = new Error(`GRPC service failed to get a proper response from the peer "${this.endpoint.url}".`);
							this.getCharacteristics(return_error);
							logger.error(`${method} - rejecting with:${return_error}`);
							reject(return_error);
						}
					} else {
						const return_error = new Error(`GRPC service got a null or undefined response from the peer "${this.endpoint.url}".`);
						this.getCharacteristics(return_error);
						logger.error(`${method} - rejecting with:${return_error}`);
						reject(return_error);
					}
				}
			});
		});
	}
}

module.exports = Endorser;
