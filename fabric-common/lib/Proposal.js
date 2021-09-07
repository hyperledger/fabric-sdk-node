/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Proposal';

const settle = require('promise-settle');
const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);
const fabproto6 = require('fabric-protos');

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

		// to be used to build a discovery interest
		this.noPrivateReads = false;
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
	 * Returns a JSON object representing this proposal's chaincodes,
	 * collections and the no private reads as an "interest" for the
	 * Discovery Service.
	 * The {@link Discovery} will use an interest to build a query
	 * request for an endorsement plan to a Peer's Discovery service.
	 * Use the {@link Proposal#addCollectionInterest} to add collections
	 * for the chaincode of this proposal.
	 * Use the {@link Proposal#setNoPrivateReads} to set this "no private reads"
	 * setting for this proposal's chaincode. The default will be false
	 * when not set.
	 * Use the {@link Proposal#addChaincodeCollectionInterest} to add
	 * chaincodes and collections that this chaincode code will call.
	 * @example
	 *    [
	 *      { name: "mychaincode", collectionNames: ["mycollection"] }
	 *    ]
	 * @example
	 *    [
	 *      { name: "mychaincode", collectionNames: ["mycollection"], noPrivateReads: true }
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
		chaincode.noPrivateReads = this.noPrivateReads;
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
	 * Use this method to set the "no private reads" of the discovery hint
	 * (interest) for the chaincode of this proposal.
	 * @param {boolean} noPrivateReads Indicates we do not need to read from private data
	 */
	setNoPrivateReads(noPrivateReads) {
		const method = `setNoPrivateReads[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		if (typeof noPrivateReads === 'boolean') {
			this.noPrivateReads = noPrivateReads;
		} else {
			throw Error(`The "no private reads" setting must be boolean. :: ${noPrivateReads}`);
		}
	}

	/**
	 * Use this method to add a chaincode name and the collection names
	 * that this proposal's chaincode will call along with the no private read
	 * setting. These will be used to build a Discovery interest when this proposal
	 * is used with the Discovery Service.
	 * @param {string} chaincodeId - chaincode name
	 * @param {boolean} noPrivateReads Indicates we do not need to read from private data
	 * @param  {...string} collectionNames - one or more collection names
	 */
	addChaincodeNoPrivateReadsCollectionsInterest(chaincodeId, noPrivateReads, ...collectionNames) {
		const method = `addChaincodeCollectionsInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);
		if (typeof chaincodeId === 'string') {
			const added_chaincode = {};
			added_chaincode.name = chaincodeId;
			added_chaincode.noPrivateReads = noPrivateReads ? true : false;
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
	 * Use this method to add a chaincode name and collection names
	 * that this proposal's chaincode will call. These will be used
	 * to build a Discovery interest when this proposal is used with
	 * the Discovery Service.
	 * @param {string} chaincodeId - chaincode name
	 * @param  {...string} collectionNames - one or more collection names
	 */
	addChaincodeCollectionsInterest(chaincodeId, ...collectionNames) {
		const method = `addChaincodeCollectionsInterest[${this.chaincodeId}]`;
		logger.debug('%s - start', method);

		return this.addChaincodeNoPrivateReadsCollectionsInterest(chaincodeId, false, ...collectionNames);
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
			logger.debug('%s - adding transientMap', method);
			this._action.transientMap = transientMap;
		}
		if (typeof init === 'boolean') {
			this._action.init = init;
		}

		if (request.generateTransactionId !== false) {
			idContext.calculateTransactionId();
		}
		this._action.transactionId = idContext.transactionId;

		this._action.args = [];
		if (fcn) {
			this._action.fcn = fcn;
			this._action.args.push(Buffer.from(this._action.fcn, 'utf8'));
			logger.debug('%s - adding function %s', method, this._action.fcn);
		} else {
			logger.debug('%s - not adding function', method);
		}

		for (let i = 0; i < args.length; i++) {
			logger.debug('%s - adding arg ==>%s<==', method, args[i]);
			let arg;
			if (args[i] instanceof Buffer) {
				arg = args[i];
			} else {
				const arg_as_string = args[i].toString();
				arg = Buffer.from(arg_as_string, 'utf8');
			}
			this._action.args.push(arg);
		}

		// build the proposal payload
		const chaincodeID = fabproto6.protos.ChaincodeID.create({
			name: this.chaincodeId
		});

		const chaincodeInput = fabproto6.protos.ChaincodeInput.create({
			args: this._action.args,
			is_init: this._action.init
		});

		const chaincodeSpec = fabproto6.protos.ChaincodeSpec.create({
			type: fabproto6.protos.ChaincodeSpec.Type.GOLANG,
			chaincode_id: chaincodeID,
			input: chaincodeInput
		});

		const chaincodeInvocationSpec = fabproto6.protos.ChaincodeInvocationSpec.create({
			chaincode_spec: chaincodeSpec
		});
		const chaincodeInvocationSpecBuf = fabproto6.protos.ChaincodeInvocationSpec.encode(
			chaincodeInvocationSpec
		).finish();

		const fields = {
			input: chaincodeInvocationSpecBuf
		};
		if (this._action.transientMap) {
			fields.TransientMap = this._action.transientMap;
		}
		const chaincodeProposalPayload = fabproto6.protos.ChaincodeProposalPayload.create(
			fields
		);
		const chaincodeProposalPayloadBuf = fabproto6.protos.ChaincodeProposalPayload.encode(
			chaincodeProposalPayload
		).finish();

		const channelHeaderBuf = this.channel.buildChannelHeader(
			fabproto6.common.HeaderType.ENDORSER_TRANSACTION,
			this.chaincodeId,
			this._action.transactionId
		);

		// save the header for use by the commit
		this._action.header = this.buildHeader(idContext, channelHeaderBuf);

		const headerBuf = fabproto6.common.Header.encode(this._action.header).finish();

		this._action.proposal = fabproto6.protos.Proposal.create({
			header: headerBuf,
			payload: chaincodeProposalPayloadBuf
		});
		this._payload = fabproto6.protos.Proposal.encode(this._action.proposal).finish();

		return this._payload;
	}

	/**
	 * @typedef {Object} SendProposalRequest
	 * @property {Endorser[]} [targets] - Optional. The peers to send the proposal.
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
			const promises = [];
			for (const peer of peers) {
				if (peer.hasChaincode(this.chaincodeId)) {
					promises.push(peer.sendProposal(signedEnvelope, requestTimeout));
				} else {
					const chaincodeError = new Error(`Peer ${peer.name} is not running chaincode ${this.chaincodeId}`);
					peer.getCharacteristics(chaincodeError);
					promises.push(Promise.reject(chaincodeError));
				}
			}

			logger.debug('%s - about to send to all peers', method);
			const results = await settle(promises);
			results.forEach((result) => {
				if (result.isFulfilled()) {
					const response = result.value();
					if (response && response.response && response.response.status) {
						logger.debug('%s - Promise is fulfilled: status:%s message:%s', method, response.response.status, response.response.message);
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

		const sid = fabproto6.msp.SerializedIdentity.decode(endorsement.endorser);
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
	 * return a printable representation of this object
	 */
	toString() {

		return `Proposal: {chaincodeId: ${this.chaincodeId}, channel: ${this.channel.name}}`;
	}
}

module.exports = Proposal;
