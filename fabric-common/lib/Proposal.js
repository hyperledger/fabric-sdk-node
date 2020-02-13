/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Proposal';

const settle = require('promise-settle');
const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);
const fabprotos = require('fabric-protos');
const ServiceAction = require('./ServiceAction.js');

/**
 * @classdesc
 * This is an base class represents a Proposal definition and the
 * base for actions on a proposal.
 * This class allows an application to contain all proposal attributes and
 * artifacts in one place during runtime. Use the {@link Endorsement}
 * {@link Query} and {@link Commit} to endorse, query,
 * and to commit a proposal.
 *
 * @class
 */
class Proposal extends ServiceAction {
	/**
	 * Construct a Proposal object.
	 *
	 * @param {string} chaincodeId - The chaincode this proposal will execute
	 * @param {Channel} channel - The channel of this proposal
	 * @returns {Proposal} The Proposal instance.
	 */
	constructor(chaincodeId = checkParameter('chaincodeId'), channel = checkParameter('channel')) {
		super(chaincodeId);
		logger.debug(`${TYPE}.constructor[${chaincodeId}] - start `);
		this.type = TYPE;

		this.chaincodeId = chaincodeId;
		this.channel = channel;
		this.collectionsInterest = [];
		this.chaincodesCollectionsInterest = [];
	}

	/**
	 * Returns the transaction ID used for the proposal
	 *
	 * @returns {string} The transaction ID of the proposal
	 */
	getTransactionId() {
		const method = `getTransactionId[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		if (!this._action || !this._action.transactionId) {
			throw Error('The proposal has not been built');
		}

		return this._action.transactionId;
	}

	/**
	 * Returns a JSON object representing this proposals chaincodes
	 * and collections as an interest for the Discovery Service.
	 * The {@link Discovery} will use the interest to build a query
	 * request for an endorsement plan to a Peer's Discovery service.
	 * Use the {@link Proposal#addCollectionInterest} to add collections
	 * for the chaincode of this proposal.
	 * Use the {@link Proposal#addChaincodeCollectionInterest} to add
	 * chaincodes and collections that this chaincode code will call.
	 * @example
	 *    [
	 *      { name: "mychaincode", collectionNames: ["mycollection"] }
	 *    ]
	 */
	buildProposalInterest() {
		const method = `buildProposalInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		let interest = [];
		const chaincode = {};
		interest.push(chaincode);
		chaincode.name = this.chaincodeId;
		if (this.collectionsInterest.length > 0) {
			chaincode.collectionNames = this.collectionsInterest;
		}
		if (this.chaincodesCollectionsInterest.length > 0) {
			interest = interest.concat(this.chaincodesCollectionsInterest);
		}

		return interest;
	}

	/**
	 * Use this method to add collection names associated
	 * with this proposal's chaincode name. These will be
	 * used to build a Discovery interest. {@link Proposal#buildProposalInterest}
	 * @param {string} collectionName - collection name
	 */
	addCollectionInterest(collectionName) {
		const method = `addCollectionInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		if (typeof collectionName === 'string') {
			this.collectionsInterest.push(collectionName);
		} else {
			throw Error('Invalid collectionName parameter');
		}

		return this;
	}

	/**
	 * Use this method to add a chaincode name and collection names
	 * that this proposal's chaincode will call. These will be used
	 * to build a Discovery interest. {@link Proposal#buildProposalInterest}
	 * @param {string} chaincodeId - chaincode name
	 * @param  {...string} collectionNames - one or more collection names
	 */
	addChaincodeCollectionsInterest(chaincodeId, ...collectionNames) {
		const method = `addChaincodeCollectionsInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		if (typeof chaincodeId === 'string') {
			const added_chaincode = {};
			added_chaincode.name = chaincodeId;
			if (collectionNames && collectionNames.length > 0) {
				added_chaincode.collectionNames = collectionNames;
			}
			this.chaincodesCollectionsInterest.push(added_chaincode);
		} else {
			throw Error('Invalid chaincodeId parameter');
		}

		return this;
	}
	/**
	 * @typedef {Object} BuildProposalRequest
	 * @property {string} [fcn] - Optional. The function name. May be used by
	 * the chaincode to control the flow within the chaincode. Default 'invoke'
	 * @property {string[]} [args] - Optional. The arguments needed by the
	 * chaincode execution. These should be strings or byte buffers.
	 * These will be converted into byte buffers before building the protobuf
	 * object to be sent to the fabric peer for endorsement.
	 * @property {Map} [transientMap] - Optional. A map with the key value pairs
	 * of the transient data.
	 * @property {boolean} [init] - Optional. If this proposal should be an
	 * chaincode initialization request. This will set the init setting in the
	 * protobuf object sent to the peer.
	 */

	/**
	 * Use this method to build a proposal. The proposal will be stored
	 * internally and also returned as bytes. Use the bytes when signing
	 * the proposal externally. When signing the proposal externally the
	 * user object of the IdentityContext does not have to have
	 * a signing identity, only an identity that has the user's certificate is
	 * required. This identity will be used to build
	 * the protobuf objects of the proposal that must be signed later and sent
	 * to the fabric Peer for endorsement.
	 *
	 * @param {IdentityContext} idContext - Contains the {@link User} object
	 * needed to build this proposal.
	 * @param {BuildProposalRequest} request - The proposals values of the request.
	 */
	build(idContext = checkParameter('idContext'), request = {}) {
		const method = `build[${this.chaincodeId}][${this.type}]`;
		logger.debug('%s - start', method);

		const {fcn,  args = [], transientMap, init} = request;

		if (!Array.isArray(args)) {
			throw Error('Proposal parameter "args" must be an array.');
		}

		this._reset();

		if (transientMap) {
			this._action.transientMap = transientMap;
		}
		if (typeof init === 'boolean') {
			this._action.init = init;
		}

		this._action.transactionId = idContext.calculateTransactionId().transactionId;

		this._action.args = [];
		if (fcn) {
			this._action.fcn = fcn;
			this._action.args.push(Buffer.from(this._action.fcn, 'utf8'));
			logger.debug('%s - adding function %s', method, this._action.fcn);
		} else {
			logger.debug('%s - not adding function', method);
		}

		for (let i = 0; i < args.length; i++) {
			logger.debug('%s - adding arg %s', method, args[i]);
			let arg;
			if (args[i] instanceof Buffer) {
				arg = args[i];
			} else {
				const arg_as_string = args[i].toString();
				arg = Buffer.from(arg_as_string, 'utf8');
			}
			this._action.args.push(arg);
		}

		logger.debug('%s - chaincode ID:%s', method, this.chaincodeId);
		const chaincodeSpec = new fabprotos.protos.ChaincodeSpec();
		chaincodeSpec.setType(fabprotos.protos.ChaincodeSpec.Type.GOLANG);
		const chaincode_id = new fabprotos.protos.ChaincodeID();
		chaincode_id.setName(this.chaincodeId);
		chaincodeSpec.setChaincodeId(chaincode_id);
		const input = new fabprotos.protos.ChaincodeInput();
		input.setArgs(this._action.args);
		if (this._action.init) {
			input.setIsInit(true);
		}
		chaincodeSpec.setInput(input);

		const channelHeader = this.channel.buildChannelHeader(
			fabprotos.common.HeaderType.ENDORSER_TRANSACTION,
			this.chaincodeId,
			this._action.transactionId
		);

		this._action.header = this.buildHeader(idContext, channelHeader);

		// construct the ChaincodeInvocationSpec
		const cciSpec = new fabprotos.protos.ChaincodeInvocationSpec();
		cciSpec.setChaincodeSpec(chaincodeSpec);

		const cc_payload = new fabprotos.protos.ChaincodeProposalPayload();
		cc_payload.setInput(cciSpec.toBuffer());

		if (this._action.transientMap) {
			cc_payload.setTransientMap(this._action.transientMap);
		}

		this._action.proposal = new fabprotos.protos.Proposal();
		this._action.proposal.setHeader(this._action.header.toBuffer());
		this._action.proposal.setPayload(cc_payload.toBuffer());

		this._payload = this._action.proposal.toBuffer();
		return this._payload;
	}

	/**
	 * @typedef {Object} SendProposalRequest
	 * @property {Peer[]} [targets] - Optional. The peers to send the proposal.
	 * @property {ServiceHandler} - [handler] - Optional. The handler to send the proposal.
	 * @property {Number} [requestTimeout] - Optional. The request timeout
	 */

	/**
	 * @typedef {Object} ProposalResponse
	 * @property {Error[]} errors -  errors returned from the endorsement
	 * @property {EndorsementResponse[]} responses - The endorsements returned from
	 *  the endorsing peers.
	 * @property {Buffer[]} queryResults - the results as extracted from the
	 *  endorsement {@link EndorsementResponse} from an {@link Query} endorsement
	 *  that was only a query and will not be committed.
	 */

	/**
	 * @typedef {Object} EndorsementResponse
	 * This object is the protobuf object returned from the peer when doing
	 * an endorsement of a proposal. The following description is from the protobuf
	 * file fabric-protos/protos/peer/proposal_response.protos
	 * @example
// A ProposalResponse is returned from an endorser to the proposal submitter.
// The idea is that this message contains the endorser's response to the
// request of a client to perform an action over a chaincode (or more
// generically on the ledger); the response might be success/error (conveyed in
// the Response field) together with a description of the action and a
// signature over it by that endorser.  If a sufficient number of distinct
// endorsers agree on the same action and produce signature to that effect, a
// transaction can be generated and sent for ordering.
message ProposalResponse {
	// Version indicates message protocol version
	int32 version = 1;

	// Timestamp is the time that the message
	// was created as  defined by the sender
	google.protobuf.Timestamp timestamp = 2;

	// A response message indicating whether the
	// endorsement of the action was successful
	Response response = 4;

	// The payload of response. It is the bytes of ProposalResponsePayload
	bytes payload = 5;

	// The endorsement of the proposal, basically
	// the endorser's signature over the payload
	Endorsement endorsement = 6;
}

// A response with a representation similar to an HTTP response that can
// be used within another message.
message Response {
	// A status code that should follow the HTTP status codes.
	int32 status = 1;

	// A message associated with the response code.
	string message = 2;

	// A payload that can be used to include metadata with this response.
	bytes payload = 3;
}

message Endorsement {
	// Identity of the endorser (e.g. its certificate)
	bytes endorser = 1;

	// Signature of the payload included in ProposalResponse concatenated with
	// the endorser's certificate; ie, sign(ProposalResponse.payload + endorser)
	bytes signature = 2;
}
	 *
	 */

	/**
	 * Send a signed transaction proposal to peer(s)
	 *
	 * @param {SendProposalRequest} request options
	 * @returns {ProposalResponse} The results of sending
	 */
	async send(request = {}) {
		const method = `send[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		const {handler, targets, requestTimeout} = request;
		logger.debug('%s - requestTimeout %s', method, requestTimeout);
		const signedEnvelope = this.getSignedProposal();
		this._proposalResponses = [];
		this._proposalErrors = [];
		this._queryResults = [];

		if (handler) {
			logger.debug('%s - endorsing with a handler', method);
			let results;
			if (this.type === 'Query') {
				results = await handler.query(signedEnvelope, request);
			} else {
				results = await handler.endorse(signedEnvelope, request);
			}
			logger.debug('%s - have results from handler', method);
			results.forEach((result) => {
				if (result instanceof Error) {
					logger.debug('%s - result is an error: %s', method, result);
					this._proposalErrors.push(result);
				} else {
					logger.debug('%s - result is endorsed', method);
					this._proposalResponses.push(result);
				}
			});
		} else if (targets) {
			logger.debug('%s - have targets', method);
			const peers = this.channel.getTargetEndorsers(targets);
			const promises = peers.map(async (peer) => {
				return peer.sendProposal(signedEnvelope, requestTimeout);
			});

			logger.debug('%s - about to send to all peers', method);
			const results = await settle(promises);
			logger.debug('%s - have results from peers', method);
			results.forEach((result) => {
				if (result.isFulfilled()) {
					const response = result.value();
					if (response && response.response && response.response.status) {
						logger.debug('%s - Promise is fulfilled: %s', method, response.response.status);
						this._proposalResponses.push(response);
					} else if (response instanceof Error) {
						logger.debug('%s - Promise response is an error: %s', method, response);
						this._proposalErrors.push(response);
					} else {
						logger.debug('%s - Promise response is not properly formed: %j', method, response);
						this._proposalErrors.push(new Error('Missing response status'));
					}
				} else {
					logger.debug('%s - Promise is rejected: %s', method, result.reason());
					this._proposalErrors.push(result.reason());
				}
			});
		} else {
			// need to have a handler or targets defined to have a proposal endorsed
			logger.error('%s - no targets or handler', method);
			throw Error('Missing targets parameter');
		}

		const return_results =  {
			errors: this._proposalErrors,
			responses: this._proposalResponses
		};

		if (this.type === 'Query') {
			this._proposalResponses.forEach((response) => {
				if (response.endorsement && response.response && response.response.payload) {
					logger.debug('%s - have payload', method);
					this._queryResults.push(response.response.payload);
				} else {
					logger.debug('%s - no payload in query', method);
				}
			});
			return_results.queryResults = this._queryResults;
		}

		return return_results;
	}

	/**
	 * Utility method to verify a single proposal response. It checks the
	 * following aspects:
	 * <li>The endorser's identity belongs to a legitimate MSP of the channel
	 *     and can be successfully deserialized
	 * <li>The endorsement signature can be successfully verified with the
	 *     endorser's identity certificate
	 * <br><br>
	 * This method requires that the initialize method of this channel object
	 * has been called to load this channel's MSPs. The MSPs will have the
	 * trusted root certificates for this channel.
	 *
	 * @param {ProposalResponse} proposalResponse - The endorsement response
	 * from the peer,
	 * includes the endorser certificate and signature over the
	 * proposal + endorsement result + endorser certificate.
	 * @returns {boolean} A boolean value of true when both the identity and
	 * the signature are valid, false otherwise.
	 */
	verifyProposalResponse(proposalResponse = checkParameter('proposalResponse')) {
		const method = `verifyProposalResponse[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		if (proposalResponse instanceof Error) {

			return false;
		}
		if (!proposalResponse.endorsement) {
			throw new Error('Parameter must be a ProposalResponse Object');
		}
		logger.error('%s - This method needs to be implemented', method);

		throw Error(`${method} is not implemented`);
		/*
		const endorsement = proposal_response.endorsement;
		let identity;

		const sid = fabprotos.msp.SerializedIdentity.decode(endorsement.endorser);
		const mspid = sid.getMspid();
		logger.debug('%s - found mspid %s', method, mspid);
		const msp = this._msp_manager.getMSP(mspid);

		if (!msp) {
			throw new Error(`Failed to locate an MSP configuration matching the endorser identity\'s organization ${mspid} on the channel`);
		}
		logger.debug('%s - found endorser\'s MSP', method);

		try {
			identity = await msp.deserializeIdentity(endorsement.endorser, false);
			if (!identity) {
				throw new Error('Unable to find the endorser identity');
			}
		} catch (error) {
			logger.error('%s - getting endorser identity failed with: ', method, error);

			return false;
		}

		try {
			// see if the identity is trusted
			if (!identity.isValid()) {
				logger.error('Endorser identity is not valid');

				return false;
			}
			logger.debug('%s - have a valid identity', method);

			// check the signature against the endorser and payload hash
			const digest = Buffer.concat([proposal_response.payload, endorsement.endorser]);
			if (!identity.verify(digest, endorsement.signature)) {
				logger.error('%s - Proposal signature is not valid', method);

				return false;
			}
		} catch (error) {
			logger.error('%s - verify failed with: ', method, error);

			return false;
		}

		logger.debug('%s - This endorsement has both a valid identity and valid signature', method);

		return true;
		*/
	}

	/**
	 * Utility method to examine a set of proposals to check they contain
	 * the same endorsement result write sets.
	 * This will validate that the endorsing peers all agree on the result
	 * of the chaincode execution.
	 *
	 * @param {ProposalResponse[]} proposalResponses - The proposal responses
	 * from all endorsing peers
	 * @returns {boolean} True when all proposals compare equally, false otherwise.
	 */
	compareProposalResponseResults(proposalResponses = checkParameter('proposalResponses')) {
		const method = `compareProposalResponseResults[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		if (!Array.isArray(proposalResponses)) {
			throw new Error('proposalResponses must be an array, typeof=' + typeof proposalResponses);
		}
		if (proposalResponses.length === 0) {
			throw new Error('proposalResponses is empty');
		}

		if (proposalResponses.some((response) => response instanceof Error)) {

			return false;
		}

		const first_one = _getProposalResponseResults(proposalResponses[0]);
		for (let i = 1; i < proposalResponses.length; i++) {
			const next_one = _getProposalResponseResults(proposalResponses[i]);
			if (next_one.equals(first_one)) {
				logger.debug('%s - read/writes result sets match index=%s', method, i);
			} else {
				logger.error('%s - read/writes result sets do not match index=%s', method, i);

				return false;
			}
		}

		return true;
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {

		return `Proposal: {chaincodeId: ${this.chaincodeId}, channel: ${this.channel.name}}`;
	}
}

// internal utility method to decode and get the write set
// from a proposal response
function _getProposalResponseResults(proposaResponse = checkParameter('proposalResponse')) {
	if (!proposaResponse.payload) {
		throw new Error('Parameter must be a ProposalResponse Object');
	}
	const payload = fabprotos.protos.ProposalResponsePayload.decode(proposaResponse.payload);
	const extension = fabprotos.protos.ChaincodeAction.decode(payload.extension);

	// return a buffer object which has an equals method
	return extension.results.toBuffer();
}

module.exports = Proposal;
