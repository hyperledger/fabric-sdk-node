/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

var api = require('../api.js');
var idModule = require('./identity.js');
var Identity = idModule.Identity;
var SigningIdentity = idModule.SigningIdentity;
var utils = require('../utils.js');
var logger = utils.getLogger('msp.js');

var grpc = require('grpc');
var identityProto = grpc.load(__dirname + '/../protos/msp/identities.proto').msp;
var _mspConfigProto = grpc.load(__dirname + '/../protos/msp/msp_config.proto').msp;


/**
 * MSP is the minimal Membership Service Provider Interface to be implemented
 * to manage identities (in terms of signing and signature verification) represented
 * by private keys and certificates generated from different algorithms (ECDSA, RSA, etc)
 * and PKIs (software-managed or HSM based)
 * @class
 */
var MSP = class {
	/**
	 * Setup the MSP instance according to configuration information
	 * @param {Object} config A configuration object specific to the implementation. For this
	 * implementation it uses the following fields:
	 *		<br>`rootCerts`: array of {@link Identity} representing trust anchors for validating
	 *           signing certificates. Required for MSPs used in verifying signatures
	 *		<br>`intermediateCerts`: array of {@link Identity} representing trust anchors for validating
	 *           signing certificates. optional for MSPs used in verifying signatures
	 *		<br>`admins`: array of {@link Identity} representing admin privileges
	 *		<br>`signer`: {@link SigningIdentity} signing identity. Required for MSPs used in signing
	 *		<br>`id`: {string} value for the identifier of this instance
	 *		<br>`orgs`: {string} array of organizational unit identifiers
	 *		<br>`cryptoSuite': the underlying {@link module:api.CryptoSuite} for crypto primitive operations
	 */
	constructor(config) {
		logger.debug('const - start');
		if (!config)
			throw new Error('Missing required parameter "config"');

		if (!config.id)
			throw new Error('Parameter "config" missing required field "id"');

		if (!config.cryptoSuite)
			throw new Error('Parameter "config" missing required field "cryptoSuite"');

		if (typeof config.signer !== 'undefined') {
			// when constructing local msp, a signer property is required and it must be an instance of SigningIdentity
			if (!(SigningIdentity.isInstance(config.signer))) {
				throw new Error('Parameter "signer" must be an instance of SigningIdentity');
			}
		}

		this._rootCerts = config.rootCerts;
		this._intermediateCerts = config.intermediateCerts;
		this._signer = config.signer;
		this._admins = config.admins;
		this.cryptoSuite = config.cryptoSuite;
		this._id = config.id;
		this._organization_units = config.orgs;
		this._tls_root_certs = config.tls_root_certs;
		this._tls_intermediate_certs = config.tls_intermediate_certs;
	}

	/**
	 * Get provider identifier
	 * @returns {string}
	 */
	getId() {
		return this._id;
	}

	/**
	 * Get organizational unit identifiers
	 * @returns {string[]}
	 */
	getOrganizationUnits() {
		return this._organization_units;
	}

	/**
	 * Obtain the policy to govern changes
	 * @returns {Object}
	 */
	getPolicy() {
		throw new Error('Not implemented yet');
	}

	/**
	 * Returns a signing identity corresponding to the provided identifier
	 * @param {string} identifier The identifier of the requested identity object
	 * @returns {SigningIdentity}
	 */
	getSigningIdentity(identifier) {
		throw new Error('Not implemented yet');
	}

	/**
	 * Returns the default signing identity
	 * @returns {SigningIdentity}
	 */
	getDefaultSigningIdentity() {
		return this._signer;
	}

	/**
	 * Returns the Protobuf representation of this MSP Config
	 */
	toProtobuf() {
		var proto_msp_config = new _mspConfigProto.MSPConfig();
		proto_msp_config.setType(0); //FABRIC
		var proto_fabric_msp_config = new _mspConfigProto.FabricMSPConfig();
		proto_fabric_msp_config.setName(this._id);
		proto_fabric_msp_config.setRootCerts(this._rootCerts);
		if(this._intermediateCerts) {
			proto_fabric_msp_config.setIntermediateCerts(this._intermediateCerts);
		}
		if(this._admins) {
			proto_fabric_msp_config.setAdmins(this._admins);
		}
		if(this._organization_units) {
			//organizational_unit_identifiers
			proto_fabric_msp_config.setOrganizationalUnitIdentifiers(this._organization_units);
		}
		if(this._tls_root_certs) {
			proto_fabric_msp_config.setTlsRootCerts(this._tls_root_certs);
		}
		if(this._tls_intermediate_certs) {
			proto_fabric_msp_config.getTlsIntermediateCerts(this._tls_intermediate_certs);
		}
		proto_msp_config.setConfig(proto_fabric_msp_config.toBuffer());
		return proto_msp_config;
	}

	/**
	 * DeserializeIdentity deserializes an identity
	 * @param {byte[]} serializedIdentity - A protobuf-based serialization of an object with
	 * 	      two fields: mspid and idBytes for certificate PEM bytes
	 * @param {boolean} storeKey - if the user should be stored in the key store. Only when
	 *        false will a promise not be returned
	 * @returns {Promise} Promise for an {@link Identity} instance or
	 *           or the Identity object itself if "storeKey" argument is false
	 */
	deserializeIdentity(serializedIdentity, storeKey) {
		logger.debug('importKey - start');
		var store_key = true; //default
		// if storing is not required and therefore a promise will not be returned
		// then storeKey must be set to false;
		if(typeof storeKey === 'boolean') {
			store_key = storeKey;
		}
		var sid = identityProto.SerializedIdentity.decode(serializedIdentity);
		var cert = sid.getIdBytes().toBinary();
		logger.debug('Encoded cert from deserialized identity: %s', cert);
		if(!store_key) {
			var publicKey =this.cryptoSuite.importKey(cert, { algorithm: api.CryptoAlgorithms.X509Certificate, ephemeral: true });
			var sdk_identity = new Identity(cert, publicKey, this.getId(), this.cryptoSuite);
			return sdk_identity;
		}
		else {
			return this.cryptoSuite.importKey(cert, { algorithm: api.CryptoAlgorithms.X509Certificate })
			.then((publicKey) => {
				return new Identity(cert, publicKey, this.getId(), this.cryptoSuite);
			});
		}
	}

	/**
	 * Checks whether the supplied identity is valid
	 * @param {Identity} id
	 * @returns {boolean}
	 */
	validate(id) {
		return true;
	}

};

module.exports = MSP;
