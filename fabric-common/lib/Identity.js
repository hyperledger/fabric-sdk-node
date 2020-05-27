/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fabproto6 = require('fabric-protos');

/**
 * This interface is shared within the peer and client API of the membership service provider.
 * Identity interface defines operations associated to a "certificate".
 * That is, the public part of the identity could be thought to be a certificate,
 * and offers solely signature verification capabilities. This is to be used
 * at the client side when validating certificates that endorsements are signed
 * with, and verifying signatures that correspond to these certificates.
 *
 * @class
 */
class Identity {
	/**
	 * @param {string} certificate HEX string for the PEM encoded certificate
	 * @param {module:api.Key} publicKey The public key represented by the certificate
	 * @param {string} mspId The associated MSP's mspId that manages this identity
	 * @param {module:api.CryptoSuite} cryptoSuite The underlying {@link CryptoSuite} implementation for the digital
	 * signature algorithm
	 */
	constructor(certificate, publicKey, mspId, cryptoSuite) {

		if (!certificate) {
			throw new Error('Missing required parameter "certificate".');
		}

		if (!mspId) {
			throw new Error('Missing required parameter "mspId".');
		}

		this._certificate = certificate;
		this._publicKey = publicKey;
		this._mspId = mspId;
		this._cryptoSuite = cryptoSuite;
	}

	/**
	 * Returns the identifier of the Membser Service Provider that manages
	 * this identity in terms of being able to understand the key algorithms
	 * and have access to the trusted roots needed to validate it
	 * @returns {string}
	 */
	getMSPId() {
		return this._mspId;
	}

	/**
	 * This uses the rules that govern this identity to validate it.
	 * E.g., if it is a fabric TCert implemented as identity, validate
	 * will check the TCert signature against the assumed root certificate
	 * authority.
	 * @returns {boolean}
	 */
	isValid() {
		return true;
	}

	/**
	 * Returns the organization units this identity is related to
	 * as long as this is public information. In certain implementations
	 * this could be implemented by certain attributes that are publicly
	 * associated to that identity, or the identifier of the root certificate
	 * authority that has provided signatures on this certificate.
	 * Examples:
	 *  - OrganizationUnit of a fabric-tcert that was signed by TCA under name
	 *    "Organization 1", would be "Organization 1".
	 *  - OrganizationUnit of an alternative implementation of tcert signed by a public
	 *    CA used by organization "Organization 1", could be provided in the clear
	 *    as part of that tcert structure that this call would be able to return.
	 * @returns {string}
	 */
	getOrganizationUnits() {
		return 'dunno!';
	}

	/**
	 * Verify a signature over some message using this identity as reference
	 * @param {byte[]} msg The message to be verified
	 * @param {byte[]} signature The signature generated against the message "msg"
	 * @param {Object} opts Options include 'policy' and 'label' TODO (not implemented yet)
	 */
	verify(msg, signature, opts) {
		// TODO: retrieve the publicKey from the certificate
		if (!this._publicKey) {
			throw new Error('Missing public key for this Identity');
		}
		if (!this._cryptoSuite) {
			throw new Error('Missing cryptoSuite for this Identity');
		}
		return this._cryptoSuite.verify(this._publicKey, signature, msg);
	}

	/**
	 * Verify attributes against the given attribute spec
	 * TODO: when this method's design is finalized
	 */
	verifyAttributes(proof, attributeProofSpec) {
		return true;
	}

	/**
	 * Converts this identity to bytes
	 * @returns {Buffer} protobuf-based serialization with two fields: "mspid" and "certificate PEM bytes"
	 */
	serialize() {
		const serializedIdentity = fabproto6.msp.SerializedIdentity.create({
			mspid: this.getMSPId(),
			id_bytes: Buffer.from(this._certificate)
		});
		const serializedIdentityBuf = fabproto6.msp.SerializedIdentity.encode(serializedIdentity).finish();

		return serializedIdentityBuf;
	}
}

module.exports = Identity;