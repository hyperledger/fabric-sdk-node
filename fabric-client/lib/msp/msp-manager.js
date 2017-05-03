/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var util = require('util');
var path = require('path');
var grpc = require('grpc');

var MSP = require('./msp.js');
var utils = require('../utils.js');
var logger = utils.getLogger('MSPManager.js');
var idModule = require('./identity.js');

var SigningIdentity = idModule.SigningIdentity;
var Signer = idModule.Signer;

var mspProto = grpc.load(path.join(__dirname, '../protos/msp/msp_config.proto')).msp;
var identityProto = grpc.load(path.join(__dirname, '../protos/msp/identities.proto')).msp;

/**
 * MSPManager is an interface defining a manager of one or more MSPs. This essentially acts
 * as a mediator to MSP calls and routes MSP related calls to the appropriate MSP. This object
 * is immutable, it is initialized once and never changed.
 *
 * @class
 */
var MSPManager = class {
	constructor() {
		this._msps = {};
	}

	/**
	 * Instantiates MSPs for validating identities (like the endorsor in the ProposalResponse). The
	 * MSPs loaded via this method require the CA certificate representing the Certificate
	 * Authority that signed the identities to be validated. They also optionally contain the
	 * certificates for the administrators of the organization that the CA certs represent.
	 *
	 * @param {protos/msp/mspconfig.proto} mspConfigs An array of MSPConfig objects as defined by the
	 *   protobuf protos/msp/mspconfig.proto
	 */
	loadMSPs(mspConfigs) {
		logger.debug('loadMSPs - start number of msps=%s',mspConfigs.length);
		var self = this;
		if (!mspConfigs || !Array.isArray(mspConfigs))
			throw new Error('"mspConfigs" argument must be an array');

		mspConfigs.forEach((config) => {
			if (typeof config.getType() !== 'number' || config.getType() !== 0)
				throw new Error(util.format('MSP Configuration object type not supported: %s', config.getType()));

			if (!config.getConfig || !config.getConfig())
				throw new Error('MSP Configuration object missing the payload in the "Config" property');

			var fabricConfig = mspProto.FabricMSPConfig.decode(config.getConfig());

			if (!fabricConfig.getName())
				throw new Error('MSP Configuration does not have a name');

			// with this method we are only dealing with verifying MSPs, not local MSPs. Local MSPs are instantiated
			// from user enrollment materials (see User class). For verifying MSPs the root certificates are always
			// required
			if (!fabricConfig.getRootCerts())
				throw new Error('MSP Configuration does not have any root certificates required for validating signing certificates');

			// TODO: for now using application-scope defaults but crypto parameters like key size, hash family
			// and digital signature algorithm should be from the config itself
			var cs = utils.newCryptoSuite();
			cs.setCryptoKeyStore(utils.newCryptoKeyStore());

			// get the application org names
			var orgs = [];
			let org_units = fabricConfig.getOrganizationalUnitIdentifiers();
			if(org_units) for(let i = 0; i < org_units.length; i++) {
				let org_unit = org_units[i];
				let org_id = org_unit.organizational_unit_identifier;
				logger.debug('loadMSPs - found org of :: %s',org_id);
				orgs.push(org_id);
			}

			var newMSP = new MSP({
				rootCerts: fabricConfig.getRootCerts(),
				intermediateCerts: fabricConfig.getIntermediateCerts(),
				admins: fabricConfig.getAdmins(),
				id: fabricConfig.getName(),
				orgs : orgs,
				cryptoSuite: cs
			});
			logger.debug('loadMSPs - found msp=',newMSP.getId());
			//will eliminate duplicates
			self._msps[fabricConfig.getName()] = newMSP;
		});
	}

	/**
	 * Create and add MSP instance to this manager according to configuration information
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
	 *@return {MSP} The newly created MSP instance
	 */
	addMSP(config) {
		if(!config.cryptoSuite) config.cryptoSuite = utils.newCryptoSuite();
		var msp = new MSP(config);
		logger.debug('addMSP - msp=',msp.getId());
		this._msps[msp.getId()] = msp;
		return msp;
	}

	/**
	 * Returns the validating MSPs. Note that this does NOT return the local MSP
	 */
	getMSPs() {
		return this._msps;
	}

	/**
	 * Returns a validating MSP
	 */
	getMSP(id) {
		return this._msps[id];
	}

	/**
	 * DeserializeIdentity deserializes an identity
	 * @param {byte[]} serializedIdentity A protobuf-based serialization of an object with
	 * two fields: mspid and idBytes for certificate PEM bytes
	 * @returns {Promise} Promise for an {@link Identity} instance
	 */
	deserializeIdentity(serializedIdentity) {
		var sid = identityProto.SerializedIdentity.decode(serializedIdentity);
		var mspid = sid.getMspid();
		var msp = this._msps[mspid];

		if (!msp)
			throw new Error(util.format('Failed to locate an MSP instance matching the requested id "%s" in the deserialized identity', mspid));

		return msp.deserializeIdentity(serializedIdentity);
	}
};

module.exports = MSPManager;
