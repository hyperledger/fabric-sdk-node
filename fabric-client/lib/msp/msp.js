'use strict';

var api = require('../api.js');
var idModule = require('./identity.js');
var Identity = idModule.Identity;
var SigningIdentity = idModule.SigningIdentity;
var utils = require('../utils.js');
var logger = utils.getLogger('msp.js');

var grpc = require('grpc');
var identityProto = grpc.load(__dirname + '/../protos/identity.proto').msp;

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
			if (!(config.signer instanceof SigningIdentity)) {
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
	 * DeserializeIdentity deserializes an identity
	 * @param {byte[]} serializedIdentity A protobuf-based serialization of an object with
	 * two fields: mspid and idBytes for certificate PEM bytes
	 * @returns {Promise} Promise for an {@link Identity} instance
	 */
	deserializeIdentity(serializedIdentity) {
		var sid = identityProto.SerializedIdentity.decode(serializedIdentity);
		var cert = sid.IdBytes.toBinary();
		logger.debug('Encoded cert from deserialized identity: %s', cert);
		return this.cryptoSuite.importKey(cert, { algorithm: api.CryptoAlgorithms.X509Certificate })
		.then((publicKey) => {
			// TODO: the id of the new Identity instance should probably be derived from the subject info in the cert?
			return new Identity('SomeDummyValue', cert, publicKey, this);
		});
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
