/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
const TYPE = 'User';

const Identity = require('./Identity');
const Signer = require('./Signer');
const SigningIdentity = require('./SigningIdentity');
const sdkUtils = require('./Utils');
const logger = sdkUtils.getLogger(TYPE);
const check = sdkUtils.checkParameter;


/**
 * The User class represents users that have been enrolled and represented by
 * an enrollment certificate (ECert) and a signing key. The ECert must have
 * been signed by one of the CAs the blockchain network has been configured to trust.
 * An enrolled Admin user (having a signing key and ECert) can conduct chaincode instantiate,
 * transactions and queries with the Channel.
 *
 * User ECerts can be obtained from a CA beforehand as part of installing and instantiating
 * the application, or it can be obtained from the optional Fabric CA service via its
 * enrollment process.
 *
 * Sometimes User identities are confused with Peer identities. User identities represent
 * signing capability because it has access to the private key, while Peer identities in
 * the context of the application/SDK only has the certificate for verifying signatures.
 * An application cannot use the Peer identity to sign things because the application does not
 * have access to the Peer identity’s private key.
 *
 * @class
 */
const User = class {

	/**
	 * Constructor for a member.
	 *
	 * @param {string|Object} cfg - The member name or an object with the following attributes:
	 *   - enrollmentID {string}: user name
	 *   - name {string}: user name, if "enrollmentID" is also specified, the "name" is ignored
	 *   - roles {string[]}: optional. array of roles
	 *   - affiliation {string}: optional. affiliation with a group or organization
	 */
	constructor(cfg) {
		this.type = TYPE;
		if (typeof cfg === 'string') {
			this._name = cfg;
			this._roles = null; // string[]
			this._affiliation = '';
		} else if (cfg !== null && typeof cfg === 'object') {
			const req = cfg;
			this._name = req.enrollmentID || req.name;
			this._roles = req.roles || ['fabric.user'];
			this._affiliation = req.affiliation;
		}

		this._enrollmentSecret = '';
		this._identity = null;
		this._signingIdentity = null;
		this._mspId = '';
		this._cryptoSuite = null;
	}

	/**
	 * Get the member name.
	 * @returns {string} The member name.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the MSP Id.
	 * @returns {string} The mspid.
	 */
	getMspid() {
		return this._mspId;
	}

	/**
	 * Get the roles.
	 * @returns {string[]} The roles.
	 */
	getRoles() {
		return this._roles;
	}

	/**
	 * Get the enrollment secret.
	 * @returns {string} The password.
	 */
	getEnrollmentSecret() {
		return this._enrollmentSecret;
	}

	/**
	 * Set the roles.
	 * @param roles {string[]} The roles.
	 */
	setRoles(roles) {
		this._roles = roles;
	}

	/**
	 * Get the affiliation.
	 * @returns {string} The affiliation.
	 */
	getAffiliation() {
		return this._affiliation;
	}

	/**
	 * Set the affiliation.
	 * @param {string} affiliation The affiliation.
	 */
	setAffiliation(affiliation) {
		this._affiliation = affiliation;
	}

	/**
	 * Get the {@link Identity} object for this User instance, used to verify signatures
	 * @returns {Identity} the identity object that encapsulates the user's enrollment certificate
	 */
	getIdentity() {
		return this._identity;
	}

	/**
	 * Get the {@link SigningIdentity} object for this User instance, used to generate signatures
	 * @returns {SigningIdentity} the identity object that encapsulates the user's private key for signing
	 */
	getSigningIdentity() {
		return this._signingIdentity;
	}

	/**
	 * Set the {@link SigningIdentity} object for this User instance, used to generate signatures
	 * @param {SigningIdentity} the identity object that encapsulates the user's private key for signing
	 */
	setSigningIdentity(signingIdentity) {
		this._signingIdentity = signingIdentity;
		this._identity = signingIdentity;
	}

	/**
	 * Get the {@link module:api.CryptoSuite} cryptoSuite object for this User instance.
	 * @returns {module:api.CryptoSuite} the cryptoSuite used to store crypto and key store settings
	 */
	getCryptoSuite() {
		return this._cryptoSuite;
	}

	/**
	 * Set the cryptoSuite.
	 *
	 * When the application needs to use crypto settings or a key store other than the default,
	 * it needs to set a cryptoSuite instance that was created with the desired CryptoSuite
	 * settings and CryptoKeyStore options.
	 *
	 * @param {module:api.CryptoSuite} cryptoSuite The cryptoSuite.
	 */
	setCryptoSuite(cryptoSuite) {
		this._cryptoSuite = cryptoSuite;
	}


	/**
	 * This is a factory method. It returns a new instance of the CryptoSuite API implementation, based on the "setting"
	 * that is passed in, or if skipped, based on default values of the {@link CryptoSetting} properties.
	 *
	 * @param {CryptoSetting} setting Optional
	 * @returns {module:api.CryptoSuite} a new instance of the CryptoSuite API implementation
	 */
	static newCryptoSuite(setting) {
		return sdkUtils.newCryptoSuite(setting);
	}

	/**
	 * Set the enrollment object for this User instance
	 *
	 * @async
	 * @param {module:api.Key} privateKey the private key object
	 * @param {string} certificate the PEM-encoded string of certificate
	 * @param {string} mspId The Member Service Provider id for the local signing identity
	 * @returns {Promise} Promise for successful completion of creating the user's signing Identity
	 */
	async setEnrollment(privateKey, certificate, mspId) {
		if (typeof privateKey === 'undefined' || privateKey === null || privateKey === '') {
			throw new Error('Invalid parameter. Must have a valid private key.');
		}

		if (typeof certificate === 'undefined' || certificate === null || certificate === '') {
			throw new Error('Invalid parameter. Must have a valid certificate.');
		}

		if (typeof mspId === 'undefined' || mspId === null || mspId === '') {
			throw new Error('Invalid parameter. Must have a valid mspId.');
		}

		this._mspId = mspId;

		if (!this._cryptoSuite) {
			this._cryptoSuite = sdkUtils.newCryptoSuite();
			this._cryptoSuite.setCryptoKeyStore(sdkUtils.newCryptoKeyStore());
		}

		const pubKey = await this._cryptoSuite.createKeyFromRaw(certificate);
		this._identity = new Identity(certificate, pubKey, mspId, this._cryptoSuite);
		this._signingIdentity = new SigningIdentity(certificate, pubKey, mspId, this._cryptoSuite, new Signer(this._cryptoSuite, privateKey));
	}

	/**
	 * Determine if this name has been enrolled.
	 * @returns {boolean} True if enrolled; otherwise, false.
	 */
	isEnrolled() {
		return this._identity !== null && this._signingIdentity !== null;
	}

	/**
	 * Set the current state of this member from a string based JSON object
	 *
	 * @async
	 * @param {string} str - the member state serialized
	 * @return {Member} Promise of the unmarshalled Member object represented by the serialized string
	 */
	async fromString(str) {
		logger.debug('fromString --start');
		const state = JSON.parse(str);

		if (state.name !== this.getName()) {
			throw new Error('name mismatch: \'' + state.name + '\' does not equal \'' + this.getName() + '\'');
		}

		this._name = state.name;
		this._roles = state.roles;
		this._affiliation = state.affiliation;
		this._enrollmentSecret = state.enrollmentSecret;

		if (typeof state.mspid === 'undefined' || state.mspid === null || state.mspid === '') {
			throw new Error('Failed to find "mspid" in the deserialized state object for the user. Likely due to an outdated state store.');
		}
		this._mspId = state.mspid;

		if (!this._cryptoSuite) {
			this._cryptoSuite = sdkUtils.newCryptoSuite();
			this._cryptoSuite.setCryptoKeyStore(sdkUtils.newCryptoKeyStore());
		}

		const pubKey = this._cryptoSuite.createKeyFromRaw(state.enrollment.identity.certificate);

		this._identity = new Identity(state.enrollment.identity.certificate, pubKey, this._mspId, this._cryptoSuite);

		// during serialization (see toString() below) only the key's SKI are saved
		// swap out that for the real key from the crypto provider
		const privateKey = await this._cryptoSuite.getKey(state.enrollment.signingIdentity);

		// the key retrieved from the key store using the SKI could be a public key
		// or a private key, check to make sure it's a private key
		if (privateKey && privateKey.isPrivate()) {
			this._signingIdentity = new SigningIdentity(
				state.enrollment.identity.certificate,
				pubKey,
				this._mspId,
				this._cryptoSuite,
				new Signer(this._cryptoSuite, privateKey));

			return this;
		} else {
			throw new Error(`Private key missing from key store. Can not establish the signing identity for user ${state.name}`);
		}
	}

	/**
	 * Returns a {@link User} object with signing identities based on the
	 * private key and the corresponding x509 certificate. This allows applications
	 * to use pre-existing crypto materials (private keys and certificates) to
	 * construct user objects with signing capabilities, as an alternative to
	 * dynamically enrolling users with [fabric-ca]{@link http://hyperledger-fabric-ca.readthedocs.io/en/latest/}
	 *
	 * @async
	 * @param {UserOpts} opts - Essential information about the user
	 * @returns {User} the user object.
	 */
	static createUser(name = check('name'), password, mspid = check('mspid'), signedCertPEM = check('signedCertPEM'), privateKeyPEM) {
		logger.debug('createUser %s', name);
		const cryptoSuite = sdkUtils.newCryptoSuite();
		let privateKey = null;
		if (privateKeyPEM) {
			privateKey = cryptoSuite.createKeyFromRaw(privateKeyPEM.toString());
		}
		const pubKey = cryptoSuite.createKeyFromRaw(signedCertPEM.toString());
		const user = new User(name);
		user._enrollmentSecret = password;
		user._cryptoSuite = cryptoSuite;
		user._mspId = mspid;
		user._identity = new Identity(signedCertPEM, pubKey, mspid, cryptoSuite);
		if (privateKey) {
			user._signingIdentity = new SigningIdentity(signedCertPEM, pubKey, mspid, cryptoSuite, new Signer(cryptoSuite, privateKey));
		}

		return user;
	}

	/**
	 * Save the current state of this member as a string
	 * @return {string} The state of this member as a string
	 */
	toString() {
		const serializedEnrollment = {};
		if (this._signingIdentity) {
			serializedEnrollment.signingIdentity = this._signingIdentity._signer._key.getSKI();
		}

		if (this._identity) {
			serializedEnrollment.identity = {
				certificate: this._identity._certificate
			};
		}

		const state = {
			name: this._name,
			mspid: this._mspId,
			roles: this._roles,
			affiliation: this._affiliation,
			enrollmentSecret: this._enrollmentSecret,
			enrollment: serializedEnrollment
		};

		return JSON.stringify(state);
	}

	static isInstance(object) {
		return (typeof object._name !== 'undefined' &&
			typeof object._roles !== 'undefined' &&
			typeof object._affiliation !== 'undefined' &&
			typeof object._enrollmentSecret !== 'undefined' &&
			typeof object._identity !== 'undefined' &&
			typeof object._signingIdentity !== 'undefined' &&
			typeof object._mspId !== 'undefined' &&
			typeof object._cryptoSuite !== 'undefined');
	}
};

module.exports = User;
