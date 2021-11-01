/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'Proposal';

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
	 * @constructor
	 * @param {string} chaincodeId - The chaincode this proposal will execute
	 * @param {Channel} channel - The channel of this proposal
	 */
	constructor(chaincodeId = checkParameter('chaincodeId'), channel = checkParameter('channel')) {
		super(chaincodeId);
		logger.debug(`${TYPE}.constructor[${chaincodeId}] - start `);
		this.type = TYPE;

		this.chaincodeId = chaincodeId;
		this.channel = channel;
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

		const {fcn, args = [], transientMap, init} = request;

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

		for (const arg of args) {
			logger.debug('%s - adding arg ==>%s<==', method, arg);
			const _arg = arg instanceof Buffer ? arg : Buffer.from(arg.toString(), 'utf8');

			this._action.args.push(_arg);
		}

		// build the proposal payload
		const chaincodeID = fabproto6.protos.ChaincodeID.create({
			name: this.chaincodeId,
			version: this.chaincodeVersion || '',
			path: this.chaincodePath || '',
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
		const chaincodeInvocationSpecBuf = fabproto6.protos.ChaincodeInvocationSpec.encode(chaincodeInvocationSpec).finish();

		const fields = {
			input: chaincodeInvocationSpecBuf
		};
		if (this._action.transientMap) {
			fields.TransientMap = this._action.transientMap;
		}
		const chaincodeProposalPayload = fabproto6.protos.ChaincodeProposalPayload.create(fields);
		const chaincodeProposalPayloadBuf = fabproto6.protos.ChaincodeProposalPayload.encode(chaincodeProposalPayload).finish();

		const channelHeaderBuf = this.channel.buildChannelHeader(
			fabproto6.common.HeaderType.ENDORSER_TRANSACTION,
			{
				name: this.chaincodeId,
				version: this.chaincodeVersion || '',
				path: this.chaincodePath || '',
			},
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
	 * @property {ServiceHandler|function} handler - Required. The handler to send the proposal.
	 * @property {Number} [requestTimeout] - Optional. The request timeout
	 */

	/**
	 * @typedef {Object} ProposalResponse
	 * @property {Error[]} errors -  errors returned from the endorsement
	 * @property {EndorsementResponse[]} responses - The endorsements returned from
	 *  the endorsing peers.
	 */

	/**
	 * @typedef {Object} EndorsementResponse
	 * This object is the protobuf object returned from the peer when doing
	 * an endorsement of a proposal. See detailed description from the protobuf
	 * file fabric-protos/protos/peer/proposal_response.proto
	 *
	 */

	/**
	 * Send a signed transaction proposal to peer(s)
	 *
	 * @param {SendProposalRequest} request options
	 * @returns {ProposalResponse} The results of sending
	 */
	async send(request = {}) {
		const {handler} = request;
		const signedEnvelope = this.getSignedProposal();


		const {errors, responses} = await handler(signedEnvelope, request);
		this._proposalErrors = errors;
		this._proposalResponses = responses;

		return {errors, responses};
	}

	/**
	 * return a printable representation of this object
	 */
	toString() {

		return `Proposal: {chaincodeId: ${this.chaincodeId}, channel: ${this.channel.name}}`;
	}
}

module.exports = Proposal;
