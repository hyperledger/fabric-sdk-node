/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const TYPE = 'ServiceAction';

const {checkParameter, getLogger} = require('./Utils.js');
const logger = getLogger(TYPE);
const IdentityContext = require('./IdentityContext.js');
const fabproto6 = require('fabric-protos');

/**
 * @classdesc
 * This is an base class that represents an action on a fabric service.
 *
 * @class
 */
const ServiceAction = class {

	/**
	 * Construct a ServiceAction base object.
	 *
	 * @returns {ServiceAction} The ServiceAction instance.
	 */
	constructor(name = checkParameter('name')) {
		this.type = TYPE;
		this.name = name;
		logger.debug(`${TYPE}.constructor - start [${name}]`);
	}

	_reset() {
		this._action = {};
		this._action.init = false;
		this._payload = null; // bytes
		this._signature = null; // bytes
	}

	/**
	 * Use this method must be implemented to build an action that will
	 * require a signature and then be sent to the service.
	 */
	build() {
		throw Error('"build" method must be implemented');
	}


	/**
	 * Use this method with an IdentityContext that contains a User that has
	 * a Signing Identity.
	 * OR
	 * Use this method with a byte[] to set the signature
	 * when the application has done the signed externally.
	 * Use the results of the build as the bytes that will be signed.
	 * @param {IdentityContext | byte[]} param - When 'param' is a
	 * {@link IdentityContext} the signing identity of the user
	 *  will sign the current build bytes.
	 *  When the 'param' is a byte[], the bytes will be used as the final
	 *  commit signature.
	 */
	sign(param = checkParameter('param')) {
		const method = `sign[${this.type}:${this.name}]`;
		logger.debug('%s - start', method);
		if (!this._payload) {
			throw Error('The send payload has not been built');
		}
		if (param.type === IdentityContext.TYPE) {
			this._signature = Buffer.from(param.sign(this._payload));
		} else if (param instanceof Buffer) {
			this._signature = param;
		} else {
			throw Error('param is an unknown signer or signature type');
		}

		logger.debug('%s - end', method);
		return this;
	}

	/**
	 * implementing class must implement
	 */
	send() {
		throw Error('"send" method must be implemented');
	}

	/*
	 * return a signed proposal from the signature and the payload as bytes
	 *
	 * This method is not intended for use by an application. It will be used
	 * by the send method of the super class.
	 * @returns {object} An object with the signature and the payload bytes
	 */
	getSignedProposal() {
		const method = `getSignedProposal[${this.type}:${this.name}]`;
		logger.debug('%s - start', method);

		this._checkPayloadAndSignature();

		const signedProposal = fabproto6.protos.SignedProposal.create({
			signature: this._signature,
			proposal_bytes: this._payload
		});

		// const signedProposal = {
		// 	signature: this._signature,
		// 	proposalBytes: this._payload
		// };

		return signedProposal;
	}

	/*
	 * return a signed envelope from the signature and the payload as bytes
	 *
	 * This method is not intended for use by an application. It will be used
	 * by the send method of the super class.
	 * @returns {object} An object with the signature and the payload bytes
	 */
	getSignedEnvelope() {
		const method = `getSignedEnvelope[${this.type}:${this.name}]`;
		logger.debug(`${method} - start`);

		this._checkPayloadAndSignature();

		const envelope = {
			signature: this._signature,
			payload: this._payload
		};

		return envelope;
	}

	_checkPayloadAndSignature() {
		if (!this._payload) {
			throw Error('The send payload has not been built');
		}
		if (!this._signature) {
			throw Error('The send payload has not been signed');
		}
	}

	/*
	 * This function will build the common header
	 */
	buildHeader(idContext, channelHeaderBuf) {
		const method = 'buildHeader';
		logger.debug('%s - start', method);

		const signatureHeader = fabproto6.common.SignatureHeader.create({
			creator: idContext.serializeIdentity(),
			nonce: idContext.nonce
		});
		const signatureHeaderBuf = fabproto6.common.SignatureHeader.encode(signatureHeader).finish();

		const header = fabproto6.common.Header.create({
			signature_header: signatureHeaderBuf,
			channel_header: channelHeaderBuf
		});

		return header;
	}

	/**
	 * implementing class must implement
	 */
	toString() {
		throw Error('"toString" method must be implemented');
	}
};

module.exports = ServiceAction;
