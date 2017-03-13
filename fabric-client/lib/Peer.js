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
 * chain and chaincode levels.
 *
 * @class
 */
var Peer = class extends Remote {

	/**
	 * Constructs a Peer given its endpoint configuration settings.
	 *
	 * @param {string} url The URL with format of "grpcs://host:port".
	 * @param {Object} opts The options for the connection to the peer.
	 */
	constructor(url, opts) {
		super(url, opts);
		logger.info('Peer.const - url: %s options ',url, this._options);
		this._endorserClient = new _serviceProto.Endorser(this._endpoint.addr, this._endpoint.creds, this._options);
		this._name = null;
		this._roles = [];
	}

	/**
	 * Since practically all Peers are event producers, when constructing a Peer instance,
	 * an application can designate it as the event source for the application. Typically
	 * only one of the Peers on a Chain needs to be the event source, because all Peers on
	 * the Chain produce the same events. This method tells the SDK which Peer(s) to use as
	 * the event source for the client application. It is the responsibility of the SDK to
	 * manage the connection lifecycle to the Peer’s EventHub. It is the responsibility of
	 * the Client Application to understand and inform the selected Peer as to which event
	 * types it wants to receive and the call back functions to use.
	 * @returns {Promise} This gives the app a handle to attach “success” and “error” listeners
	 */
	connectEventSource() {
		//to do
	}

	/**
	 * A network call that discovers if at least one listener has been connected to the target
	 * Peer for a given event. This helps application instance to decide whether it needs to
	 * connect to the event source in a crash recovery or multiple instance instantiation.
	 * @param {string} eventName required
	 * @param {Chain} chain optional
	 * @result {boolean} Whether the said event has been listened on by some application instance on that chain.
	 */
	isEventListened(event, chain) {
		//to do
	}

	/**
	 * For a Peer that is connected to eventSource, the addListener registers an EventCallBack for a
	 * set of event types. addListener can be invoked multiple times to support differing EventCallBack
	 * functions receiving different types of events.
	 *
	 * Note that the parameters below are optional in certain languages, like Java, that constructs an
	 * instance of a listener interface, and pass in that instance as the parameter.
	 * @param {string} eventType : ie. Block, Chaincode, Transaction
	 * @param  {object} eventTypeData : Object Specific for event type as necessary, currently needed
	 * for “Chaincode” event type, specifying a matching pattern to the event name set in the chaincode(s)
	 * being executed on the target Peer, and for “Transaction” event type, specifying the transaction ID
	 * @param {class} eventCallback Client Application class registering for the callback.
	 * @returns {string} An ID reference to the event listener.
	 */
	addListener(eventType, eventTypeData, eventCallback) {
		//to do
	}

	/**
	 * Unregisters a listener.
	 * @param {string} eventListenerRef Reference returned by SDK for event listener.
	 * @return {boolean} Success / Failure status
	 */
	removeListener() {
		//to do
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
	 * Get the user’s roles the Peer participates in. It’s an array of possible values
	 * in “client”, and “auditor”. The member service defines two more roles reserved
	 * for peer membership: “peer” and “validator”, which are not exposed to the applications.
	 * @returns {string[]} The roles for this user.
	 */
	getRoles() {
		return this._roles();
	}

	/**
	 * Set the user’s roles the Peer participates in. See getRoles() for legitimate values.
	 * @param {string[]} roles The list of roles for the user.
	 */
	setRoles(roles) {
		this._roles = roles;
	}

	/**
	 * Returns the Peer's enrollment certificate.
	 * @returns {object} Certificate in PEM format signed by the trusted CA
	 */
	getEnrollmentCertificate() {

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

		// Send the transaction to the peer node via grpc
		// The rpc specification on the peer side is:
		//     rpc ProcessProposal(Proposal) returns (ProposalResponse) {}
		return new Promise(function(resolve, reject) {
			self._endorserClient.processProposal(proposal, function(err, proposalResponse) {
				if (err) {
					logger.error('GRPC client got an error response from the peer "%s". %s', self._url, err.stack ? err.stack : err);
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
